import { obterBanco } from '../../src/database/banco';

export async function obterConfig(chave: string): Promise<string | null> {
  const db = await obterBanco();

  const linha = await db.getFirstAsync<{
    valor: string | null;
  }>(
    `
    SELECT valor
    FROM configuracao_local
    WHERE chave = ?
    LIMIT 1
    `,
    chave
  );

  return linha?.valor ?? null;
}

export async function salvarConfig(
  chave: string,
  valor: string
): Promise<void> {
  const db = await obterBanco();

  const agora = new Date().toISOString();

  await db.runAsync(
    `
    INSERT OR REPLACE INTO configuracao_local
    (chave, valor, atualizado_em)
    VALUES (?, ?, ?)
    `,
    chave,
    valor,
    agora
  );
}