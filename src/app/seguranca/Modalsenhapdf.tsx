import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  cadastrarSenhaPdf,
  possuiSenhaPdfCadastrada,
  redefinirSenhaPdf,
  validarSenhaPdf,
} from '../seguranca/Senhapdf';

type Props = {
  visivel: boolean;
  aoFechar: () => void;
  // Chamado quando a senha foi digitada/cadastrada e confirmada com
  // sucesso. Recebe a senha em texto puro, para uso IMEDIATO na
  // criptografia do PDF — quem chamar não deve guardar esse valor em
  // nenhum lugar.
  aoConfirmar: (senha: string) => void;
};

/**
 * Modal responsável por pedir a senha de proteção dos PDFs antes de
 * gerar um relatório.
 *
 * - Se ainda não existe senha cadastrada, mostra o formulário de
 *   "criar senha" (senha + confirmação).
 * - Se já existe, mostra o formulário de "digitar senha" — com opção
 *   de "esqueci minha senha" para redefinir (o que só vale para os
 *   PRÓXIMOS PDFs; os antigos continuam com a senha anterior).
 */
export default function ModalSenhaPdf({ visivel, aoFechar, aoConfirmar }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [modoCriacao, setModoCriacao] = useState(false);

  const [senha, setSenha] = useState('');
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!visivel) {
      return;
    }

    // Toda vez que o modal abre, reseta o estado e confere se já
    // existe senha cadastrada.
    setSenha('');
    setConfirmacaoSenha('');
    setErro('');
    setEnviando(false);
    setCarregando(true);

    possuiSenhaPdfCadastrada()
      .then((existe) => {
        setModoCriacao(!existe);
      })
      .catch((e) => {
        console.error('Erro ao verificar senha do PDF:', e);
        setModoCriacao(true);
      })
      .finally(() => {
        setCarregando(false);
      });
  }, [visivel]);

  async function lidarComConfirmar() {
    setErro('');

    if (modoCriacao) {
      if (senha.trim().length < 4) {
        setErro('A senha precisa ter pelo menos 4 caracteres.');
        return;
      }

      if (senha !== confirmacaoSenha) {
        setErro('As senhas digitadas não são iguais.');
        return;
      }

      try {
        setEnviando(true);
        await cadastrarSenhaPdf(senha);
        aoConfirmar(senha);
      } catch (e: any) {
        setErro(e?.message || 'Não foi possível cadastrar a senha.');
      } finally {
        setEnviando(false);
      }

      return;
    }

    // Modo "digitar senha existente"
    if (!senha) {
      setErro('Digite a senha.');
      return;
    }

    try {
      setEnviando(true);

      const valida = await validarSenhaPdf(senha);

      if (!valida) {
        setErro('Senha incorreta.');
        return;
      }

      aoConfirmar(senha);
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível conferir a senha.');
    } finally {
      setEnviando(false);
    }
  }

  function lidarComEsqueciSenha() {
    Alert.alert(
      'Redefinir senha do PDF',
      'Isso vai apagar a senha atual e permitir cadastrar uma nova para os PRÓXIMOS PDFs. PDFs que você já gerou continuam exigindo a senha antiga para abrir — isso não tem como ser alterado depois. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Redefinir',
          style: 'destructive',
          onPress: async () => {
            try {
              await redefinirSenhaPdf();
              setModoCriacao(true);
              setSenha('');
              setConfirmacaoSenha('');
              setErro('');
            } catch (e: any) {
              Alert.alert(
                'Erro',
                e?.message || 'Não foi possível redefinir a senha.'
              );
            }
          },
        },
      ]
    );
  }

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={aoFechar}
    >
      <View style={estilos.fundo}>
        <View style={estilos.cartao}>
          {carregando ? (
            <ActivityIndicator color="#279905" style={{ marginVertical: 24 }} />
          ) : (
            <>
              <Text style={estilos.titulo}>
                {modoCriacao
                  ? 'Criar senha para os PDFs'
                  : 'Senha do relatório em PDF'}
              </Text>

              <Text style={estilos.texto}>
                {modoCriacao
                  ? 'Essa senha vai ser pedida sempre que você gerar um relatório em PDF, e será necessária para abrir o arquivo depois. Guarde-a em um lugar seguro — o app não consegue recuperá-la.'
                  : 'Digite a senha cadastrada para proteger este PDF.'}
              </Text>

              <TextInput
                style={estilos.campo}
                placeholder={modoCriacao ? 'Nova senha' : 'Senha'}
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoFocus
                value={senha}
                onChangeText={setSenha}
              />

              {modoCriacao && (
                <TextInput
                  style={estilos.campo}
                  placeholder="Confirmar senha"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  value={confirmacaoSenha}
                  onChangeText={setConfirmacaoSenha}
                />
              )}

              {!!erro && <Text style={estilos.erro}>{erro}</Text>}

              <TouchableOpacity
                style={[estilos.botaoPrincipal, enviando && estilos.desabilitado]}
                onPress={lidarComConfirmar}
                disabled={enviando}
              >
                {enviando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={estilos.botaoPrincipalTexto}>
                    {modoCriacao ? 'Criar senha e gerar PDF' : 'Confirmar e gerar PDF'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={estilos.botaoTexto}
                onPress={aoFechar}
                disabled={enviando}
              >
                <Text style={estilos.botaoTextoTexto}>Cancelar</Text>
              </TouchableOpacity>

              {!modoCriacao && (
                <TouchableOpacity
                  style={estilos.botaoTexto}
                  onPress={lidarComEsqueciSenha}
                  disabled={enviando}
                >
                  <Text style={estilos.botaoTextoLink}>Esqueci minha senha</Text>
                </TouchableOpacity>
              )}
            </>
          )}
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

  cartao: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 22,
  },

  titulo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  texto: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
    marginBottom: 16,
  },

  campo: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },

  erro: {
    color: '#b91c1c',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '600',
  },

  botaoPrincipal: {
    backgroundColor: '#279905',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },

  botaoPrincipalTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  botaoTexto: {
    paddingVertical: 12,
    alignItems: 'center',
  },

  botaoTextoTexto: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },

  botaoTextoLink: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '600',
  },

  desabilitado: {
    opacity: 0.6,
  },
});