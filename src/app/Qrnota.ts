// npm install qrcode-generator
import qrcode from 'qrcode-generator';

export type ItemNota = {
  nome: string;
  quantidade: number;
  precoUnitario: number;
};

export type DadosNota = {
  numero: string | number;
  data: string; // já formatada, ex: 28/09/2026 14:32
  loja?: string;
  operador?: string;
  formaPagamento?: string;
  itens: ItemNota[];
  total: number;
};

// Limite seguro para leitura rápida pela câmera (o máximo teórico é ~2900).
const MAX_CARACTERES = 1100;

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function reais(valor: number): string {
  return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

/** Texto que o cliente vai ver ao ler o QR com a câmera. */
export function montarTextoNota(nota: DadosNota): string {
  const cabecalho = [
    nota.loja ? nota.loja : 'COMPROVANTE DE COMPRA',
    `Nota ${nota.numero} - ${nota.data}`,
    nota.operador ? `Operador: ${nota.operador}` : '',
    '--------------------',
  ].filter(Boolean);

  const rodape = [
    '--------------------',
    `TOTAL: ${reais(nota.total)}`,
    nota.formaPagamento ? `Pagamento: ${nota.formaPagamento}` : '',
    'Nao e documento fiscal',
  ].filter(Boolean);

  const linhas: string[] = [];
  let tamanho = [...cabecalho, ...rodape].join('\n').length;
  let omitidos = 0;

  for (const item of nota.itens) {
    const subtotal = item.quantidade * item.precoUnitario;
    const linha = `${item.quantidade}x ${item.nome} @ ${reais(
      item.precoUnitario
    )} = ${reais(subtotal)}`;

    if (tamanho + linha.length + 1 > MAX_CARACTERES - 40) {
      omitidos++;
      continue;
    }

    linhas.push(linha);
    tamanho += linha.length + 1;
  }

  if (omitidos > 0) {
    linhas.push(`... e mais ${omitidos} item(ns). Total acima.`);
  }

  return semAcento([...cabecalho, ...linhas, ...rodape].join('\n'));
}

/** SVG do QR para embutir no HTML que o expo-print transforma em PDF. */
export function gerarQrSvg(texto: string, tamanhoPx = 150): string {
  const qr = qrcode(0, 'L'); // 0 = escolhe a versão automaticamente
  qr.addData(texto, 'Byte');
  qr.make();

  const modulos = qr.getModuleCount();
  const celula = Math.max(2, Math.floor(tamanhoPx / (modulos + 2)));

  return qr.createSvgTag({ cellSize: celula, margin: celula, scalable: false });
}

/** Bloco pronto para colar no HTML da nota, perto do total. */
export function blocoQrHtml(nota: DadosNota): string {
  const svg = gerarQrSvg(montarTextoNota(nota));

  return `
    <div style="text-align:center;margin-top:16px;">
      ${svg}
      <div style="font-size:11px;color:#444;margin-top:4px;">
        Aponte a camera do celular para ver o detalhamento da compra
      </div>
    </div>
  `;
}