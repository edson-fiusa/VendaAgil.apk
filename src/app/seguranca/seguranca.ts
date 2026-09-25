// ============================================================
// SEGURANÇA — VALIDAÇÃO DA SENHA MESTRA
// ============================================================
//
// IMPORTANTE (leia antes de mexer neste arquivo):
//
// A senha NÃO fica gravada em texto puro em nenhum lugar do
// código. Em vez disso, guardamos apenas o "hash" SHA-256 dela
// (uma sequência de 64 caracteres que não pode ser revertida
// para descobrir a senha original).
//
// Quando o usuário digita uma senha na tela de bloqueio, nós
// calculamos o hash SHA-256 do que ele digitou e comparamos
// com o hash salvo aqui. Se forem iguais, a senha está correta.
//
// AVISO HONESTO: como este é um aplicativo React Native, todo
// o código-fonte (incluindo este arquivo) acaba compilado e
// pode, com esforço técnico, ser extraído do aplicativo
// instalado. Isso significa que não existe forma 100% segura
// de esconder uma senha dentro de um app que roda no aparelho
// do usuário. Usar o hash SHA-256 já é MUITO melhor do que
// deixar a senha "estoquemestre" escrita diretamente no código
// (o que apareceria pronta para qualquer pessoa que abrisse o
// arquivo), mas não é uma proteção de nível bancário. Para algo
// realmente seguro, a validação da senha precisaria acontecer
// em um servidor, não dentro do aplicativo.
//
// Para trocar a senha no futuro, gere um novo hash SHA-256 da
// nova senha (qualquer gerador de hash SHA-256 confiável serve)
// e substitua o valor da constante HASH_SENHA_MESTRE abaixo.

function rightRotate(valor: number, quantidade: number): number {
  return (valor >>> quantidade) | (valor << (32 - quantidade));
}

/**
 * Implementação pura de SHA-256 em JavaScript (sem dependências
 * externas). Recebe um texto e devolve o hash em hexadecimal.
 */
function sha256Hex(mensagem: string): string {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a,
    h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const utf8 = unescape(encodeURIComponent(mensagem));
  const bytes: number[] = [];

  for (let i = 0; i < utf8.length; i++) {
    bytes.push(utf8.charCodeAt(i) & 0xff);
  }

  const bitLenLo = bytes.length * 8;

  bytes.push(0x80);

  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  for (let i = 3; i >= 0; i--) {
    bytes.push(0);
  }

  for (let i = 3; i >= 0; i--) {
    bytes.push((bitLenLo >>> (i * 8)) & 0xff);
  }

  const w = new Array<number>(64);

  for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += 64) {
    for (let i = 0; i < 16; i++) {
      const offset = chunkStart + i * 4;

      w[i] =
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3];
    }

    for (let i = 16; i < 64; i++) {
      const s0 =
        rightRotate(w[i - 15], 7) ^
        rightRotate(w[i - 15], 18) ^
        (w[i - 15] >>> 3);

      const s1 =
        rightRotate(w[i - 2], 17) ^
        rightRotate(w[i - 2], 19) ^
        (w[i - 2] >>> 10);

      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');

  return (
    toHex(h0) +
    toHex(h1) +
    toHex(h2) +
    toHex(h3) +
    toHex(h4) +
    toHex(h5) +
    toHex(h6) +
    toHex(h7)
  );
}

// Hash SHA-256 da senha mestra. Não é a senha em texto puro —
// é o resultado do hash, que não pode ser revertido para
// descobrir a senha original.
const HASH_SENHA_MESTRE =
  '2d985aae6e495676cd7cf6160b308454dacc55d079dd41a2137c9012a0b49019';

/**
 * Verifica se a senha digitada pelo usuário corresponde à
 * senha mestra de desbloqueio do aplicativo.
 */
export function verificarSenhaMestre(senhaDigitada: string): boolean {
  const texto = String(senhaDigitada || '').trim();

  if (!texto) {
    return false;
  }

  return sha256Hex(texto) === HASH_SENHA_MESTRE;
}