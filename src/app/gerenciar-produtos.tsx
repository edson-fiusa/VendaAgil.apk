import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
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
  precoEntrada: number | string;
  precoVenda: number | string;
  unidade: string;
  quantidade: number | string;
  estoqueMinimo: number | string;
  categoria: string;
  ativo: boolean;
};

type ProdutoBanco = {
  id: number;
  codigo: string | null;
  nome: string | null;
  preco_entrada: number | null;
  preco_venda: number | null;
  unidade: string | null;
  quantidade: number | null;
  estoque_minimo: number | null;
  categoria: string | null;
  ativo: number | null;
};

export default function GerenciarProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  const [pesquisa, setPesquisa] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] =
    useState<Produto | null>(null);

  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [precoEntrada, setPrecoEntrada] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [unidade, setUnidade] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');
  const [categoria, setCategoria] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  // ============================================================
  // CARREGAR PRODUTOS
  // ============================================================

  async function carregarProdutos() {
    try {
      setErro('');

      const db = await obterBanco();

      const resultado = await db.getAllAsync<ProdutoBanco>(
        `
        SELECT
          id,
          codigo,
          nome,
          preco_entrada,
          preco_venda,
          unidade,
          quantidade,
          estoque_minimo,
          categoria,
          ativo
        FROM produtos_local
        WHERE ativo = 1
        ORDER BY nome COLLATE NOCASE ASC
        `
      );

      const lista: Produto[] = resultado.map((item) => ({
        id: Number(item.id),
        codigo: item.codigo ?? '',
        nome: item.nome ?? '',
        precoEntrada: Number(item.preco_entrada ?? 0),
        precoVenda: Number(item.preco_venda ?? 0),
        unidade: item.unidade ?? 'unidade',
        quantidade: Number(item.quantidade ?? 0),
        estoqueMinimo: Number(item.estoque_minimo ?? 0),
        categoria: item.categoria ?? 'Geral',
        ativo: Number(item.ativo ?? 0) === 1,
      }));

      setProdutos(lista);
    } catch (error: any) {
      console.log(
        'ERRO SQLITE GERENCIAR PRODUTOS:',
        error
      );

      setErro(
        error?.message ||
          'Erro ao acessar os produtos locais.'
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  useEffect(() => {
    carregarProdutos();
  }, []);

  function atualizarLista() {
    setAtualizando(true);
    carregarProdutos();
  }

  // ============================================================
  // FILTRO DE PESQUISA
  // ============================================================

  const produtosFiltrados = produtos.filter((produto) => {
    const termo = pesquisa.trim().toLowerCase();

    if (!termo) {
      return true;
    }

    const nomeProduto = String(produto.nome || '').toLowerCase();
    const codigoProduto = String(produto.codigo || '').toLowerCase();
    const categoriaProduto = String(
      produto.categoria || ''
    ).toLowerCase();

    return (
      nomeProduto.includes(termo) ||
      codigoProduto.includes(termo) ||
      categoriaProduto.includes(termo)
    );
  });

  // ============================================================
  // FORMATAÇÃO
  // ============================================================

  function formatarPreco(valor: number | string) {
    const numero = Number(valor || 0);

    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function converterNumero(valor: string) {
    const texto = String(valor || '')
      .trim()
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.');

    if (!texto) {
      return 0;
    }

    return Number(texto);
  }

  // ============================================================
  // ABRIR E FECHAR EDIÇÃO
  // ============================================================

  function abrirEditar(produto: Produto) {
    setProdutoEditando(produto);

    setCodigo(
      String(produto.codigo || '')
    );

    setNome(
      String(produto.nome || '')
    );

    setPrecoEntrada(
      String(produto.precoEntrada ?? 0).replace('.', ',')
    );

    setPrecoVenda(
      String(produto.precoVenda ?? 0).replace('.', ',')
    );

    setUnidade(
      String(produto.unidade || 'unidade')
    );

    setQuantidade(
      String(produto.quantidade ?? 0).replace('.', ',')
    );

    setEstoqueMinimo(
      String(produto.estoqueMinimo ?? 0).replace('.', ',')
    );

    setCategoria(
      String(produto.categoria || 'Geral')
    );

    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) {
      return;
    }

    setModalAberto(false);
    setProdutoEditando(null);

    setCodigo('');
    setNome('');
    setPrecoEntrada('');
    setPrecoVenda('');
    setUnidade('');
    setQuantidade('');
    setEstoqueMinimo('');
    setCategoria('');
  }

  // ============================================================
  // SALVAR ALTERAÇÃO
  // ============================================================

  async function salvarProduto() {
    if (!produtoEditando) {
      return;
    }

    const codigoFinal = codigo
      .trim()
      .replace(/[^0-9]/g, '');

    const nomeFinal = nome.trim();

    const unidadeFinal =
      unidade.trim() || 'unidade';

    const categoriaFinal =
      categoria.trim() || 'Geral';

    if (!codigoFinal) {
      Alert.alert(
        'Atenção',
        'Informe o código do produto.'
      );
      return;
    }

    if (!nomeFinal) {
      Alert.alert(
        'Atenção',
        'Informe o nome do produto.'
      );
      return;
    }

    const venda = converterNumero(precoVenda);
    const entrada = converterNumero(precoEntrada);
    const qtd = converterNumero(quantidade);
    const minimo = converterNumero(estoqueMinimo);

    if (!Number.isFinite(venda) || venda <= 0) {
      Alert.alert(
        'Atenção',
        'Informe um preço de venda válido.'
      );
      return;
    }

    if (
      !Number.isFinite(entrada) ||
      !Number.isFinite(qtd) ||
      !Number.isFinite(minimo)
    ) {
      Alert.alert(
        'Atenção',
        'Informe valores numéricos válidos.'
      );
      return;
    }

    if (
      entrada < 0 ||
      qtd < 0 ||
      minimo < 0
    ) {
      Alert.alert(
        'Atenção',
        'Os valores não podem ser negativos.'
      );
      return;
    }

    try {
      setSalvando(true);

      const db = await obterBanco();

      // --------------------------------------------------------
      // VERIFICAR CÓDIGO DUPLICADO
      // --------------------------------------------------------

      const codigoExistente =
        await db.getFirstAsync<{ id: number }>(
          `
          SELECT id
          FROM produtos_local
          WHERE codigo = ?
            AND id <> ?
            AND ativo = 1
          LIMIT 1
          `,
          [
            codigoFinal,
            Number(produtoEditando.id),
          ]
        );

      if (codigoExistente) {
        Alert.alert(
          'Código já utilizado',
          'Já existe outro produto ativo cadastrado com este código.'
        );
        return;
      }

      // --------------------------------------------------------
      // DATA DE ATUALIZAÇÃO
      // --------------------------------------------------------

      const agora = new Date().toISOString();

      // --------------------------------------------------------
      // ATUALIZAR PRODUTO
      // --------------------------------------------------------

      const resultado = await db.runAsync(
        `
        UPDATE produtos_local
        SET
          codigo = ?,
          nome = ?,
          preco_entrada = ?,
          preco_venda = ?,
          unidade = ?,
          quantidade = ?,
          estoque_minimo = ?,
          categoria = ?,
          ativo = 1,
          sincronizado = 0,
          atualizado_em = ?
        WHERE id = ?
        `,
        [
          codigoFinal,
          nomeFinal,
          entrada,
          venda,
          unidadeFinal,
          qtd,
          minimo,
          categoriaFinal,
          agora,
          Number(produtoEditando.id),
        ]
      );

      console.log(
        'RESULTADO UPDATE PRODUTO:',
        resultado
      );

      const alteracoes =
        Number(resultado?.changes ?? 0);

      if (alteracoes !== 1) {
        throw new Error(
          'O banco não confirmou a alteração do produto.'
        );
      }

      // --------------------------------------------------------
      // CONFIRMAR NO BANCO
      // --------------------------------------------------------

      const confirmado =
        await db.getFirstAsync<ProdutoBanco>(
          `
          SELECT
            id,
            codigo,
            nome,
            preco_entrada,
            preco_venda,
            unidade,
            quantidade,
            estoque_minimo,
            categoria,
            ativo
          FROM produtos_local
          WHERE id = ?
          LIMIT 1
          `,
          [Number(produtoEditando.id)]
        );

      if (!confirmado) {
        throw new Error(
          'Produto atualizado, mas não foi possível confirmar os dados no banco.'
        );
      }

      console.log(
        'PRODUTO CONFIRMADO:',
        confirmado
      );

      Alert.alert(
        'Sucesso',
        'Produto atualizado com sucesso.',
        [
          {
            text: 'OK',
            onPress: async () => {
              fecharModal();
              await carregarProdutos();
            },
          },
        ]
      );
    } catch (error: any) {
      console.log(
        'ERRO SQLITE AO ATUALIZAR PRODUTO:',
        error
      );

      console.log(
        'MENSAGEM DO ERRO:',
        error?.message
      );

      Alert.alert(
        'Erro ao alterar produto',
        error?.message ||
          'Não foi possível atualizar o produto.'
      );
    } finally {
      setSalvando(false);
    }
  }

  // ============================================================
  // CONFIRMAR EXCLUSÃO
  // ============================================================

  function confirmarExcluir(produto: Produto) {
    Alert.alert(
      'Excluir produto',
      `Deseja realmente excluir "${produto.nome}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            excluirProduto(produto.id);
          },
        },
      ]
    );
  }

  // ============================================================
  // EXCLUIR PRODUTO
  // ============================================================

  async function excluirProduto(id: number) {
    if (excluindoId !== null) {
      return;
    }

    try {
      setExcluindoId(id);

      const db = await obterBanco();

      const produto =
        await db.getFirstAsync<{
          id: number;
          nome: string | null;
        }>(
          `
          SELECT
            id,
            nome
          FROM produtos_local
          WHERE id = ?
          LIMIT 1
          `,
          [Number(id)]
        );

      if (!produto) {
        throw new Error(
          'Produto não encontrado.'
        );
      }

      const agora = new Date().toISOString();

      // --------------------------------------------------------
      // EXCLUSÃO LÓGICA
      // Não apagamos fisicamente porque o produto
      // pode possuir histórico de vendas.
      // --------------------------------------------------------

      const resultado = await db.runAsync(
        `
        UPDATE produtos_local
        SET
          ativo = 0,
          sincronizado = 0,
          atualizado_em = ?
        WHERE id = ?
        `,
        [
          agora,
          Number(id),
        ]
      );

      console.log(
        'RESULTADO EXCLUSÃO:',
        resultado
      );

      const alteracoes =
        Number(resultado?.changes ?? 0);

      if (alteracoes !== 1) {
        throw new Error(
          'O banco não confirmou a exclusão do produto.'
        );
      }

      // --------------------------------------------------------
      // CONFIRMAR EXCLUSÃO
      // --------------------------------------------------------

      const confirmado =
        await db.getFirstAsync<{
          id: number;
          ativo: number;
        }>(
          `
          SELECT
            id,
            ativo
          FROM produtos_local
          WHERE id = ?
          LIMIT 1
          `,
          [Number(id)]
        );

      if (
        confirmado &&
        Number(confirmado.ativo) !== 0
      ) {
        throw new Error(
          'O produto não foi marcado como inativo.'
        );
      }

      Alert.alert(
        'Sucesso',
        'Produto excluído com sucesso.'
      );

      await carregarProdutos();
    } catch (error: any) {
      console.log(
        'ERRO SQLITE AO EXCLUIR PRODUTO:',
        error
      );

      console.log(
        'MENSAGEM DO ERRO:',
        error?.message
      );

      Alert.alert(
        'Erro ao excluir produto',
        error?.message ||
          'Não foi possível excluir o produto.'
      );
    } finally {
      setExcluindoId(null);
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <View style={styles.container}>

      {/* CABEÇALHO */}

      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>
          Gerenciar Produtos
        </Text>

        <Text style={styles.subtitulo}>
          {produtosFiltrados.length} de {produtos.length} produto(s)
        </Text>

        <View style={styles.caixaPesquisa}>
          <TextInput
            style={styles.inputPesquisa}
            value={pesquisa}
            onChangeText={setPesquisa}
            placeholder="Pesquisar por nome, código ou categoria"
            placeholderTextColor="#999"
            autoCorrect={false}
            autoCapitalize="none"
          />

          {pesquisa.length > 0 && (
            <TouchableOpacity
              onPress={() => setPesquisa('')}
              style={styles.botaoLimparPesquisa}
            >
              <Text style={styles.textoLimparPesquisa}>
                ✕
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* LISTAGEM */}

      {carregando ? (
        <View style={styles.centralizado}>
          <ActivityIndicator size="large" />

          <Text style={styles.mensagem}>
            Carregando produtos...
          </Text>
        </View>
      ) : erro ? (
        <View style={styles.centralizado}>
          <Text style={styles.erro}>
            {erro}
          </Text>

          <TouchableOpacity
            onPress={carregarProdutos}
          >
            <Text style={styles.tentarNovamente}>
              Tentar novamente
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={produtosFiltrados}
          keyExtractor={(item) =>
            String(item.id)
          }
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={atualizarLista}
            />
          }
          contentContainerStyle={
            produtosFiltrados.length === 0
              ? styles.listaVazia
              : styles.lista
          }
          renderItem={({ item }) => {
            const quantidade =
              Number(item.quantidade || 0);

            const estoqueMinimo =
              Number(item.estoqueMinimo || 0);

            const estoqueBaixo =
              quantidade <= estoqueMinimo;

            const excluindo =
              excluindoId === item.id;

            return (
              <View style={styles.card}>

                <View style={styles.cardTopo}>

                  <View style={styles.informacoes}>
                    <Text style={styles.nome}>
                      {item.nome}
                    </Text>

                    <Text style={styles.codigo}>
                      Código: {item.codigo}
                    </Text>

                    <Text style={styles.categoria}>
                      Categoria: {item.categoria}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.status,
                      item.ativo
                        ? styles.statusAtivo
                        : styles.statusInativo,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusTexto,
                        item.ativo
                          ? styles.statusTextoAtivo
                          : styles.statusTextoInativo,
                      ]}
                    >
                      {item.ativo
                        ? 'Ativo'
                        : 'Inativo'}
                    </Text>
                  </View>

                </View>

                <View style={styles.divisor} />

                <View style={styles.dados}>

                  <View style={styles.dado}>
                    <Text style={styles.dadoLabel}>
                      Venda
                    </Text>

                    <Text style={styles.preco}>
                      {formatarPreco(
                        item.precoVenda
                      )}
                    </Text>
                  </View>

                  <View style={styles.dado}>
                    <Text style={styles.dadoLabel}>
                      Custo
                    </Text>

                    <Text style={styles.valor}>
                      {formatarPreco(
                        item.precoEntrada
                      )}
                    </Text>
                  </View>

                  <View style={styles.dado}>
                    <Text style={styles.dadoLabel}>
                      Estoque
                    </Text>

                    <Text
                      style={[
                        styles.valor,
                        estoqueBaixo &&
                          styles.estoqueBaixo,
                      ]}
                    >
                      {quantidade}{' '}
                      {item.unidade}
                    </Text>
                  </View>

                </View>

                {estoqueBaixo && (
                  <View style={styles.alertaEstoque}>
                    <Text style={styles.alertaTexto}>
                      ⚠ Estoque baixo
                    </Text>
                  </View>
                )}

                <View style={styles.acoes}>

                  {/* EDITAR */}

                  <TouchableOpacity
                    style={styles.botaoEditar}
                    onPress={() =>
                      abrirEditar(item)
                    }
                    disabled={excluindo}
                  >
                    <Text style={styles.textoBotao}>
                      ✏ Editar
                    </Text>
                  </TouchableOpacity>

                  {/* EXCLUIR */}

                  <TouchableOpacity
                    style={[
                      styles.botaoExcluir,
                      excluindo &&
                        styles.botaoDesabilitado,
                    ]}
                    onPress={() =>
                      confirmarExcluir(item)
                    }
                    disabled={excluindo}
                  >
                    {excluindo ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.textoBotao}>
                        🗑 Excluir
                      </Text>
                    )}
                  </TouchableOpacity>

                </View>

              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centralizado}>
              <Text style={styles.semProdutos}>
                {pesquisa
                  ? 'Nenhum produto encontrado para essa pesquisa.'
                  : 'Nenhum produto cadastrado.'}
              </Text>
            </View>
          }
        />
      )}

      {/* ======================================================
          MODAL DE EDIÇÃO
      ====================================================== */}

      <Modal
        visible={modalAberto}
        transparent
        animationType="slide"
        onRequestClose={fecharModal}
      >
        <KeyboardAvoidingView
          style={styles.tecladoModal}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
        >
          <View style={styles.fundoModal}>

            <View style={styles.modal}>

              <Text style={styles.modalTitulo}>
                Editar produto
              </Text>

              <FlatList
                data={[1]}
                keyExtractor={() => 'form'}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                  styles.formularioModal
                }
                renderItem={() => (
                  <View>

                    {/* CÓDIGO */}

                    <Text style={styles.label}>
                      Código
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={codigo}
                      onChangeText={(texto) => {
                        setCodigo(
                          texto.replace(
                            /[^0-9]/g,
                            ''
                          )
                        );
                      }}
                      placeholder="Código"
                      placeholderTextColor="#999"
                      keyboardType="number-pad"
                      inputMode="numeric"
                      autoCorrect={false}
                      autoCapitalize="none"
                    />

                    {/* NOME */}

                    <Text style={styles.label}>
                      Nome
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={nome}
                      onChangeText={setNome}
                      placeholder="Nome do produto"
                      placeholderTextColor="#999"
                      autoCorrect={false}
                    />

                    {/* PREÇO VENDA */}

                    <Text style={styles.label}>
                      Preço de venda
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={precoVenda}
                      onChangeText={setPrecoVenda}
                      placeholder="0,00"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />

                    {/* PREÇO ENTRADA */}

                    <Text style={styles.label}>
                      Preço de entrada
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={precoEntrada}
                      onChangeText={setPrecoEntrada}
                      placeholder="0,00"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />

                    {/* QUANTIDADE */}

                    <Text style={styles.label}>
                      Quantidade
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={quantidade}
                      onChangeText={setQuantidade}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />

                    {/* ESTOQUE MÍNIMO */}

                    <Text style={styles.label}>
                      Estoque mínimo
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={estoqueMinimo}
                      onChangeText={
                        setEstoqueMinimo
                      }
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />

                    {/* UNIDADE */}

                    <Text style={styles.label}>
                      Unidade
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={unidade}
                      onChangeText={setUnidade}
                      placeholder="unidade"
                      placeholderTextColor="#999"
                      autoCorrect={false}
                    />

                    {/* CATEGORIA */}

                    <Text style={styles.label}>
                      Categoria
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={categoria}
                      onChangeText={setCategoria}
                      placeholder="Geral"
                      placeholderTextColor="#999"
                      autoCorrect={false}
                    />

                    {/* BOTÕES */}

                    <View style={styles.botoesModal}>

                      <TouchableOpacity
                        style={styles.botaoCancelar}
                        onPress={fecharModal}
                        disabled={salvando}
                      >
                        <Text
                          style={styles.textoCancelar}
                        >
                          Cancelar
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.botaoSalvar,
                          salvando &&
                            styles.botaoDesabilitado,
                        ]}
                        onPress={salvarProduto}
                        disabled={salvando}
                      >
                        {salvando ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text
                            style={styles.textoSalvar}
                          >
                            Salvar
                          </Text>
                        )}
                      </TouchableOpacity>

                    </View>

                  </View>
                )}
              />

            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },

  cabecalho: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },

  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f2937',
  },

  subtitulo: {
    marginTop: 5,
    fontSize: 14,
    color: '#6b7280',
  },

  caixaPesquisa: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
  },

  inputPesquisa: {
    flex: 1,
    height: 44,
    color: '#111827',
  },

  botaoLimparPesquisa: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  textoLimparPesquisa: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '700',
  },

  lista: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  listaVazia: {
    flexGrow: 1,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,

    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  cardTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  informacoes: {
    flex: 1,
    paddingRight: 10,
  },

  nome: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },

  codigo: {
    marginTop: 5,
    fontSize: 13,
    color: '#6b7280',
  },

  categoria: {
    marginTop: 3,
    fontSize: 13,
    color: '#6b7280',
  },

  status: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusAtivo: {
    backgroundColor: '#dcfce7',
  },

  statusInativo: {
    backgroundColor: '#fee2e2',
  },

  statusTexto: {
    fontSize: 11,
    fontWeight: '700',
  },

  statusTextoAtivo: {
    color: '#166534',
  },

  statusTextoInativo: {
    color: '#991b1b',
  },

  divisor: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 14,
  },

  dados: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  dado: {
    flex: 1,
  },

  dadoLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 3,
  },

  preco: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },

  valor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  estoqueBaixo: {
    color: '#dc2626',
  },

  alertaEstoque: {
    marginTop: 12,
    padding: 9,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },

  alertaTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },

  acoes: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },

  botaoEditar: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },

  botaoExcluir: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },

  botaoDesabilitado: {
    opacity: 0.6,
  },

  textoBotao: {
    color: '#ffffff',
    fontWeight: '700',
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  mensagem: {
    marginTop: 10,
    color: '#6b7280',
  },

  erro: {
    textAlign: 'center',
    color: '#dc2626',
    fontSize: 15,
    marginBottom: 15,
  },

  tentarNovamente: {
    color: '#2563eb',
    fontWeight: '700',
  },

  semProdutos: {
    color: '#6b7280',
    fontSize: 15,
  },

  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 15,
  },

  tecladoModal: {
    flex: 1,
  },

  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    height: '88%',
    maxHeight: '88%',
  },

  modalTitulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 15,
  },

  formularioModal: {
    paddingBottom: 30,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 5,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  botoesModal: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },

  botaoCancelar: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },

  textoCancelar: {
    color: '#374151',
    fontWeight: '700',
  },

  botaoSalvar: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },

  textoSalvar: {
    color: '#ffffff',
    fontWeight: '700',
  },
});