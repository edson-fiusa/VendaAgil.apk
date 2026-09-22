import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { obterBanco } from './../database/banco';

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

export default {
  fazerBackupLocal,
  obterInfoBackupLocal,
  restaurarBackupLocal,
  compartilharBackupLocal,
};