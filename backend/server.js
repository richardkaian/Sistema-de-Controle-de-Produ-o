// server.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');

const { extrairOS } = require('./os-parser');
const { salvarOS, listarOS, buscarOSCompleta, atualizarStatus, ErroOS,
  listarProgramacao, listarDisponiveisParaProgramacao, reordenarProgramacao,
  adicionarAProgramacao, removerDaProgramacao } = require('./os-service');
const { iniciarWatcher } = require('./watcher');
const {
  buscarPorCracha,
  listarFuncionarios,
  criarFuncionario,
  atualizarStatusAtivo,
  ErroFuncionario,
} = require('./funcionario-service');
const { registrarEvento, ErroBipagem } = require('./bipagem-service');
const { listarRecentes } = require('./eventos-service');
const { login: loginAdmin, trocarSenha, ErroAuth } = require('./auth-service');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log(`[socket] painel conectado: ${socket.id}`);
});

// ---------------------------------------------------------
// POST /os/upload — envio manual de um PDF "Controle Usinagem"
// campo do form-data: "arquivo"
// ---------------------------------------------------------
app.post('/os/upload', upload.single('arquivo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erro: 'Nenhum arquivo enviado (campo "arquivo").' });
  }

  try {
    const dados = await extrairOS(req.file.buffer);
    const resultado = salvarOS(dados, req.file.originalname);

    if (!resultado.ja_existia) {
      io.emit('os:nova', { os_id: resultado.os_id, numero_os: resultado.numero_os });
    }

    res.status(resultado.ja_existia ? 200 : 201).json(resultado);
  } catch (erro) {
    console.error('[upload] falha ao processar PDF:', erro.message);
    res.status(422).json({ erro: erro.message });
  }
});

// ---------------------------------------------------------
// GET /os — lista todas as OS (visão do admin)
// ---------------------------------------------------------
app.get('/os', (req, res) => {
  res.json(listarOS());
});

// ---------------------------------------------------------
// GET /os/:numero_os — detalhe de uma OS específica com seus itens
// ---------------------------------------------------------
app.get('/os/:numero_os', (req, res) => {
  const os = buscarOSCompleta(req.params.numero_os);
  if (!os) return res.status(404).json({ erro: 'OS não encontrada.' });
  res.json(os);
});

// ---------------------------------------------------------
// PATCH /os/:numero_os/status — move a OS manualmente pra
// qualquer estágio (uso administrativo, sobrescreve o que os
// eventos de bipagem calcularam). Corpo esperado: { status }
// ---------------------------------------------------------
app.patch('/os/:numero_os/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ codigo: 'CAMPO_FALTANDO', erro: '"status" é obrigatório.' });
  }

  try {
    const os = atualizarStatus(req.params.numero_os, status);
    io.emit('os:status-atualizado', { numero_os: os.numero_os, status: os.status });
    res.json(os);
  } catch (erro) {
    if (erro instanceof ErroOS) {
      const statusHttp = erro.codigo === 'OS_NAO_ENCONTRADA' ? 404 : 400;
      return res.status(statusHttp).json({ codigo: erro.codigo, erro: erro.message });
    }
    console.error('[os] erro inesperado ao atualizar status:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha ao atualizar status.' });
  }
});

// ---------------------------------------------------------
// Programação de produção — fila ordenável de usinagem.
// GET  /programacao          -> { fila, disponiveis }
// PUT  /programacao/ordem    -> { numeros_os: [...] } regrava a ordem inteira
// POST /programacao/:numero_os   -> adiciona uma OS ao fim da fila
// DELETE /programacao/:numero_os -> tira uma OS da fila
// ---------------------------------------------------------
app.get('/programacao', (req, res) => {
  res.json({
    fila: listarProgramacao(),
    disponiveis: listarDisponiveisParaProgramacao(),
  });
});

app.put('/programacao/ordem', (req, res) => {
  const { numeros_os } = req.body;
  if (!Array.isArray(numeros_os) || numeros_os.length === 0) {
    return res.status(400).json({ codigo: 'CAMPO_FALTANDO', erro: '"numeros_os" precisa ser uma lista não vazia.' });
  }

  try {
    reordenarProgramacao(numeros_os);
    io.emit('programacao:atualizada');
    res.json({ ok: true });
  } catch (erro) {
    console.error('[programacao] erro ao reordenar:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha ao reordenar a fila.' });
  }
});

app.post('/programacao/:numero_os', (req, res) => {
  try {
    const os = adicionarAProgramacao(req.params.numero_os);
    io.emit('programacao:atualizada');
    res.json(os);
  } catch (erro) {
    if (erro instanceof ErroOS) {
      return res.status(erro.codigo === 'OS_NAO_ENCONTRADA' ? 404 : 400).json({ codigo: erro.codigo, erro: erro.message });
    }
    console.error('[programacao] erro ao adicionar à fila:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha ao adicionar à programação.' });
  }
});

app.delete('/programacao/:numero_os', (req, res) => {
  try {
    const os = removerDaProgramacao(req.params.numero_os);
    io.emit('programacao:atualizada');
    res.json(os);
  } catch (erro) {
    if (erro instanceof ErroOS) {
      return res.status(erro.codigo === 'OS_NAO_ENCONTRADA' ? 404 : 400).json({ codigo: erro.codigo, erro: erro.message });
    }
    console.error('[programacao] erro ao remover da fila:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha ao remover da programação.' });
  }
});

// ---------------------------------------------------------
// GET /funcionarios — lista todos os crachás (área admin)
// POST /funcionarios — cadastra um novo crachá (área admin)
// PATCH /funcionarios/:id/ativo — ativa/desativa um crachá
// ---------------------------------------------------------
app.get('/funcionarios', (req, res) => {
  res.json(listarFuncionarios());
});

app.post('/funcionarios', (req, res) => {
  try {
    const funcionario = criarFuncionario(req.body);
    io.emit('funcionario:novo', funcionario);
    res.status(201).json(funcionario);
  } catch (erro) {
    if (erro instanceof ErroFuncionario) {
      const status = erro.codigo === 'CRACHA_DUPLICADO' ? 409 : 400;
      return res.status(status).json({ codigo: erro.codigo, erro: erro.message });
    }
    console.error('[funcionarios] erro inesperado:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha ao cadastrar funcionário.' });
  }
});

app.patch('/funcionarios/:id/ativo', (req, res) => {
  const { ativo } = req.body;
  if (typeof ativo !== 'boolean') {
    return res.status(400).json({ codigo: 'CAMPO_INVALIDO', erro: '"ativo" precisa ser true ou false.' });
  }

  try {
    const funcionario = atualizarStatusAtivo(Number(req.params.id), ativo);
    io.emit('funcionario:atualizado', funcionario);
    res.json(funcionario);
  } catch (erro) {
    if (erro instanceof ErroFuncionario) {
      return res.status(404).json({ codigo: erro.codigo, erro: erro.message });
    }
    console.error('[funcionarios] erro inesperado:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha ao atualizar funcionário.' });
  }
});

// ---------------------------------------------------------
// GET /funcionarios/:codigo_cracha — valida um crachá bipado
// (usado pela tela de bipagem assim que o operador bipa o crachá,
// antes mesmo de bipar a OS)
// ---------------------------------------------------------
app.get('/funcionarios/:codigo_cracha', (req, res) => {
  const funcionario = buscarPorCracha(req.params.codigo_cracha);
  if (!funcionario) {
    return res.status(404).json({ codigo: 'CRACHA_NAO_ENCONTRADO', erro: 'Crachá não cadastrado.' });
  }
  if (!funcionario.ativo) {
    return res.status(403).json({ codigo: 'CRACHA_INATIVO', erro: 'Este crachá está inativo.' });
  }
  res.json(funcionario);
});

// ---------------------------------------------------------
// GET /eventos — feed dos últimos eventos de bipagem (dashboard)
// ---------------------------------------------------------
app.get('/eventos', (req, res) => {
  const limite = Number(req.query.limite) || 50;
  res.json(listarRecentes(limite));
});

// ---------------------------------------------------------
// POST /bipagem — registra a bipagem de uma OS numa etapa,
// identificada pelo crachá do operador. Corpo esperado:
// { codigo_cracha, numero_os, etapa }
// ---------------------------------------------------------
const CODIGO_PARA_STATUS = {
  ETAPA_INVALIDA: 400,
  CRACHA_NAO_ENCONTRADO: 404,
  CRACHA_INATIVO: 403,
  OS_NAO_ENCONTRADA: 404,
};

app.post('/bipagem', (req, res) => {
  const { codigo_cracha, numero_os, etapa } = req.body;

  if (!codigo_cracha || !numero_os || !etapa) {
    return res.status(400).json({
      codigo: 'CAMPOS_FALTANDO',
      erro: 'codigo_cracha, numero_os e etapa são obrigatórios.',
    });
  }

  try {
    const resultado = registrarEvento({ codigo_cracha, numero_os, etapa });
    io.emit('bipagem:novo', resultado);
    res.status(201).json(resultado);
  } catch (erro) {
    if (erro instanceof ErroBipagem) {
      const status = CODIGO_PARA_STATUS[erro.codigo] || 400;
      return res.status(status).json({ codigo: erro.codigo, erro: erro.message });
    }
    console.error('[bipagem] erro inesperado:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha inesperada ao registrar bipagem.' });
  }
});

// ---------------------------------------------------------
// POST /auth/login — login da área admin (crachá + senha)
// POST /auth/trocar-senha — troca de senha (ex: sair da senha padrão)
// ---------------------------------------------------------
const CODIGO_PARA_STATUS_AUTH = {
  SENHA_INVALIDA: 401,
  SEM_PERMISSAO: 403,
  CRACHA_INATIVO: 403,
  CRACHA_NAO_ENCONTRADO: 404,
};

app.post('/auth/login', (req, res) => {
  const { codigo_cracha, senha } = req.body;
  if (!codigo_cracha || !senha) {
    return res.status(400).json({
      codigo: 'CAMPOS_FALTANDO',
      erro: 'codigo_cracha e senha são obrigatórios.',
    });
  }

  try {
    const funcionario = loginAdmin(codigo_cracha, senha);
    res.json(funcionario);
  } catch (erro) {
    if (erro instanceof ErroAuth) {
      const status = CODIGO_PARA_STATUS_AUTH[erro.codigo] || 400;
      return res.status(status).json({ codigo: erro.codigo, erro: erro.message });
    }
    console.error('[auth] erro inesperado:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha ao fazer login.' });
  }
});

app.post('/auth/trocar-senha', (req, res) => {
  const { codigo_cracha, senha_atual, senha_nova } = req.body;
  if (!codigo_cracha || !senha_atual || !senha_nova) {
    return res.status(400).json({
      codigo: 'CAMPOS_FALTANDO',
      erro: 'codigo_cracha, senha_atual e senha_nova são obrigatórios.',
    });
  }

  try {
    trocarSenha(codigo_cracha, senha_atual, senha_nova);
    res.json({ sucesso: true });
  } catch (erro) {
    if (erro instanceof ErroAuth) {
      const status = CODIGO_PARA_STATUS_AUTH[erro.codigo] || 400;
      return res.status(status).json({ codigo: erro.codigo, erro: erro.message });
    }
    console.error('[auth] erro inesperado:', erro);
    res.status(500).json({ codigo: 'ERRO_INTERNO', erro: 'Falha ao trocar senha.' });
  }
});

// ---------------------------------------------------------
// Deploy único: serve o build de produção do Angular (pasta
// "public", gerada por `npm run build:frontend` — veja README).
// Fica DEPOIS de todas as rotas de API acima, pra elas terem
// prioridade, e o fallback abaixo cobre as rotas internas do
// Angular Router (ex: /admin/os) que não existem como arquivo.
// ---------------------------------------------------------
const PASTA_FRONTEND = path.join(__dirname, 'public');
app.use(express.static(PASTA_FRONTEND));

app.get('*', (req, res, next) => {
  // Não intercepta chamadas de API que não bateram em nenhuma rota
  // acima (essas devem continuar caindo em 404 normal, não no index.html)
  const prefixosApi = ['/os', '/funcionarios', '/eventos', '/bipagem', '/auth', '/programacao'];
  if (prefixosApi.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    return next();
  }
  res.sendFile(path.join(PASTA_FRONTEND, 'index.html'));
});

const PORTA = process.env.PORTA || 3000;

server.listen(PORTA, () => {
  console.log(`[server] rodando em http://localhost:${PORTA}`);
  iniciarWatcher(io); // começa a monitorar a pasta assim que o servidor sobe
});
