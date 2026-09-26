import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import * as Updates from 'expo-updates';

import { LinearGradient } from 'expo-linear-gradient';

import {
  PinchGestureHandler,
  State as GestureState,
} from 'react-native-gesture-handler';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  inicializarBanco,
  obterBanco,
} from '../../src/database/banco';

import { verificarSenhaMestre } from './seguranca/seguranca';

import Avarias from './avarias';
import CadastroProduto from './cadastro-produto';
import Caixa from './caixa';
import GerenciarOperadores from './gerenciar-operadores';
import GerenciarProdutos from './gerenciar-produtos';
import IA from './ia';
import Relatorios from './relatorios';
import Backup from '../database/backup';
import LogAtividades from './seguranca/log_atividades';
import TrocarSenha from './seguranca/trocar-senha';

import { registrarLog } from '../../src/app/seguranca/log';

// ============================================================
// INTERFACES
// ============================================================

interface Operador {
  id: number;
  nome: string;
  usuario?: string;
}

interface CaixaEstado {
  id: number;
  caixaId: number;
  operadorId: number;
  operadorNome: string;
  saldoInicial: number;
  total: number;
  fechado: boolean;
}

type Tela = 'login' | 'admin' | 'caixa';

type TelaLogin = 'escolha' | 'admin' | 'caixa';

type TelaAdmin =
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

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function Index() {
  // ============================================================
  // RESPONSIVIDADE (TELAS MAIORES / TABLET / ORIENTAÇÃO DEITADA)
  // ============================================================

  const { width, height } = useWindowDimensions();
  const menorDimensaoTela = Math.min(width, height);
  const isTablet = menorDimensaoTela >= 600;
  const isPaisagem = width > height;
  const isTabletOuPaisagem = isTablet || isPaisagem;

  const [tela, setTela] = useState<Tela>('login');

  const [telaLogin, setTelaLogin] =
    useState<TelaLogin>('escolha');

  const [telaAdmin, setTelaAdmin] =
    useState<TelaAdmin>('menu');

  // ============================================================
  // GRADE DO MENU ADMINISTRATIVO (ZOOM POR PINÇA)
  // ============================================================
  //
  // Em vez de cards fixos agrupados por seção (produtos numa
  // fileira, relatórios em outra sozinho etc.), todos os itens
  // do menu ficam numa única grade que preenche as fileiras na
  // horizontal. O administrador pode dar zoom com os dedos:
  // afastar os dedos (zoom in) deixa os cards maiores (menos
  // colunas); juntar os dedos (zoom out) deixa os cards menores
  // e cabem mais por fileira. Continua responsivo para tablet
  // e celular deitado, que já começam com mais colunas.
  // ============================================================

  const colunasIniciais = isTabletOuPaisagem ? 3 : 2;

  const [colunasMenu, setColunasMenu] =
    useState(colunasIniciais);

  const escalaPincaRef = useRef(1);

  // ============================================================
  // BANCO LOCAL
  // ============================================================

  const [bancoPronto, setBancoPronto] =
    useState(false);

  const [erroBanco, setErroBanco] =
    useState<string | null>(null);

  // ============================================================
  // INICIALIZAÇÃO DO BANCO
  // ============================================================

  useEffect(() => {
    let ativo = true;

    async function prepararBanco() {
      try {
        console.log(
          'Inicializando banco SQLite local...'
        );

        await inicializarBanco();

        if (ativo) {
          setBancoPronto(true);
          setErroBanco(null);
        }

        console.log(
          'Banco SQLite local inicializado.'
        );
      } catch (error: any) {
        console.error(
          'Erro ao inicializar banco local:',
          error
        );

        if (ativo) {
          setBancoPronto(false);

          setErroBanco(
            error?.message ||
              'Não foi possível inicializar o banco local.'
          );
        }
      }
    }

    prepararBanco();

    return () => {
      ativo = false;
    };
  }, []);

  // ============================================================
  // VERIFICAÇÃO DE ATUALIZAÇÃO (EAS Update)
  // ============================================================

  useEffect(() => {
    async function verificarAtualizacao() {
      if (__DEV__) return; // não checa em modo desenvolvimento

      try {
        const resultado = await Updates.checkForUpdateAsync();

        if (resultado.isAvailable) {
          Alert.alert(
            'Atualização disponível',
            'Uma nova versão do aplicativo está disponível. Deseja atualizar agora?',
            [
              { text: 'Depois', style: 'cancel' },
              {
                text: 'Atualizar',
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (erroFetch: any) {
                    console.error(
                      'Erro ao baixar atualização:',
                      erroFetch
                    );

                    Alert.alert(
                      'Erro',
                      'Não foi possível baixar a atualização agora.'
                    );
                  }
                },
              },
            ]
          );
        }
      } catch (error: any) {
        console.log(
          'Erro ao verificar atualização:',
          error
        );
      }
    }

    verificarAtualizacao();
  }, []);

  // ============================================================
  // TESTE / LICENÇA (30 DIAS)
  // ============================================================

  const DIAS_TESTE = 30;

  const [verificandoTeste, setVerificandoTeste] =
    useState(true);

  const [testeExpirado, setTesteExpirado] =
    useState(false);

  const [appDesbloqueado, setAppDesbloqueado] =
    useState(false);

  const [diasRestantesTeste, setDiasRestantesTeste] =
    useState(DIAS_TESTE);

  const [mostrarBoasVindas, setMostrarBoasVindas] =
    useState(false);

  const [senhaDesbloqueio, setSenhaDesbloqueio] =
    useState('');

  const [verificandoSenha, setVerificandoSenha] =
    useState(false);

  async function obterConfig(
    chave: string
  ): Promise<string | null> {
    const db = await obterBanco();

    const linha = await db.getFirstAsync<{
      valor: string | null;
    }>(
      `
      SELECT valor
      FROM configuracao_local
      WHERE chave = ?
      LIMIT 1
      `,
      chave
    );

    return linha?.valor ?? null;
  }

  async function salvarConfig(
    chave: string,
    valor: string
  ): Promise<void> {
    const db = await obterBanco();

    const agora = new Date().toISOString();

    await db.runAsync(
      `
      INSERT OR REPLACE INTO configuracao_local
      (chave, valor, atualizado_em)
      VALUES (?, ?, ?)
      `,
      chave,
      valor,
      agora
    );
  }

  async function verificarPeriodoTeste() {
    try {
      // Se já foi desbloqueado com a senha em algum momento,
      // libera direto, sem checar datas.
      const ativado = await obterConfig('app_ativado');

      if (ativado === '1') {
        setAppDesbloqueado(true);
        setTesteExpirado(false);
        return;
      }

      let dataInstalacaoTexto =
        await obterConfig('data_instalacao');

      if (!dataInstalacaoTexto) {
        dataInstalacaoTexto = new Date().toISOString();

        await salvarConfig(
          'data_instalacao',
          dataInstalacaoTexto
        );
      }

      const dataInstalacao = new Date(
        dataInstalacaoTexto
      ).getTime();

      const agora = Date.now();

      const diasPassados = Math.floor(
        (agora - dataInstalacao) /
          (1000 * 60 * 60 * 24)
      );

      const restantes = DIAS_TESTE - diasPassados;

      if (restantes > 0) {
        setDiasRestantesTeste(restantes);
        setTesteExpirado(false);
        setAppDesbloqueado(false);
        setMostrarBoasVindas(true);
      } else {
        setDiasRestantesTeste(0);
        setTesteExpirado(true);
        setAppDesbloqueado(false);
      }
    } catch (error: any) {
      console.error(
        'Erro ao verificar período de teste:',
        error
      );

      // Se der algum erro ao verificar (ex.: banco com problema),
      // não travamos o uso do app por causa disso.
      setAppDesbloqueado(true);
      setTesteExpirado(false);
    } finally {
      setVerificandoTeste(false);
    }
  }

  useEffect(() => {
    if (bancoPronto) {
      verificarPeriodoTeste();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bancoPronto]);

  async function desbloquearComSenha() {
    const digitado = senhaDesbloqueio.trim();

    if (!digitado) {
      Alert.alert(
        'Atenção',
        'Informe a senha de desbloqueio.'
      );
      return;
    }

    try {
      setVerificandoSenha(true);

      const correta = verificarSenhaMestre(digitado);

      if (!correta) {
        Alert.alert(
          'Senha incorreta',
          'A senha informada está incorreta.'
        );
        return;
      }

      await salvarConfig('app_ativado', '1');

      setAppDesbloqueado(true);
      setTesteExpirado(false);
      setSenhaDesbloqueio('');
    } catch (error: any) {
      console.error(
        'Erro ao desbloquear com senha:',
        error
      );

      Alert.alert(
        'Erro',
        error?.message ||
          'Não foi possível validar a senha agora.'
      );
    } finally {
      setVerificandoSenha(false);
    }
  }

  // ============================================================
  // CREDENCIAIS
  // ============================================================

  const [usuario, setUsuario] =
    useState('');

  const [senha, setSenha] =
    useState('');

  const [operadorUsuario, setOperadorUsuario] =
    useState('');

  const [operadorSenha, setOperadorSenha] =
    useState('');

  // ============================================================
  // ENTIDADES LOGADAS
  // ============================================================

  const [operador, setOperador] =
    useState<Operador | null>(null);

  const [caixa, setCaixa] =
    useState<CaixaEstado | null>(null);

  const [carregando, setCarregando] =
    useState(false);

  // ============================================================
  // VERIFICAR BANCO
  // ============================================================

  function verificarBancoAntesDeEntrar() {
    if (!bancoPronto) {
      Alert.alert(
        'Aguarde',
        erroBanco ||
          'O aplicativo ainda está preparando os dados locais.'
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
  // configuracao_local (chaves "admin_usuario" e
  // "admin_senha"). Na primeira execução, se ainda não
  // existirem, são criadas com o padrão admin/admin. A partir
  // daí o login sempre valida contra o que está no banco, o
  // que permite trocar a senha na tela "Trocar senha" e ter
  // essa alteração preservada pelo backup/restauração local.
  // ============================================================

  async function loginAdmin() {
    if (!bancoPronto) {
      Alert.alert(
        'Aguarde',
        'O banco local ainda não foi inicializado.'
      );
      return;
    }

    const usuarioDigitado = usuario.trim();
    const senhaDigitada = senha.trim();

    if (!usuarioDigitado || !senhaDigitada) {
      Alert.alert(
        'Atenção',
        'Informe usuário e senha.'
      );
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

        console.log(
          'Credenciais administrativas padrão criadas.'
        );
      }

      if (
        usuarioDigitado !== usuarioSalvo ||
        senhaDigitada !== senhaSalva
      ) {
        Alert.alert(
          'Acesso negado',
          'Usuário ou senha inválidos.'
        );

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

      console.log(
        'LOGIN ADMINISTRADOR REALIZADO COM SUCESSO'
      );
    } catch (error: any) {
      console.error(
        'ERRO NO LOGIN ADMIN:',
        error
      );

      Alert.alert(
        'Erro',
        error?.message ||
          'Erro ao abrir o banco local.'
      );
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

    const usuarioDigitado =
      operadorUsuario.trim();

    const senhaDigitada =
      operadorSenha.trim();

    if (
      !usuarioDigitado ||
      !senhaDigitada
    ) {
      Alert.alert(
        'Atenção',
        'Informe usuário e senha.'
      );

      return;
    }

    try {
      setCarregando(true);

      const db = await obterBanco();

      const operadorEncontrado =
        await db.getFirstAsync<{
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
        Alert.alert(
          'Acesso negado',
          'Operador não encontrado ou inativo.'
        );

        return;
      }

      /*
       * Nesta primeira versão local,
       * comparamos a senha armazenada.
       *
       * Se a senha estiver vazia, o operador
       * também não poderá entrar.
       */

      const senhaArmazenada =
        operadorEncontrado.senha_hash || '';

      if (
        senhaArmazenada !== senhaDigitada
      ) {
        Alert.alert(
          'Acesso negado',
          'Usuário ou senha inválidos.'
        );

        return;
      }

      const operadorLogado: Operador = {
        id: Number(
          operadorEncontrado.id
        ),
        nome:
          operadorEncontrado.nome,
        usuario:
          operadorEncontrado.usuario ||
          undefined,
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

      const caixaExistente =
        await db.getFirstAsync<{
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
        caixaId =
          Number(caixaExistente.id);

        saldoInicial =
          Number(
            caixaExistente.saldo_inicial || 0
          );
      } else {
        const agora =
          new Date().toISOString();

        const resultado =
          await db.runAsync(
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

        caixaId =
          Number(
            resultado.lastInsertRowId
          );
      }

      // ========================================================
      // ENTIDADE DO CAIXA
      // ========================================================

      setOperador(
        operadorLogado
      );

      setCaixa({
        id: caixaId,
        caixaId,
        operadorId:
          operadorLogado.id,
        operadorNome:
          operadorLogado.nome,
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
      console.error(
        'Erro no login do caixa local:',
        error
      );

      setOperador(null);
      setCaixa(null);

      Alert.alert(
        'Erro',
        error?.message ||
          'Não foi possível entrar no caixa.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // ============================================================
  // SAIR
  // ============================================================

  function sair() {
    const usuarioSaindo =
      tela === 'caixa' && operador
        ? operador.nome
        : 'admin';

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

  // ============================================================
  // TELA DE VERIFICAÇÃO DO PERÍODO DE TESTE
  // ============================================================

  if (verificandoTeste) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.telaCarregamentoTeste}>
          <ActivityIndicator size="large" color="#279905" />

          <Text style={styles.textoCarregamentoTeste}>
            Verificando licença...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // TELA DE BLOQUEIO (TESTE EXPIRADO)
  // ============================================================

  if (testeExpirado && !appDesbloqueado) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={
            Platform.OS === 'ios' ? 'padding' : 'height'
          }
          keyboardVerticalOffset={
            Platform.OS === 'ios' ? 0 : 24
          }
        >
          <ScrollView
            contentContainerStyle={styles.loginContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.loginCard,
                isTabletOuPaisagem && styles.loginCardTablet,
              ]}
            >
              <Text style={styles.bloqueioIcone}>
                🔒
              </Text>

              <Text style={styles.loginTitulo}>
                Período de teste encerrado
              </Text>

              <Text style={styles.bloqueioTexto}>
                O período de avaliação gratuita de{' '}
                {DIAS_TESTE} dias deste aplicativo
                terminou. Para continuar usando,
                informe a senha de desbloqueio.
              </Text>

              <Text style={styles.label}>
                Senha de desbloqueio
              </Text>

              <TextInput
                style={styles.input}
                value={senhaDesbloqueio}
                onChangeText={setSenhaDesbloqueio}
                placeholder="Digite a senha"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={desbloquearComSenha}
                editable={!verificandoSenha}
              />

              <TouchableOpacity
                style={styles.botaoEntrar}
                onPress={desbloquearComSenha}
                disabled={verificandoSenha}
              >
                {verificandoSenha ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botaoEntrarTexto}>
                    Desbloquear
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ============================================================
  // LOGIN
  // ============================================================

  if (tela === 'login') {
    // ----------------------------------------------------------
    // ESCOLHA ADMIN / CAIXA
    // ----------------------------------------------------------

    if (telaLogin === 'escolha') {
      return (
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={
              Platform.OS === 'ios'
                ? 'padding'
                : 'height'
            }
            keyboardVerticalOffset={
              Platform.OS === 'ios'
                ? 0
                : 24
            }
          >
            <ScrollView
              contentContainerStyle={
                styles.loginContainer
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={
                false
              }
            >
              <View style={styles.logoArea}>
                <Image
                  source={require('./img/icon.png')}
                  style={[
                    styles.logoAdmin,
                    isTabletOuPaisagem && styles.logoAdminTablet,
                  ]}
                  resizeMode="contain"
                />
              </View>

              <View
                style={[
                  styles.loginCard,
                  isTabletOuPaisagem && styles.loginCardTablet,
                ]}
              >
                <Text
                  style={styles.loginTitulo}
                >
                  Acesso ao sistema
                </Text>

                <View
                  style={
                    isPaisagem
                      ? styles.opcoesEscolhaPaisagem
                      : undefined
                  }
                >
                  <TouchableOpacity
                    style={[
                      styles.botaoPrincipal,
                      isPaisagem && styles.botaoEscolhaPaisagem,
                      !bancoPronto &&
                        styles.botaoDesabilitado,
                    ]}
                    onPress={() =>
                      setTelaLogin('admin')
                    }
                    disabled={!bancoPronto}
                  >
                    <Text
                      style={
                        styles.botaoPrincipalTexto
                      }
                    >
                      Administrador
                    </Text>

                    <Text
                      style={
                        styles.botaoDescricao
                      }
                    >
                      Produtos, operadores,
                      avarias, relatórios e
                      backup
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.botaoSecundario,
                      isPaisagem && styles.botaoEscolhaPaisagem,
                      !bancoPronto &&
                        styles.botaoDesabilitado,
                    ]}
                    onPress={() =>
                      setTelaLogin('caixa')
                    }
                    disabled={!bancoPronto}
                  >
                    <Text
                      style={
                        styles.botaoSecundarioTexto
                      }
                    >
                      Operador de Caixa
                    </Text>

                    <Text
                      style={
                        styles.botaoDescricaoEscuro
                      }
                    >
                      Acessar o PDV
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* ====================================================
              MODAL DE BOAS-VINDAS / AVISO DE TESTE DE 30 DIAS
              ==================================================== */}

          <Modal
            visible={mostrarBoasVindas}
            transparent
            animationType="fade"
            onRequestClose={() =>
              setMostrarBoasVindas(false)
            }
          >
            <View style={styles.modalFundoBoasVindas}>
              <View style={styles.modalBoasVindas}>
                <Text style={styles.boasVindasIcone}>
                  👋
                </Text>

                <Text style={styles.boasVindasTitulo}>
                  Bem-vindo(a) ao Venda Ágil!
                </Text>

                <Text style={styles.boasVindasTexto}>
                  Você está usando o período de teste
                  gratuito de {DIAS_TESTE} dias.
                </Text>

                <Text style={styles.boasVindasDias}>
                  {diasRestantesTeste}{' '}
                  {diasRestantesTeste === 1
                    ? 'dia restante'
                    : 'dias restantes'}
                </Text>

                <Text
                  style={
                    styles.boasVindasTextoSecundario
                  }
                >
                  Após o período de teste, será
                  necessário informar uma senha de
                  desbloqueio para continuar usando o
                  aplicativo.
                </Text>

                <TouchableOpacity
                  style={styles.botaoBoasVindas}
                  onPress={() =>
                    setMostrarBoasVindas(false)
                  }
                >
                  <Text
                    style={
                      styles.botaoBoasVindasTexto
                    }
                  >
                    Começar a usar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      );
    }

    // ----------------------------------------------------------
    // LOGIN
    // ----------------------------------------------------------

    const isAdmin =
      telaLogin === 'admin';

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
          keyboardVerticalOffset={
            Platform.OS === 'ios'
              ? 0
              : 24
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.loginContainer
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={
              false
            }
          >
            <View
              style={[
                styles.loginCard,
                isTabletOuPaisagem && styles.loginCardTablet,
              ]}
            >
              <TouchableOpacity
                onPress={() =>
                  setTelaLogin('escolha')
                }
              >
                <Text
                  style={styles.voltarLogin}
                >
                  ← Voltar
                </Text>
              </TouchableOpacity>

              <Text
                style={styles.loginTitulo}
              >
                {isAdmin
                  ? 'Administrador'
                  : 'Operador de Caixa'}
              </Text>

              <Text style={styles.label}>
                Usuário
              </Text>

              <TextInput
                style={styles.input}
                value={
                  isAdmin
                    ? usuario
                    : operadorUsuario
                }
                onChangeText={
                  isAdmin
                    ? setUsuario
                    : setOperadorUsuario
                }
                placeholder="Digite o usuário"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <Text style={styles.label}>
                Senha
              </Text>

              <TextInput
                style={styles.input}
                value={
                  isAdmin
                    ? senha
                    : operadorSenha
                }
                onChangeText={
                  isAdmin
                    ? setSenha
                    : setOperadorSenha
                }
                placeholder="Digite a senha"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={
                  isAdmin
                    ? loginAdmin
                    : loginCaixa
                }
              />

              <TouchableOpacity
                style={styles.botaoEntrar}
                onPress={
                  isAdmin
                    ? loginAdmin
                    : loginCaixa
                }
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator
                    color="#fff"
                  />
                ) : (
                  <Text
                    style={
                      styles.botaoEntrarTexto
                    }
                  >
                    {isAdmin
                      ? 'Entrar'
                      : 'Entrar no Caixa'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ============================================================
  // ADMIN
  // ============================================================

  if (tela === 'admin') {
    // ----------------------------------------------------------
    // TELAS INTERNAS
    // ----------------------------------------------------------

    if (telaAdmin !== 'menu') {
      const titulos: Record<
        Exclude<TelaAdmin, 'menu'>,
        string
      > = {
        cadastroProduto:
          'Cadastrar produto',

        gerenciarProdutos:
          'Gerenciar produtos',

        gerenciarOperadores:
          'Gerenciar operadores',

        avarias:
          'Avarias',

        relatorios:
          'Relatório de vendas',

        ia:
          '🤖 Assistente IA',

        backup:
          '💾 Backup e Restauração',

        trocarSenha:
          '🔑 Trocar senha do admin',

        logAtividades:
          '📋 Log de atividades',
      };

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.topoInterno}>
            <TouchableOpacity
              onPress={() =>
                setTelaAdmin('menu')
              }
            >
              <Text
                style={
                  styles.voltarInterno
                }
              >
                ← Voltar
              </Text>
            </TouchableOpacity>

            <Text
              style={styles.topoTitulo}
            >
              {titulos[telaAdmin]}
            </Text>
          </View>

          {telaAdmin ===
            'cadastroProduto' && (
            <CadastroProduto />
          )}

          {telaAdmin ===
            'gerenciarProdutos' && (
            <GerenciarProdutos />
          )}

          {telaAdmin ===
            'gerenciarOperadores' && (
            <GerenciarOperadores />
          )}

          {telaAdmin === 'avarias' && (
            <Avarias />
          )}

          {telaAdmin ===
            'relatorios' && (
            <Relatorios
              onVoltar={() =>
                setTelaAdmin('menu')
              }
            />
          )}

          {telaAdmin === 'ia' && (
            <IA />
          )}

          {telaAdmin === 'backup' && (
            <Backup />
          )}

          {telaAdmin === 'trocarSenha' && (
            <TrocarSenha />
          )}

          {telaAdmin === 'logAtividades' && (
            <LogAtividades />
          )}
        </SafeAreaView>
      );
    }

    // ----------------------------------------------------------
    // MENU ADMINISTRATIVO
    // ----------------------------------------------------------

    // Acompanha o movimento do gesto de pinça enquanto ele
    // acontece (não muda a grade ainda, só guarda a escala).
    function aoMoverPinca(evento: any) {
      escalaPincaRef.current = evento.nativeEvent.scale;
    }

    // Quando o gesto termina, decide se aumenta ou diminui o
    // número de colunas com base na escala final da pinça.
    function aoSoltarPinca(evento: any) {
      if (evento.nativeEvent.oldState !== GestureState.ACTIVE) {
        return;
      }

      const escala = escalaPincaRef.current;

      setColunasMenu((atual) => {
        // Afastou os dedos (deu zoom) -> cards maiores, menos colunas
        if (escala > 1.15) {
          return Math.max(1, atual - 1);
        }

        // Juntou os dedos (diminuiu o zoom) -> cards menores, mais colunas
        if (escala < 0.85) {
          return Math.min(4, atual + 1);
        }

        return atual;
      });

      escalaPincaRef.current = 1;
    }

    // Largura útil do conteúdo (respeita o padding usado em
    // adminContainer / adminContainerTablet) para calcular o
    // tamanho exato de cada card conforme o número de colunas.
    const espacamentoCard = 12;

    const larguraUtilConteudo = isTabletOuPaisagem
      ? Math.min(width, 900) - 24 * 2
      : width - 18 * 2;

    const larguraCardMenu =
      (larguraUtilConteudo -
        espacamentoCard * (colunasMenu - 1)) /
      colunasMenu;

    // Todos os itens do menu numa única lista: eles preenchem as
    // fileiras na horizontal, sem ficar presos a "seções" (por
    // isso "Relatório de vendas", que antes ficava sozinho numa
    // fileira, agora divide a fileira com outros cards).
    const itensMenuAdmin: Array<{
      icon: string;
      title: string;
      onPress: () => void;
    }> = [
      {
        icon: '📦',
        title: 'Cadastrar produtos',
        onPress: () => setTelaAdmin('cadastroProduto'),
      },
      {
        icon: '🗂️',
        title: 'Gerenciar produtos',
        onPress: () => setTelaAdmin('gerenciarProdutos'),
      },
      {
        icon: '👥',
        title: 'Gerenciar operadores',
        onPress: () => setTelaAdmin('gerenciarOperadores'),
      },
      {
        icon: '⚠️',
        title: 'Avarias',
        onPress: () => setTelaAdmin('avarias'),
      },
      {
        icon: '🤖',
        title: 'Perguntar à IA',
        onPress: () => setTelaAdmin('ia'),
      },
      {
        icon: '📊',
        title: 'Relatório de vendas',
        onPress: () => setTelaAdmin('relatorios'),
      },
      {
        icon: '💾',
        title: 'Backup e restauração',
        onPress: () => setTelaAdmin('backup'),
      },
      {
        icon: '🔑',
        title: 'Trocar senha',
        onPress: () => setTelaAdmin('trocarSenha'),
      },
      {
        icon: '📋',
        title: 'Log de atividades',
        onPress: () => setTelaAdmin('logAtividades'),
      },
    ];

    return (
      <SafeAreaView style={styles.container}>

        <View style={styles.adminCabecalho}>
          <Text style={styles.adminSubtitulo}>
            Painel Administrativo
          </Text>

          <TouchableOpacity
            style={styles.botaoSairPequeno}
            onPress={sair}
          >
            <Text style={styles.botaoSairTexto}>
              Sair
            </Text>
          </TouchableOpacity>
        </View>

        {/* Do cabeçalho pra baixo: gradiente puxando pro branco/cinza */}
        <LinearGradient
          colors={['#b6eeb6', '#e3f0e6', '#f7f7f8']}
          style={styles.gradienteConteudo}
        >
          <PinchGestureHandler
            onGestureEvent={aoMoverPinca}
            onHandlerStateChange={aoSoltarPinca}
          >
            <ScrollView
              contentContainerStyle={[
                styles.adminContainer,
                isTabletOuPaisagem && styles.adminContainerTablet,
              ]}
            >
            

              <View style={styles.gradeMenu}>
                {itensMenuAdmin.map((item) => (
                  <MenuButton
                    key={item.title}
                    icon={item.icon}
                    title={item.title}
                    style={{ width: larguraCardMenu }}
                    onPress={item.onPress}
                  />
                ))}
              </View>
            </ScrollView>
          </PinchGestureHandler>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ============================================================
  // CAIXA
  // ============================================================

  if (tela === 'caixa') {
    return (
      <SafeAreaView style={styles.container}>
        <Caixa
          operador={operador}
          caixa={caixa}
          onLogout={sair}
        />
      </SafeAreaView>
    );
  }

  return null;
}

// ============================================================
// BOTÃO DO MENU
// ============================================================

function MenuButton({
  icon,
  title,
  onPress,
  style,
}: {
  icon: string;
  title: string;
  onPress: () => void;
  style?: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuButton, style]}
      onPress={onPress}
    >
      <Text style={styles.menuButtonIcone}>
        {icon}
      </Text>

      <Text
        style={styles.menuButtonTitle}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7bd17b',
    borderRadius: 5,
    paddingTop: 6,
  },

  keyboardContainer: {
    flex: 1,
  },

  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 80,
  },

  logoArea: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoAdmin: {
    width: 300,
    height: 300,
  },

  logoAdminTablet: {
    width: 220,
    height: 220,
  },

  loginCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    elevation: 4,
  },

  // Em tablets e na orientação deitada, o card de login/menu fica
  // limitado em largura e centralizado, em vez de esticar até as
  // bordas da tela.
  loginCardTablet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },

  // Na paisagem, os dois botões de "Administrador" / "Operador de
  // Caixa" ficam lado a lado em vez de empilhados.
  opcoesEscolhaPaisagem: {
    flexDirection: 'row',
    gap: 12,
  },

  botaoEscolhaPaisagem: {
    flex: 1,
    marginBottom: 0,
  },

  loginTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#518859',
    marginBottom: 20,
  },

  voltarLogin: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 18,
    backgroundColor: '#a4e4ba',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#161d2c',
    fontSize: 14,
  },

  botaoDesabilitado: {
    opacity: 0.5,
  },

  botaoPrincipal: {
    backgroundColor: '#279905',
    borderRadius: 12,
    padding: 17,
    marginBottom: 12,
  },

  botaoPrincipalTexto: {
    color: '#f5f5f5',
    fontSize: 17,
    fontWeight: '800',
  },

  botaoDescricao: {
    color: '#2ff707',
    fontSize: 12,
    marginTop: 5,
  },

  botaoSecundario: {
    backgroundColor: '#279905',
    borderRadius: 12,
    padding: 17,
  },

  botaoSecundarioTexto: {
    color: '#f5f8ff',
    fontSize: 17,
    fontWeight: '800',
  },

  botaoDescricaoEscuro: {
    color: '#2ff707',
    fontSize: 12,
    marginTop: 5,
  },

  botaoEntrar: {
    backgroundColor: '#2563eb',
    borderRadius: 9,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },

  botaoEntrarTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  topoInterno: {
    height: 58,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  voltarInterno: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: '#a4e4ba',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 15,
  },

  topoTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  adminContainer: {
    padding: 18,
    paddingBottom: 40,
  },

  // Em tablets/paisagem, o conteúdo do painel fica centralizado
  // e com largura máxima, para não esticar demais em telas largas.
  adminContainerTablet: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },

  // Grade de cards quadrados (ícone + nome) para o menu
  // administrativo, sempre em várias colunas, em qualquer
  // tamanho de tela.
  gradeMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 12,
  },

  // Cabeçalho fica sempre verde, igual já era antes; o que muda
  // é o conteúdo abaixo dele, que agora usa um gradiente.
  adminCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#b6eeb6',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },

  // Área abaixo do cabeçalho: gradiente puxando do verde pro
  // branco/cinza (ver LinearGradient no render do menu admin).
  gradienteConteudo: {
    flex: 1,
  },

  dicaZoom: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 14,
  },

  adminSubtitulo: {
    fontSize: 13,
    color: '#23262b',
    marginTop: 4,
    borderRadius: 9,
    padding: 5,
    backgroundColor: '#fee2e2',
  },

  botaoSairPequeno: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  botaoSairTexto: {
    color: '#b91c1c',
    fontWeight: '800',
    fontSize: 13,
  },

  secaoMenuTitulo: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 9,
  },

  menuButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 6,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra em caixa nos dois sistemas
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
  },

  menuButtonIcone: {
    fontSize: 30,
    marginBottom: 8,
  },

  menuButtonTitle: {
    color: '#111827',
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 16,
  },

  // ============================================================
  // TESTE / BLOQUEIO / BOAS-VINDAS
  // ============================================================

  telaCarregamentoTeste: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoCarregamentoTeste: {
    marginTop: 12,
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },

  bloqueioIcone: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 10,
  },

  bloqueioTexto: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 18,
    lineHeight: 19,
  },

  modalFundoBoasVindas: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalBoasVindas: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },

  boasVindasIcone: {
    fontSize: 40,
    marginBottom: 8,
  },

  boasVindasTitulo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },

  boasVindasTexto: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },

  boasVindasDias: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '900',
    color: '#279905',
    textAlign: 'center',
  },

  boasVindasTextoSecundario: {
    marginTop: 14,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },

  botaoBoasVindas: {
    marginTop: 20,
    backgroundColor: '#279905',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
  },

  botaoBoasVindasTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});