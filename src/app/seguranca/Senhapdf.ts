import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// ============================================================
// SENHA DE PROTEÇÃO DOS PDFs
//
// Este módulo gerencia a senha usada para proteger (criptografar) os
// relatórios em PDF gerados pelo aplicativo.
//
// COMO FUNCIONA A SEGURANÇA AQUI:
//
// - A senha em texto puro NUNCA é salva em disco, em nenhum momento.
//   Ela só existe na memória do aparelho durante o tempo necessário
//   para criptografar o PDF (alguns milissegundos) e depois é
//   descartada.
//
// - O que fica salvo é só um HASH (SHA-256) da senha, junto com um
//   "salt" aleatório. Isso é usado apenas para CONFERIR se a senha
//   que o usuário digitou da próxima vez é a mesma de antes — é o
//   mesmo princípio de uma senha de login: nunca se guarda a senha,
//   só um jeito de validar.
//
// - O hash e o salt são guardados com expo-secure-store. No Android,
//   o expo-secure-store usa automaticamente o Android Keystore por
//   baixo dos panos (armazenamento criptografado apoiado no hardware
//   do aparelho, quando disponível) — não é preciso configurar nada
//   a mais para isso acontecer. No iOS, usa o Keychain.
//
// CONSEQUÊNCIA IMPORTANTE (e isso é esperado, não é um bug):
// Se o usuário esquecer a senha, não tem como recuperá-la, e os PDFs
// já gerados com ela continuam exigindo a senha antiga para abrir.
// A única coisa possível é cadastrar uma senha NOVA para os PRÓXIMOS
// PDFs (função redefinirSenhaPdf).
// ============================================================

const CHAVE_HASH = 'venda_agil_pdf_senha_hash';
const CHAVE_SALT = 'venda_agil_pdf_senha_salt';

function bytesParaHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function gerarSalt(): Promise<string> {
  const bytesAleatorios = await Crypto.getRandomBytesAsync(16);
  return bytesParaHex(bytesAleatorios);
}

async function calcularHash(senha: string, salt: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${senha}`
  );
}

/**
 * Indica se já existe uma senha cadastrada para proteger os PDFs.
 * Usado para decidir se o modal deve mostrar "criar senha" (primeira
 * vez) ou "digitar senha" (já existe uma cadastrada).
 */
export async function possuiSenhaPdfCadastrada(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(CHAVE_HASH);
  return !!hash;
}

/**
 * Cadastra (ou substitui) a senha usada para proteger os PDFs.
 * Guarda apenas o hash + salt no Keystore/Keychain — nunca a senha
 * em texto puro.
 */
export async function cadastrarSenhaPdf(senha: string): Promise<void> {
  const senhaLimpa = senha.trim();

  if (senhaLimpa.length < 4) {
    throw new Error('A senha precisa ter pelo menos 4 caracteres.');
  }

  const salt = await gerarSalt();
  const hash = await calcularHash(senhaLimpa, salt);

  await SecureStore.setItemAsync(CHAVE_SALT, salt);
  await SecureStore.setItemAsync(CHAVE_HASH, hash);
}

/**
 * Confere se a senha digitada bate com a senha cadastrada.
 * Retorna false se ainda não houver nenhuma senha cadastrada.
 */
export async function validarSenhaPdf(senha: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(CHAVE_SALT);
  const hashSalvo = await SecureStore.getItemAsync(CHAVE_HASH);

  if (!salt || !hashSalvo) {
    return false;
  }

  const hashDigitado = await calcularHash(senha.trim(), salt);

  return hashDigitado === hashSalvo;
}

/**
 * Remove a senha cadastrada. Depois disso, o app vai pedir para
 * cadastrar uma nova senha na próxima vez que gerar um PDF protegido.
 *
 * Não afeta PDFs já gerados anteriormente — eles continuam exigindo
 * a senha antiga para abrir, pois a criptografia já está "dentro" do
 * arquivo. Isso é uma limitação da própria criptografia de PDF, não
 * do app.
 */
export async function redefinirSenhaPdf(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_HASH);
  await SecureStore.deleteItemAsync(CHAVE_SALT);
}

export default {
  possuiSenhaPdfCadastrada,
  cadastrarSenhaPdf,
  validarSenhaPdf,
  redefinirSenhaPdf,
};