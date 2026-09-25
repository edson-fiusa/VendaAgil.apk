import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PDFDocument } from 'pdf-lib-plus-encrypt';
import { obterBanco } from '../../database/banco';

const PASTA_BACKUP = `${FileSystem.documentDirectory}backups/`;
const CAMINHO_BACKUP = `${PASTA_BACKUP}venda-agil-backup.json`;
const CAMINHO_METADADOS = `${PASTA_BACKUP}backup-info.json`;
const CAMINHO_PRE_RESTAURACAO = `${PASTA_BACKUP}venda-agil-pre-restauracao.json`;

// Todas as tabelas locais que fazem parte do backup.
const TABELAS: string[] = [
  'configuracao_local',
  'produtos_local',
  'operadores_local',
  'caixas_local',
  'vendas_local',
  'itens_venda_local',
  'avarias_local',
  'movimentacoes_estoque_local',
];

export interface BackupInfo {
  existe: boolean;
  data?: string;
  tamanho?: number;
  arquivo?: string;
}

interface DadosBackup {
  versao: number;
  criadoEm: string;
  tabelas: Record<string, any[]>;
}

async function garantirPastaBackup(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PASTA_BACKUP);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PASTA_BACKUP, {
      intermediates: true,
    });
  }
}

/**
 * Lê todas as linhas de todas as tabelas locais do banco e monta um
 * objeto único, pronto para ser salvo como JSON. Usa a mesma conexão
 * (obterBanco) que o resto do aplicativo já usa, então não depende de
 * localizar o arquivo físico do banco no sistema de arquivos.
 */
async function exportarDados(): Promise<DadosBackup> {
  const db = await obterBanco();

  const tabelas: Record<string, any[]> = {};

  for (const tabela of TABELAS) {
    try {
      tabelas[tabela] = await db.getAllAsync(`SELECT * FROM ${tabela}`);
    } catch (erro) {
      // Se a tabela ainda não existir por algum motivo, trata como vazia
      // em vez de interromper todo o backup.
      console.warn(`Não foi possível ler a tabela ${tabela} para o backup:`, erro);
      tabelas[tabela] = [];
    }
  }

  return {
    versao: 1,
    criadoEm: new Date().toISOString(),
    tabelas,
  };
}

/**
 * Apaga todos os dados atuais das tabelas locais e insere os dados do
 * objeto de backup fornecido. Executado dentro de uma transação: se
 * algo falhar no meio, nada é alterado.
 */
async function importarDados(dados: DadosBackup): Promise<void> {
  const db = await obterBanco();

  await db.withTransactionAsync(async () => {
    // Apaga em ordem inversa para reduzir chance de referências soltas.
    for (const tabela of [...TABELAS].reverse()) {
      await db.runAsync(`DELETE FROM ${tabela}`);
    }

    for (const tabela of TABELAS) {
      const linhas = dados.tabelas[tabela] || [];

      for (const linha of linhas) {
        const colunas = Object.keys(linha);

        if (colunas.length === 0) {
          continue;
        }

        const marcadores = colunas.map(() => '?').join(', ');

        const valores = colunas.map((coluna) => linha[coluna]);

        await db.runAsync(
          `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${marcadores})`,
          ...valores
        );
      }
    }
  });
}

/**
 * Faz um backup dos dados do aplicativo, salvando-os como um arquivo
 * JSON dentro da pasta de backups do próprio celular. Não depende de
 * servidor/internet.
 */
export async function fazerBackupLocal(): Promise<BackupInfo> {
  await garantirPastaBackup();

  const dados = await exportarDados();

  const conteudo = JSON.stringify(dados);

  // Escreve primeiro em um arquivo temporário. Só substitui o backup
  // anterior se a escrita for concluída com sucesso, para nunca ficar
  // sem nenhum backup válido no meio do caminho.
  const caminhoTemporario = `${CAMINHO_BACKUP}.tmp`;

  await FileSystem.writeAsStringAsync(caminhoTemporario, conteudo);

  const infoTemporario = await FileSystem.getInfoAsync(caminhoTemporario);

  if (!infoTemporario.exists || !infoTemporario.size) {
    throw new Error('Não foi possível gravar o arquivo de backup.');
  }

  const existeBackupAtual = (
    await FileSystem.getInfoAsync(CAMINHO_BACKUP)
  ).exists;

  if (existeBackupAtual) {
    await FileSystem.deleteAsync(CAMINHO_BACKUP, { idempotent: true });
  }

  await FileSystem.moveAsync({
    from: caminhoTemporario,
    to: CAMINHO_BACKUP,
  });

  const metadados: BackupInfo = {
    existe: true,
    data: dados.criadoEm,
    tamanho: infoTemporario.size,
    arquivo: CAMINHO_BACKUP,
  };

  await FileSystem.writeAsStringAsync(
    CAMINHO_METADADOS,
    JSON.stringify(metadados)
  );

  return metadados;
}

/**
 * Consulta as informações do último backup local (data, tamanho etc.),
 * lendo o arquivo de metadados salvo junto do backup.
 */
export async function obterInfoBackupLocal(): Promise<BackupInfo> {
  const infoMetadados = await FileSystem.getInfoAsync(CAMINHO_METADADOS);

  if (!infoMetadados.exists) {
    return { existe: false };
  }

  try {
    const conteudo = await FileSystem.readAsStringAsync(CAMINHO_METADADOS);
    const metadados: BackupInfo = JSON.parse(conteudo);

    const infoArquivoBackup = await FileSystem.getInfoAsync(CAMINHO_BACKUP);

    if (!infoArquivoBackup.exists) {
      // Os metadados existem, mas o arquivo de backup em si sumiu.
      return { existe: false };
    }

    return { ...metadados, existe: true };
  } catch (erro) {
    console.error('Erro ao ler metadados do backup local:', erro);
    return { existe: false };
  }
}

/**
 * Restaura os dados do aplicativo a partir do último backup salvo no
 * celular. Antes de sobrescrever, guarda uma cópia de segurança dos
 * dados atuais (CAMINHO_PRE_RESTAURACAO), para o caso de algo dar
 * errado.
 */
export async function restaurarBackupLocal(): Promise<void> {
  const infoBackup = await FileSystem.getInfoAsync(CAMINHO_BACKUP);

  if (!infoBackup.exists) {
    throw new Error('Nenhum backup local encontrado para restaurar.');
  }

  await garantirPastaBackup();

  const conteudoBackup = await FileSystem.readAsStringAsync(CAMINHO_BACKUP);
  const dadosBackup: DadosBackup = JSON.parse(conteudoBackup);

  // Guarda uma cópia de segurança dos dados atuais antes de sobrescrever.
  try {
    const dadosAtuais = await exportarDados();

    await FileSystem.writeAsStringAsync(
      CAMINHO_PRE_RESTAURACAO,
      JSON.stringify(dadosAtuais)
    );
  } catch (erro) {
    console.warn('Não foi possível salvar cópia pré-restauração:', erro);
  }

  await importarDados(dadosBackup);
}

/**
 * Abre a folha de compartilhamento nativa do aparelho (a mesma usada
 * para compartilhar fotos, por exemplo) apontando para o arquivo de
 * backup local. A partir dela o operador escolhe para onde enviar:
 * e-mail (Gmail, Outlook...), Google Drive, WhatsApp, Telegram,
 * "Salvar em arquivos", Bluetooth etc.
 *
 * Isso tira o backup do aparelho, sem o app precisar guardar
 * credenciais de e-mail nem depender de um servidor próprio.
 *
 * Requer o pacote expo-sharing (`npx expo install expo-sharing`).
 */
export async function compartilharBackupLocal(): Promise<void> {
  const infoBackup = await FileSystem.getInfoAsync(CAMINHO_BACKUP);

  if (!infoBackup.exists) {
    throw new Error(
      'Nenhum backup local encontrado. Faça um backup antes de enviar.'
    );
  }

  const disponivel = await Sharing.isAvailableAsync();

  if (!disponivel) {
    throw new Error(
      'O compartilhamento não está disponível neste aparelho.'
    );
  }

  await Sharing.shareAsync(CAMINHO_BACKUP, {
    mimeType: 'application/json',
    dialogTitle: 'Enviar backup do Venda Ágil',
    UTI: 'public.json',
  });
}

// ============================================================
// RELATÓRIO EM PDF
//
// Isto é SEPARADO do backup em JSON acima. O JSON continua sendo
// a única coisa usada por restaurarBackupLocal() para reconstruir
// o banco. O PDF aqui é só um relatório legível, pra imprimir ou
// enviar por e-mail/WhatsApp — não é possível "restaurar" um PDF
// de volta no banco.
//
// Requer o pacote expo-print (`npx expo install expo-print`).
//
// O PDF pode opcionalmente ser protegido por senha (criptografado),
// usando o pacote pdf-lib-plus-encrypt. A senha em si é gerenciada
// pelo módulo `senhaPdf.ts` (hash + Keystore) — este arquivo só
// recebe a senha já validada, em texto puro, e a usa apenas para
// criptografar o arquivo no momento da geração.
// ============================================================

function escaparHtml(valor: any): string {
  if (valor === null || valor === undefined) {
    return '';
  }

  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarMoedaRelatorio(valor: any): string {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 'R$ 0,00';
  }

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatarDataRelatorio(valor: any): string {
  if (!valor) {
    return '-';
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return String(valor);
  }

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function montarLinhasTabela(
  linhas: any[],
  colunas: { chave: string; titulo: string; formatar?: (valor: any, linha: any) => string }[]
): string {
  if (!linhas.length) {
    return `<tr><td colspan="${colunas.length}" class="vazio">Nenhum registro.</td></tr>`;
  }

  return linhas
    .map((linha) => {
      const celulas = colunas
        .map((coluna) => {
          const valorBruto = linha[coluna.chave];

          const valorFormatado = coluna.formatar
            ? coluna.formatar(valorBruto, linha)
            : escaparHtml(valorBruto);

          return `<td>${valorFormatado}</td>`;
        })
        .join('');

      return `<tr>${celulas}</tr>`;
    })
    .join('');
}

function gerarHtmlRelatorio(dados: DadosBackup): string {
  const produtos = dados.tabelas['produtos_local'] || [];
  const operadores = dados.tabelas['operadores_local'] || [];
  const vendas = dados.tabelas['vendas_local'] || [];
  const avarias = dados.tabelas['avarias_local'] || [];

  const mapaOperadores: Record<string, string> = {};

  for (const operador of operadores) {
    mapaOperadores[String(operador.id)] = operador.nome || '-';
  }

  const vendasFinalizadas = vendas.filter(
    (v: any) => String(v.status) === 'finalizada'
  );

  const totalVendido = vendasFinalizadas.reduce(
    (soma: number, v: any) => soma + Number(v.total || 0),
    0
  );

  const totaisPorForma: Record<string, number> = {};

  for (const venda of vendasFinalizadas) {
    const forma = String(venda.forma_pagamento || 'outros');
    totaisPorForma[forma] = (totaisPorForma[forma] || 0) + Number(venda.total || 0);
  }

  const linhasResumoPagamento = Object.keys(totaisPorForma)
    .map(
      (forma) =>
        `<tr><td>${escaparHtml(
          forma === 'dinheiro' ? 'Dinheiro' : forma === 'pix' ? 'PIX' : 'Outros'
        )}</td><td>${formatarMoedaRelatorio(totaisPorForma[forma])}</td></tr>`
    )
    .join('');

  const linhasProdutos = montarLinhasTabela(produtos, [
    { chave: 'nome', titulo: 'Nome' },
    { chave: 'codigo', titulo: 'Código' },
    { chave: 'categoria', titulo: 'Categoria' },
    {
      chave: 'preco_venda',
      titulo: 'Preço',
      formatar: (v) => formatarMoedaRelatorio(v),
    },
    {
      chave: 'quantidade',
      titulo: 'Estoque',
      formatar: (v) => escaparHtml(v),
    },
  ]);

  const linhasOperadores = montarLinhasTabela(operadores, [
    { chave: 'nome', titulo: 'Nome' },
    { chave: 'usuario', titulo: 'Usuário' },
    {
      chave: 'ativo',
      titulo: 'Ativo',
      formatar: (v) => (Number(v) === 1 ? 'Sim' : 'Não'),
    },
  ]);

  const linhasVendas = montarLinhasTabela(
    [...vendas].sort((a: any, b: any) =>
      String(b.criado_em || '').localeCompare(String(a.criado_em || ''))
    ),
    [
      { chave: 'id', titulo: '#' },
      {
        chave: 'criado_em',
        titulo: 'Data',
        formatar: (v) => formatarDataRelatorio(v),
      },
      {
        chave: 'operador_id',
        titulo: 'Operador',
        formatar: (v) => escaparHtml(mapaOperadores[String(v)] || '-'),
      },
      {
        chave: 'forma_pagamento',
        titulo: 'Pagamento',
        formatar: (v) =>
          escaparHtml(
            v === 'dinheiro' ? 'Dinheiro' : v === 'pix' ? 'PIX' : 'Outros'
          ),
      },
      {
        chave: 'total',
        titulo: 'Total',
        formatar: (v) => formatarMoedaRelatorio(v),
      },
      { chave: 'status', titulo: 'Status' },
    ]
  );

  const linhasAvarias = montarLinhasTabela(avarias, [
    { chave: 'produto_id', titulo: 'Produto (ID)' },
    { chave: 'quantidade', titulo: 'Quantidade' },
    { chave: 'motivo', titulo: 'Motivo' },
    {
      chave: 'criado_em',
      titulo: 'Data',
      formatar: (v) => formatarDataRelatorio(v),
    },
  ]);

  const geradoEm = formatarDataRelatorio(dados.criadoEm);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    color: #111827;
    padding: 24px;
  }
  h1 {
    font-size: 22px;
    margin-bottom: 2px;
    color: #279905;
  }
  .subtitulo {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 20px;
  }
  h2 {
    font-size: 15px;
    margin-top: 28px;
    margin-bottom: 8px;
    border-bottom: 2px solid #279905;
    padding-bottom: 4px;
  }
  .resumo {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;
  }
  .resumo-item {
    background: #f3f4f6;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    min-width: 140px;
  }
  .resumo-item strong {
    display: block;
    font-size: 15px;
    margin-top: 2px;
    color: #111827;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 6px;
  }
  th {
    background: #279905;
    color: #fff;
    text-align: left;
    padding: 6px 8px;
  }
  td {
    padding: 5px 8px;
    border-bottom: 1px solid #e5e7eb;
  }
  tr:nth-child(even) td {
    background: #f9fafb;
  }
  .vazio {
    text-align: center;
    color: #9ca3af;
    font-style: italic;
  }
  .rodape {
    margin-top: 30px;
    font-size: 10px;
    color: #9ca3af;
    text-align: center;
  }
</style>
</head>
<body>
  <h1>Relatório Venda Ágil</h1>
  <div class="subtitulo">Gerado em ${geradoEm}</div>

  <div class="resumo">
    <div class="resumo-item">Produtos cadastrados<strong>${produtos.length}</strong></div>
    <div class="resumo-item">Operadores<strong>${operadores.length}</strong></div>
    <div class="resumo-item">Vendas finalizadas<strong>${vendasFinalizadas.length}</strong></div>
    <div class="resumo-item">Total vendido<strong>${formatarMoedaRelatorio(totalVendido)}</strong></div>
  </div>

  <h2>Vendas por forma de pagamento</h2>
  <table>
    <tr><th>Forma</th><th>Total</th></tr>
    ${linhasResumoPagamento || '<tr><td colspan="2" class="vazio">Nenhuma venda registrada.</td></tr>'}
  </table>

  <h2>Vendas</h2>
  <table>
    <tr><th>#</th><th>Data</th><th>Operador</th><th>Pagamento</th><th>Total</th><th>Status</th></tr>
    ${linhasVendas}
  </table>

  <h2>Produtos</h2>
  <table>
    <tr><th>Nome</th><th>Código</th><th>Categoria</th><th>Preço</th><th>Estoque</th></tr>
    ${linhasProdutos}
  </table>

  <h2>Operadores</h2>
  <table>
    <tr><th>Nome</th><th>Usuário</th><th>Ativo</th></tr>
    ${linhasOperadores}
  </table>

  <h2>Avarias</h2>
  <table>
    <tr><th>Produto (ID)</th><th>Quantidade</th><th>Motivo</th><th>Data</th></tr>
    ${linhasAvarias}
  </table>

  <div class="rodape">Software Venda Ágil — relatório gerado automaticamente</div>
</body>
</html>
  `;
}

/**
 * Recebe os bytes de um PDF (em base64) e a senha já validada, e
 * devolve uma nova versão criptografada (também em base64).
 *
 * userPassword e ownerPassword são a mesma senha aqui de propósito:
 * não faz sentido ter uma senha "de dono" diferente neste app, então
 * qualquer pessoa que abrir o PDF (com a senha certa) tem acesso
 * total à leitura do relatório.
 */
async function criptografarPdfBase64(
  base64OriginalPdf: string,
  senha: string
): Promise<string> {
  const bytesOriginais = Buffer.from(base64OriginalPdf, 'base64');

  const pdfDoc = await PDFDocument.load(bytesOriginais);

  pdfDoc.encrypt({
    userPassword: senha,
    ownerPassword: senha,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });

  const bytesCriptografados = await pdfDoc.save();

  return Buffer.from(bytesCriptografados).toString('base64');
}

/**
 * Gera um relatório em PDF (legível por humanos) com os dados atuais
 * do aplicativo: produtos, operadores, vendas e avarias. Diferente do
 * backup em JSON, este PDF NÃO pode ser usado para restaurar dados —
 * serve só para leitura, impressão ou envio.
 *
 * @param senha Opcional. Se informada, o PDF é criptografado com essa
 * senha (o app deve chamar `validarSenhaPdf` do módulo `senhaPdf.ts`
 * ANTES de chamar esta função, para garantir que é a senha correta
 * cadastrada pelo usuário — esta função não faz essa validação).
 *
 * Retorna o caminho do arquivo PDF salvo na pasta de backups.
 */
export async function gerarRelatorioPdfLocal(senha?: string): Promise<string> {
  const dados = await exportarDados();

  const html = gerarHtmlRelatorio(dados);

  // Pede o PDF já em base64, em vez de um "uri" de arquivo. O
  // expo-print usa por baixo dos panos o módulo NOVO do
  // expo-file-system, enquanto o resto deste arquivo usa o módulo
  // LEGADO (expo-file-system/legacy). Tentar copiar o arquivo do
  // expo-print com FileSystem.copyAsync (legado) pode falhar em
  // alguns aparelhos Android com erro de I/O, porque os dois módulos
  // não enxergam o URI da mesma forma. Pedindo base64 direto,
  // evitamos essa mistura: escrevemos o conteúdo nós mesmos.
  const { base64 } = await Print.printToFileAsync({
    html,
    base64: true,
  });

  if (!base64) {
    throw new Error('O gerador de PDF não retornou o conteúdo do arquivo.');
  }

  const base64Final = senha
    ? await criptografarPdfBase64(base64, senha)
    : base64;

  await garantirPastaBackup();

  const nomeArquivo = `venda-agil-relatorio-${Date.now()}.pdf`;
  const destino = `${PASTA_BACKUP}${nomeArquivo}`;

  await FileSystem.writeAsStringAsync(destino, base64Final, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return destino;
}

/**
 * Gera o relatório em PDF e já abre a folha de compartilhamento nativa
 * do aparelho (e-mail, WhatsApp, Google Drive, "Salvar em arquivos",
 * abrir num leitor de PDF etc.).
 *
 * @param senha Opcional. Se informada, o PDF sai protegido por senha.
 * Veja o aviso em `gerarRelatorioPdfLocal` sobre validar a senha antes
 * de chamar esta função.
 */
export async function gerarECompartilharRelatorioPdfLocal(
  senha?: string
): Promise<void> {
  const caminhoPdf = await gerarRelatorioPdfLocal(senha);

  const disponivel = await Sharing.isAvailableAsync();

  if (!disponivel) {
    throw new Error(
      'O compartilhamento não está disponível neste aparelho. O PDF foi ' +
        `salvo em: ${caminhoPdf}`
    );
  }

  await Sharing.shareAsync(caminhoPdf, {
    mimeType: 'application/pdf',
    dialogTitle: 'Enviar relatório em PDF do Venda Ágil',
    UTI: 'com.adobe.pdf',
  });
}

export default {
  fazerBackupLocal,
  obterInfoBackupLocal,
  restaurarBackupLocal,
  compartilharBackupLocal,
  gerarRelatorioPdfLocal,
  gerarECompartilharRelatorioPdfLocal,
};