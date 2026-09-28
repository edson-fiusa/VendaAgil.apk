import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// No Android o SecureStore guarda os valores criptografados com uma
// chave do Android Keystore (fora do APK e fora do bundle JS).

const CHAVE_TOKEN_MP = 'vendaagil.mp_access_token';
const CHAVE_BANCO = 'vendaagil.db_key';
const CHAVE_BANCO_MIGRADO = 'vendaagil.db_migrado';

const OPCOES: SecureStore.SecureStoreOptions = {
  // Só iOS; no Android é ignorado.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// ---------------------------------------------------------------
// Token do Mercado Pago (um por comerciante, digitado no app)
// ---------------------------------------------------------------

/** Remove "Bearer ", aspas, espaços e quebras de linha de uma colagem. */
export function limparTokenDigitado(bruto: string): string {
  let t = String(bruto ?? '').trim();
  t = t.replace(/^bearer\s+/i, '');
  t = t.replace(/^["']+|["']+$/g, '');
  return t.replace(/\s+/g, '');
}

/**
 * Validação básica de formato. A Public Key também começa com
 * "APP_USR-", mas é bem mais curta (formato UUID), então o tamanho
 * mínimo já a descarta.
 */
export function tokenMPValido(token: string): boolean {
  return /^(APP_USR|TEST)-[A-Za-z0-9-]{40,}$/.test(token);
}

export function tokenEhDeTeste(token: string): boolean {
  return token.startsWith('TEST-');
}

export async function salvarTokenMP(token: string): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_TOKEN_MP, token, OPCOES);
}

export async function lerTokenMP(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CHAVE_TOKEN_MP, OPCOES);
  } catch {
    return null;
  }
}

export async function removerTokenMP(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_TOKEN_MP, OPCOES);
}

// ---------------------------------------------------------------
// Chave de criptografia do banco (SQLCipher)
// ---------------------------------------------------------------

/**
 * Devolve a chave do banco (64 caracteres hexadecimais). Na primeira
 * chamada gera 32 bytes aleatórios e guarda no SecureStore.
 *
 * ATENÇÃO: se essa chave for perdida, o banco não abre mais.
 */
export async function obterChaveBanco(): Promise<string> {
  const existente = await SecureStore.getItemAsync(CHAVE_BANCO, OPCOES);

  if (existente) {
    return existente;
  }

  const bytes = await Crypto.getRandomBytesAsync(32);

  const chave = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await SecureStore.setItemAsync(CHAVE_BANCO, chave, OPCOES);

  return chave;
}

export async function bancoJaMigrado(): Promise<boolean> {
  return (
    (await SecureStore.getItemAsync(CHAVE_BANCO_MIGRADO, OPCOES)) === '1'
  );
}

export async function marcarBancoMigrado(): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_BANCO_MIGRADO, '1', OPCOES);
}