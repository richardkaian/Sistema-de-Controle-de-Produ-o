-- ========================================================
-- pedidos-fabrica — schema SQLite
-- ========================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- Funcionários / crachás
-- Usada tanto pros operadores que bipam nas estações
-- quanto pros admins (role='admin' + senha_hash preenchido
-- pra login no painel).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS funcionarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_cracha  TEXT NOT NULL UNIQUE,        -- ex: FUNC-0001
  nome           TEXT NOT NULL,
  cargo          TEXT,
  role           TEXT NOT NULL DEFAULT 'operador'
                   CHECK (role IN ('operador', 'admin')),
  senha_hash     TEXT,                        -- só usado se role = 'admin'
  ativo          INTEGER NOT NULL DEFAULT 1
                   CHECK (ativo IN (0, 1)),
  criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funcionarios_cracha
  ON funcionarios (codigo_cracha);

-- ---------------------------------------------------------
-- Ordens de serviço
-- status avança automaticamente via trigger (ver embaixo)
-- conforme os eventos de bipagem chegam.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ordens_servico (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_os              TEXT NOT NULL UNIQUE,   -- ex: 313614
  vendedor               TEXT,
  cliente                TEXT NOT NULL,
  data_pedido            TEXT,                   -- ISO 8601 (YYYY-MM-DD)
  data_limite_usinagem   TEXT,                   -- ISO 8601 (YYYY-MM-DD)
  tempo_usinagem_total   REAL,
  status                 TEXT NOT NULL DEFAULT 'aguardando'
                           CHECK (status IN (
                             'aguardando', 'separacao', 'corte',
                             'usinagem', 'expedicao', 'concluido'
                           )),
  ordem_producao         INTEGER,                -- posição na fila de programação (NULL = fora da fila)
  arquivo_origem         TEXT,                   -- nome/caminho do PDF que originou
  criado_em              TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_os_numero  ON ordens_servico (numero_os);
CREATE INDEX IF NOT EXISTS idx_os_status  ON ordens_servico (status);
CREATE INDEX IF NOT EXISTS idx_os_ordem_producao ON ordens_servico (ordem_producao);

-- ---------------------------------------------------------
-- Itens de cada OS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS itens_os (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id           INTEGER NOT NULL
                    REFERENCES ordens_servico (id) ON DELETE CASCADE,
  qtd             INTEGER NOT NULL,
  tempo_por_item  REAL,
  descricao       TEXT NOT NULL,
  observacoes     TEXT   -- ex: "USINAGEM CONFORME DESENHO Nº F5 8000..."
);

CREATE INDEX IF NOT EXISTS idx_itens_os ON itens_os (os_id);

-- ---------------------------------------------------------
-- Eventos de bipagem (histórico completo, nunca sobrescreve)
-- Cada bipagem de OS numa estação gera uma linha aqui.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos_bipagem (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id           INTEGER NOT NULL
                    REFERENCES ordens_servico (id) ON DELETE CASCADE,
  funcionario_id  INTEGER NOT NULL
                    REFERENCES funcionarios (id),
  etapa           TEXT NOT NULL
                    CHECK (etapa IN ('separacao', 'corte', 'usinagem', 'expedicao')),
  tipo_evento     TEXT NOT NULL
                    CHECK (tipo_evento IN ('inicio', 'fim')),
  criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eventos_os           ON eventos_bipagem (os_id);
CREATE INDEX IF NOT EXISTS idx_eventos_funcionario   ON eventos_bipagem (funcionario_id);
CREATE INDEX IF NOT EXISTS idx_eventos_etapa         ON eventos_bipagem (etapa);

-- ---------------------------------------------------------
-- Trigger: avança o status da OS sozinho a cada bipagem
-- - "inicio" numa etapa -> status vira essa etapa
-- - "fim" na expedição   -> status vira "concluido"
-- Ajuste essa lógica se quiser regras diferentes
-- (ex: exigir "fim" de todas as etapas anteriores antes de avançar).
-- ---------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_atualiza_status_os
AFTER INSERT ON eventos_bipagem
BEGIN
  UPDATE ordens_servico
  SET status = CASE
        WHEN NEW.tipo_evento = 'inicio' THEN NEW.etapa
        WHEN NEW.tipo_evento = 'fim' AND NEW.etapa = 'expedicao' THEN 'concluido'
        ELSE status
      END,
      atualizado_em = datetime('now')
  WHERE id = NEW.os_id;
END;
