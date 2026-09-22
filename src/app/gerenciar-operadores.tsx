import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { obterBanco } from '../database/banco';

type Operador = {
  id: number;
  nome: string;
  usuario: string;
  senha_hash?: string | null;
  ativo?: number;
  criado_em?: string | null;
};

export default function GerenciarOperadores() {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Operador | null>(null);

  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');

  async function carregarOperadores() {
    try {
      setCarregando(true);

      const db = await obterBanco();

      const resultado = await db.getAllAsync<Operador>(`
        SELECT
          id,
          nome,
          usuario,
          senha_hash,
          ativo,
          criado_em
        FROM operadores_local
        WHERE ativo = 1
        ORDER BY nome COLLATE NOCASE ASC
      `);

      setOperadores(resultado);
    } catch (error) {
      console.error('ERRO SQLITE OPERADORES:', error);

      Alert.alert(
        'Erro',
        'Não foi possível carregar os operadores.'
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarOperadores();
  }, []);

  function abrirNovo() {
    setEditando(null);
    setNome('');
    setUsuario('');
    setSenha('');
    setModalAberto(true);
  }

  function abrirEditar(operador: Operador) {
    setEditando(operador);
    setNome(operador.nome);
    setUsuario(operador.usuario);
    setSenha('');
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditando(null);
    setNome('');
    setUsuario('');
    setSenha('');
  }

  async function salvar() {
    // ============================================================
    // NORMALIZAÇÃO
    //
    // O login compara os valores com trim() e o usuário precisa
    // bater exatamente com o que está gravado. Por isso limpamos
    // tudo AQUI, antes de validar e antes de gravar. Sem isso um
    // espaço invisível no fim da senha impede o operador de entrar.
    // ============================================================

    const nomeLimpo = nome.trim();
    const usuarioLimpo = usuario.trim().toLowerCase();
    const senhaLimpa = senha.trim();

    if (!nomeLimpo) {
      Alert.alert('Atenção', 'Informe o nome do operador.');
      return;
    }

    if (!usuarioLimpo) {
      Alert.alert('Atenção', 'Informe o usuário.');
      return;
    }

    if (!editando && senhaLimpa.length < 4) {
      Alert.alert(
        'Atenção',
        'A senha deve ter no mínimo 4 caracteres.'
      );
      return;
    }

    if (
      editando &&
      senhaLimpa.length > 0 &&
      senhaLimpa.length < 4
    ) {
      Alert.alert(
        'Atenção',
        'A nova senha deve ter no mínimo 4 caracteres.'
      );
      return;
    }

    try {
      const db = await obterBanco();

      // Verifica se já existe outro operador com o mesmo usuário.
      const operadorExistente =
        await db.getFirstAsync<Operador>(
          `
            SELECT id
            FROM operadores_local
            WHERE LOWER(usuario) = LOWER(?)
              AND ativo = 1
              AND id != ?
            LIMIT 1
          `,
          usuarioLimpo,
          editando?.id ?? 0
        );

      if (operadorExistente) {
        Alert.alert(
          'Atenção',
          'Já existe um operador com esse usuário.'
        );
        return;
      }

      if (editando) {
        if (senhaLimpa) {
          await db.runAsync(
            `
              UPDATE operadores_local
              SET
                nome = ?,
                usuario = ?,
                senha_hash = ?,
                ativo = 1,
                sincronizado = 0,
                atualizado_em = ?
              WHERE id = ?
            `,
            nomeLimpo,
            usuarioLimpo,
            senhaLimpa,
            new Date().toISOString(),
            editando.id
          );
        } else {
          await db.runAsync(
            `
              UPDATE operadores_local
              SET
                nome = ?,
                usuario = ?,
                ativo = 1,
                sincronizado = 0,
                atualizado_em = ?
              WHERE id = ?
            `,
            nomeLimpo,
            usuarioLimpo,
            new Date().toISOString(),
            editando.id
          );
        }

        Alert.alert(
          'Sucesso',
          'Operador atualizado com sucesso.'
        );
      } else {
        await db.runAsync(
          `
            INSERT INTO operadores_local (
              nome,
              usuario,
              senha_hash,
              ativo,
              sincronizado,
              criado_em,
              atualizado_em
            )
            VALUES (?, ?, ?, 1, 0, ?, ?)
          `,
          nomeLimpo,
          usuarioLimpo,
          senhaLimpa,
          new Date().toISOString(),
          new Date().toISOString()
        );

        Alert.alert(
          'Sucesso',
          `Operador cadastrado.\n\nUsuário de login: ${usuarioLimpo}`
        );
      }

      fecharModal();
      await carregarOperadores();
    } catch (error: any) {
      console.error('ERRO SQLITE AO SALVAR OPERADOR:', error);

      Alert.alert(
        'Erro',
        'Não foi possível salvar o operador.'
      );
    }
  }

  function confirmarExcluir(operador: Operador) {
    Alert.alert(
      'Excluir operador',
      `Deseja realmente excluir "${operador.nome}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => excluir(operador.id),
        },
      ]
    );
  }

  async function excluir(id: number) {
    try {
      const db = await obterBanco();

      // Exclusão lógica para preservar histórico.
      await db.runAsync(
        `
          UPDATE operadores_local
          SET
            ativo = 0,
            sincronizado = 0,
            atualizado_em = ?
          WHERE id = ?
        `,
        new Date().toISOString(),
        id
      );

      Alert.alert(
        'Sucesso',
        'Operador excluído.'
      );

      await carregarOperadores();
    } catch (error) {
      console.error(
        'ERRO SQLITE AO EXCLUIR OPERADOR:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível excluir o operador.'
      );
    }
  }

  function renderOperador({
    item,
  }: {
    item: Operador;
  }) {
    return (
      <View style={styles.card}>
        <View style={styles.info}>
          <Text style={styles.nome}>
            {item.nome}
          </Text>

          <Text style={styles.usuario}>
            Usuário: {item.usuario}
          </Text>
        </View>

        <View style={styles.acoes}>
          <TouchableOpacity
            style={styles.botaoEditar}
            onPress={() => abrirEditar(item)}
          >
            <Text style={styles.textoBotao}>
              Editar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoExcluir}
            onPress={() =>
              confirmarExcluir(item)
            }
          >
            <Text style={styles.textoBotao}>
              Excluir
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topo}>
        <View>
          <Text style={styles.titulo}>
            Gerenciar operadores
          </Text>

          <Text style={styles.subtitulo}>
            Cadastre e edite os operadores do caixa
          </Text>
        </View>

        <TouchableOpacity
          style={styles.botaoNovo}
          onPress={abrirNovo}
        >
          <Text style={styles.textoNovo}>
            + Novo
          </Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={styles.carregando}>
          <ActivityIndicator size="large" />

          <Text style={styles.textoCarregando}>
            Carregando operadores...
          </Text>
        </View>
      ) : (
        <FlatList
          data={operadores}
          keyExtractor={(item) =>
            String(item.id)
          }
          renderItem={renderOperador}
          contentContainerStyle={
            operadores.length === 0
              ? styles.listaVazia
              : styles.lista
          }
          ListEmptyComponent={
            <View>
              <Text style={styles.vazioTitulo}>
                Nenhum operador cadastrado
              </Text>

              <Text style={styles.vazioTexto}>
                Toque em "+ Novo" para cadastrar o
                primeiro operador.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalAberto}
        transparent
        animationType="slide"
        onRequestClose={fecharModal}
      >
        <View style={styles.fundoModal}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>
              {editando
                ? 'Editar operador'
                : 'Novo operador'}
            </Text>

            <Text style={styles.label}>
              Nome
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nome do operador"
              value={nome}
              onChangeText={setNome}
            />

            <Text style={styles.label}>
              Usuário
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Usuário para login"
              value={usuario}
              onChangeText={setUsuario}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>
              {editando
                ? 'Nova senha (opcional)'
                : 'Senha'}
            </Text>

            {/*
              autoCapitalize="none" e autoCorrect={false} são
              obrigatórios aqui: sem eles o teclado do Android
              coloca a primeira letra em maiúscula sem que você
              veja (o campo mostra bolinhas), e a senha gravada
              fica diferente da que você digita no login.
            */}
            <TextInput
              style={styles.input}
              placeholder={
                editando
                  ? 'Deixe vazio para manter'
                  : 'Mínimo 4 caracteres'
              }
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.botoesModal}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={fecharModal}
              >
                <Text style={styles.textoCancelar}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoSalvar}
                onPress={salvar}
              >
                <Text style={styles.textoSalvar}>
                  {editando
                    ? 'Salvar alterações'
                    : 'Cadastrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },

  subtitulo: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },

  botaoNovo: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },

  textoNovo: {
    color: '#ffffff',
    fontWeight: '700',
  },

  lista: {
    padding: 16,
    paddingBottom: 30,
  },

  listaVazia: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
  },

  info: {
    flex: 1,
    paddingRight: 10,
  },

  nome: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  usuario: {
    marginTop: 5,
    fontSize: 14,
    color: '#6b7280',
  },

  acoes: {
    flexDirection: 'row',
    gap: 8,
  },

  botaoEditar: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 7,
  },

  botaoExcluir: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 7,
  },

  textoBotao: {
    color: '#ffffff',
    fontWeight: '600',
  },

  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoCarregando: {
    marginTop: 10,
    color: '#6b7280',
  },

  vazioTitulo: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },

  vazioTexto: {
    marginTop: 8,
    textAlign: 'center',
    color: '#6b7280',
  },

  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },

  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
  },

  modalTitulo: {
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 20,
    color: '#111827',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
    backgroundColor: '#ffffff',
    color: '#111827',
  },

  botoesModal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 5,
  },

  botaoCancelar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },

  textoCancelar: {
    color: '#374151',
    fontWeight: '600',
  },

  botaoSalvar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#16a34a',
  },

  textoSalvar: {
    color: '#ffffff',
    fontWeight: '700',
  },
});