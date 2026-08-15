# Pedidos Fábrica — OBR

Sistema de controle de produção da fábrica: bipagem de crachá + OS nas
estações (Separação, Corte, Usinagem, Expedição) e painel admin (kanban,
lista de OS, funcionários, programação).

## Estrutura

```
pedidos-fabrica/
├── backend/          API + banco (Node.js/Express + SQLite)
│   ├── server.js
│   ├── *-service.js  regras de negócio (auth, bipagem, OS, funcionários...)
│   ├── schema.sql    schema do banco
│   ├── migrate.js    cria/atualiza o banco
│   ├── scripts/      script de deploy (builda o front e copia pra public/)
│   └── README.md     passo a passo detalhado de instalação/deploy
│
└── frontend/         Angular 19 (tela de bipagem + painel admin)
    └── src/app/
        ├── scan/     tela de bipagem (kiosk, sem mouse)
        └── admin/    painel: dashboard, os-list, crachás, programação, login
```

## Começando

Veja **[backend/README.md](backend/README.md)** — tem o passo a passo
completo (instalar, migrar banco, buildar, rodar).

Resumo rápido:

```bash
cd backend
npm install
npm run migrate   # cria o banco (1ª vez só)
npm run deploy     # builda o Angular e copia pra backend/public/
npm start          # sobe tudo na porta 3000
```

## O que vai pro Git e o que não vai

Cada pasta tem seu próprio `.gitignore`. Regra geral:

**Vai (código-fonte):**
- Todo o `.ts`, `.html`, `.scss` do frontend
- Todo o `.js` do backend, `schema.sql`, `package.json`
- `package-lock.json` (trava as versões exatas das dependências)

**Não vai (gerado ou específico do ambiente):**
- `node_modules/` (backend e frontend) — recriado com `npm install`
- `backend/data/` — o banco SQLite (`.db`) de cada instalação é local, tem
  dados reais da fábrica, nunca é código
- `backend/pedidos-recebidos/` — pasta que o watcher monitora, se enche de
  PDFs reais das OS
- `backend/public/` — build do Angular copiado pra lá pelo `npm run deploy`;
  é gerado a partir de `frontend/`, reconstrói quando precisar
- `frontend/dist/`, `frontend/.angular/` — build e cache do Angular

Isso mantém o repositório só com código-fonte — sem banco de dados, sem
PDFs de OS reais, sem builds gerados.
