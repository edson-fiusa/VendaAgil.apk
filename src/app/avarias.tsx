import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { obterBanco } from '../database/banco';

type Produto = {
  id: number;
  codigo: string;
  nome: string;
  quantidade: number;
  precoEntrada: number;
  precoVenda: number;
  unidade?: string;
};

type Avaria = {
  id: number;
  produtoId: number;
  produtoNome: string;
  quantidade: number;
  motivo: string;
  observacao?: string;
  precoCusto: number;
  data: string;
};

function fmt(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmt3(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function Avarias() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [avarias, setAvarias] = useState<Avaria[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<Produto | null>(null);

  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [busca, setBusca] = useState('');

  const [modalProduto, setModalProduto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  async function carregarDados() {
    try {
      setCarregando(true);

      const db = await obterBanco();

      const produtosDb = await db.getAllAsync<{
        id: number;
        codigo: string;
        nome: string;
        quantidade: number;
        preco_entrada: number;
        preco_venda: number;
        unidade: string;
        ativo: number;
      }>(`
        SELECT
          id,
          codigo,
          nome,
          quantidade,
          preco_entrada,
          preco_venda,
          unidade,
          ativo
        FROM produtos_local
        WHERE ativo = 1
        ORDER BY nome COLLATE NOCASE ASC
      `);

      const produtosConvertidos: Produto[] = produtosDb.map((produto) => ({
        id: Number(produto.id),
        codigo: produto.codigo || '',
        nome: produto.nome || '',
        quantidade: Number(produto.quantidade || 0),
        precoEntrada: Number(produto.preco_entrada || 0),
        precoVenda: Number(produto.preco_venda || 0),
        unidade: produto.unidade || 'unidade',
      }));

      setProdutos(produtosConvertidos);

      const avariasDb = await db.getAllAsync<{
        id: number;
        produto_id: number;
        quantidade: number;
        motivo: string;
        observacao: string | null;
        preco_custo: number;
        data: string;
      }>(`
        SELECT
          id,
          produto_id,
          quantidade,
          motivo,
          observacao,
          preco_custo,
          data
        FROM avarias_local
        ORDER BY data DESC
      `);

      const avariasConvertidas: Avaria[] = avariasDb.map((avaria) => {
        const produto = produtosConvertidos.find(
          (item) => item.id === Number(avaria.produto_id)
        );

        return {
          id: Number(avaria.id),
          produtoId: Number(avaria.produto_id),
          produtoNome:
            produto?.nome || `Produto #${avaria.produto_id}`,
          quantidade: Number(avaria.quantidade || 0),
          motivo: avaria.motivo || '',
          observacao: avaria.observacao || '',
          precoCusto: Number(avaria.preco_custo || 0),
          data: avaria.data || '',
        };
      });

      setAvarias(avariasConvertidas);
    } catch (error: any) {
      console.log(
        'ERRO AO CARREGAR AVARIAS DO SQLITE:',
        error
      );

      Alert.alert(
        'Erro',
        error?.message ||
          'Não foi possível carregar os dados.'
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function registrarAvaria() {
    if (!produtoSelecionado) {
      Alert.alert(
        'Atenção',
        'Selecione um produto.'
      );
      return;
    }

    const qtd = Number(
      quantidade.replace(',', '.')
    );

    if (!Number.isFinite(qtd) || qtd <= 0) {
      Alert.alert(
        'Atenção',
        'Informe uma quantidade válida.'
      );
      return;
    }

    if (
      qtd >
      Number(produtoSelecionado.quantidade)
    ) {
      Alert.alert(
        'Atenção',
        'A quantidade avariada é maior que o estoque atual.'
      );
      return;
    }

    if (!motivo.trim()) {
      Alert.alert(
        'Atenção',
        'Informe o motivo da avaria.'
      );
      return;
    }

    try {
      setSalvando(true);

      const db = await obterBanco();

      const agora = new Date().toISOString();

      const precoCusto =
        Number(produtoSelecionado.precoEntrada) || 0;

      await db.runAsync(
        `
        INSERT INTO avarias_local (
          produto_id,
          quantidade,
          motivo,
          observacao,
          preco_custo,
          data,
          sincronizado
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        Number(produtoSelecionado.id),
        qtd,
        motivo.trim(),
        observacao.trim(),
        precoCusto,
        agora,
        0
      );

      await db.runAsync(
        `
        UPDATE produtos_local
        SET
          quantidade = quantidade - ?,
          sincronizado = 0,
          atualizado_em = ?
        WHERE id = ?
        `,
        qtd,
        agora,
        Number(produtoSelecionado.id)
      );

      Alert.alert(
        'Sucesso',
        'Avaria registrada e estoque atualizado.'
      );

      setProdutoSelecionado(null);
      setQuantidade('');
      setMotivo('');
      setObservacao('');

      await carregarDados();
    } catch (error: any) {
      console.log(
        'ERRO AO REGISTRAR AVARIA NO SQLITE:',
        error
      );

      Alert.alert(
        'Erro',
        error?.message ||
          'Não foi possível registrar a avaria.'
      );
    } finally {
      setSalvando(false);
    }
  }

  function solicitarExclusao(avaria: Avaria) {
    Alert.alert(
      'Excluir avaria',
      `O que deseja fazer com a quantidade de ${fmt3(
        avaria.quantidade
      )}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Repor no estoque',
          onPress: () =>
            excluirAvaria(avaria, true),
        },
        {
          text: 'Excluir permanentemente',
          style: 'destructive',
          onPress: () =>
            excluirAvaria(avaria, false),
        },
      ]
    );
  }

  async function excluirAvaria(
    avaria: Avaria,
    reporEstoque: boolean
  ) {
    try {
      setExcluindoId(avaria.id);

      const db = await obterBanco();

      const agora = new Date().toISOString();

      if (reporEstoque) {
        await db.runAsync(
          `
          UPDATE produtos_local
          SET
            quantidade = quantidade + ?,
            sincronizado = 0,
            atualizado_em = ?
          WHERE id = ?
          `,
          Number(avaria.quantidade),
          agora,
          Number(avaria.produtoId)
        );
      }

      await db.runAsync(
        `
        DELETE FROM avarias_local
        WHERE id = ?
        `,
        Number(avaria.id)
      );

      Alert.alert(
        'Sucesso',
        reporEstoque
          ? 'Avaria excluída e quantidade reposta no estoque.'
          : 'Avaria excluída permanentemente.'
      );

      await carregarDados();
    } catch (error: any) {
      console.log(
        'ERRO AO EXCLUIR AVARIA DO SQLITE:',
        error
      );

      Alert.alert(
        'Erro',
        error?.message ||
          'Não foi possível excluir a avaria.'
      );
    } finally {
      setExcluindoId(null);
    }
  }

  const produtosFiltrados = produtos.filter(
    (produto) => {
      const texto = busca
        .toLowerCase()
        .trim();

      return (
        produto.nome
          .toLowerCase()
          .includes(texto) ||
        String(produto.codigo)
          .toLowerCase()
          .includes(texto)
      );
    }
  );

  const totalPerdas = avarias.reduce(
    (total, avaria) =>
      total +
      Number(avaria.precoCusto || 0) *
        Number(avaria.quantidade || 0),
    0
  );

  const totalQuantidade = avarias.reduce(
    (total, avaria) =>
      total +
      Number(avaria.quantidade || 0),
    0
  );

  function formatarData(data: string) {
    const dataFormatada = new Date(data);

    if (
      Number.isNaN(
        dataFormatada.getTime()
      )
    ) {
      return '-';
    }

    return dataFormatada.toLocaleString(
      'pt-BR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.carregando}>
          <ActivityIndicator size="large" />

          <Text style={styles.carregandoTexto}>
            Carregando avarias...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
      >
        <Text style={styles.titulo}>
          Avarias
        </Text>

        <Text style={styles.subtitulo}>
          Registre perdas e produtos danificados
        </Text>

        <View style={styles.resumoContainer}>
          <View style={styles.cardResumo}>
            <Text style={styles.resumoLabel}>
              Registros
            </Text>

            <Text style={styles.resumoValor}>
              {avarias.length}
            </Text>
          </View>

          <View style={styles.cardResumo}>
            <Text style={styles.resumoLabel}>
              Quantidade
            </Text>

            <Text style={styles.resumoValor}>
              {fmt3(totalQuantidade)}
            </Text>
          </View>

          <View style={styles.cardResumo}>
            <Text style={styles.resumoLabel}>
              Perdas
            </Text>

            <Text style={styles.resumoValor}>
              R$ {fmt(totalPerdas)}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.secaoTitulo}>
            Registrar avaria
          </Text>

          <Text style={styles.label}>
            Produto
          </Text>

          <TouchableOpacity
            style={styles.seletor}
            onPress={() =>
              setModalProduto(true)
            }
          >
            <Text
              style={
                produtoSelecionado
                  ? styles.seletorTexto
                  : styles.seletorPlaceholder
              }
            >
              {produtoSelecionado
                ? `${produtoSelecionado.nome} — Estoque: ${fmt3(
                    produtoSelecionado.quantidade
                  )}`
                : 'Selecione um produto'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>
            Quantidade avariada
          </Text>

          <TextInput
            style={styles.input}
            value={quantidade}
            onChangeText={setQuantidade}
            placeholder="Ex.: 2 ou 0,500"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>
            Motivo
          </Text>

          <TextInput
            style={styles.input}
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Ex.: Produto vencido"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>
            Observação
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.inputObservacao,
            ]}
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Observações adicionais"
            placeholderTextColor="#9ca3af"
            multiline
          />

          <TouchableOpacity
            style={styles.botaoSalvar}
            onPress={registrarAvaria}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={styles.botaoSalvarTexto}
              >
                Registrar avaria
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.listaCabecalho}>
          <Text style={styles.secaoTitulo}>
            Produtos avariados
          </Text>

          <Text style={styles.contador}>
            {avarias.length}
          </Text>
        </View>

        {avarias.length === 0 ? (
          <View style={styles.vazio}>
            <Text style={styles.vazioTitulo}>
              Nenhuma avaria registrada
            </Text>

            <Text style={styles.vazioTexto}>
              Os produtos avariados aparecerão aqui.
            </Text>
          </View>
        ) : (
          avarias.map((avaria) => (
            <View
              key={avaria.id}
              style={styles.avariaCard}
            >
              <View style={styles.avariaTopo}>
                <View style={styles.avariaProduto}>
                  <Text
                    style={styles.avariaNome}
                  >
                    {avaria.produtoNome ||
                      `Produto #${avaria.produtoId}`}
                  </Text>

                  <Text
                    style={styles.avariaData}
                  >
                    {formatarData(
                      avaria.data
                    )}
                  </Text>
                </View>

                <Text
                  style={styles.avariaValor}
                >
                  R${' '}
                  {fmt(
                    Number(
                      avaria.precoCusto || 0
                    ) *
                      Number(
                        avaria.quantidade || 0
                      )
                  )}
                </Text>
              </View>

              <View style={styles.divisor} />

              <Text style={styles.avariaInfo}>
                Quantidade:{' '}
                {fmt3(avaria.quantidade)}
              </Text>

              <Text style={styles.avariaInfo}>
                Motivo: {avaria.motivo}
              </Text>

              {avaria.observacao ? (
                <Text
                  style={styles.avariaInfo}
                >
                  Observação:{' '}
                  {avaria.observacao}
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.botaoExcluir}
                onPress={() =>
                  solicitarExclusao(avaria)
                }
                disabled={
                  excluindoId === avaria.id
                }
              >
                {excluindoId === avaria.id ? (
                  <ActivityIndicator
                    color="#b91c1c"
                  />
                ) : (
                  <Text
                    style={
                      styles.botaoExcluirTexto
                    }
                  >
                    Excluir avaria
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalProduto}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setModalProduto(false)
        }
      >
        <View style={styles.modalFundo}>
          <View style={styles.modal}>
            <View style={styles.modalCabecalho}>
              <Text
                style={styles.modalTitulo}
              >
                Selecionar produto
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setModalProduto(false)
                }
              >
                <Text style={styles.fechar}>
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar produto ou código..."
              placeholderTextColor="#9ca3af"
            />

            <ScrollView
              keyboardShouldPersistTaps="handled"
            >
              {produtosFiltrados.map(
                (produto) => (
                  <TouchableOpacity
                    key={produto.id}
                    style={
                      styles.produtoOpcao
                    }
                    onPress={() => {
                      setProdutoSelecionado(
                        produto
                      );
                      setModalProduto(false);
                      setBusca('');
                    }}
                  >
                    <View
                      style={
                        styles.produtoOpcaoTexto
                      }
                    >
                      <Text
                        style={
                          styles.produtoOpcaoNome
                        }
                      >
                        {produto.nome}
                      </Text>

                      <Text
                        style={
                          styles.produtoOpcaoCodigo
                        }
                      >
                        Código: {produto.codigo}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.produtoOpcaoEstoque
                      }
                    >
                      Estoque:{' '}
                      {fmt3(
                        produto.quantidade
                      )}
                    </Text>
                  </TouchableOpacity>
                )
              )}

              {produtosFiltrados.length ===
              0 ? (
                <Text
                  style={styles.semProdutos}
                >
                  Nenhum produto encontrado.
                </Text>
              ) : null}
            </ScrollView>
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

  conteudo: {
    padding: 16,
    paddingBottom: 40,
  },

  titulo: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
  },

  subtitulo: {
    marginTop: 4,
    marginBottom: 18,
    color: '#6b7280',
    fontSize: 13,
  },

  resumoContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  cardResumo: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 13,
    marginHorizontal: 4,
    elevation: 2,
  },

  resumoLabel: {
    color: '#6b7280',
    fontSize: 11,
    marginBottom: 6,
  },

  resumoValor: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 22,
    elevation: 2,
  },

  secaoTitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 14,
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#111827',
    backgroundColor: '#fff',
    fontSize: 14,
  },

  inputObservacao: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  seletor: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 13,
    backgroundColor: '#fff',
  },

  seletorTexto: {
    color: '#111827',
    fontSize: 14,
  },

  seletorPlaceholder: {
    color: '#9ca3af',
    fontSize: 14,
  },

  botaoSalvar: {
    backgroundColor: '#b91c1c',
    borderRadius: 9,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },

  botaoSalvarTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  listaCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  contador: {
    backgroundColor: '#e5e7eb',
    color: '#374151',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontWeight: '700',
  },

  avariaCard: {
    backgroundColor: '#fff',
    borderRadius: 13,
    padding: 15,
    marginBottom: 12,
    elevation: 2,
  },

  avariaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  avariaProduto: {
    flex: 1,
    paddingRight: 10,
  },

  avariaNome: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  avariaData: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },

  avariaValor: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '800',
  },

  divisor: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },

  avariaInfo: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 5,
  },

  botaoExcluir: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: 'center',
  },

  botaoExcluirTexto: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '800',
  },

  vazio: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 25,
    alignItems: 'center',
  },

  vazioTitulo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
  },

  vazioTexto: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 13,
  },

  carregando: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  carregandoTexto: {
    marginTop: 10,
    color: '#6b7280',
  },

  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  modal: {
    backgroundColor: '#f5f6f8',
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },

  modalCabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  modalTitulo: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },

  fechar: {
    color: '#2563eb',
    fontWeight: '700',
  },

  produtoOpcao: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  produtoOpcaoTexto: {
    flex: 1,
    paddingRight: 10,
  },

  produtoOpcaoNome: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  produtoOpcaoCodigo: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 3,
  },

  produtoOpcaoEstoque: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700',
  },

  semProdutos: {
    textAlign: 'center',
    color: '#6b7280',
    padding: 25,
  },
});