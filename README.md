# Pedidos Fábrica

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
