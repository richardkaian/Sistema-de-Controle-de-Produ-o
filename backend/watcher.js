// watcher.js
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { extrairOS } = require('./os-parser');
const { salvarOS } = require('./os-service');

const PASTA_PEDIDOS = process.env.PASTA_PEDIDOS || path.join(__dirname, 'pedidos-recebidos');
const PASTA_PROCESSADOS = path.join(PASTA_PEDIDOS, 'processados');
const PASTA_ERROS = path.join(PASTA_PEDIDOS, 'erros');

for (const pasta of [PASTA_PEDIDOS, PASTA_PROCESSADOS, PASTA_ERROS]) {
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
}

/**
 * @param {import('socket.io').Server} [io] - opcional, pra avisar o painel admin em tempo real
 */
function iniciarWatcher(io) {
  const watcher = chokidar.watch(PASTA_PEDIDOS, {
    ignored: (caminho) => caminho.includes('processados') || caminho.includes('erros'),
    depth: 0,
    ignoreInitial: false,
    awaitWriteFinish: {
      // espera o arquivo parar de crescer antes de disparar o evento —
      // evita ler um PDF pela metade enquanto ainda está sendo copiado/gerado
      stabilityThreshold: 1500,
      pollInterval: 200,
    },
  });

  watcher.on('add', async (caminhoArquivo) => {
    if (!caminhoArquivo.toLowerCase().endsWith('.pdf')) return;

    const nomeArquivo = path.basename(caminhoArquivo);
    console.log(`[watcher] novo arquivo detectado: ${nomeArquivo}`);

    try {
      const buffer = fs.readFileSync(caminhoArquivo);
      const dados = await extrairOS(buffer);
      const resultado = salvarOS(dados, nomeArquivo);

      if (resultado.ja_existia) {
        console.log(`[watcher] OS ${resultado.numero_os} já estava no banco, ignorado.`);
      } else {
        console.log(`[watcher] OS ${resultado.numero_os} gravada com sucesso (id ${resultado.os_id}).`);
        if (io) {
          io.emit('os:nova', { os_id: resultado.os_id, numero_os: resultado.numero_os });
        }
      }

      fs.renameSync(caminhoArquivo, path.join(PASTA_PROCESSADOS, nomeArquivo));
    } catch (erro) {
      console.error(`[watcher] falha ao processar ${nomeArquivo}:`, erro.message);
      fs.renameSync(caminhoArquivo, path.join(PASTA_ERROS, nomeArquivo));
      if (io) {
        io.emit('os:erro', { arquivo: nomeArquivo, motivo: erro.message });
      }
    }
  });

  watcher.on('error', (erro) => console.error('[watcher] erro no watcher:', erro));

  console.log(`[watcher] monitorando: ${PASTA_PEDIDOS}`);
  return watcher;
}

module.exports = { iniciarWatcher, PASTA_PEDIDOS, PASTA_PROCESSADOS, PASTA_ERROS };
