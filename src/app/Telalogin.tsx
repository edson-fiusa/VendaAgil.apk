import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { estilos } from './Estilos';
import { ModalBoasVindas } from './Telateste';
import type { TelaLogin as TipoTelaLogin } from './Tipos';

interface TelaLoginProps {
  isPaisagem: boolean;
  isLargo: boolean;
  bancoPronto: boolean;

  telaLogin: TipoTelaLogin;
  setTelaLogin: (tela: TipoTelaLogin) => void;

  usuario: string;
  setUsuario: (valor: string) => void;
  senha: string;
  setSenha: (valor: string) => void;

  operadorUsuario: string;
  setOperadorUsuario: (valor: string) => void;
  operadorSenha: string;
  setOperadorSenha: (valor: string) => void;

  carregando: boolean;
  loginAdmin: () => void;
  loginAdminComBiometria: () => void;
  loginCaixa: () => void;

  mostrarBoasVindas: boolean;
  setMostrarBoasVindas: (valor: boolean) => void;
  diasRestantesTeste: number;
  diasTeste: number;
}

export function TelaLogin({
  isPaisagem,
  isLargo,
  bancoPronto,
  telaLogin,
  setTelaLogin,
  usuario,
  setUsuario,
  senha,
  setSenha,
  operadorUsuario,
  setOperadorUsuario,
  operadorSenha,
  setOperadorSenha,
  carregando,
  loginAdmin,
  loginAdminComBiometria,
  loginCaixa,
  mostrarBoasVindas,
  setMostrarBoasVindas,
  diasRestantesTeste,
  diasTeste,
}: TelaLoginProps) {
  // ----------------------------------------------------------
  // ESCOLHA ADMIN / CAIXA (MENU COM CARDS)
  // ----------------------------------------------------------

  if (telaLogin === 'escolha') {
    return (
      <SafeAreaView style={estilos.container}>
        <KeyboardAvoidingView
          style={estilos.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <ScrollView
            contentContainerStyle={[
              estilos.loginContainer,
              isPaisagem && estilos.loginContainerPaisagem,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                estilos.logoArea,
                isPaisagem && estilos.logoAreaPaisagem,
              ]}
            >
              <Image
                source={require('./img/icon.png')}
                style={[estilos.logoAdmin, isLargo && estilos.logoAdminLargo]}
                resizeMode="contain"
              />
            </View>

            <View
              style={[
                menuEstilos.menuWrapper,
                isLargo && menuEstilos.menuWrapperLargo,
              ]}
            >
              <Text style={menuEstilos.menuTitulo}>Acesso ao sistema</Text>
              <Text style={menuEstilos.menuSubtitulo}>
                Selecione como deseja entrar
              </Text>

              <View
                style={[
                  menuEstilos.cardsLista,
                  isPaisagem && menuEstilos.cardsListaPaisagem,
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[
                    menuEstilos.card,
                    isPaisagem && menuEstilos.cardPaisagem,
                    !bancoPronto && menuEstilos.cardDesabilitado,
                  ]}
                  onPress={() => setTelaLogin('admin')}
                  disabled={!bancoPronto}
                >
                  <View
                    style={[menuEstilos.cardIcone, menuEstilos.cardIconeAdmin]}
                  >
                    <Text style={menuEstilos.cardIconeTexto}>👤</Text>
                  </View>

                  <View style={menuEstilos.cardTextos}>
                    <Text style={menuEstilos.cardTitulo}>Administrador</Text>
                    <Text style={menuEstilos.cardDescricao}>
                      Produtos, operadores, avarias, relatórios e backup
                    </Text>
                  </View>

                  <Text style={menuEstilos.cardSeta}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[
                    menuEstilos.card,
                    isPaisagem && menuEstilos.cardPaisagem,
                    !bancoPronto && menuEstilos.cardDesabilitado,
                  ]}
                  onPress={() => setTelaLogin('caixa')}
                  disabled={!bancoPronto}
                >
                  <View
                    style={[menuEstilos.cardIcone, menuEstilos.cardIconeCaixa]}
                  >
                    <Text style={menuEstilos.cardIconeTexto}>🧾</Text>
                  </View>

                  <View style={menuEstilos.cardTextos}>
                    <Text style={menuEstilos.cardTitulo}>
                      Operador de Caixa
                    </Text>
                    <Text style={menuEstilos.cardDescricao}>
                      Acessar o PDV
                    </Text>
                  </View>

                  <Text style={menuEstilos.cardSeta}>›</Text>
                </TouchableOpacity>
              </View>

              {!bancoPronto && (
                <Text style={menuEstilos.avisoBanco}>
                  Preparando o banco de dados...
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <ModalBoasVindas
          visivel={mostrarBoasVindas}
          onFechar={() => setMostrarBoasVindas(false)}
          diasRestantes={diasRestantesTeste}
          diasTeste={diasTeste}
          isLargo={isLargo}
        />
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------------
  // FORMULÁRIO DE LOGIN (ADMIN OU CAIXA)
  // ----------------------------------------------------------

  const isAdmin = telaLogin === 'admin';

  return (
    <SafeAreaView style={estilos.container}>
      <KeyboardAvoidingView
        style={estilos.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={estilos.loginContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={[estilos.loginCard, isLargo && estilos.loginCardLargo]}>
            <TouchableOpacity onPress={() => setTelaLogin('escolha')}>
              <Text style={estilos.voltarLogin}>← Voltar</Text>
            </TouchableOpacity>

            <Text style={estilos.loginTitulo}>
              {isAdmin ? 'Administrador' : 'Operador de Caixa'}
            </Text>

            <Text style={estilos.label}>Usuário</Text>

            <TextInput
              style={estilos.input}
              value={isAdmin ? usuario : operadorUsuario}
              onChangeText={isAdmin ? setUsuario : setOperadorUsuario}
              placeholder="Digite o usuário"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={estilos.label}>Senha</Text>

            <TextInput
              style={estilos.input}
              value={isAdmin ? senha : operadorSenha}
              onChangeText={isAdmin ? setSenha : setOperadorSenha}
              placeholder="Digite a senha"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={isAdmin ? loginAdmin : loginCaixa}
            />

            <TouchableOpacity
              style={estilos.botaoEntrar}
              onPress={isAdmin ? loginAdmin : loginCaixa}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={estilos.botaoEntrarTexto}>
                  {isAdmin ? 'Entrar' : 'Entrar no Caixa'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Alternativa à senha, só na tela de Administrador. */}
            {isAdmin && (
              <>
                <View style={biometriaEstilos.separadorLinha}>
                  <View style={biometriaEstilos.linha} />
                  <Text style={biometriaEstilos.separadorTexto}>ou</Text>
                  <View style={biometriaEstilos.linha} />
                </View>

                <TouchableOpacity
                  style={biometriaEstilos.botaoBiometria}
                  onPress={loginAdminComBiometria}
                  disabled={carregando}
                >
                  <Text style={biometriaEstilos.botaoBiometriaIcone}>🔒</Text>
                  <Text style={biometriaEstilos.botaoBiometriaTexto}>
                    Entrar com biometria
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------
// ESTILOS DO BOTÃO DE BIOMETRIA (locais)
// ----------------------------------------------------------

const biometriaEstilos = StyleSheet.create({
  separadorLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 14,
  },
  linha: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  separadorTexto: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '700',
  },
  botaoBiometria: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  botaoBiometriaIcone: {
    fontSize: 18,
    marginRight: 8,
  },
  botaoBiometriaTexto: {
    color: '#2563eb',
    fontWeight: '800',
    fontSize: 15,
  },
});

// ----------------------------------------------------------
// ESTILOS DO MENU DE CARDS (locais, não dependem de Estilos.ts)
// ----------------------------------------------------------

const menuEstilos = StyleSheet.create({
  menuWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  menuWrapperLargo: {
    maxWidth: 520,
  },
  menuTitulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  menuSubtitulo: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  cardsLista: {
    gap: 14,
  },
  cardsListaPaisagem: {
    flexDirection: 'row',
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbecdf',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 10,
  },
  cardPaisagem: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  cardDesabilitado: {
    opacity: 0.5,
  },
  cardIcone: {
    width: 57,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIconeAdmin: {
    backgroundColor: '#eef2ff',
  },
  cardIconeCaixa: {
    backgroundColor: '#ecfdf5',
  },
  cardIconeTexto: {
    fontSize: 22,
  },
  cardTextos: {
    flex: 1,
  },
  cardTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  cardDescricao: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardSeta: {
    fontSize: 22,
    color: '#9ca3af',
    marginLeft: 8,
  },
  avisoBanco: {
    marginTop: 16,
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
});