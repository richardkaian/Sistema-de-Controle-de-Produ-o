// funcionario-service.js
const bcrypt = require('bcrypt');
const db = require('./db');

class ErroFuncionario extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

function buscarPorCracha(codigo_cracha) {
  return db
    .prepare(
      `SELECT id, codigo_cracha, nome, cargo, role, ativo
       FROM funcionarios WHERE codigo_cracha = ?`
    )
    .get(codigo_cracha);
}

function buscarPorId(id) {
  return db
    .prepare(
      `SELECT id, codigo_cracha, nome, cargo, role, ativo, criado_em
       FROM funcionarios WHERE id = ?`
    )
    .get(id);
}

function listarFuncionarios() {
  return db
    .prepare(
      `SELECT id, codigo_cracha, nome, cargo, role, ativo, criado_em
       FROM funcionarios ORDER BY nome`
    )
    .all();
}

function criarFuncionario({ codigo_cracha, nome, cargo, role, senha }) {
  if (!codigo_cracha || !nome) {
    throw new ErroFuncionario('CAMPOS_FALTANDO', 'codigo_cracha e nome são obrigatórios.');
  }
  if (buscarPorCracha(codigo_cracha)) {
    throw new ErroFuncionario('CRACHA_DUPLICADO', `Já existe um funcionário com o crachá ${codigo_cracha}.`);
  }

  const roleFinal = role === 'admin' ? 'admin' : 'operador';
  if (roleFinal === 'admin' && !senha) {
    throw new ErroFuncionario('SENHA_OBRIGATORIA', 'Cadastro de admin precisa de uma senha.');
  }
  const senhaHash = roleFinal === 'admin' ? bcrypt.hashSync(senha, 10) : null;

  const info = db
    .prepare(
      `INSERT INTO funcionarios (codigo_cracha, nome, cargo, role, senha_hash, ativo)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(codigo_cracha, nome, cargo || null, roleFinal, senhaHash);

  return buscarPorId(info.lastInsertRowid);
}

function atualizarStatusAtivo(id, ativo) {
  const info = db.prepare(`UPDATE funcionarios SET ativo = ? WHERE id = ?`).run(ativo ? 1 : 0, id);

  if (info.changes === 0) {
    throw new ErroFuncionario('FUNCIONARIO_NAO_ENCONTRADO', `Funcionário ${id} não encontrado.`);
  }

  return buscarPorId(id);
}

module.exports = {
  buscarPorCracha,
  buscarPorId,
  listarFuncionarios,
  criarFuncionario,
  atualizarStatusAtivo,
  ErroFuncionario,
};
