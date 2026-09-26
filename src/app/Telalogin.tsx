import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  loginCaixa,
  mostrarBoasVindas,
  setMostrarBoasVindas,
  diasRestantesTeste,
  diasTeste,
}: TelaLoginProps) {
  // ----------------------------------------------------------
  // ESCOLHA ADMIN / CAIXA
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
                estilos.loginCard,
                isLargo && estilos.loginCardLargo,
                isPaisagem && estilos.loginCardPaisagem,
              ]}
            >
              <Text style={estilos.loginTitulo}>Acesso ao sistema</Text>

              <TouchableOpacity
                style={[
                  estilos.botaoPrincipal,
                  !bancoPronto && estilos.botaoDesabilitado,
                ]}
                onPress={() => setTelaLogin('admin')}
                disabled={!bancoPronto}
              >
                <Text style={estilos.botaoPrincipalTexto}>Administrador</Text>

                <Text style={estilos.botaoDescricao}>
                  Produtos, operadores, avarias, relatórios e backup
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  estilos.botaoSecundario,
                  !bancoPronto && estilos.botaoDesabilitado,
                ]}
                onPress={() => setTelaLogin('caixa')}
                disabled={!bancoPronto}
              >
                <Text style={estilos.botaoSecundarioTexto}>
                  Operador de Caixa
                </Text>

                <Text style={estilos.botaoDescricaoEscuro}>
                  Acessar o PDV
                </Text>
              </TouchableOpacity>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}