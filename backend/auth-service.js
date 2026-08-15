// auth-service.js
const bcrypt = require('bcrypt');
const db = require('./db');

class ErroAuth extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/**
 * Login da área admin: crachá + senha. Só funcionários com role='admin'
 * conseguem entrar (o crachá de operador comum não tem senha_hash).
 */
function login(codigo_cracha, senha) {
  const funcionario = db
    .prepare(`SELECT * FROM funcionarios WHERE codigo_cracha = ?`)
    .get(codigo_cracha);

  if (!funcionario) {
    throw new ErroAuth('CRACHA_NAO_ENCONTRADO', 'Crachá não encontrado.');
  }
  if (funcionario.role !== 'admin') {
    throw new ErroAuth('SEM_PERMISSAO', 'Esse crachá não tem acesso à área administrativa.');
  }
  if (!funcionario.ativo) {
    throw new ErroAuth('CRACHA_INATIVO', 'Crachá inativo — fale com outro admin.');
  }
  if (!funcionario.senha_hash || !bcrypt.compareSync(senha, funcionario.senha_hash)) {
    throw new ErroAuth('SENHA_INVALIDA', 'Senha incorreta.');
  }

  const { senha_hash, ...semSenha } = funcionario;
  return semSenha;
}

/**
 * Troca a senha de um admin (usado na primeira vez, pra sair da senha padrão).
 */
function trocarSenha(codigo_cracha, senhaAtual, senhaNova) {
  const funcionario = db
    .prepare(`SELECT * FROM funcionarios WHERE codigo_cracha = ?`)
    .get(codigo_cracha);

  if (!funcionario || funcionario.role !== 'admin') {
    throw new ErroAuth('CRACHA_NAO_ENCONTRADO', 'Crachá de admin não encontrado.');
  }
  if (!bcrypt.compareSync(senhaAtual, funcionario.senha_hash || '')) {
    throw new ErroAuth('SENHA_INVALIDA', 'Senha atual incorreta.');
  }

  const novoHash = bcrypt.hashSync(senhaNova, 10);
  db.prepare(`UPDATE funcionarios SET senha_hash = ? WHERE id = ?`).run(novoHash, funcionario.id);
  return true;
}

module.exports = { login, trocarSenha, ErroAuth };
