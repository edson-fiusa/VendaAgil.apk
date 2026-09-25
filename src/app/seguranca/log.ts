

import { obterBanco } from '../../database/banco';

// ============================================================
// LOG DE ATIVIDADES
// ============================================================
//
// Registra ações importantes feitas por administradores e
// operadores (login, cadastro/edição/exclusão de produtos e
// operadores, avarias, vendas, abertura/fechamento de caixa,
// troca de senha, backup, etc.) numa tabela local
// (log_atividades), para consulta posterior na tela de log.
// ============================================================

export type TipoAcao =
  | 'login'
  | 'logout'
  | 'produto_cadastrado'
  | 'produto_editado'
  | 'produto_excluido'
  | 'operador_cadastrado'
  | 'operador_editado'
  | 'operador_excluido'
  | 'avaria_registrada'
  | 'venda_realizada'
  | 'caixa_aberto'
  | 'caixa_fechado'
  | 'senha_alterada'
  | 'backup_realizado'
  | 'backup_restaurado'
  | 'outro';

export interface LogAtividade {
  id: number;
  tipo: string;
  usuario: string;
  descricao: string;
  data: string;
}

async function garantirTabela(): Promise<void> {
  const db = await obterBanco();

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS log_atividades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      usuario TEXT NOT NULL,
      descricao TEXT NOT NULL,
      data TEXT NOT NULL
    )
  `);
}

/**
 * Registra uma atividade no log local.
 *
 * Exemplo:
 * await registrarLog(
 *   'produto_cadastrado',
 *   'admin',
 *   'Cadastrou o produto "Coca-Cola 2L" com preço R$ 9,90'
 * );
 */
export async function registrarLog(
  tipo: TipoAcao,
  usuario: string,
  descricao: string
): Promise<void> {
  try {
    await garantirTabela();

    const db = await obterBanco();
    const agora = new Date().toISOString();

    await db.runAsync(
      `
      INSERT INTO log_atividades
      (tipo, usuario, descricao, data)
      VALUES (?, ?, ?, ?)
      `,
      tipo,
      usuario || 'desconhecido',
      descricao,
      agora
    );
  } catch (error) {
    // Uma falha ao gravar o log nunca deve travar a ação
    // principal do usuário (cadastro, venda, login etc.).
    console.error('Erro ao registrar log de atividade:', error);
  }
}

/**
 * Retorna as atividades mais recentes, da mais nova para a
 * mais antiga.
 */
export async function obterLogs(
  limite = 300
): Promise<LogAtividade[]> {
  await garantirTabela();

  const db = await obterBanco();

  const linhas = await db.getAllAsync<LogAtividade>(
    `
    SELECT id, tipo, usuario, descricao, data
    FROM log_atividades
    ORDER BY id DESC
    LIMIT ?
    `,
    limite
  );

  return linhas;
}

/**
 * Apaga todo o histórico de log. Use com cuidado — normalmente
 * só deve ser exposto para o administrador, com confirmação.
 */
export async function limparLogs(): Promise<void> {
  await garantirTabela();

  const db = await obterBanco();

  await db.runAsync(`DELETE FROM log_atividades`);
}