const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005; // Use port 3005 for the warehouse module
const JWT_SECRET = process.env.JWT_SECRET || 'armazem-secret-key-123';

app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'armazem.sqlite');
let db;

try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);
  console.log('Conectado ao banco de dados SQLite do Armazém via better-sqlite3.');
} catch (e) {
  console.log('better-sqlite3 não encontrado. Tentando carregar node:sqlite nativo...');
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbPath);
  console.log('Conectado ao banco de dados SQLite do Armazém via node:sqlite.');
}

initDb();

function initDb() {
    // Users table
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      name TEXT,
      must_change_password INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migração: Adiciona a coluna se ela não existir (para bancos antigos)
    try {
        // Apenas para não dar erro se já existir, mas não vamos usar a lógica
    } catch (e) { }

    // Stock Exits table
    db.exec(`CREATE TABLE IF NOT EXISTS stock_exits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT,
      quantity INTEGER,
      store TEXT,
      exit_date DATE,
      operator_id INTEGER,
      unit_price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(operator_id) REFERENCES users(id)
    )`);

    // Migração: Adiciona unit_price se não existir
    try {
        db.prepare("ALTER TABLE stock_exits ADD COLUMN unit_price REAL DEFAULT 0").run();
        console.log('Coluna unit_price adicionada à tabela stock_exits.');
    } catch (e) {
        // Coluna já existe
    }

    // Products table (Learning System)
    db.exec(`CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT,
      weight REAL,
      width REAL,
      height REAL,
      length REAL,
      ncm TEXT,
      cest TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create default user if not exists
    const row = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
    if (!row) {
        const hashedPassword = bcrypt.hashSync('senha123', 10);
        db.prepare("INSERT INTO users (username, password, name, must_change_password) VALUES (?, ?, ?, ?)").run('admin', hashedPassword, 'Administrador do Armazém', 0);
        console.log('Usuário admin padrão criado: admin / senha123');
    }
}

// Middleware de Autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    const mustChange = !!user.must_change_password;
    console.log(`Usuário ${username} logado. Precisa trocar senha? ${mustChange}`);
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        name: user.name,
        mustChangePassword: !!user.must_change_password
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change Password
app.post('/api/change-password', authenticateToken, (req, res) => {
  const { newPassword } = req.body;
  const userId = req.user.id;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  try {
    db.prepare("UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?").run(hashedPassword, userId);
    res.json({ message: 'Senha atualizada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Stock Exits
app.get('/api/exits', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare(`
        SELECT e.*, u.name as operator_name 
        FROM stock_exits e 
        JOIN users u ON e.operator_id = u.id 
        ORDER BY e.created_at DESC
      `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register Stock Exit
app.post('/api/exits', authenticateToken, (req, res) => {
  const { sku, quantity, store, date, unit_price } = req.body;
  const operator_id = req.user.id; 

  try {
    const info = db.prepare(
        "INSERT INTO stock_exits (sku, quantity, store, exit_date, operator_id, unit_price) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(sku, quantity, store, date, operator_id, unit_price || 0);
    res.status(201).json({ id: info.lastInsertRowid, sku, quantity, store, date, unit_price: unit_price || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create User (Only for management, for now simplified)
app.post('/api/users', async (req, res) => {
  const { username, password, name } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  try {
    const info = db.prepare("INSERT INTO users (username, password, name) VALUES (?, ?, ?)").run(username, hashedPassword, name);
    res.status(201).json({ id: info.lastInsertRowid, username, name });
  } catch (err) {
    res.status(500).json({ error: 'Usuário já existe' });
  }
});



// Get all users
app.get('/api/users', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare("SELECT id, username, name, created_at FROM users").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // Impedir exclusão do admin (ID 1)
  if (parseInt(id) === 1) {
    return res.status(403).json({ error: 'O administrador principal não pode ser excluído.' });
  }

  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ message: 'Usuário excluído com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PRODUCTS DATABASE (LEARNING SYSTEM)

// Save/Update Product
app.post('/api/products', (req, res) => {
  const { sku, name, weight, dimensions, ncm, cest } = req.body;
  const { width, height, length } = dimensions || { width: 0, height: 0, length: 0 };

  try {
    db.prepare(`
        INSERT INTO products (sku, name, weight, width, height, length, ncm, cest)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sku) DO UPDATE SET
          name=excluded.name,
          weight=excluded.weight,
          width=excluded.width,
          height=excluded.height,
          length=excluded.length,
          ncm=excluded.ncm,
          cest=excluded.cest
      `).run(sku, name, weight, width, height, length, ncm, cest);
    res.status(200).json({ message: 'Produto salvo com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search Product in DB
app.get('/api/products/:query', (req, res) => {
  const query = req.params.query;
  try {
    const row = db.prepare("SELECT * FROM products WHERE sku = ? OR name LIKE ?").get(query, `%${query}%`);
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor do Armazém rodando na porta ${PORT}`);
});
