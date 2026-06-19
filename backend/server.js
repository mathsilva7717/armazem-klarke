const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005; // Use port 3005 for the warehouse module
const JWT_SECRET = process.env.JWT_SECRET || 'armazem-secret-key-123';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists on start
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Cabeçalhos de Segurança (Contra Clickjacking, XSS, MIME Sniffing)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Content Security Policy básico
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://wa.me;");
  next();
});

// Rate Limiting Customizado em Memória (Proteção contra DDoS/Brute Force)
const rateLimit = {};
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_REQUESTS = 300; // Limite de 300 requisições por IP a cada 15 min

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
  } else {
    if (now > rateLimit[ip].resetTime) {
      rateLimit[ip] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    } else {
      rateLimit[ip].count++;
      if (rateLimit[ip].count > MAX_REQUESTS) {
        console.warn(`[SECURITY] Rate limit excedido para o IP: ${ip}`);
        return res.status(429).json({ error: 'Muitas requisições do seu IP. Tente novamente mais tarde.' });
      }
    }
  }
  next();
});

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
      is_admin INTEGER DEFAULT 0,
      role TEXT DEFAULT 'operator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migração: Adiciona a coluna se ela não existir (para bancos antigos)
    try {
        db.prepare("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0").run();
        console.log('Coluna is_admin adicionada à tabela users.');
    } catch (e) { }

    try {
        db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'operator'").run();
        console.log('Coluna role adicionada à tabela users.');
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
        db.prepare("INSERT INTO users (username, password, name, must_change_password, is_admin, role) VALUES (?, ?, ?, ?, ?, ?)").run('admin', hashedPassword, 'Administrador do Armazém', 0, 1, 'admin');
        console.log('Usuário admin padrão criado: admin / senha123');
    } else {
        // Garantir que o admin existente é admin
        db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE username = 'admin'").run();
    }

    // Audit logs table
    db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Purchase orders table
    db.exec(`CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_name TEXT,
      emitted_by INTEGER,
      status TEXT DEFAULT 'PENDENTE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      accepted_by INTEGER,
      finalized_by INTEGER,
      FOREIGN KEY(emitted_by) REFERENCES users(id),
      FOREIGN KEY(accepted_by) REFERENCES users(id),
      FOREIGN KEY(finalized_by) REFERENCES users(id)
    )`);

    // Migração: Adicionar accepted_by caso não exista
    try {
      db.prepare("ALTER TABLE purchase_orders ADD COLUMN accepted_by INTEGER").run();
      console.log('Coluna accepted_by adicionada à tabela purchase_orders.');
    } catch (e) {
      // Já existe
    }

    // Migração: Adicionar finalized_by caso não exista
    try {
      db.prepare("ALTER TABLE purchase_orders ADD COLUMN finalized_by INTEGER").run();
      console.log('Coluna finalized_by adicionada à tabela purchase_orders.');
    } catch (e) {
      // Já existe
    }

    // Migração: Adicionar colunas de Nota Fiscal e Romaneio se não existirem
    try {
      db.prepare("ALTER TABLE purchase_orders ADD COLUMN invoice_path TEXT").run();
      console.log('Coluna invoice_path adicionada à tabela purchase_orders.');
    } catch (e) { }

    try {
      db.prepare("ALTER TABLE purchase_orders ADD COLUMN packing_slip_path TEXT").run();
      console.log('Coluna packing_slip_path adicionada à tabela purchase_orders.');
    } catch (e) { }

    try {
      db.prepare("ALTER TABLE purchase_orders ADD COLUMN nfe_key TEXT").run();
      console.log('Coluna nfe_key adicionada à tabela purchase_orders.');
    } catch (e) { }

    // Order items table
    db.exec(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      sku TEXT,
      name TEXT,
      quantity INTEGER,
      unit TEXT DEFAULT 'UN',
      FOREIGN KEY(order_id) REFERENCES purchase_orders(id)
    )`);

    // Migração: Adiciona unit se não existir na tabela order_items
    try {
        db.prepare("ALTER TABLE order_items ADD COLUMN unit TEXT DEFAULT 'UN'").run();
        console.log('Coluna unit adicionada à tabela order_items.');
    } catch (e) { }

    // Order status history table (for movement tracking)
    db.exec(`CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      old_status TEXT,
      new_status TEXT,
      user_id INTEGER,
      username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES purchase_orders(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Migration: Migrate old 'GERAR_PEDIDO' logs into purchase_orders/order_items
    try {
      const existingCount = db.prepare("SELECT COUNT(*) as count FROM purchase_orders").get().count;
      if (existingCount === 0) {
        console.log("Iniciando migração de pedidos antigos a partir dos logs de auditoria...");
        const oldLogs = db.prepare("SELECT * FROM audit_logs WHERE action = 'GERAR_PEDIDO'").all();
        
        const insertOrder = db.prepare("INSERT INTO purchase_orders (store_name, emitted_by, status, created_at, updated_at) VALUES (?, ?, 'PENDENTE', ?, ?)");
        const insertItem = db.prepare("INSERT INTO order_items (order_id, sku, name, quantity) VALUES (?, ?, ?, ?)");

        db.transaction(() => {
          for (const log of oldLogs) {
            try {
              const detailsObj = JSON.parse(log.details);
              if (detailsObj && detailsObj.storeName && Array.isArray(detailsObj.items)) {
                const createdAt = log.created_at || new Date().toISOString();
                const userId = log.user_id || 1;
                const info = insertOrder.run(detailsObj.storeName, userId, createdAt, createdAt);
                const newOrderId = info.lastInsertRowid;

                // Pre-populate initial status history for migrated order
                db.prepare("INSERT INTO order_status_history (order_id, old_status, new_status, user_id, username, created_at) VALUES (?, NULL, 'PENDENTE', ?, ?, ?)")
                  .run(newOrderId, userId, log.username || 'Sistema', createdAt);

                for (const it of detailsObj.items) {
                  insertItem.run(newOrderId, it.sku || '', it.name || '', it.quantity || 0);
                }
              }
            } catch (innerErr) {
              console.error(`Erro ao processar log #${log.id} na migração:`, innerErr.message);
            }
          }
        })();
        console.log(`Migração concluída! ${oldLogs.length} pedidos migrados.`);
      }
    } catch (migErr) {
      console.error("Erro geral na migração de logs para pedidos:", migErr.message);
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

// Middleware de Administrador
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta operação.' });
  }
  next();
};

// Gravação de Logs de Auditoria
function logAction(userId, username, action, details) {
  try {
    db.prepare("INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)")
      .run(userId || null, username || null, action, details || null);
    console.log(`[LOG] User ${username || 'System'}: ${action} - ${details || ''}`);
  } catch (err) {
    console.error("Erro ao gravar log no banco:", err.message);
  }
}

// Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: '8h' });
    const mustChange = !!user.must_change_password;
    console.log(`Usuário ${username} logado. Precisa trocar senha? ${mustChange}`);
    
    logAction(user.id, user.username, 'LOGIN', 'Login realizado com sucesso');

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        name: user.name,
        mustChangePassword: !!user.must_change_password,
        isAdmin: !!user.is_admin,
        role: user.role
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
    logAction(userId, req.user.username, 'TROCA_SENHA', 'Senha alterada pelo próprio usuário');
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
    logAction(operator_id, req.user.username, 'REGISTRO_SAIDA', `Registrou saída do SKU: ${sku} | Qtd: ${quantity} | Loja: ${store}`);
    res.status(201).json({ id: info.lastInsertRowid, sku, quantity, store, date, unit_price: unit_price || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create User (Only for management)
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, name, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const validRoles = ['admin', 'operator', 'expedicao', 'gerencia', 'estoque'];
  const userRole = validRoles.includes(role) ? role : 'operator';
  const isAdminVal = userRole === 'admin' ? 1 : 0;
  
  try {
    const info = db.prepare("INSERT INTO users (username, password, name, is_admin, role) VALUES (?, ?, ?, ?, ?)").run(username, hashedPassword, name, isAdminVal, userRole);
    logAction(req.user.id, req.user.username, 'CADASTRAR_USUARIO', `Cadastrou operador: ${username} | Nome: ${name} | Cargo: ${userRole}`);
    res.status(201).json({ id: info.lastInsertRowid, username, name, is_admin: isAdminVal, role: userRole });
  } catch (err) {
    res.status(500).json({ error: 'Usuário já existe' });
  }
});



// Get all users
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const rows = db.prepare("SELECT id, username, name, is_admin, role, created_at FROM users").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user info by username (Authenticated users)
app.get('/api/users/by-username/:username', authenticateToken, (req, res) => {
  const { username } = req.params;
  try {
    const row = db.prepare("SELECT id, name, username FROM users WHERE username = ?").get(username);
    if (!row) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Impedir exclusão do admin (ID 1)
  if (parseInt(id) === 1) {
    return res.status(403).json({ error: 'O administrador principal não pode ser excluído.' });
  }

  try {
    const deletedUser = db.prepare("SELECT username FROM users WHERE id = ?").get(id);
    const deletedUsername = deletedUser ? deletedUser.username : id;

    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    logAction(req.user.id, req.user.username, 'EXCLUIR_USUARIO', `Excluiu o operador: ${deletedUsername}`);
    res.json({ message: 'Usuário excluído com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle/Update user role
app.put('/api/users/:id/role', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  // Impedir alteração do admin principal (ID 1)
  if (parseInt(id) === 1) {
    return res.status(403).json({ error: 'O cargo do administrador principal não pode ser alterado.' });
  }

  const validRoles = ['admin', 'operator', 'expedicao', 'gerencia', 'estoque'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Cargo inválido.' });
  }

  const isAdminVal = role === 'admin' ? 1 : 0;

  try {
    const targetUser = db.prepare("SELECT username FROM users WHERE id = ?").get(id);
    const targetUsername = targetUser ? targetUser.username : id;

    db.prepare("UPDATE users SET is_admin = ?, role = ? WHERE id = ?").run(isAdminVal, role, id);
    logAction(req.user.id, req.user.username, 'ALTERAR_CARGO', `Alterou o cargo de ${targetUsername} para: ${role}`);
    res.json({ message: 'Cargo atualizado com sucesso!', is_admin: isAdminVal, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit user (name and username)
app.put('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { username, name } = req.body;
  
  if (!username || !name) {
    return res.status(400).json({ error: 'Nome e usuário são obrigatórios.' });
  }

  // Se for o admin principal (ID 1), impedir a alteração do username para outra coisa
  if (parseInt(id) === 1 && username !== 'admin') {
    return res.status(403).json({ error: 'O nome de usuário do administrador principal não pode ser alterado.' });
  }

  try {
    // Verificar se o username já está em uso por outro usuário
    const existingUser = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, id);
    if (existingUser) {
      return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
    }

    const targetUser = db.prepare("SELECT username, name FROM users WHERE id = ?").get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    db.prepare("UPDATE users SET username = ?, name = ? WHERE id = ?").run(username, name, id);
    logAction(req.user.id, req.user.username, 'EDITAR_USUARIO', `Editou o operador ${targetUser.username}: Nome: ${targetUser.name} -> ${name}, Usuário: ${targetUser.username} -> ${username}`);
    res.json({ message: 'Usuário atualizado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset user password
app.post('/api/users/:id/reset-password', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Impedir alteração do admin principal (ID 1)
  if (parseInt(id) === 1) {
    return res.status(403).json({ error: 'A senha do administrador principal não pode ser resetada.' });
  }

  const hashedPassword = bcrypt.hashSync('123456', 10);

  try {
    const targetUser = db.prepare("SELECT username FROM users WHERE id = ?").get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    db.prepare("UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?").run(hashedPassword, id);
    logAction(req.user.id, req.user.username, 'RESET_SENHA_USUARIO', `Resetou a senha de ${targetUser.username} para o padrão (123456)`);
    res.json({ message: 'Senha resetada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register purchase order and begin tracking
app.post('/api/orders', authenticateToken, (req, res) => {
  const { storeName, items, emittedByUsername } = req.body;
  let userId = req.user.id;
  let username = req.user.username;

  if (!storeName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Dados do pedido inválidos ou vazios.' });
  }

  const allowedStores = [
    'LOJA TUDO 10 OU 20 - PRAIA GRANDE',
    'LOJA TUDO 10 OU 20 - SÃO VICENTE'
  ];

  if (!allowedStores.includes(storeName)) {
    return res.status(400).json({ error: 'Loja inválida ou não cadastrada.' });
  }

  if (emittedByUsername) {
    const targetUser = db.prepare("SELECT id, username FROM users WHERE username = ?").get(emittedByUsername);
    if (targetUser) {
      userId = targetUser.id;
      username = targetUser.username;
    }
  }

  const insertOrder = db.prepare("INSERT INTO purchase_orders (store_name, emitted_by, status) VALUES (?, ?, ?)");
  const insertItem = db.prepare("INSERT INTO order_items (order_id, sku, name, quantity, unit) VALUES (?, ?, ?, ?, ?)");

  try {
    const executeTx = db.transaction(() => {
      const info = insertOrder.run(storeName, userId, 'PENDENTE');
      const orderId = info.lastInsertRowid;

      for (const item of items) {
        let finalUnit = item.unit || 'UN';
        if (item.name && /\(CX\)/i.test(item.name)) {
          finalUnit = 'CX';
        }
        insertItem.run(orderId, item.sku, item.name, item.quantity, finalUnit);
      }
      return orderId;
    });

    const orderId = executeTx();

    // Record initial PENDENTE status history
    db.prepare("INSERT INTO order_status_history (order_id, old_status, new_status, user_id, username) VALUES (?, NULL, 'PENDENTE', ?, ?)")
      .run(orderId, userId, username);

    // Log internally for compatibility with Logs.jsx re-download button
    const detailsObj = {
      orderId,
      storeName,
      items: items.map(it => ({ sku: it.sku, name: it.name, quantity: it.quantity, unit: it.unit || 'UN' })),
      emittedByUsername: username
    };
    logAction(userId, username, 'GERAR_PEDIDO', JSON.stringify(detailsObj));

    res.status(201).json({ id: orderId, storeName, status: 'PENDENTE' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all orders with their nested items
app.get('/api/orders', authenticateToken, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.*, u.name as emitter_name, a.name as acceptor_name, f.name as finalizer_name
      FROM purchase_orders o
      JOIN users u ON o.emitted_by = u.id
      LEFT JOIN users a ON o.accepted_by = a.id
      LEFT JOIN users f ON o.finalized_by = f.id
      ORDER BY o.created_at DESC
    `).all();

    const ordersWithItems = orders.map(order => {
      const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
      const mappedItems = items.map(it => {
        let finalUnit = it.unit || 'UN';
        if (it.name && /\(CX\)/i.test(it.name)) {
          finalUnit = 'CX';
        }
        return { ...it, unit: finalUnit };
      });
      return { ...order, items: mappedItems };
    });

    res.json(ordersWithItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get status/movement history for a specific order
app.get('/api/orders/:id/history', authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const rows = db.prepare(`
      SELECT h.*, u.name as user_full_name
      FROM order_status_history h
      LEFT JOIN users u ON h.user_id = u.id
      WHERE h.order_id = ?
      ORDER BY h.created_at ASC
    `).all(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status and trigger automated inventory deductions on completion
app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['PENDENTE', 'PREPARANDO', 'EM_ROTA', 'FINALIZADO', 'ERRO'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const order = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const oldStatus = order.status;
    if (oldStatus === status) {
      return res.json({ message: 'Status já atualizado.', status });
    }

    const userRole = req.user.role;
    const isAdmin = req.user.isAdmin;

    // Check permission for finishing (FINALIZADO / ERRO)
    const allowedRolesForFinishing = ['admin', 'estoque', 'expedicao', 'gerencia'];
    if ((status === 'FINALIZADO' || status === 'ERRO') && !allowedRolesForFinishing.includes(userRole) && !isAdmin) {
      return res.status(403).json({ error: 'Acesso negado. Apenas usuários dos cargos de estoque, expedição, gerência ou administradores podem finalizar pedidos.' });
    }

    // Check permission for other transitions
    const allowedRolesForFulfillment = ['admin', 'estoque', 'expedicao', 'gerencia'];
    if (!allowedRolesForFulfillment.includes(userRole) && !isAdmin) {
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para alterar o status dos pedidos.' });
    }

    // Update status and set accepted_by / finalized_by when transitioning
    if (status === 'PREPARANDO') {
      db.prepare("UPDATE purchase_orders SET status = ?, accepted_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.user.id, id);
    } else if (status === 'FINALIZADO' || status === 'ERRO') {
      db.prepare("UPDATE purchase_orders SET status = ?, finalized_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.user.id, id);
    } else {
      db.prepare("UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
    }

    // Record status transition in history
    db.prepare("INSERT INTO order_status_history (order_id, old_status, new_status, user_id, username) VALUES (?, ?, ?, ?, ?)")
      .run(id, oldStatus, status, req.user.id, req.user.name || req.user.username);

    // If completing the order, automatically log stock exit
    const isNowFinished = (status === 'FINALIZADO' || status === 'ERRO');
    const wasAlreadyFinished = (oldStatus === 'FINALIZADO' || oldStatus === 'ERRO');

    if (isNowFinished && !wasAlreadyFinished) {
      const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id);
      
      const insertExit = db.prepare(`
        INSERT INTO stock_exits (sku, quantity, store, exit_date, operator_id, unit_price)
        VALUES (?, ?, ?, ?, ?, 0)
      `);

      db.transaction(() => {
        const exitDate = new Date().toISOString().slice(0, 10);
        for (const item of items) {
          insertExit.run(item.sku, item.quantity, order.store_name, exitDate, req.user.id);
        }
      })();

      logAction(req.user.id, req.user.username, 'EXPEDICAO_PEDIDO', `Finalizou pedido #${id} (${status}). Saídas de estoque registradas automaticamente.`);
    } else {
      logAction(req.user.id, req.user.username, 'STATUS_PEDIDO', `Alterou status do pedido #${id} de ${oldStatus} para ${status}.`);
    }

    res.json({ message: 'Status atualizado com sucesso!', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exclude/Delete order from tracking queue (Admin only)
app.delete('/api/orders/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const order = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    db.transaction(() => {
      // Delete status history first
      db.prepare("DELETE FROM order_status_history WHERE order_id = ?").run(id);
      // Delete order items first
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);
      // Delete purchase order
      db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(id);
    })();

    logAction(req.user.id, req.user.username, 'EXCLUIR_PEDIDO', `Excluiu o pedido de expedição #${id} da loja ${order.store_name}.`);
    res.json({ message: 'Pedido excluído com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload order files (Invoice or Packing Slip)
app.put('/api/orders/:id/upload', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { type, fileData, fileName } = req.body;

  if (!type || !fileData || !fileName) {
    return res.status(400).json({ error: 'Dados de upload incompletos.' });
  }

  if (type !== 'invoice' && type !== 'packing_slip') {
    return res.status(400).json({ error: 'Tipo de arquivo inválido.' });
  }

  try {
    const order = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const matches = fileData.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Formato de arquivo inválido.' });
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const ext = fileName.split('.').pop();
    const savedName = `${type}-${id}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, savedName);
    
    fs.writeFileSync(filePath, buffer);

    const columnName = type === 'invoice' ? 'invoice_path' : 'packing_slip_path';
    db.prepare(`UPDATE purchase_orders SET ${columnName} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(savedName, id);

    // Auto-extract 44-digit NFe key from fileName if type is invoice and key exists in filename
    if (type === 'invoice') {
      const keyMatch = fileName.match(/\b\d{44}\b/) || fileName.match(/\d{44}/);
      if (keyMatch) {
        db.prepare("UPDATE purchase_orders SET nfe_key = ? WHERE id = ?").run(keyMatch[0], id);
      }
    }

    logAction(req.user.id, req.user.username, 'UPLOAD_DOC', `Enviou ${type === 'invoice' ? 'Nota Fiscal' : 'Romaneio'} para o pedido #${id}`);

    res.json({ message: 'Arquivo enviado com sucesso!', fileName: savedName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual update/save of NFe access key
app.put('/api/orders/:id/nfe-key', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { nfeKey } = req.body;

  if (nfeKey && !/^\d{44}$/.test(nfeKey)) {
    return res.status(400).json({ error: 'A chave de acesso da NF-e deve conter exatamente 44 números.' });
  }

  try {
    const order = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    db.prepare("UPDATE purchase_orders SET nfe_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nfeKey || null, id);
    logAction(req.user.id, req.user.username, 'UPDATE_NFE_KEY', `Atualizou chave NF-e do pedido #${id} para ${nfeKey || 'vazio'}`);
    res.json({ message: 'Chave atualizada com sucesso!', nfe_key: nfeKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete order files (Invoice or Packing Slip)
app.delete('/api/orders/:id/upload/:type', authenticateToken, (req, res) => {
  const { id, type } = req.params;

  if (type !== 'invoice' && type !== 'packing_slip') {
    return res.status(400).json({ error: 'Tipo de arquivo inválido.' });
  }

  try {
    const order = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const columnName = type === 'invoice' ? 'invoice_path' : 'packing_slip_path';
    const fileName = order[columnName];

    if (fileName) {
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.prepare(`UPDATE purchase_orders SET ${columnName} = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);

    logAction(req.user.id, req.user.username, 'DELETE_DOC', `Excluiu o documento de ${type === 'invoice' ? 'Nota Fiscal' : 'Romaneio'} do pedido #${id}`);

    res.json({ message: 'Arquivo excluído com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PRODUCTS DATABASE (LEARNING SYSTEM)

// Save/Update Product
app.post('/api/products', authenticateToken, (req, res) => {
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
    logAction(req.user.id, req.user.username, 'SALVAR_PRODUTO', `Salvou/Atualizou produto SKU: ${sku} | Nome: ${name}`);
    res.status(200).json({ message: 'Produto salvo com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search Product in DB
app.get('/api/products/:query', authenticateToken, (req, res) => {
  const query = req.params.query;
  try {
    const row = db.prepare("SELECT * FROM products WHERE sku = ? OR name LIKE ?").get(query, `%${query}%`);
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Undo action from system logs (Admin only)
app.post('/api/logs/:id/undo', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  try {
    const log = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(id);
    if (!log) {
      return res.status(404).json({ error: 'Log não encontrado.' });
    }

    if (log.action !== 'STATUS_PEDIDO' && log.action !== 'EXPEDICAO_PEDIDO') {
      return res.status(400).json({ error: 'Esta ação não pode ser desfeita.' });
    }

    const match = log.details.match(/pedido\s*#\s*(\d+)/i);
    if (!match) {
      return res.status(400).json({ error: 'Não foi possível identificar o ID do pedido nesta ação.' });
    }

    const orderId = parseInt(match[1]);

    // Encontra a transição correspondente de status mais recente desse pedido
    const history = db.prepare(`
      SELECT * FROM order_status_history 
      WHERE order_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(orderId);

    if (!history) {
      return res.status(400).json({ error: 'Histórico de status do pedido não encontrado.' });
    }

    const oldStatus = history.old_status;
    const newStatus = history.new_status;

    if (!oldStatus) {
      return res.status(400).json({ error: 'O pedido está em seu status inicial e não pode ser revertido.' });
    }

    // Reverte o status na tabela purchase_orders
    db.prepare("UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(oldStatus, orderId);

    // Se o status desfeito era FINALIZADO ou ERRO (que desconta estoque),
    // devemos excluir as saídas de estoque geradas automaticamente naquele momento
    if (newStatus === 'FINALIZADO' || newStatus === 'ERRO') {
      const items = db.prepare("SELECT sku, quantity FROM order_items WHERE order_id = ?").all(orderId);
      const orderData = db.prepare("SELECT store_name FROM purchase_orders WHERE id = ?").get(orderId);

      if (items.length > 0 && orderData) {
        // Obter o timestamp da transição
        const histTimeStr = history.created_at.includes('T') ? history.created_at : history.created_at.replace(' ', 'T') + 'Z';
        const histTime = new Date(histTimeStr).getTime();
        
        // Janela de tempo de 60 segundos antes/depois da transição
        const toSqliteDateTime = (date) => date.toISOString().replace('T', ' ').substring(0, 19);
        const startTime = toSqliteDateTime(new Date(histTime - 60000));
        const endTime = toSqliteDateTime(new Date(histTime + 60000));

        for (const item of items) {
          db.prepare(`
            DELETE FROM stock_exits 
            WHERE sku = ? 
              AND quantity = ? 
              AND store = ? 
              AND created_at BETWEEN ? AND ?
          `).run(item.sku, item.quantity, orderData.store_name, startTime, endTime);
        }
      }
    }

    // Registra a reversão no histórico de status
    db.prepare("INSERT INTO order_status_history (order_id, old_status, new_status, user_id, username) VALUES (?, ?, ?, ?, ?)")
      .run(orderId, newStatus, oldStatus, req.user.id, `Desfazer (por ${req.user.name || req.user.username})`);

    // Registra o log da reversão em audit_logs
    logAction(req.user.id, req.user.username, 'DESFAZER_ACAO', `Desfez alteração de status do pedido #${orderId} (revertido de ${newStatus} para ${oldStatus})`);

    res.json({ message: `Ação desfeita! Pedido #${orderId} revertido para o status ${oldStatus}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all audit logs (Only for admins)
app.get('/api/logs', authenticateToken, requireAdmin, (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor do Armazém rodando na porta ${PORT}`);
});
