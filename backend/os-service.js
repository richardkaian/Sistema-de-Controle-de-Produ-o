// os-service.js
const db = require('./db');

const STATUSES_VALIDOS = [
  'aguardando', 'separacao', 'corte', 'usinagem', 'expedicao', 'concluido',
];

class ErroOS extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

const buscarOSPorNumero = db.prepare(
  `SELECT id FROM ordens_servico WHERE numero_os = ?`
);

const inserirOS = db.prepare(`
  INSERT INTO ordens_servico
    (numero_os, vendedor, cliente, data_pedido, data_limite_usinagem,
     tempo_usinagem_total, arquivo_origem)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const inserirItem = db.prepare(`
  INSERT INTO itens_os
    (os_id, qtd, tempo_por_item, descricao, observacoes)
  VALUES (?, ?, ?, ?, ?)
`);

/**
 * Salva uma OS extraída do PDF no banco.
 * Se a OS já existir (mesmo numero_os), não duplica — retorna ja_existia: true.
 * Isso cobre tanto o reprocessamento acidental de um arquivo quanto o fato
 * do próprio PDF "Controle Usinagem" vir com a OS impressa duas vezes.
 *
 * @param {object} dados - retorno de extrairOS() do os-parser.js
 * @param {string} arquivoOrigem - nome/caminho do PDF de origem
 */
const salvarOS = db.transaction((dados, arquivoOrigem) => {
  if (!dados.numero_os) {
    throw new Error('PDF sem número de OS reconhecível — não foi salvo.');
  }

  const existente = buscarOSPorNumero.get(dados.numero_os);
  if (existente) {
    return { ja_existia: true, os_id: existente.id, numero_os: dados.numero_os };
  }

  const info = inserirOS.run(
    dados.numero_os,
    dados.vendedor,
    dados.cliente,
    dados.data_pedido,
    dados.data_limite_usinagem,
    dados.tempo_usinagem_total,
    arquivoOrigem
  );

  const osId = info.lastInsertRowid;

  for (const item of dados.itens) {
    inserirItem.run(osId, item.qtd, item.tempo_por_item, item.descricao, item.observacoes);
  }

  return { ja_existia: false, os_id: osId, numero_os: dados.numero_os };
});

function listarOS() {
  return db.prepare(`
    SELECT * FROM ordens_servico ORDER BY criado_em DESC
  `).all();
}

function buscarOSCompleta(numero_os) {
  const os = db.prepare(`SELECT * FROM ordens_servico WHERE numero_os = ?`).get(numero_os);
  if (!os) return null;

  const itens = db.prepare(`SELECT * FROM itens_os WHERE os_id = ?`).all(os.id);
  return { ...os, itens };
}

/**
 * Move uma OS manualmente pra qualquer estágio, sobrescrevendo o que os
 * eventos de bipagem tinham calculado. Uso: correção manual pelo admin
 * (ex: OS pulou uma etapa no chão de fábrica, ou entrou fora de ordem).
 */
function atualizarStatus(numero_os, novoStatus) {
  if (!STATUSES_VALIDOS.includes(novoStatus)) {
    throw new ErroOS('STATUS_INVALIDO', `Status "${novoStatus}" não é válido.`);
  }

  const os = db.prepare(`SELECT * FROM ordens_servico WHERE numero_os = ?`).get(numero_os);
  if (!os) {
    throw new ErroOS('OS_NAO_ENCONTRADA', `OS ${numero_os} não encontrada.`);
  }

  db.prepare(
    `UPDATE ordens_servico SET status = ?, atualizado_em = datetime('now') WHERE id = ?`
  ).run(novoStatus, os.id);

  return { ...os, status: novoStatus };
}

// ---------------------------------------------------------
// Programação de produção — fila ordenável de OS pra usinar.
// Uma OS só entra na fila quando o admin adiciona ela (ordem_producao
// deixa de ser NULL); a partir daí a posição é 100% manual, controlada
// pelo admin arrastando a lista.
// ---------------------------------------------------------

/** OS que já estão na fila, na ordem definida pelo admin. */
function listarProgramacao() {
  return db.prepare(`
    SELECT * FROM ordens_servico
    WHERE ordem_producao IS NOT NULL
    ORDER BY ordem_producao ASC
  `).all();
}

/**
 * OS que ainda não estão na fila (candidatas a adicionar), com as mais
 * urgentes primeiro — sem data limite cadastrada fica por último.
 */
function listarDisponiveisParaProgramacao() {
  return db.prepare(`
    SELECT * FROM ordens_servico
    WHERE ordem_producao IS NULL AND status != 'concluido'
    ORDER BY (data_limite_usinagem IS NULL), data_limite_usinagem ASC
  `).all();
}

/**
 * Recebe a fila inteira, na nova ordem desejada, e regrava
 * ordem_producao = 1, 2, 3... nessa sequência. É assim que o
 * drag-and-drop do admin persiste.
 */
const reordenarProgramacao = db.transaction((numerosOsEmOrdem) => {
  const atualizar = db.prepare(
    `UPDATE ordens_servico SET ordem_producao = ?, atualizado_em = datetime('now') WHERE numero_os = ?`
  );
  numerosOsEmOrdem.forEach((numero_os, index) => {
    atualizar.run(index + 1, numero_os);
  });
});

/** Adiciona uma OS ao fim da fila. */
function adicionarAProgramacao(numero_os) {
  const os = db.prepare(`SELECT id FROM ordens_servico WHERE numero_os = ?`).get(numero_os);
  if (!os) {
    throw new ErroOS('OS_NAO_ENCONTRADA', `OS ${numero_os} não encontrada.`);
  }

  const maxAtual = db.prepare(`SELECT MAX(ordem_producao) AS max FROM ordens_servico`).get().max || 0;
  db.prepare(
    `UPDATE ordens_servico SET ordem_producao = ?, atualizado_em = datetime('now') WHERE id = ?`
  ).run(maxAtual + 1, os.id);

  return db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(os.id);
}

/** Tira uma OS da fila (volta pra lista de disponíveis). */
function removerDaProgramacao(numero_os) {
  const os = db.prepare(`SELECT id FROM ordens_servico WHERE numero_os = ?`).get(numero_os);
  if (!os) {
    throw new ErroOS('OS_NAO_ENCONTRADA', `OS ${numero_os} não encontrada.`);
  }

  db.prepare(
    `UPDATE ordens_servico SET ordem_producao = NULL, atualizado_em = datetime('now') WHERE id = ?`
  ).run(os.id);

  return db.prepare(`SELECT * FROM ordens_servico WHERE id = ?`).get(os.id);
}

module.exports = {
  salvarOS,
  listarOS,
  buscarOSCompleta,
  atualizarStatus,
  listarProgramacao,
  listarDisponiveisParaProgramacao,
  reordenarProgramacao,
  adicionarAProgramacao,
  removerDaProgramacao,
  ErroOS,
  STATUSES_VALIDOS,
};
