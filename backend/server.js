const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
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
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco do Armazém:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite do Armazém.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Stock Exits table
    db.run(`CREATE TABLE IF NOT EXISTS stock_exits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT,
      quantity INTEGER,
      store TEXT,
      exit_date DATE,
      operator_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(operator_id) REFERENCES users(id)
    )`);

    // Products table (Learning System)
    db.run(`CREATE TABLE IF NOT EXISTS products (
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
    db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
      if (!row) {
        const hashedPassword = await bcrypt.hash('senha123', 10);
        db.run("INSERT INTO users (username, password, name) VALUES (?, ?, ?)", 
          ['admin', hashedPassword, 'Administrador do Armazém']);
        console.log('Usuário admin padrão criado: admin / senha123');
      }
    });
  });
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
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
  });
});

// Get Stock Exits
app.get('/api/exits', authenticateToken, (req, res) => {
  db.all(`
    SELECT e.*, u.name as operator_name 
    FROM stock_exits e 
    JOIN users u ON e.operator_id = u.id 
    ORDER BY e.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Register Stock Exit
app.post('/api/exits', authenticateToken, (req, res) => {
  const { sku, quantity, store, date } = req.body;
  const operator_id = req.user.id;

  db.run(
    "INSERT INTO stock_exits (sku, quantity, store, exit_date, operator_id) VALUES (?, ?, ?, ?, ?)",
    [sku, quantity, store, date, operator_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, sku, quantity, store, date });
    }
  );
});

// Create User (Only for management, for now simplified)
app.post('/api/users', async (req, res) => {
  const { username, password, name } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run("INSERT INTO users (username, password, name) VALUES (?, ?, ?)", 
    [username, hashedPassword, name], 
    function(err) {
      if (err) return res.status(500).json({ error: 'Usuário já existe' });
      res.status(201).json({ id: this.lastID, username, name });
    }
  );
});

// Get all users
app.get('/api/users', authenticateToken, (req, res) => {
  db.all("SELECT id, username, name, created_at FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// PRODUCTS DATABASE (LEARNING SYSTEM)

// Save/Update Product
app.post('/api/products', authenticateToken, (req, res) => {
  const { sku, name, weight, dimensions, ncm, cest } = req.body;
  const { width, height, length } = dimensions || { width: 0, height: 0, length: 0 };

  db.run(`
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
  `, [sku, name, weight, width, height, length, ncm, cest], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Produto salvo com sucesso!' });
  });
});

// Search Product in DB
app.get('/api/products/:query', authenticateToken, (req, res) => {
  const query = req.params.query;
  db.get("SELECT * FROM products WHERE sku = ? OR name LIKE ?", [query, `%${query}%`], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || null);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor do Armazém rodando na porta ${PORT}`);
});
