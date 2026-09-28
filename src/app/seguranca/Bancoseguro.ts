import * as SQLite from 'expo-sqlite';

import {
  bancoJaMigrado,
  marcarBancoMigrado,
  obterChaveBanco,
} from '../Armazenamentoseguro';

// Nome que o seu banco.ts usava (NOME_BANCO) antes da criptografia.
const NOME_ANTIGO = 'venda-agil.db';
export const NOME_BANCO_SEGURO = 'venda-agil-seguro.db';
const NOME_SEGURO = NOME_BANCO_SEGURO;

/**
 * Copia o banco antigo (sem criptografia) para um banco novo
 * criptografado e apaga o antigo. Roda uma única vez por aparelho.
 */
async function migrarBancoAntigo(chave: string) {
  const antigo = await SQLite.openDatabaseAsync(NOME_ANTIGO);

  const contagem = await antigo.getFirstAsync<{ n: number }>(
    'SELECT count(*) AS n FROM sqlite_master'
  );

  if (Number(contagem?.n ?? 0) > 0) {
    const versao = await antigo.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version'
    );

    const caminhoNovo = `${SQLite.defaultDatabaseDirectory}/${NOME_SEGURO}`;

    // A chave é hexadecimal (gerada por nós), então é segura dentro
    // das aspas.
    await antigo.execAsync(
      `ATTACH DATABASE '${caminhoNovo}' AS seguro KEY '${chave}';`
    );
    await antigo.execAsync(`SELECT sqlcipher_export('seguro');`);
    await antigo.execAsync(
      `PRAGMA seguro.user_version = ${Number(versao?.user_version ?? 0)};`
    );
    await antigo.execAsync(`DETACH DATABASE seguro;`);
  }

  await antigo.closeAsync();
  await SQLite.deleteDatabaseAsync(NOME_ANTIGO);
}

/**
 * Use no lugar do openDatabaseAsync do seu banco.ts:
 *
 *   const db = await abrirBancoSeguro();
 *   // ...o resto (CREATE TABLE etc.) continua igual
 */
export async function abrirBancoSeguro(): Promise<SQLite.SQLiteDatabase> {
  // Sem cache aqui de propósito: o banco.ts já guarda a promise, e o
  // fecharBanco() dele precisa conseguir reabrir a conexão do zero.
  const chave = await obterChaveBanco();

  if (!(await bancoJaMigrado())) {
    await migrarBancoAntigo(chave);
    await marcarBancoMigrado();
  }

  const db = await SQLite.openDatabaseAsync(NOME_SEGURO);

  // PRAGMA key precisa ser o primeiro comando após abrir.
  await db.execAsync(`PRAGMA key = '${chave}';`);

  // Se a chave estiver errada, isto falha ("file is not a database").
  await db.getFirstAsync('SELECT count(*) FROM sqlite_master');

  return db;
}