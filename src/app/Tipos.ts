export interface Operador {
  id: number;
  nome: string;
  usuario?: string;
}

export interface CaixaEstado {
  id: number;
  caixaId: number;
  operadorId: number;
  operadorNome: string;
  saldoInicial: number;
  total: number;
  fechado: boolean;
}

export type Tela = 'login' | 'admin' | 'caixa';

export type TelaLogin = 'escolha' | 'admin' | 'caixa';

export type TelaAdmin =
  | 'menu'
  | 'cadastroProduto'
  | 'gerenciarProdutos'
  | 'gerenciarOperadores'
  | 'avarias'
  | 'relatorios'
  | 'ia'
  | 'backup'
  | 'trocarSenha'
  | 'logAtividades';