import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ============================================================
// CONFIGURAÇÃO — troque pelos seus contatos reais
// ============================================================
const EMAIL_DESENVOLVEDOR = 'antoedson@gmail.com';
const WHATSAPP_DESENVOLVEDOR = '5585999538924';
const NOME_APP = 'Venda Ágil';

const ESTRELAS = [1, 2, 3, 4, 5];

export default function FeedbackApp() {
  const [nota, setNota] = useState(0);
  const [mensagem, setMensagem] = useState('');

  function montarTexto(): string {
    const notaTexto = nota > 0 ? `${nota}/5 estrelas` : 'Sem nota';

    return (
      `Feedback do ${NOME_APP}\n\n` +
      `Avaliação: ${notaTexto}\n\n` +
      `Comentário:\n${mensagem.trim() || '(sem comentário)'}`
    );
  }

  function validar(): boolean {
    if (nota === 0 && !mensagem.trim()) {
      Alert.alert(
        'Atenção',
        'Dê uma nota ou escreva um comentário antes de enviar.'
      );
      return false;
    }
    return true;
  }

  async function enviarPorEmail() {
    if (!validar()) return;

    const assunto = encodeURIComponent(`Feedback - ${NOME_APP}`);
    const corpo = encodeURIComponent(montarTexto());
    const url = `mailto:${EMAIL_DESENVOLVEDOR}?subject=${assunto}&body=${corpo}`;

    try {
      const suportado = await Linking.canOpenURL(url);

      if (!suportado) {
        Alert.alert(
          'Sem app de e-mail',
          'Não encontrei um aplicativo de e-mail configurado neste aparelho.'
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Erro ao abrir e-mail:', error);
      Alert.alert('Erro', 'Não foi possível abrir o aplicativo de e-mail.');
    }
  }

  async function enviarPorWhatsapp() {
    if (!validar()) return;

    const texto = encodeURIComponent(montarTexto());
    const url = `whatsapp://send?phone=${WHATSAPP_DESENVOLVEDOR}&text=${texto}`;

    try {
      const suportado = await Linking.canOpenURL(url);

      if (!suportado) {
        Alert.alert(
          'WhatsApp não encontrado',
          'Não encontrei o WhatsApp instalado neste aparelho.'
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Erro ao abrir WhatsApp:', error);
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        contentContainerStyle={estilos.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={estilos.card}>
          <Text style={estilos.titulo}>O que você achou do aplicativo?</Text>
          <Text style={estilos.subtitulo}>
            Sua opinião ajuda a melhorar o {NOME_APP}.
          </Text>

          <View style={estilos.estrelasLinha}>
            {ESTRELAS.map((valor) => (
              <TouchableOpacity
                key={valor}
                onPress={() => setNota(valor)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Text
                  style={[
                    estilos.estrela,
                    valor <= nota && estilos.estrelaAtiva,
                  ]}
                >
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={estilos.label}>Comentário (opcional)</Text>

          <TextInput
            style={estilos.textarea}
            value={mensagem}
            onChangeText={setMensagem}
            placeholder="Conte o que funcionou bem, o que travou, o que falta..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={estilos.aviso}>
            O app não tem internet própria: ao enviar, seu celular abre o
            e-mail ou o WhatsApp com o texto já pronto para você mandar.
          </Text>

          <TouchableOpacity
            style={[estilos.botao, estilos.botaoEmail]}
            onPress={enviarPorEmail}
          >
            <Text style={estilos.botaoTexto}>✉️  Enviar por e-mail</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[estilos.botao, estilos.botaoWhatsapp]}
            onPress={enviarPorWhatsapp}
          >
            <Text style={estilos.botaoTexto}>💬  Enviar por WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flexGrow: 1,
    padding: 18,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    elevation: 4,
  },

  titulo: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },

  subtitulo: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 18,
  },

  estrelasLinha: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },

  estrela: {
    fontSize: 38,
    color: '#e5e7eb',
  },

  estrelaAtiva: {
    color: '#f59e0b',
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },

  textarea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#161d2c',
    fontSize: 14,
    minHeight: 110,
  },

  aviso: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
    marginBottom: 18,
    lineHeight: 17,
  },

  botao: {
    borderRadius: 9,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },

  botaoEmail: {
    backgroundColor: '#2563eb',
  },

  botaoWhatsapp: {
    backgroundColor: '#16a34a',
  },

  botaoTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});