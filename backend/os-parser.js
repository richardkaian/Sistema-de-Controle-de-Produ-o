// os-parser.js
//
// Extrai os dados de uma OS a partir do PDF "Controle Usinagem" (padrão OBR).
//
// Por que não usar pdf-parse simples: esse layout vem com a mesma OS
// duplicada lado a lado na página (2 vias pra imprimir e cortar), e as
// colunas ficam coladas sem espaço no texto puro (ex: "21,60" pode ser
// Qtd=2 + Tempo=1,60 grudados). Aqui a gente usa pdfjs-dist pra pegar a
// posição (x,y) de cada pedaço de texto, filtra só a metade esquerda da
// página (evita duplicidade) e reconstrói a tabela pelas colunas reais.
//
// npm install pdfjs-dist@3

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Limites de coluna da tabela de itens, calibrados nesse layout.
// Se o layout do form mudar, ajuste esses valores.
const COL_QTD_MAX_X = 95;
const COL_TEMPO_MAX_X = 145;

function normalizarData(str) {
  // aceita DD/MM/AAAA ou DD/MM/AA (o próprio PDF às vezes gera os dois
  // formatos pras duas vias da mesma OS) -> sempre retorna AAAA-MM-DD
  const m = str && str.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!m) return null;
  let [, dia, mes, ano] = m;
  if (ano.length === 2) ano = '20' + ano;
  return `${ano}-${mes}-${dia}`;
}

function normalizarDecimal(str) {
  if (!str) return null;
  const n = parseFloat(str.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

async function extrairLinhasPagina(page) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const midX = viewport.width / 2;

  const items = content.items
    .filter((i) => i.str.trim() !== '')
    .filter((i) => i.transform[4] < midX) // só a via da esquerda
    .map((i) => ({
      str: i.str.trim(),
      x: i.transform[4],
      y: Math.round(i.transform[5]),
    }));

  const tol = 3; // tolerância vertical pra considerar "mesma linha"
  const rows = [];
  for (const it of items) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
    if (!row) {
      row = { y: it.y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }

  rows.sort((a, b) => b.y - a.y); // topo -> base da página
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x)); // esquerda -> direita
  return rows;
}

// Acha o item logo à direita de um item cujo texto bate com labelRegex,
// na mesma linha (ex: label "Cliente:" -> valor "MERCEDES BENZ DO BRASIL").
function acharValorNaLinha(rows, labelRegex) {
  for (const row of rows) {
    const idx = row.items.findIndex((i) => labelRegex.test(i.str));
    if (idx !== -1 && row.items[idx + 1]) {
      return row.items[idx + 1].str.trim();
    }
  }
  return null;
}

// Caso específico: "Vendedor" / "O.S" são cabeçalho numa linha, mas o valor
// (nome do vendedor + número da OS) não está necessariamente na linha
// seguinte — pode ter o título "Controle Usinagem" no meio. Por isso
// procura a primeira linha ABAIXO do cabeçalho cujo último item seja
// só dígitos (padrão do número da OS).
function acharVendedorEOS(rows) {
  const headerIdx = rows.findIndex((r) =>
    r.items.some((i) => /^Vendedor$/.test(i.str))
  );
  if (headerIdx === -1) return { vendedor: null, numero_os: null };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const items = rows[i].items;
    const ultimo = items[items.length - 1];
    if (items.length >= 2 && ultimo && /^\d+$/.test(ultimo.str)) {
      return { vendedor: items[0].str, numero_os: ultimo.str };
    }
  }
  return { vendedor: null, numero_os: null };
}

function extrairItens(rows) {
  // O cabeçalho da tabela quebra em várias linhas nesse layout
  // ("Qtd" / "Itens" / "Tempo por" / "Item" / "(decimal)" / "Descrição
  // dos Itens" cada um pode cair em y's diferentes). "(decimal)" é
  // sempre a última linha desse bloco, então é o marcador mais confiável
  // de onde a tabela de dados realmente começa.
  const headerIdx = rows.findIndex((r) =>
    r.items.some((i) => /\(decimal\)/i.test(i.str))
  );
  const obsLimitIdx = rows.findIndex((r) =>
    r.items.some((i) => /^OBS\.:/.test(i.str))
  );
  if (headerIdx === -1 || obsLimitIdx === -1) return [];

  const linhasTabela = rows.slice(headerIdx + 1, obsLimitIdx);
  const itens = [];

  for (const row of linhasTabela) {
    const cols = row.items;
    const temQtd = cols.some((i) => i.x < COL_QTD_MAX_X);

    if (temQtd) {
      const qtdItem = cols.find((i) => i.x < COL_QTD_MAX_X);
      const tempoItem = cols.find(
        (i) => i.x >= COL_QTD_MAX_X && i.x < COL_TEMPO_MAX_X
      );
      const descricao = cols
        .filter((i) => i.x >= COL_TEMPO_MAX_X)
        .map((i) => i.str)
        .join(' ')
        .trim();

      itens.push({
        qtd: qtdItem ? parseInt(qtdItem.str, 10) : null,
        tempo_por_item: tempoItem ? normalizarDecimal(tempoItem.str) : null,
        descricao,
        observacoes: null,
      });
    } else {
      // linha sem Qtd/Tempo = observação/complemento do último item
      // (ex: "*** USINAGEM CONFORME DESENHO Nº ... ***")
      const texto = cols.map((i) => i.str).join(' ').trim();
      const ultimoItem = itens[itens.length - 1];
      if (ultimoItem && texto) {
        ultimoItem.observacoes = ultimoItem.observacoes
          ? `${ultimoItem.observacoes} ${texto}`
          : texto;
      }
    }
  }

  return itens;
}

/**
 * Extrai os dados de uma OS a partir do buffer de um PDF "Controle Usinagem".
 * @param {Buffer} buffer
 * @returns {Promise<object>} dados prontos pra inserir em ordens_servico / itens_os
 */
async function extrairOS(buffer) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const rows = await extrairLinhasPagina(page);

    const ehFormularioControleUsinagem = rows.some((r) =>
      r.items.some((i) => /Controle Usinagem/i.test(i.str))
    );
    if (!ehFormularioControleUsinagem) continue; // pula páginas de desenho técnico etc.

    const { vendedor, numero_os: numeroOsDaLinha } = acharVendedorEOS(rows);
    const numeroOsCodBarras = acharValorNaLinha(rows, /^\*OS-\d+\*$/);
    const numero_os = numeroOsCodBarras
      ? numeroOsCodBarras.match(/\d+/)[0]
      : numeroOsDaLinha;

    const dataPedidoRaw = acharValorNaLinha(rows, /^Data Pedido:$/);
    const dataLimiteRaw = acharValorNaLinha(rows, /Data limite para Usinagem/);
    const cliente = acharValorNaLinha(rows, /^Cliente:$/);
    const totalItensRaw = acharValorNaLinha(rows, /^Total de Itens:$/);
    const tempoTotalRaw = acharValorNaLinha(rows, /^Tempo de Usinagem Total:$/);

    const itens = extrairItens(rows);

    return {
      numero_os,
      vendedor,
      cliente,
      data_pedido: normalizarData(dataPedidoRaw),
      data_limite_usinagem: normalizarData(dataLimiteRaw),
      total_itens: totalItensRaw ? parseInt(totalItensRaw, 10) : itens.length,
      tempo_usinagem_total: normalizarDecimal(tempoTotalRaw),
      itens,
    };
  }

  throw new Error(
    'Nenhuma página no formato "Controle Usinagem" foi encontrada nesse PDF.'
  );
}

module.exports = { extrairOS };
