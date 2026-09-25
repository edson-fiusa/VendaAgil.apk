import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  LogAtividade,
  limparLogs,
  obterLogs,
} from '../seguranca/log';

// ============================================================
// RÓTULOS DE EXIBIÇÃO POR TIPO DE AÇÃO
// ============================================================

const ROTULOS_TIPO: Record<string, string> = {
  login: '🔑 Login',
  logout: '🚪 Saída',
  produto_cadastrado: '📦 Produto cadastrado',
  produto_editado: '✏️ Produto editado',
  produto_excluido: '🗑️ Produto excluído',
  operador_cadastrado: '👤 Operador cadastrado',
  operador_editado: '✏️ Operador editado',
  operador_excluido: '🗑️ Operador excluído',
  avaria_registrada: '⚠️ Avaria registrada',
  venda_realizada: '💰 Venda realizada',
  caixa_aberto: '🟢 Caixa aberto',
  caixa_fechado: '🔴 Caixa fechado',
  senha_alterada: '🔒 Senha alterada',
  backup_realizado: '💾 Backup realizado',
  backup_restaurado: '♻️ Backup restaurado',
  outro: '📌 Outro',
};

function formatarData(dataIso: string): string {
  const data = new Date(dataIso);

  if (isNaN(data.getTime())) {
    return dataIso;
  }

  return data.toLocaleString('pt-BR');
}

// ============================================================
// COMPONENTE
// ============================================================

export default function LogAtividades() {
  const [logs, setLogs] = useState<LogAtividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [filtro, setFiltro] = useState('');

  const [idsExpandidos, setIdsExpandidos] =
    useState<Set<number>>(new Set());

  function alternarExpandido(id: number) {
    setIdsExpandidos((atual) => {
      const novo = new Set(atual);

      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }

      return novo;
    });
  }

  const carregar = useCallback(async () => {
    try {
      const dados = await obterLogs(300);
      setLogs(dados);
    } catch (error: any) {
      console.error(
        'Erro ao carregar log de atividades:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível carregar o log de atividades.'
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function aoAtualizar() {
    setAtualizando(true);
    carregar();
  }

  function confirmarLimpeza() {
    Alert.alert(
      'Limpar log',
      'Isso vai apagar todo o histórico de atividades registrado. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              await limparLogs();
              setLogs([]);
            } catch (error: any) {
              Alert.alert(
                'Erro',
                'Não foi possível limpar o log.'
              );
            }
          },
        },
      ]
    );
  }

  const termo = filtro.trim().toLowerCase();

  const logsFiltrados = termo
    ? logs.filter(
        (log) =>
          log.usuario.toLowerCase().includes(termo) ||
          log.descricao.toLowerCase().includes(termo) ||
          log.tipo.toLowerCase().includes(termo)
      )
    : logs;

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator
          size="large"
          color="#279905"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topo}>
        <TextInput
          style={styles.filtroInput}
          value={filtro}
          onChangeText={setFiltro}
          placeholder="Filtrar por usuário, ação ou descrição"
          placeholderTextColor="#9ca3af"
        />

        <TouchableOpacity
          style={styles.botaoLimpar}
          onPress={confirmarLimpeza}
        >
          <Text style={styles.botaoLimparTexto}>
            Limpar
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={logsFiltrados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={aoAtualizar}
            colors={['#279905']}
          />
        }
        ListEmptyComponent={
          <Text style={styles.vazio}>
            Nenhuma atividade registrada ainda.
          </Text>
        }
        renderItem={({ item }) => {
          const expandido = idsExpandidos.has(item.id);

          return (
            <TouchableOpacity
              style={styles.item}
              activeOpacity={0.7}
              onPress={() =>
                alternarExpandido(item.id)
              }
            >
              <View style={styles.itemTopo}>
                <Text style={styles.itemTipo}>
                  {ROTULOS_TIPO[item.tipo] || item.tipo}
                </Text>

                <View style={styles.itemTopoDireita}>
                  <Text style={styles.itemData}>
                    {formatarData(item.data)}
                  </Text>

                  <Text style={styles.setaExpandir}>
                    {expandido ? '▲' : '▼'}
                  </Text>
                </View>
              </View>

              <Text style={styles.itemUsuario}>
                {item.usuario}
              </Text>

              <Text
                style={styles.itemDescricao}
                numberOfLines={expandido ? undefined : 2}
              >
                {item.descricao}
              </Text>

              {expandido && (
                <View style={styles.detalhes}>
                  <View style={styles.detalheLinha}>
                    <Text style={styles.detalheChave}>
                      ID do registro
                    </Text>

                    <Text style={styles.detalheValor}>
                      #{item.id}
                    </Text>
                  </View>

                  <View style={styles.detalheLinha}>
                    <Text style={styles.detalheChave}>
                      Tipo (interno)
                    </Text>

                    <Text style={styles.detalheValor}>
                      {item.tipo}
                    </Text>
                  </View>

                  <View style={styles.detalheLinha}>
                    <Text style={styles.detalheChave}>
                      Usuário
                    </Text>

                    <Text style={styles.detalheValor}>
                      {item.usuario}
                    </Text>
                  </View>

                  <View style={styles.detalheLinha}>
                    <Text style={styles.detalheChave}>
                      Data e hora completas
                    </Text>

                    <Text style={styles.detalheValor}>
                      {formatarData(item.data)}
                    </Text>
                  </View>

                  <View style={styles.detalheLinha}>
                    <Text style={styles.detalheChave}>
                      Data (bruta/ISO)
                    </Text>

                    <Text style={styles.detalheValor}>
                      {item.data}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
  },

  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  filtroInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: '#161d2c',
    fontSize: 13,
    marginRight: 10,
  },

  botaoLimpar: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 9,
  },

  botaoLimparTexto: {
    color: '#b91c1c',
    fontWeight: '800',
    fontSize: 12,
  },

  lista: {
    paddingBottom: 40,
  },

  vazio: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 40,
    fontSize: 13,
  },

  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },

  itemTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  itemTopoDireita: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemTipo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    flexShrink: 1,
    paddingRight: 8,
  },

  itemData: {
    fontSize: 11,
    color: '#9ca3af',
  },

  setaExpandir: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 8,
  },

  itemUsuario: {
    fontSize: 12,
    color: '#279905',
    fontWeight: '700',
    marginBottom: 3,
  },

  itemDescricao: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },

  detalhes: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  detalheLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  detalheChave: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '700',
    flex: 1,
  },

  detalheValor: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
    textAlign: 'right',
  },
});