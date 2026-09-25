import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { obterBanco } from '../../database/banco';
import { registrarLog } from './log';

// ============================================================
// COMPONENTE: TROCAR SENHA DO ADMINISTRADOR
// ============================================================
//
// Lê e grava as credenciais do admin na tabela
// configuracao_local (chaves "admin_usuario" e "admin_senha"),
// a mesma tabela usada pelo login em index.tsx. Como essa
// tabela é local e deve estar incluída no backup/restauração
// do aplicativo, a senha trocada aqui é preservada junto com
// o restante dos dados.
// ============================================================

export default function TrocarSenha() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novoUsuario, setNovoUsuario] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  // ------------------------------------------------------------
  // HELPERS DE CONFIGURAÇÃO LOCAL
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // TROCAR CREDENCIAIS
  // ------------------------------------------------------------

  async function trocar() {
    const senhaAtualDigitada = senhaAtual.trim();
    const novoUsuarioDigitado = novoUsuario.trim();
    const novaSenhaDigitada = novaSenha.trim();
    const confirmarSenhaDigitada = confirmarSenha.trim();

    if (
      !senhaAtualDigitada ||
      !novoUsuarioDigitado ||
      !novaSenhaDigitada ||
      !confirmarSenhaDigitada
    ) {
      Alert.alert(
        'Atenção',
        'Preencha todos os campos.'
      );
      return;
    }

    if (novaSenhaDigitada.length < 4) {
      Alert.alert(
        'Atenção',
        'A nova senha deve ter pelo menos 4 caracteres.'
      );
      return;
    }

    if (novaSenhaDigitada !== confirmarSenhaDigitada) {
      Alert.alert(
        'Atenção',
        'A nova senha e a confirmação não coincidem.'
      );
      return;
    }

    try {
      setSalvando(true);

      // Garante a tabela, caso ainda não exista
      const db = await obterBanco();

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS configuracao_local (
          chave TEXT PRIMARY KEY,
          valor TEXT,
          atualizado_em TEXT
        )
      `);

      const senhaSalva =
        (await obterConfig('admin_senha')) || 'admin';

      if (senhaAtualDigitada !== senhaSalva) {
        Alert.alert(
          'Erro',
          'A senha atual informada está incorreta.'
        );
        return;
      }

      await salvarConfig(
        'admin_usuario',
        novoUsuarioDigitado
      );

      await salvarConfig(
        'admin_senha',
        novaSenhaDigitada
      );

      await registrarLog(
        'senha_alterada',
        novoUsuarioDigitado,
        `Usuário e senha do administrador foram alterados (usuário anterior mantido no histórico apenas por segurança).`
      );

      Alert.alert(
        'Sucesso',
        'Usuário e senha do administrador atualizados com sucesso.'
      );

      setSenhaAtual('');
      setNovoUsuario('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      console.error(
        'Erro ao trocar credenciais do admin:',
        error
      );

      Alert.alert(
        'Erro',
        error?.message ||
          'Não foi possível trocar a senha agora.'
      );
    } finally {
      setSalvando(false);
    }
  }

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={
        Platform.OS === 'ios' ? 'padding' : 'height'
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios' ? 0 : 24
      }
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.aviso}>
            Informe a senha atual para confirmar a
            alteração. O novo usuário e a nova senha
            serão salvos no banco local e incluídos no
            backup.
          </Text>

          <Text style={styles.label}>
            Senha atual
          </Text>

          <TextInput
            style={styles.input}
            value={senhaAtual}
            onChangeText={setSenhaAtual}
            placeholder="Digite a senha atual"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            editable={!salvando}
          />

          <Text style={styles.label}>
            Novo usuário
          </Text>

          <TextInput
            style={styles.input}
            value={novoUsuario}
            onChangeText={setNovoUsuario}
            placeholder="Digite o novo usuário"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            editable={!salvando}
          />

          <Text style={styles.label}>
            Nova senha
          </Text>

          <TextInput
            style={styles.input}
            value={novaSenha}
            onChangeText={setNovaSenha}
            placeholder="Digite a nova senha"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            editable={!salvando}
          />

          <Text style={styles.label}>
            Confirmar nova senha
          </Text>

          <TextInput
            style={styles.input}
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
            placeholder="Repita a nova senha"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={trocar}
            editable={!salvando}
          />

          <TouchableOpacity
            style={styles.botaoSalvar}
            onPress={trocar}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botaoSalvarTexto}>
                Salvar nova senha
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

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

  aviso: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 19,
    marginBottom: 10,
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

  botaoSalvar: {
    backgroundColor: '#2563eb',
    borderRadius: 9,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },

  botaoSalvarTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});