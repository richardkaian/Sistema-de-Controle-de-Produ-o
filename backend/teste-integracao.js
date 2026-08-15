// teste-integracao.js
// Simula exatamente o que a tela Angular faz: conecta o socket,
// valida o crachá, bipa a OS, e confirma que o evento em tempo real
// chega (o mesmo evento que o painel admin vai escutar).
const { io } = require('socket.io-client');

const API_URL = 'http://localhost:3000';

async function main() {
  console.log('1) Conectando o socket (igual o Angular faz no BipagemService)...');
  const socket = io(API_URL);

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout ao conectar socket')), 5000);
  });
  console.log('   ✔ socket conectado:', socket.id);

  let eventoRecebido = null;
  socket.on('bipagem:novo', (payload) => {
    eventoRecebido = payload;
    console.log('   ✔ evento "bipagem:novo" recebido em tempo real:', payload);
  });

  console.log('\n2) Validando crachá (GET /funcionarios/FUNC-0001)...');
  const respCracha = await fetch(`${API_URL}/funcionarios/FUNC-0001`);
  if (!respCracha.ok) throw new Error('falha ao validar crachá: ' + respCracha.status);
  const funcionario = await respCracha.json();
  console.log('   ✔ operador:', funcionario.nome);

  console.log('\n3) Bipando a OS (POST /bipagem)...');
  const respBipagem = await fetch(`${API_URL}/bipagem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo_cracha: 'FUNC-0001',
      numero_os: '313614',
      etapa: 'separacao',
    }),
  });
  const resultado = await respBipagem.json();
  console.log('   ✔ resposta HTTP:', resultado);

  console.log('\n4) Esperando o evento de socket propagar...');
  await new Promise((r) => setTimeout(r, 1000));

  if (!eventoRecebido) {
    throw new Error('✘ FALHOU: evento "bipagem:novo" nunca chegou pelo socket.');
  }
  if (eventoRecebido.os.numero_os !== resultado.os.numero_os) {
    throw new Error('✘ FALHOU: evento recebido não bate com a OS bipada.');
  }

  console.log('\n✅ Integração OK: HTTP + Socket.io batendo, exatamente como o Angular vai consumir.');
  socket.close();
  process.exit(0);
}

main().catch((erro) => {
  console.error('\n✘ Teste de integração falhou:', erro.message);
  process.exit(1);
});
