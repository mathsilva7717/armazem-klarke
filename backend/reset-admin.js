const bcrypt = require('bcryptjs');
const path = require('path');
const dbPath = path.join(__dirname, 'armazem.sqlite');
let db;

try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);
  console.log("Conectado via better-sqlite3");
} catch (e) {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbPath);
  console.log("Conectado via node:sqlite");
}

// 1. Criar a coluna is_admin se não existir
try {
  db.prepare("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0").run();
  console.log("Coluna is_admin adicionada com sucesso!");
} catch (e) {
  console.log("Aviso ao adicionar coluna (pode já existir):", e.message);
}

// 2. Resetar a senha do admin e garantir que ele é admin
try {
  const hashedPassword = bcrypt.hashSync('senha123', 10);
  db.prepare("UPDATE users SET password = ?, must_change_password = 0, is_admin = 1 WHERE username = 'admin'").run(hashedPassword);
  console.log("Senha do admin resetada com sucesso para: senha123");
} catch (e) {
  console.error("Erro ao resetar senha do admin:", e.message);
}
