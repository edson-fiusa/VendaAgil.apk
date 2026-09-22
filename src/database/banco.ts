import * as SQLite from 'expo-sqlite';

const NOME_BANCO = 'venda-agil.db';

let banco: SQLite.SQLiteDatabase | null = null;
let inicializado = false;
let inicializando: Promise<void> | null = null;

/**
 * Abre o único banco utilizado pelo aplicativo.
 */
let bancoPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function obterBanco(): Promise<SQLite.SQLiteDatabase> {
  if (!bancoPromise) {
    bancoPromise = SQLite.openDatabaseAsync(NOME_BANCO).then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA busy_timeout = 5000;');
      return db;
    });
  }

  return bancoPromise;
}

/**
 * Fecha a conexão atual com o banco e limpa o cache da promise.
 *
 * Necessário antes de restaurar um backup, pois o arquivo .db não pode
 * ser sobrescrito com segurança enquanto o SQLite mantém a conexão aberta
 * (principalmente em modo WAL, que também usa os arquivos -wal e -shm).
 *
 * Depois de chamar esta função, a próxima chamada a obterBanco() (ou
 * inicializarBanco()) abre uma conexão nova do zero.
 */
export async function fecharBanco(): Promise<void> {
  if (bancoPromise) {
    try {
      const db = await bancoPromise;
      await db.closeAsync();
    } catch (erro) {
      console.error('Erro ao fechar o banco local:', erro);
    }
  }

  bancoPromise = null;
  inicializado = false;
}

/**
 * Verifica se uma tabela existe.
 */
async function tabelaExiste(
  db: SQLite.SQLiteDatabase,
  tabela: string
): Promise<boolean> {
  const resultado = await db.getFirstAsync<{ nome: string }>(
    `
      SELECT name AS nome
      FROM sqlite_master
      WHERE type = 'table'
      AND name = ?
      LIMIT 1
    `,
    tabela
  );

  return !!resultado;
}

/**
 * Verifica se uma coluna existe.
 */
async function colunaExiste(
  db: SQLite.SQLiteDatabase,
  tabela: string,
  coluna: string
): Promise<boolean> {
  const colunas = await db.getAllAsync<{
    name: string;
  }>(`PRAGMA table_info(${tabela})`);

  return colunas.some((item) => item.name === coluna);
}

/**
 * Adiciona uma coluna somente se ela ainda não existir.
 */
async function adicionarColuna(
  db: SQLite.SQLiteDatabase,
  tabela: string,
  coluna: string,
  definicao: string
): Promise<void> {
  const existe = await colunaExiste(db, tabela, coluna);

  if (existe) {
    return;
  }

  console.log(
    `SQLite: adicionando coluna ${tabela}.${coluna}`
  );

  await db.runAsync(
    `ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`
  );
}

/**
 * Inicialização pública.
 *
 * Impede várias inicializações simultâneas.
 */
export function inicializarBanco(): Promise<void> {
  if (inicializado) {
    return Promise.resolve();
  }

  if (inicializando) {
    return inicializando;
  }

  inicializando = inicializarBancoInterno()
    .then(() => {
      inicializado = true;

      console.log(
        'Banco SQLite local inicializado com sucesso.'
      );
    })
    .catch((erro) => {
      console.error(
        'Erro ao inicializar banco local:',
        erro
      );

      inicializado = false;

      throw erro;
    })
    .finally(() => {
      inicializando = null;
    });

  return inicializando;
}

/**
 * Criação e migração do banco.
 *
 * IMPORTANTE:
 * - Não apaga dados.
 * - Não cria outro banco.
 * - Usa somente venda-agil.db.
 * - Usa somente tabelas *_local.
 */
async function inicializarBancoInterno(): Promise<void> {
  console.log(
    'Inicializando banco SQLite local...'
  );

  const db = await obterBanco();

  // =========================================================
  // CONFIGURAÇÃO
  // =========================================================

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS configuracao_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave TEXT NOT NULL UNIQUE,
      valor TEXT,
      atualizado_em TEXT
    )
  `);

  // =========================================================
  // PRODUTOS
  // =========================================================

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS produtos_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      ean TEXT UNIQUE,
      nome TEXT NOT NULL,
      marca TEXT,
      descricao TEXT,
      imagem TEXT,
      ncm TEXT,
      preco_entrada REAL NOT NULL DEFAULT 0,
      preco_venda REAL NOT NULL DEFAULT 0,
      unidade TEXT NOT NULL DEFAULT 'UN',
      quantidade REAL NOT NULL DEFAULT 0,
      estoque_minimo REAL NOT NULL DEFAULT 0,
      categoria TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT,
      atualizado_em TEXT
    )
  `);

  // =========================================================
  // OPERADORES
  // =========================================================

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS operadores_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      usuario TEXT,
      senha_hash TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT,
      atualizado_em TEXT
    )
  `);

  // =========================================================
  // CAIXAS
  // =========================================================

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS caixas_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operador_id INTEGER,
      status TEXT NOT NULL DEFAULT 'aberto',
      saldo_inicial REAL NOT NULL DEFAULT 0,
      saldo_final REAL,
      aberto_em TEXT,
      fechado_em TEXT,
      sincronizado INTEGER NOT NULL DEFAULT 0
    )
  `);

  // =========================================================
  // VENDAS
  // =========================================================

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS vendas_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caixa_id INTEGER,
      operador_id INTEGER,
      total REAL NOT NULL DEFAULT 0,
      forma_pagamento TEXT,
      status TEXT NOT NULL DEFAULT 'finalizada',
      valor_recebido REAL NOT NULL DEFAULT 0,
      troco REAL NOT NULL DEFAULT 0,
      observacao TEXT,
      criado_em TEXT,
      sincronizado INTEGER NOT NULL DEFAULT 0
    )
  `);

  // =========================================================
  // MIGRAÇÃO DE VENDAS
  // =========================================================

  if (await tabelaExiste(db, 'vendas_local')) {
    await adicionarColuna(
      db,
      'vendas_local',
      'caixa_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'operador_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'total',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'forma_pagamento',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'status',
      "TEXT NOT NULL DEFAULT 'finalizada'"
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'valor_recebido',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'troco',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'observacao',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'criado_em',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'vendas_local',
      'sincronizado',
      'INTEGER NOT NULL DEFAULT 0'
    );
  }

  // =========================================================
  // ITENS DA VENDA
  // =========================================================

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS itens_venda_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      codigo TEXT,
      nome TEXT,
      quantidade REAL NOT NULL DEFAULT 0,
      preco_unitario REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      sincronizado INTEGER NOT NULL DEFAULT 0
    )
  `);

  // =========================================================
  // MIGRAÇÃO DE ITENS DA VENDA
  // =========================================================

  if (
    await tabelaExiste(
      db,
      'itens_venda_local'
    )
  ) {
    await adicionarColuna(
      db,
      'itens_venda_local',
      'venda_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'itens_venda_local',
      'produto_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'itens_venda_local',
      'codigo',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'itens_venda_local',
      'nome',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'itens_venda_local',
      'quantidade',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'itens_venda_local',
      'preco_unitario',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'itens_venda_local',
      'subtotal',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'itens_venda_local',
      'sincronizado',
      'INTEGER NOT NULL DEFAULT 0'
    );
  }

  // =========================================================
  // AVARIAS
  // =========================================================

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS avarias_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      quantidade REAL NOT NULL DEFAULT 0,
      motivo TEXT NOT NULL,
      observacao TEXT,
      preco_custo REAL NOT NULL DEFAULT 0,
      data TEXT,
      operador_id INTEGER,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      criada_em TEXT
    )
  `);

  // =========================================================
  // MIGRAÇÃO DE AVARIAS
  // =========================================================

  if (await tabelaExiste(db, 'avarias_local')) {
    await adicionarColuna(
      db,
      'avarias_local',
      'produto_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'avarias_local',
      'quantidade',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'avarias_local',
      'motivo',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'avarias_local',
      'observacao',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'avarias_local',
      'preco_custo',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'avarias_local',
      'data',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'avarias_local',
      'operador_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'avarias_local',
      'sincronizado',
      'INTEGER NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'avarias_local',
      'criada_em',
      'TEXT'
    );

    // Preenche a data das avarias antigas.
    const possuiData = await colunaExiste(
      db,
      'avarias_local',
      'data'
    );

    const possuiCriadaEm = await colunaExiste(
      db,
      'avarias_local',
      'criada_em'
    );

    if (possuiData) {
      if (possuiCriadaEm) {
        await db.runAsync(`
          UPDATE avarias_local
          SET data = COALESCE(
            NULLIF(data, ''),
            criada_em,
            datetime('now')
          )
          WHERE data IS NULL
             OR data = ''
        `);
      } else {
        await db.runAsync(`
          UPDATE avarias_local
          SET data = datetime('now')
          WHERE data IS NULL
             OR data = ''
        `);
      }
    }
  }

  // =========================================================
  // MOVIMENTAÇÕES DE ESTOQUE
  // =========================================================

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS movimentacoes_estoque_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      quantidade REAL NOT NULL DEFAULT 0,
      quantidade_anterior REAL,
      quantidade_nova REAL,
      motivo TEXT,
      referencia_id INTEGER,
      operador_id INTEGER,
      criado_em TEXT,
      sincronizado INTEGER NOT NULL DEFAULT 0
    )
  `);

  // =========================================================
  // MIGRAÇÃO DE MOVIMENTAÇÕES
  // =========================================================

  if (
    await tabelaExiste(
      db,
      'movimentacoes_estoque_local'
    )
  ) {
    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'produto_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'tipo',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'quantidade',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'quantidade_anterior',
      'REAL'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'quantidade_nova',
      'REAL'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'motivo',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'referencia_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'operador_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'criado_em',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'movimentacoes_estoque_local',
      'sincronizado',
      'INTEGER NOT NULL DEFAULT 0'
    );
  }

  // =========================================================
  // MIGRAÇÃO DE PRODUTOS
  // =========================================================

  if (await tabelaExiste(db, 'produtos_local')) {
    await adicionarColuna(
      db,
      'produtos_local',
      'codigo',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'ean',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'nome',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'marca',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'descricao',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'imagem',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'ncm',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'preco_entrada',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'preco_venda',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'unidade',
      "TEXT NOT NULL DEFAULT 'UN'"
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'quantidade',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'estoque_minimo',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'categoria',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'ativo',
      'INTEGER NOT NULL DEFAULT 1'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'sincronizado',
      'INTEGER NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'criado_em',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'produtos_local',
      'atualizado_em',
      'TEXT'
    );
  }

  // =========================================================
  // MIGRAÇÃO DE OPERADORES
  // =========================================================

  if (
    await tabelaExiste(
      db,
      'operadores_local'
    )
  ) {
    await adicionarColuna(
      db,
      'operadores_local',
      'nome',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'operadores_local',
      'usuario',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'operadores_local',
      'senha_hash',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'operadores_local',
      'ativo',
      'INTEGER NOT NULL DEFAULT 1'
    );

    await adicionarColuna(
      db,
      'operadores_local',
      'sincronizado',
      'INTEGER NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'operadores_local',
      'criado_em',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'operadores_local',
      'atualizado_em',
      'TEXT'
    );
  }

  // =========================================================
  // MIGRAÇÃO DE CAIXAS
  // =========================================================

  if (
    await tabelaExiste(
      db,
      'caixas_local'
    )
  ) {
    await adicionarColuna(
      db,
      'caixas_local',
      'operador_id',
      'INTEGER'
    );

    await adicionarColuna(
      db,
      'caixas_local',
      'status',
      "TEXT NOT NULL DEFAULT 'aberto'"
    );

    await adicionarColuna(
      db,
      'caixas_local',
      'saldo_inicial',
      'REAL NOT NULL DEFAULT 0'
    );

    await adicionarColuna(
      db,
      'caixas_local',
      'saldo_final',
      'REAL'
    );

    await adicionarColuna(
      db,
      'caixas_local',
      'aberto_em',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'caixas_local',
      'fechado_em',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'caixas_local',
      'sincronizado',
      'INTEGER NOT NULL DEFAULT 0'
    );
  }

  // =========================================================
  // MIGRAÇÃO DE CONFIGURAÇÃO
  // =========================================================

  if (
    await tabelaExiste(
      db,
      'configuracao_local'
    )
  ) {
    await adicionarColuna(
      db,
      'configuracao_local',
      'chave',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'configuracao_local',
      'valor',
      'TEXT'
    );

    await adicionarColuna(
      db,
      'configuracao_local',
      'atualizado_em',
      'TEXT'
    );
  }

  // =========================================================
  // FINALIZAÇÃO
  // =========================================================

  console.log(
    'Estrutura SQLite local verificada.'
  );
}