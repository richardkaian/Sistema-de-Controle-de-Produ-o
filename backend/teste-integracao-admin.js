// teste-integracao-admin.js
const API_URL = 'http://localhost:3000';

async function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('1) Login admin com senha errada (deve falhar)...');
  const respErrada = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo_cracha: 'ADMIN-0001', senha: 'errada' }),
  });
  if (respErrada.status !== 401) throw new Error('esperava 401 pra senha errada');
  console.log('   ✔ bloqueado corretamente (401)');

  console.log('\n2) Login admin correto...');
  const respLogin = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo_cracha: 'ADMIN-0001', senha: 'troque-esta-senha' }),
  });
  if (!respLogin.ok) throw new Error('login deveria funcionar');
  const admin = await respLogin.json();
  console.log('   ✔ logado como:', admin.nome);

  console.log('\n3) Operador tentando entrar no admin (deve barrar)...');
  const respOperador = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo_cracha: 'FUNC-0001', senha: 'qualquer' }),
  });
  if (respOperador.status !== 403) throw new Error('esperava 403 pra operador tentando entrar no admin');
  console.log('   ✔ bloqueado corretamente (403)');

  console.log('\n4) Cadastrando um novo crachá de operador...');
  const respNovo = await fetch(`${API_URL}/funcionarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo_cracha: 'FUNC-0099',
      nome: 'Teste Automatizado',
      cargo: 'Operador de Teste',
      role: 'operador',
    }),
  });
  if (!respNovo.ok) throw new Error('cadastro deveria funcionar');
  const novoFuncionario = await respNovo.json();
  console.log('   ✔ cadastrado:', novoFuncionario.codigo_cracha, '(id', novoFuncionario.id + ')');

  console.log('\n5) Desativando o crachá recém-criado...');
  const respDesativar = await fetch(`${API_URL}/funcionarios/${novoFuncionario.id}/ativo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ativo: false }),
  });
  const desativado = await respDesativar.json();
  if (desativado.ativo !== 0) throw new Error('deveria estar inativo');
  console.log('   ✔ desativado com sucesso');

  console.log('\n6) Tentando bipar com o crachá desativado (deve barrar)...');
  const respBipagemBloqueada = await fetch(`${API_URL}/bipagem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo_cracha: 'FUNC-0099', numero_os: '313614', etapa: 'corte' }),
  });
  if (respBipagemBloqueada.status !== 403) throw new Error('crachá inativo deveria ser bloqueado com 403');
  console.log('   ✔ bipagem bloqueada corretamente (403)');

  console.log('\n7) Listando todas as OS...');
  const respOS = await fetch(`${API_URL}/os`);
  const ordens = await respOS.json();
  console.log(`   ✔ ${ordens.length} OS encontrada(s) no sistema`);

  console.log('\n8) Buscando detalhe de uma OS específica...');
  if (ordens.length > 0) {
    const respDetalhe = await fetch(`${API_URL}/os/${ordens[0].numero_os}`);
    const detalhe = await respDetalhe.json();
    console.log(`   ✔ OS ${detalhe.numero_os} tem ${detalhe.itens.length} item(ns)`);
  }

  console.log('\n9) Listando eventos recentes (feed do dashboard)...');
  const respEventos = await fetch(`${API_URL}/eventos?limite=10`);
  const eventos = await respEventos.json();
  console.log(`   ✔ ${eventos.length} evento(s) no feed`);

  console.log('\n✅ Painel admin validado de ponta a ponta.');
}

main().catch((erro) => {
  console.error('\n✘ Teste falhou:', erro.message);
  process.exit(1);
});
