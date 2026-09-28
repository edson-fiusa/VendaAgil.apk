import { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    limparTokenDigitado,
    lerTokenMP,
    removerTokenMP,
    salvarTokenMP,
    tokenEhDeTeste,
    tokenMPValido,
} from '../app/Armazenamentoseguro';

type Props = {
  visivel: boolean;
  aoFechar: () => void;
};

export function TelaTokenMercadoPago({ visivel, aoFechar }: Props) {
  const [atual, setAtual] = useState<string | null>(null);
  const [entrada, setEntrada] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setAtual(await lerTokenMP());
  }

  useEffect(() => {
    if (visivel) {
      setEntrada('');
      carregar();
    }
  }, [visivel]);

  async function salvar() {
    const token = limparTokenDigitado(entrada);

    if (!tokenMPValido(token)) {
      Alert.alert(
        'Token inválido',
        'Cole o Access Token (começa com APP_USR- ou TEST-). ' +
          'A Public Key não serve.'
      );
      return;
    }

    try {
      setSalvando(true);
      await salvarTokenMP(token);
      setEntrada('');
      await carregar();

      Alert.alert(
        'Token salvo',
        tokenEhDeTeste(token)
          ? 'Token de TESTE salvo. Pagamentos não são reais.'
          : 'Token de produção salvo. Os pagamentos serão reais.'
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o token com segurança.');
    } finally {
      setSalvando(false);
    }
  }

  function remover() {
    Alert.alert('Remover token', 'O app não conseguirá gerar PIX até um novo token ser cadastrado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await removerTokenMP();
          await carregar();
        },
      },
    ]);
  }

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={aoFechar}
    >
      <View style={estilos.fundo}>
        <View style={estilos.caixa}>
          <Text style={estilos.titulo}>Mercado Pago</Text>

          <Text style={estilos.status}>
            {atual
              ? `Token salvo: ••••${atual.slice(-6)} (${
                  tokenEhDeTeste(atual) ? 'teste' : 'produção'
                })`
              : 'Nenhum token cadastrado'}
          </Text>

          <Text style={estilos.label}>Novo Access Token</Text>

          <TextInput
            style={estilos.input}
            value={entrada}
            onChangeText={setEntrada}
            placeholder="APP_USR-..."
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            contextMenuHidden={false}
          />

          <Text style={estilos.dica}>
            Fica guardado criptografado no aparelho (Android Keystore).
            Gere o token em mercadopago.com.br/developers → Suas
            integrações → Credenciais de produção.
          </Text>

          <TouchableOpacity
            style={[estilos.botaoSalvar, salvando && { opacity: 0.5 }]}
            onPress={salvar}
            disabled={salvando}
          >
            <Text style={estilos.botaoTexto}>Salvar token</Text>
          </TouchableOpacity>

          {!!atual && (
            <TouchableOpacity style={estilos.botaoRemover} onPress={remover}>
              <Text style={estilos.botaoRemoverTexto}>Remover token</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={estilos.botaoFechar} onPress={aoFechar}>
            <Text style={estilos.botaoTexto}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  caixa: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
  },

  titulo: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111827',
  },

  status: {
    marginTop: 8,
    color: '#374151',
    fontWeight: '600',
  },

  label: {
    marginTop: 16,
    marginBottom: 5,
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 12,
    color: '#111827',
  },

  dica: {
    marginTop: 8,
    fontSize: 11,
    color: '#6b7280',
  },

  botaoSalvar: {
    marginTop: 16,
    height: 46,
    borderRadius: 9,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoRemover: {
    marginTop: 10,
    height: 42,
    borderRadius: 9,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoRemoverTexto: {
    color: '#dc2626',
    fontWeight: '800',
  },

  botaoFechar: {
    marginTop: 10,
    height: 46,
    borderRadius: 9,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoTexto: {
    color: '#fff',
    fontWeight: '800',
  },
});