// scripts/build-deploy.js
//
// Builda o Angular em modo produção e copia o resultado pra dentro
// do backend (pasta "public"), pra rodar tudo com um único `npm start`
// — um servidor só, servindo API + tela, na mesma porta.
//
// Uso (de dentro da pasta do backend): node scripts/build-deploy.js
//
// Pressupõe a seguinte estrutura de pastas (ajuste PASTA_FRONTEND
// abaixo se a sua estrutura for diferente):
//
//   pedidos-fabrica/
//     backend/     <- este projeto (server.js, package.json...)
//     frontend/    <- bipagem-app-entrega (o projeto Angular)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PASTA_FRONTEND = path.join(__dirname, '..', '..', 'frontend');
const PASTA_DIST = path.join(PASTA_FRONTEND, 'dist', 'bipagem-app', 'browser');
const PASTA_PUBLIC = path.join(__dirname, '..', 'public');

if (!fs.existsSync(PASTA_FRONTEND)) {
  console.error(`[build-deploy] Pasta do frontend não encontrada: ${PASTA_FRONTEND}`);
  console.error(
    'Ajuste a constante PASTA_FRONTEND em scripts/build-deploy.js se a sua estrutura ' +
      'de pastas for diferente (backend e frontend não precisam ser irmãs, só apontar certo aqui).'
  );
  process.exit(1);
}

console.log('[build-deploy] Instalando dependências do frontend (se necessário)...');
execSync('npm install', { cwd: PASTA_FRONTEND, stdio: 'inherit' });

console.log('[build-deploy] Buildando Angular em modo produção...');
execSync('npm run build', { cwd: PASTA_FRONTEND, stdio: 'inherit' });

if (!fs.existsSync(PASTA_DIST)) {
  console.error(`[build-deploy] Build não gerou a pasta esperada: ${PASTA_DIST}`);
  console.error('Confere se o nome do projeto Angular ainda é "bipagem-app" no angular.json.');
  process.exit(1);
}

console.log('[build-deploy] Copiando build para backend/public...');
fs.rmSync(PASTA_PUBLIC, { recursive: true, force: true });
fs.cpSync(PASTA_DIST, PASTA_PUBLIC, { recursive: true });

console.log('[build-deploy] Pronto! Rode "npm start" e acesse http://localhost:3000 (ou o IP da rede).');
