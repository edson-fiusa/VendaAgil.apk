import { useState } from 'react';
import { Alert } from 'react-native';

import { obterBanco } from '../../src/database/banco';
import { registrarLog } from '../../src/app/seguranca/log';
import { obterConfig, salvarConfig } from './ConfigLocal';

import type {
  CaixaEstado,
  Operador,
  Tela,
  TelaAdmin,
  TelaLogin,
} from './Tipos';

/**
 * Hook que controla a navegação entre telas (login / admin / caixa)
 * e toda a lógica de autenticação: login do administrador, login
 * do operador de caixa (com abertura/retomada do caixa) e logout.
 */
export function useSessao(bancoPronto: boolean, erroBanco: string | null) {
  const [tela, setTela] = useState<Tela>('login');
  const [telaLogin, setTelaLogin] = useState<TelaLogin>('escolha');
  const [telaAdmin, setTelaAdmin] = useState<TelaAdmin>('menu');

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');

  const [operadorUsuario, setOperadorUsuario] = useState('');
  const [operadorSenha, setOperadorSenha] = useState('');

  const [operador, setOperador] = useState<Operador | null>(null);
  const [caixa, setCaixa] = useState<CaixaEstado | null>(null);
  const [carregando, setCarregando] = useState(false);

  function verificarBancoAntesDeEntrar() {
    if (!bancoPronto) {
      Alert.alert(
        'Aguarde',
        erroBanco || 'O aplicativo ainda está preparando os dados locais.'
      );
      return false;
    }
    return true;
  }

  // ============================================================
  // LOGIN ADMINISTRADOR LOCAL
  // ============================================================
  //
  // As credenciais do admin ficam salvas na tabela
  // configuracao_local (chaves "admin_usuario" e "admin_senha").
  // Na primeira execução, se ainda não existirem, são criadas com
  // o padrão admin/admin. A partir daí o login sempre valida
  // contra o que está no banco, o que permite trocar a senha na
  // tela "Trocar senha" e ter essa alteração preservada pelo
  // backup/restauração local.
  // ============================================================

  async function loginAdmin() {
    if (!bancoPronto) {
      Alert.alert('Aguarde', 'O banco local ainda não foi inicializado.');
      return;
    }

    const usuarioDigitado = usuario.trim();
    const senhaDigitada = senha.trim();

    if (!usuarioDigitado || !senhaDigitada) {
      Alert.alert('Atenção', 'Informe usuário e senha.');
      return;
    }

    try {
      setCarregando(true);

      const db = await obterBanco();

      // Garante a tabela
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS configuracao_local (
          chave TEXT PRIMARY KEY,
          valor TEXT,
          atualizado_em TEXT
        )
      `);

      let usuarioSalvo = await obterConfig('admin_usuario');
      let senhaSalva = await obterConfig('admin_senha');

      // Primeira vez: cria as credenciais padrão
      if (!usuarioSalvo || !senhaSalva) {
        usuarioSalvo = 'admin';
        senhaSalva = 'admin';

        await salvarConfig('admin_usuario', usuarioSalvo);
        await salvarConfig('admin_senha', senhaSalva);

        console.log('Credenciais administrativas padrão criadas.');
      }

      if (usuarioDigitado !== usuarioSalvo || senhaDigitada !== senhaSalva) {
        Alert.alert('Acesso negado', 'Usuário ou senha inválidos.');
        return;
      }

      await registrarLog(
        'login',
        usuarioSalvo,
        'Login administrativo realizado.'
      );

      // Limpa campos
      setUsuario('');
      setSenha('');

      // Entra diretamente no painel
      setTelaLogin('escolha');
      setTelaAdmin('menu');
      setTela('admin');

      console.log('LOGIN ADMINISTRADOR REALIZADO COM SUCESSO');
    } catch (error: any) {
      console.error('ERRO NO LOGIN ADMIN:', error);

      Alert.alert('Erro', error?.message || 'Erro ao abrir o banco local.');
    } finally {
      setCarregando(false);
    }
  }

  // ============================================================
  // LOGIN OPERADOR LOCAL
  // ============================================================

  async function loginCaixa() {
    if (!verificarBancoAntesDeEntrar()) {
      return;
    }

    const usuarioDigitado = operadorUsuario.trim();
    const senhaDigitada = operadorSenha.trim();

    if (!usuarioDigitado || !senhaDigitada) {
      Alert.alert('Atenção', 'Informe usuário e senha.');
      return;
    }

    try {
      setCarregando(true);

      const db = await obterBanco();

      const operadorEncontrado = await db.getFirstAsync<{
        id: number;
        nome: string;
        usuario: string | null;
        senha_hash: string | null;
        ativo: number;
      }>(
        `
        SELECT
          id,
          nome,
          usuario,
          senha_hash,
          ativo
        FROM operadores_local
        WHERE usuario = ?
        AND ativo = 1
        LIMIT 1
        `,
        usuarioDigitado
      );

      if (!operadorEncontrado) {
        Alert.alert('Acesso negado', 'Operador não encontrado ou inativo.');
        return;
      }

      /*
       * Nesta primeira versão local,
       * comparamos a senha armazenada.
       *
       * Se a senha estiver vazia, o operador
       * também não poderá entrar.
       */

      const senhaArmazenada = operadorEncontrado.senha_hash || '';

      if (senhaArmazenada !== senhaDigitada) {
        Alert.alert('Acesso negado', 'Usuário ou senha inválidos.');
        return;
      }

      const operadorLogado: Operador = {
        id: Number(operadorEncontrado.id),
        nome: operadorEncontrado.nome,
        usuario: operadorEncontrado.usuario || undefined,
      };

      // ========================================================
      // ABRIR CAIXA LOCAL
      //
      // OBS: a tabela caixas_local usa a coluna "status"
      // ('aberto' | 'fechado'), e NÃO possui as colunas
      // "operador_nome", "total" ou "fechado". Essas colunas
      // não existem no schema (ver database/banco.ts), então
      // a query e o INSERT abaixo usam somente colunas reais.
      // ========================================================

      const caixaExistente = await db.getFirstAsync<{
        id: number;
        operador_id: number;
        saldo_inicial: number;
        status: string;
        aberto_em: string | null;
      }>(
        `
        SELECT
          id,
          operador_id,
          saldo_inicial,
          status,
          aberto_em
        FROM caixas_local
        WHERE operador_id = ?
        AND status = 'aberto'
        ORDER BY id DESC
        LIMIT 1
        `,
        operadorLogado.id
      );

      let caixaId: number;
      let saldoInicial = 0;

      // O total do caixa não é armazenado em caixas_local;
      // ele é sempre calculado a partir de vendas_local
      // (ver Caixa.tsx -> carregarResumoCaixa).
      const total = 0;

      if (caixaExistente) {
        caixaId = Number(caixaExistente.id);
        saldoInicial = Number(caixaExistente.saldo_inicial || 0);
      } else {
        const agora = new Date().toISOString();

        const resultado = await db.runAsync(
          `
          INSERT INTO caixas_local (
            operador_id,
            status,
            saldo_inicial,
            aberto_em,
            sincronizado
          )
          VALUES (?, 'aberto', ?, ?, ?)
          `,
          operadorLogado.id,
          0,
          agora,
          0
        );

        caixaId = Number(resultado.lastInsertRowId);
      }

      // ========================================================
      // ENTIDADE DO CAIXA
      // ========================================================

      setOperador(operadorLogado);

      setCaixa({
        id: caixaId,
        caixaId,
        operadorId: operadorLogado.id,
        operadorNome: operadorLogado.nome,
        saldoInicial,
        total,
        fechado: false,
      });

      await registrarLog(
        'login',
        operadorLogado.nome,
        `Login do operador e abertura/retomada do caixa (id ${caixaId}).`
      );

      setOperadorUsuario('');
      setOperadorSenha('');

      setTelaLogin('escolha');
      setTela('caixa');
    } catch (error: any) {
      console.error('Erro no login do caixa local:', error);

      setOperador(null);
      setCaixa(null);

      Alert.alert(
        'Erro',
        error?.message || 'Não foi possível entrar no caixa.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // ============================================================
  // SAIR
  // ============================================================

  function sair() {
    const usuarioSaindo = tela === 'caixa' && operador ? operador.nome : 'admin';

    registrarLog(
      'logout',
      usuarioSaindo,
      tela === 'caixa'
        ? 'Operador saiu do caixa.'
        : 'Administrador saiu do painel.'
    );

    setOperador(null);
    setCaixa(null);

    setUsuario('');
    setSenha('');

    setOperadorUsuario('');
    setOperadorSenha('');

    setTelaAdmin('menu');
    setTelaLogin('escolha');
    setTela('login');
  }

  return {
    tela,
    setTela,
    telaLogin,
    setTelaLogin,
    telaAdmin,
    setTelaAdmin,

    usuario,
    setUsuario,
    senha,
    setSenha,

    operadorUsuario,
    setOperadorUsuario,
    operadorSenha,
    setOperadorSenha,

    operador,
    caixa,
    carregando,

    loginAdmin,
    loginCaixa,
    sair,
  };
}