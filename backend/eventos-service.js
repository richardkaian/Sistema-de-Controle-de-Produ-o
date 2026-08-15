// eventos-service.js
const db = require('./db');

function listarRecentes(limite = 50) {
  return db
    .prepare(
      `SELECT eb.id, eb.etapa, eb.tipo_evento, eb.criado_em,
              os.numero_os, os.cliente,
              f.nome AS funcionario_nome
       FROM eventos_bipagem eb
       JOIN ordens_servico os ON os.id = eb.os_id
       JOIN funcionarios f ON f.id = eb.funcionario_id
       ORDER BY eb.id DESC
       LIMIT ?`
    )
    .all(limite);
}

module.exports = { listarRecentes };
