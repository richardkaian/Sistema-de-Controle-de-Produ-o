# Pedidos Fábrica — Deploy único (backend servindo o Angular)

Estrutura de pastas esperada:

```
pedidos-fabrica/
  backend/     <- server.js, package.json, schema.sql, scripts/...
  frontend/    <- bipagem-app-entrega (projeto Angular)
```

Se você já tem as duas pastas com outro nome, só ajustar a constante
`PASTA_FRONTEND` no início de `backend/scripts/build-deploy.js`.

## 1. Primeira vez (banco de dados)

Dentro de `backend/`:

```bash
npm install
npm run migrate
```

## 2. Empacotar tudo num servidor só

Ainda dentro de `backend/`:

```bash
npm run deploy
```

Isso vai:
1. Instalar as dependências do Angular (se preciso)
2. Rodar `ng build` (build de produção)
3. Copiar o resultado pra `backend/public/`

## 3. Rodar

```bash
npm start
```

Abre `http://localhost:3000` (tela de bipagem) e
`http://localhost:3000/admin` (painel admin) — tudo na mesma porta,
um processo só.

Pra acessar de outra máquina da fábrica, usa o IP da máquina que está
rodando o backend, ex: `http://192.168.1.50:3000`. Não precisa mexer
em nada no front — o `config.ts` já detecta a origem automaticamente
em produção.

## Atualizando depois de mudar o código

- Mudou só o **backend** (server.js, parsers, etc.): só reinicia
  `npm start`.
- Mudou o **frontend** (telas Angular): roda `npm run deploy` de novo
  antes de reiniciar, pra gerar um novo build e copiar pra `public/`.

## Modo desenvolvimento (com hot-reload do Angular)

Se quiser trabalhar no front com recarregamento automático (mais
rápido que rebuildar toda hora), roda os dois separados como antes:

```bash
# terminal 1 — backend
cd backend && npm start

# terminal 2 — frontend
cd frontend && npm start   # ng serve, porta 4200
```

Nesse modo o `config.ts` usa `http://localhost:3000` fixo (detecta
automaticamente que está em dev), então funciona sem configurar nada.
