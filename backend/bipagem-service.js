// bipagem-service.js
const db = require('./db');
const { buscarPorCracha } = require('./funcionario-service');

const ETAPAS_VALIDAS = ['separacao', 'corte', 'usinagem', 'expedicao'];

class ErroBipagem extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo; // usado pelo endpoint pra decidir o status HTTP
  }
}

const buscarOSPorNumero = db.prepare(
  `SELECT id, numero_os, cliente FROM ordens_servico WHERE numero_os = ?`
);

const buscarUltimoEvento = db.prepare(`
  SELECT tipo_evento FROM eventos_bipagem
  WHERE os_id = ? AND etapa = ?
  ORDER BY id DESC LIMIT 1
`);

const inserirEvento = db.prepare(`
  INSERT INTO eventos_bipagem (os_id, funcionario_id, etapa, tipo_evento)
  VALUES (?, ?, ?, ?)
`);

/**
 * Registra uma bipagem. Alterna automaticamente entre "inicio" e "fim"
 * pra cada combinação de OS + etapa: a primeira bipagem daquela OS
 * naquela etapa é "inicio", a próxima é "fim", e assim por diante.
 *
 * @param {{codigo_cracha: string, numero_os: string, etapa: string}} params
 */
const registrarEvento = db.transaction(({ codigo_cracha, numero_os, etapa }) => {
  if (!ETAPAS_VALIDAS.includes(etapa)) {
    throw new ErroBipagem('ETAPA_INVALIDA', `Etapa "${etapa}" não é válida.`);
  }

  const funcionario = buscarPorCracha(codigo_cracha);
  if (!funcionario) {
    throw new ErroBipagem('CRACHA_NAO_ENCONTRADO', 'Crachá não cadastrado no sistema.');
  }
  if (!funcionario.ativo) {
    throw new ErroBipagem('CRACHA_INATIVO', 'Este crachá está inativo.');
  }

  const os = buscarOSPorNumero.get(numero_os);
  if (!os) {
    throw new ErroBipagem('OS_NAO_ENCONTRADA', `OS ${numero_os} não encontrada no sistema.`);
  }

  const ultimo = buscarUltimoEvento.get(os.id, etapa);
  const tipo_evento = !ultimo || ultimo.tipo_evento === 'fim' ? 'inicio' : 'fim';

  inserirEvento.run(os.id, funcionario.id, etapa, tipo_evento);

  return {
    funcionario: { nome: funcionario.nome, cargo: funcionario.cargo },
    os: { numero_os: os.numero_os, cliente: os.cliente },
    etapa,
    tipo_evento,
  };
});

module.exports = { registrarEvento, ErroBipagem, ETAPAS_VALIDAS };
