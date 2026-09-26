import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { estilos } from './Estilos';

// ============================================================
// TELA DE VERIFICAÇÃO DO PERÍODO DE TESTE
// ============================================================

export function TelaCarregamentoTeste() {
  return (
    <SafeAreaView style={estilos.container}>
      <View style={estilos.telaCarregamentoTeste}>
        <ActivityIndicator size="large" color="#279905" />

        <Text style={estilos.textoCarregamentoTeste}>
          Verificando licença...
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// TELA DE BLOQUEIO (TESTE EXPIRADO)
// ============================================================

interface TelaBloqueioTesteProps {
  isLargo: boolean;
  diasTeste: number;
  senhaDesbloqueio: string;
  setSenhaDesbloqueio: (valor: string) => void;
  verificandoSenha: boolean;
  desbloquearComSenha: () => void;
}

export function TelaBloqueioTeste({
  isLargo,
  diasTeste,
  senhaDesbloqueio,
  setSenhaDesbloqueio,
  verificandoSenha,
  desbloquearComSenha,
}: TelaBloqueioTesteProps) {
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
            <Text style={estilos.bloqueioIcone}>🔒</Text>

            <Text style={estilos.loginTitulo}>
              Período de teste encerrado
            </Text>

            <Text style={estilos.bloqueioTexto}>
              O período de avaliação gratuita de {diasTeste} dias deste
              aplicativo terminou. Para continuar usando, informe a senha de
              desbloqueio.
            </Text>

            <Text style={estilos.label}>Senha de desbloqueio</Text>

            <TextInput
              style={estilos.input}
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
              style={estilos.botaoEntrar}
              onPress={desbloquearComSenha}
              disabled={verificandoSenha}
            >
              {verificandoSenha ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={estilos.botaoEntrarTexto}>Desbloquear</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// MODAL DE BOAS-VINDAS / AVISO DE TESTE DE 30 DIAS
// ============================================================

interface ModalBoasVindasProps {
  visivel: boolean;
  onFechar: () => void;
  diasRestantes: number;
  diasTeste: number;
  isLargo: boolean;
}

export function ModalBoasVindas({
  visivel,
  onFechar,
  diasRestantes,
  diasTeste,
  isLargo,
}: ModalBoasVindasProps) {
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <View style={estilos.modalFundoBoasVindas}>
        <View
          style={[
            estilos.modalBoasVindas,
            isLargo && estilos.modalBoasVindasLargo,
          ]}
        >
          <Text style={estilos.boasVindasIcone}>👋</Text>

          <Text style={estilos.boasVindasTitulo}>
            Bem-vindo(a) ao Venda Ágil!
          </Text>

          <Text style={estilos.boasVindasTexto}>
            Você está usando o período de teste gratuito de {diasTeste} dias.
          </Text>

          <Text style={estilos.boasVindasDias}>
            {diasRestantes}{' '}
            {diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
          </Text>

          <Text style={estilos.boasVindasTextoSecundario}>
            Após o período de teste, será necessário informar uma senha de
            desbloqueio para continuar usando o aplicativo.
          </Text>

          <TouchableOpacity style={estilos.botaoBoasVindas} onPress={onFechar}>
            <Text style={estilos.botaoBoasVindasTexto}>Começar a usar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}