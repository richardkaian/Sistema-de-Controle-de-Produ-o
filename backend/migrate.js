// migrate.js
// Roda o schema.sql contra o banco local (data/pedidos-fabrica.db).
// Idempotente: pode rodar quantas vezes quiser, os "IF NOT EXISTS"
// cuidam de não duplicar nada.
//
// Uso: node migrate.js

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3'); // npm install better-sqlite3

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'pedidos-fabrica.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

db.exec(schema);

console.log(`Schema aplicado com sucesso em: ${DB_PATH}`);

// Migração incremental: quem já tinha o banco criado antes da coluna
// ordem_producao existir precisa dela adicionada na mão — o "CREATE TABLE
// IF NOT EXISTS" do schema.sql não mexe em tabela que já existe.
const colunasOS = db.prepare(`PRAGMA table_info(ordens_servico)`).all();
const temOrdemProducao = colunasOS.some((c) => c.name === 'ordem_producao');
if (!temOrdemProducao) {
  db.exec(`ALTER TABLE ordens_servico ADD COLUMN ordem_producao INTEGER`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_os_ordem_producao ON ordens_servico (ordem_producao)`);
  console.log('Coluna ordem_producao adicionada à tabela ordens_servico.');
}

// Cria o primeiro admin se ainda não existir nenhum,
// pra você não ficar trancado fora do painel.
const bcrypt = require('bcrypt'); // npm install bcrypt

const jaTemAdmin = db
  .prepare(`SELECT COUNT(*) AS total FROM funcionarios WHERE role = 'admin'`)
  .get().total;

if (jaTemAdmin === 0) {
  const senhaHash = bcrypt.hashSync('troque-esta-senha', 10);
  db.prepare(
    `INSERT INTO funcionarios (codigo_cracha, nome, cargo, role, senha_hash, ativo)
     VALUES (?, ?, ?, 'admin', ?, 1)`
  ).run('ADMIN-0001', 'Administrador', 'Admin', senhaHash);

  console.log('Admin padrão criado -> crachá: ADMIN-0001 | senha: troque-esta-senha');
  console.log('IMPORTANTE: troque essa senha assim que logar.');
}

db.close();
