import { useState } from 'react';
import { Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

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

// ============================================================
// BLOQUEIO POR TENTATIVAS ERRADAS
//
// As duas primeiras tentativas erradas não têm espera nenhuma.
// A partir da 3ª, cada nova tentativa errada aumenta o tempo de
// espera obrigatório antes da próxima tentativa. O contador e o
// horário de liberação ficam salvos em configuracao_local (via
// obterConfig/salvarConfig), então sobrevivem a fechar o app.
// ============================================================

const TENTATIVAS_SEM_ESPERA = 2;

const ESPERAS_SEGUNDOS = [10, 30, 60, 120, 300];

function calcularEsperaSegundos(totalFalhas: number): number {
  const indice = totalFalhas - TENTATIVAS_SEM_ESPERA - 1;

  if (indice < 0) {
    return 0;
  }

  return ESPERAS_SEGUNDOS[Math.min(indice, ESPERAS_SEGUNDOS.length - 1)];
}

function formatarEspera(segundos: number): string {
  if (segundos < 60) {
    return `${segundos} segundo${segundos === 1 ? '' : 's'}`;
  }

  const minutos = Math.ceil(segundos / 60);
  return `${minutos} minuto${minutos === 1 ? '' : 's'}`;
}

async function lerNumeroConfig(chave: string): Promise<number> {
  const valor = await obterConfig(chave);
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

async function lerDataConfig(chave: string): Promise<Date | null> {
  const valor = await obterConfig(chave);

  if (!valor) {
    return null;
  }

  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Verifica se o bloqueio (identificado por chaveEscopo, ex.: "admin"
 * ou "caixa_joao") ainda está em vigor.
 *
 * Retorna os segundos restantes (0 se não houver bloqueio ativo).
 */
async function segundosRestantesDeBloqueio(
  chaveEscopo: string
): Promise<number> {
  const bloqueadoAte = await lerDataConfig(`${chaveEscopo}_bloqueado_ate`);

  if (!bloqueadoAte) {
    return 0;
  }

  const restanteMs = bloqueadoAte.getTime() - Date.now();

  return restanteMs > 0 ? Math.ceil(restanteMs / 1000) : 0;
}

/**
 * Registra uma tentativa errada: incrementa o contador de falhas,
 * calcula (se for o caso) um novo horário de liberação, salva tudo
 * e devolve os segundos de espera impostos por ESTA tentativa (0 se
 * ainda não passou do limite de tentativas livres).
 */
async function registrarTentativaErrada(
  chaveEscopo: string
): Promise<number> {
  const falhasAnteriores = await lerNumeroConfig(
    `${chaveEscopo}_tentativas_falhas`
  );

  const totalFalhas = falhasAnteriores + 1;

  await salvarConfig(
    `${chaveEscopo}_tentativas_falhas`,
    String(totalFalhas)
  );

  const esperaSegundos = calcularEsperaSegundos(totalFalhas);

  if (esperaSegundos > 0) {
    const bloqueadoAte = new Date(Date.now() + esperaSegundos * 1000);

    await salvarConfig(
      `${chaveEscopo}_bloqueado_ate`,
      bloqueadoAte.toISOString()
    );
  }

  return esperaSegundos;
}

async function limparTentativas(chaveEscopo: string): Promise<void> {
  await salvarConfig(`${chaveEscopo}_tentativas_falhas`, '0');
  await salvarConfig(`${chaveEscopo}_bloqueado_ate`, '');
}

function horarioLegivel(data: Date): string {
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

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

  // ==========================================================
  // LOGIN ADMINISTRADOR LOCAL
  // ==========================================================

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

    const chaveEscopo = 'admin';

    const restante = await segundosRestantesDeBloqueio(chaveEscopo);

    if (restante > 0) {
      Alert.alert(
        'Aguarde para tentar novamente',
        `Muitas tentativas erradas. Tente novamente em ${formatarEspera(
          restante
        )}.`
      );
      return;
    }

    try {
      setCarregando(true);

      const db = await obterBanco();

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS configuracao_local (
          chave TEXT PRIMARY KEY,
          valor TEXT,
          atualizado_em TEXT
        )
      `);

      let usuarioSalvo = await obterConfig('admin_usuario');
      let senhaSalva = await obterConfig('admin_senha');

      if (!usuarioSalvo || !senhaSalva) {
        usuarioSalvo = 'admin';
        senhaSalva = 'admin';

        await salvarConfig('admin_usuario', usuarioSalvo);
        await salvarConfig('admin_senha', senhaSalva);
      }

      const agora = new Date();

      if (usuarioDigitado !== usuarioSalvo || senhaDigitada !== senhaSalva) {
        const esperaImposta = await registrarTentativaErrada(chaveEscopo);

        await registrarLog(
          'login_falhou',
          usuarioDigitado,
          `Tentativa de login administrativo incorreta às ${horarioLegivel(
            agora
          )}.` +
            (esperaImposta > 0
              ? ` Bloqueado por ${formatarEspera(esperaImposta)}.`
              : '')
        );

        if (esperaImposta > 0) {
          Alert.alert(
            'Acesso negado',
            `Usuário ou senha inválidos. Por segurança, novas tentativas ` +
              `só serão liberadas em ${formatarEspera(esperaImposta)}.`
          );
        } else {
          Alert.alert('Acesso negado', 'Usuário ou senha inválidos.');
        }

        return;
      }

      await limparTentativas(chaveEscopo);

      await registrarLog(
        'login',
        usuarioSalvo,
        `Login administrativo realizado com sucesso às ${horarioLegivel(
          agora
        )}.`
      );

      setUsuario('');
      setSenha('');

      setTelaLogin('escolha');
      setTelaAdmin('menu');
      setTela('admin');
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Erro ao abrir o banco local.');
    } finally {
      setCarregando(false);
    }
  }

  // ==========================================================
  // LOGIN ADMINISTRADOR VIA BIOMETRIA (alternativa à senha)
  // ==========================================================
  //
  // Não substitui a senha: é uma segunda forma de entrar, usando a
  // biometria ou o PIN/padrão já configurados no aparelho. Continua
  // exigindo que o admin já exista (ou cria o padrão admin/admin na
  // primeira vez, igual ao login por senha).
  // ==========================================================

  async function loginAdminComBiometria() {
    if (!bancoPronto) {
      Alert.alert('Aguarde', 'O banco local ainda não foi inicializado.');
      return;
    }

    try {
      setCarregando(true);

      const compativel = await LocalAuthentication.hasHardwareAsync();
      const cadastrada = await LocalAuthentication.isEnrolledAsync();

      if (!compativel || !cadastrada) {
        Alert.alert(
          'Biometria indisponível',
          'Este aparelho não tem biometria ou PIN/padrão configurado. Entre com usuário e senha.'
        );
        return;
      }

      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Entrar no Painel Administrativo',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (!resultado.success) {
        return;
      }

      const db = await obterBanco();

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS configuracao_local (
          chave TEXT PRIMARY KEY,
          valor TEXT,
          atualizado_em TEXT
        )
      `);

      let usuarioSalvo = await obterConfig('admin_usuario');

      if (!usuarioSalvo) {
        usuarioSalvo = 'admin';
        await salvarConfig('admin_usuario', usuarioSalvo);

        const senhaSalva = (await obterConfig('admin_senha')) || 'admin';
        await salvarConfig('admin_senha', senhaSalva);
      }

      await limparTentativas('admin');

      await registrarLog(
        'login',
        usuarioSalvo,
        `Login administrativo via biometria às ${horarioLegivel(new Date())}.`
      );

      setUsuario('');
      setSenha('');

      setTelaLogin('escolha');
      setTelaAdmin('menu');
      setTela('admin');
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error?.message || 'Não foi possível autenticar com biometria.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // ==========================================================
  // LOGIN OPERADOR LOCAL
  // ==========================================================

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

    // Escopo por operador: um operador bloqueado não afeta os outros.
    const chaveEscopo = `caixa_${usuarioDigitado.toLowerCase()}`;

    const restante = await segundosRestantesDeBloqueio(chaveEscopo);

    if (restante > 0) {
      Alert.alert(
        'Aguarde para tentar novamente',
        `Muitas tentativas erradas. Tente novamente em ${formatarEspera(
          restante
        )}.`
      );
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

      const agora = new Date();

      const senhaArmazenada = operadorEncontrado?.senha_hash || '';
      const senhaCorreta =
        !!operadorEncontrado && senhaArmazenada === senhaDigitada;

      if (!operadorEncontrado || !senhaCorreta) {
        const esperaImposta = await registrarTentativaErrada(chaveEscopo);

        await registrarLog(
          'login_falhou',
          usuarioDigitado,
          `Tentativa de login de operador incorreta às ${horarioLegivel(
            agora
          )}.` +
            (esperaImposta > 0
              ? ` Bloqueado por ${formatarEspera(esperaImposta)}.`
              : '')
        );

        if (esperaImposta > 0) {
          Alert.alert(
            'Acesso negado',
            `Usuário ou senha inválidos. Por segurança, novas tentativas ` +
              `só serão liberadas em ${formatarEspera(esperaImposta)}.`
          );
        } else if (!operadorEncontrado) {
          Alert.alert('Acesso negado', 'Operador não encontrado ou inativo.');
        } else {
          Alert.alert('Acesso negado', 'Usuário ou senha inválidos.');
        }

        return;
      }

      await limparTentativas(chaveEscopo);

      const operadorLogado: Operador = {
        id: Number(operadorEncontrado.id),
        nome: operadorEncontrado.nome,
        usuario: operadorEncontrado.usuario || undefined,
      };

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
      const total = 0;

      if (caixaExistente) {
        caixaId = Number(caixaExistente.id);
        saldoInicial = Number(caixaExistente.saldo_inicial || 0);
      } else {
        const agoraIso = agora.toISOString();

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
          agoraIso,
          0
        );

        caixaId = Number(resultado.lastInsertRowId);
      }

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
        `Login do operador realizado com sucesso às ${horarioLegivel(
          agora
        )} (caixa id ${caixaId}).`
      );

      setOperadorUsuario('');
      setOperadorSenha('');

      setTelaLogin('escolha');
      setTela('caixa');
    } catch (error: any) {
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

  // ==========================================================
  // SAIR
  // ==========================================================

  function sair() {
    const usuarioSaindo = tela === 'caixa' && operador ? operador.nome : 'admin';

    registrarLog(
      'logout',
      usuarioSaindo,
      `${
        tela === 'caixa' ? 'Operador saiu do caixa' : 'Administrador saiu do painel'
      } às ${horarioLegivel(new Date())}.`
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
    loginAdminComBiometria,
    loginCaixa,
    sair,
  };
}