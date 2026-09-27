export function numero(valor: any): number {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : 0;
  }

  if (valor === null || valor === undefined) {
    return 0;
  }

  let texto = String(valor).trim();

  if (!texto) {
    return 0;
  }

  texto = texto.replace(/\s/g, '');

  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '');
    texto = texto.replace(',', '.');
  }

  const n = Number(texto);

  return Number.isFinite(n) ? n : 0;
}

export function dinheiro(valor: any): number {
  return Math.round(numero(valor) * 100) / 100;
}

export function fmt(valor: any): string {
  return dinheiro(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatarTempoRestante(ms: number): string {
  const totalSegundos = Math.max(0, Math.ceil(ms / 1000));
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;

  return `${String(minutos).padStart(2, '0')}:${String(
    segundos
  ).padStart(2, '0')}`;
}

export function gerarIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}