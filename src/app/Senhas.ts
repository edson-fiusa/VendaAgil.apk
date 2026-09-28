// Coloque este arquivo na mesma pasta do Usesessao.ts e do ConfigLocal.ts
//
// Instalar:
//   npx expo install expo-crypto
//   npm i @noble/hashes@1
//
// Formato guardado: pbkdf2$<iterações>$<salt hex>$<hash hex>
// Senhas antigas (texto puro) continuam funcionando e são
// convertidas no primeiro login bem-sucedido.

import * as Crypto from 'expo-crypto';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

import { obterConfig, salvarConfig } from './ConfigLocal';

// Ajuste medindo no aparelho mais fraco (deve levar ~0,5 a 1 s).
// O valor fica gravado no hash, então dá para aumentar depois.
const ITERACOES = 50_000;
const PREFIXO = 'pbkdf2';

const MAX_TENTATIVAS = 5;
const ESPERA_BASE_SEG = 60;
const ESPERA_MAX_SEG = 15 * 60;

// ------------------------------------------------------------
// HASH
// ------------------------------------------------------------

export async function gerarHash(senha: string): Promise<string> {
  const salt = Crypto.getRandomBytes(16);
  const derivado = pbkdf2(sha256, utf8ToBytes(senha), salt, {
    c: ITERACOES,
    dkLen: 32,
  });

  return `${PREFIXO}$${ITERACOES}$${bytesToHex(salt)}$${bytesToHex(derivado)}`;
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function jaEHash(armazenado: string | null | undefined): boolean {
  return !!armazenado && armazenado.startsWith(`${PREFIXO}$`);
}

export async function verificarSenha(
  digitada: string,
  armazenado: string | null | undefined
): Promise<{ ok: boolean; precisaMigrar: boolean }> {
  const guardado = armazenado || '';

  if (!guardado) {
    return { ok: false, precisaMigrar: false };
  }

  // Formato antigo: texto puro
  if (!jaEHash(guardado)) {
    const ok = iguais(digitada, guardado);
    return { ok, precisaMigrar: ok };
  }

  const [, it, saltHex, hashHex] = guardado.split('$');
  const iteracoes = Number(it);

  if (!iteracoes || !saltHex || !hashHex) {
    return { ok: false, precisaMigrar: false };
  }

  const derivado = pbkdf2(
    sha256,
    utf8ToBytes(digitada),
    hexToBytes(saltHex),
    { c: iteracoes, dkLen: 32 }
  );

  const ok = iguais(bytesToHex(derivado), hashHex);

  return { ok, precisaMigrar: ok && iteracoes < ITERACOES };
}

// ------------------------------------------------------------
// BLOQUEIO POR TENTATIVAS (gravado no banco, sobrevive ao app fechado)
// ------------------------------------------------------------

type EstadoTentativas = { falhas: number; ate: number };

async function lerEstado(chave: string): Promise<EstadoTentativas> {
  try {
    const bruto = await obterConfig(`tentativas:${chave}`);
    if (bruto) return JSON.parse(bruto) as EstadoTentativas;
  } catch {
    // ignora e segue como zerado
  }
  return { falhas: 0, ate: 0 };
}

/** Segundos que ainda faltam de bloqueio (0 = liberado). */
export async function segundosBloqueado(chave: string): Promise<number> {
  const { ate } = await lerEstado(chave);
  const restante = Math.ceil((ate - Date.now()) / 1000);
  return restante > 0 ? restante : 0;
}

export async function registrarFalha(chave: string): Promise<void> {
  const estado = await lerEstado(chave);
  const falhas = estado.falhas + 1;
  let ate = estado.ate;

  if (falhas >= MAX_TENTATIVAS) {
    const extra = falhas - MAX_TENTATIVAS;
    const espera = Math.min(ESPERA_BASE_SEG * 2 ** extra, ESPERA_MAX_SEG);
    ate = Date.now() + espera * 1000;
  }

  await salvarConfig(
    `tentativas:${chave}`,
    JSON.stringify({ falhas, ate })
  );
}

export async function limparFalhas(chave: string): Promise<void> {
  await salvarConfig(
    `tentativas:${chave}`,
    JSON.stringify({ falhas: 0, ate: 0 })
  );
}