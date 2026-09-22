import { obterBanco } from '../database/banco';

// ============================================================
// TIPOS
// ============================================================

export type ProvedorPagamento = 'mercadopago';

export type ConfiguracaoPagamento = {
  provedor: ProvedorPagamento;
  accessToken: string | null; // access_token do Mercado Pago
  refreshToken: string | null;
  ativo: boolean;
};

// ============================================================
// CRIAÇÃO DA TABELA
// Chame isso uma vez na inicialização do banco (junto com
// as outras tabelas do seu banco.ts / migrations)
// ============================================================

export async function criarTabelaConfiguracoesPagamento() {
  const db = await obterBanco();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS configuracoes_pagamento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provedor TEXT NOT NULL UNIQUE,
      access_token TEXT,
      refresh_token TEXT,
      ativo INTEGER DEFAULT 1,
      atualizado_em TEXT
    );
  `);
}

// ============================================================
// SALVAR / ATUALIZAR CREDENCIAIS DE UM PROVEDOR
// ============================================================

export async function salvarConfiguracaoPagamento(params: {
  provedor: ProvedorPagamento;
  accessToken?: string | null;
  refreshToken?: string | null;
}) {
  const db = await obterBanco();
  const agora = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO configuracoes_pagamento
      (provedor, access_token, refresh_token, ativo, atualizado_em)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(provedor) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      ativo = 1,
      atualizado_em = excluded.atualizado_em
    `,
    [
      params.provedor,
      params.accessToken ?? null,
      params.refreshToken ?? null,
      agora,
    ]
  );
}

// ============================================================
// BUSCAR CONFIGURAÇÃO DE UM PROVEDOR ESPECÍFICO
// ============================================================

export async function buscarConfiguracaoPagamento(
  provedor: ProvedorPagamento
): Promise<ConfiguracaoPagamento | null> {
  const db = await obterBanco();

  const linha = await db.getFirstAsync<{
    provedor: string;
    access_token: string | null;
    refresh_token: string | null;
    ativo: number;
  }>(
    `
    SELECT provedor, access_token, refresh_token, ativo
    FROM configuracoes_pagamento
    WHERE provedor = ?
    LIMIT 1
    `,
    [provedor]
  );

  if (!linha) {
    return null;
  }

  return {
    provedor: linha.provedor as ProvedorPagamento,
    accessToken: linha.access_token,
    refreshToken: linha.refresh_token,
    ativo: Number(linha.ativo) === 1,
  };
}

// ============================================================
// DESCOBRIR SE O MERCADO PAGO ESTÁ CONFIGURADO E ATIVO
// ============================================================

export async function buscarProvedorAtivo(): Promise<ConfiguracaoPagamento | null> {
  const mercadoPago = await buscarConfiguracaoPagamento('mercadopago');

  if (mercadoPago?.ativo && mercadoPago.accessToken) {
    return mercadoPago;
  }

  return null;
}

// ============================================================
// DESCONECTAR UM PROVEDOR (apagar credenciais salvas)
// ============================================================

export async function removerConfiguracaoPagamento(
  provedor: ProvedorPagamento
) {
  const db = await obterBanco();

  await db.runAsync(
    `DELETE FROM configuracoes_pagamento WHERE provedor = ?`,
    [provedor]
  );
}                               