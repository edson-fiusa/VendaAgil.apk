import React, { useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { obterBanco } from '../database/banco';

// =====================================================
// TIPOS
// =====================================================

type Produto = {
  id: number;
  codigo?: string;
  ean?: string;
  nome: string;
  marca?: string;
  unidade?: string;
  quantidade?: number;
  estoqueMinimo?: number;
  precoEntrada?: number;
  precoVenda?: number;
  categoria?: string;
  ativo?: boolean;
};

type Avaria = {
  id: number;
  produtoId: number;
  produtoNome?: string;
  codigo?: string;
  quantidade: number;
  motivo?: string;
  observacao?: string;
  precoCusto?: number;
  data?: string;
};

type ItemVenda = {
  id?: number;
  vendaId?: number;
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  produto?: {
    id?: number;
    nome?: string;
    codigo?: string;
    ean?: string;
    marca?: string;
    unidade?: string;
  };
};

type Venda = {
  id: number;
  caixaId?: number;
  operadorId?: number;
  total: number;
  formaPagamento?: string;
  valorPago?: number;
  troco?: number;
  mercadoPagoId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  itens?: ItemVenda[];
};

type Props = {
  onVoltar?: () => void;
};

// =====================================================
// FORMATADORES
// =====================================================

function fmt(valor: number | string | undefined | null): string {
  const numero = Number(valor || 0);

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmt3(valor: number | string | undefined | null): string {
  const numero = Number(valor || 0);

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

// =====================================================
// COMPONENTE
// =====================================================

export default function Relatorios({ onVoltar }: Props) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [avarias, setAvarias] = useState<Avaria[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  const [aba, setAba] = useState<
    'geral' | 'baixo' | 'avarias' | 'vendas'
  >('geral');

  const [vendasExpandidas, setVendasExpandidas] = useState<
    Record<number, boolean>
  >({});

  // =====================================================
  // CARREGAR DADOS DO SQLITE
  // =====================================================

  async function carregarDados() {
    try {
      setErro('');

      const db = await obterBanco();

      // =================================================
      // PRODUTOS
      // =================================================

      const produtosDb = await db.getAllAsync<any>(`
        SELECT
          id,
          codigo,
          ean,
          nome,
          marca,
          unidade,
          quantidade,
          estoque_minimo,
          preco_entrada,
          preco_venda,
          categoria,
          ativo
        FROM produtos_local
        WHERE ativo = 1
        ORDER BY nome COLLATE NOCASE ASC
      `);

      const listaProdutos: Produto[] = produtosDb.map(
        (produto) => ({
          id: Number(produto.id),
          codigo: produto.codigo ?? '',
          ean: produto.ean ?? '',
          nome: produto.nome ?? '',
          marca: produto.marca ?? '',
          unidade: produto.unidade ?? 'UN',
          quantidade: Number(produto.quantidade ?? 0),
          estoqueMinimo: Number(
            produto.estoque_minimo ?? 0
          ),
          precoEntrada: Number(
            produto.preco_entrada ?? 0
          ),
          precoVenda: Number(
            produto.preco_venda ?? 0
          ),
          categoria: produto.categoria ?? '',
          ativo: Boolean(produto.ativo),
        })
      );

      setProdutos(listaProdutos);

      // =================================================
      // AVARIAS
      // =================================================

      let avariasDb: any[] = [];

      try {
        // Verifica se a tabela existe antes de consultar
        const tabelaAvarias = await db.getFirstAsync<any>(
          `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name = 'avarias_local'
          `
        );

        if (tabelaAvarias) {
          // Descobre as colunas reais da tabela
          const colunasAvarias =
            await db.getAllAsync<any>(
              `PRAGMA table_info(avarias_local)`
            );

          const nomesColunas = new Set(
            colunasAvarias.map(
              (coluna: any) => coluna.name
            )
          );

          const temColuna = (nome: string) =>
            nomesColunas.has(nome);

          const motivo = temColuna('motivo')
            ? `a."motivo"`
            : `NULL`;

          const observacao =
            temColuna('observacao')
              ? `a."observacao"`
              : `NULL`;

          const precoCusto =
            temColuna('preco_custo')
              ? `a."preco_custo"`
              : `0`;

          let dataColuna = `NULL`;

          if (temColuna('data')) {
            dataColuna = `a."data"`;
          } else if (temColuna('criada_em')) {
            dataColuna = `a."criada_em"`;
          }

          let ordem = `a.id`;

          if (temColuna('data')) {
            ordem = `a."data"`;
          } else if (temColuna('criada_em')) {
            ordem = `a."criada_em"`;
          }

          avariasDb =
            await db.getAllAsync<any>(
              `
              SELECT
                a.id,
                a.produto_id,
                a.quantidade,

                ${motivo} AS motivo,

                ${observacao} AS observacao,

                ${precoCusto} AS preco_custo,

                ${dataColuna} AS data,

                p.nome AS produto_nome,
                p.codigo AS produto_codigo

              FROM avarias_local a

              LEFT JOIN produtos_local p
                ON p.id = a.produto_id

              ORDER BY
                ${ordem} DESC,
                a.id DESC
              `
            );
        }
      } catch (erroAvarias) {
        console.log(
          'Erro ao carregar avarias:',
          erroAvarias
        );

        // Não deixa um problema nas avarias
        // derrubar todo o relatório.
        avariasDb = [];
      }

      const listaAvarias: Avaria[] =
        avariasDb.map(
          (avaria) => ({
            id: Number(avaria.id),
            produtoId: Number(
              avaria.produto_id
            ),
            produtoNome:
              avaria.produto_nome ?? '',
            codigo:
              avaria.produto_codigo ?? '',
            quantidade: Number(
              avaria.quantidade ?? 0
            ),
            motivo:
              avaria.motivo ?? '',
            observacao:
              avaria.observacao ?? '',
            precoCusto: Number(
              avaria.preco_custo ?? 0
            ),
            data:
              avaria.data ??
              undefined,
          })
        );

      setAvarias(listaAvarias);

      // =================================================
      // VENDAS
      // =================================================

      const vendasDb = await db.getAllAsync<any>(`
        SELECT
          id,
          caixa_id,
          operador_id,
          total,
          forma_pagamento,
          valor_recebido,
          troco,
          criado_em,
          sincronizado
        FROM vendas_local
        ORDER BY criado_em DESC, id DESC
      `);

      // =================================================
      // ITENS DAS VENDAS
      // =================================================

      const itensDb = await db.getAllAsync<any>(`
        SELECT
          i.id,
          i.venda_id,
          i.produto_id,
          i.quantidade,
          i.preco_unitario,
          i.subtotal,
          p.codigo AS codigo,
          p.nome AS nome,
          p.ean,
          p.marca,
          p.unidade
        FROM itens_venda_local i
        LEFT JOIN produtos_local p
          ON p.id = i.produto_id
        ORDER BY i.id ASC
      `);

      // =================================================
      // AGRUPA OS ITENS POR VENDA
      // =================================================

      const itensPorVenda: Record<
        number,
        ItemVenda[]
      > = {};

      for (const item of itensDb) {
        const vendaId = Number(
          item.venda_id
        );

        if (!itensPorVenda[vendaId]) {
          itensPorVenda[vendaId] = [];
        }

        itensPorVenda[vendaId].push({
          id: Number(item.id),
          vendaId,
          produtoId: Number(
            item.produto_id
          ),
          quantidade: Number(
            item.quantidade ?? 0
          ),
          precoUnitario: Number(
            item.preco_unitario ?? 0
          ),
          subtotal: Number(
            item.subtotal ?? 0
          ),
          produto: {
            id: Number(
              item.produto_id
            ),
            nome: item.nome ?? '',
            codigo: item.codigo ?? '',
            ean: item.ean ?? '',
            marca: item.marca ?? '',
            unidade:
              item.unidade ?? 'UN',
          },
        });
      }

      // =================================================
      // MONTA VENDAS
      // =================================================

      const listaVendas: Venda[] =
        vendasDb.map(
          (venda) => ({
            id: Number(venda.id),

            caixaId:
              venda.caixa_id != null
                ? Number(
                    venda.caixa_id
                  )
                : undefined,

            operadorId:
              venda.operador_id != null
                ? Number(
                    venda.operador_id
                  )
                : undefined,

            total: Number(
              venda.total ?? 0
            ),

            formaPagamento:
              venda.forma_pagamento ??
              '',

            valorPago: Number(
              venda.valor_recebido ??
                0
            ),

            troco: Number(
              venda.troco ?? 0
            ),

            mercadoPagoId: null,

            createdAt:
              venda.criado_em ??
              undefined,

            updatedAt:
              venda.criado_em ??
              undefined,

            itens:
              itensPorVenda[
                Number(venda.id)
              ] ?? [],
          })
        );

      setVendas(listaVendas);

      console.log(
        'RELATÓRIOS SQLITE:',
        {
          produtos:
            listaProdutos.length,
          avarias:
            listaAvarias.length,
          vendas:
            listaVendas.length,
        }
      );
    } catch (error: any) {
      console.error(
        'Erro ao carregar relatórios do SQLite:',
        error
      );

      const mensagem =
        error?.message ||
        'Não foi possível carregar os relatórios locais.';

      setErro(mensagem);

      Alert.alert(
        'Erro',
        `Não foi possível carregar os relatórios.\n\n${mensagem}`
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  // =====================================================
  // ATUALIZAR
  // =====================================================

  async function atualizar() {
    setAtualizando(true);
    await carregarDados();
  }

  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================

  useEffect(() => {
    carregarDados();
  }, []);

  // =====================================================
  // ESTOQUE
  // =====================================================

  const totalProdutos =
    produtos.length;

  const quantidadeTotal =
    produtos.reduce(
      (total, produto) =>
        total +
        Number(
          produto.quantidade || 0
        ),
      0
    );

  const valorCustoTotal =
    produtos.reduce(
      (total, produto) =>
        total +
        Number(
          produto.quantidade || 0
        ) *
          Number(
            produto.precoEntrada || 0
          ),
      0
    );

  const valorVendaTotal =
    produtos.reduce(
      (total, produto) =>
        total +
        Number(
          produto.quantidade || 0
        ) *
          Number(
            produto.precoVenda || 0
          ),
      0
    );

  const produtosSemEstoque =
    produtos.filter(
      (produto) =>
        Number(
          produto.quantidade || 0
        ) <= 0
    );

  const produtosBaixoEstoque =
    produtos
      .filter((produto) => {
        const quantidade =
          Number(
            produto.quantidade || 0
          );

        const minimo =
          Number(
            produto.estoqueMinimo || 0
          );

        return quantidade <= minimo;
      })
      .sort(
        (a, b) =>
          Number(
            a.quantidade || 0
          ) -
          Number(
            b.quantidade || 0
          )
      );

  const produtosFiltrados =
    produtos.filter(
      (produto) => {
        const termo =
          busca
            .trim()
            .toLowerCase();

        if (!termo) return true;

        return (
          produto.nome
            ?.toLowerCase()
            .includes(termo) ||
          produto.codigo
            ?.toLowerCase()
            .includes(termo) ||
          produto.ean
            ?.toLowerCase()
            .includes(termo) ||
          produto.marca
            ?.toLowerCase()
            .includes(termo) ||
          produto.categoria
            ?.toLowerCase()
            .includes(termo)
        );
      }
    );

  // =====================================================
  // AVARIAS
  // =====================================================

  const quantidadeAvarias =
    avarias.reduce(
      (total, avaria) =>
        total +
        Number(
          avaria.quantidade || 0
        ),
      0
    );

  const valorAvarias =
    avarias.reduce(
      (total, avaria) =>
        total +
        Number(
          avaria.quantidade || 0
        ) *
          Number(
            avaria.precoCusto || 0
          ),
      0
    );

  // =====================================================
  // VENDAS
  // =====================================================

  const totalVendas =
    vendas.length;

  const faturamentoTotal =
    vendas.reduce(
      (total, venda) =>
        total +
        Number(
          venda.total || 0
        ),
      0
    );

  const ticketMedio =
    totalVendas > 0
      ? faturamentoTotal /
        totalVendas
      : 0;

  const quantidadeItensVendidos =
    vendas.reduce(
      (total, venda) =>
        total +
        (venda.itens || []).reduce(
          (subtotal, item) =>
            subtotal +
            Number(
              item.quantidade || 0
            ),
          0
        ),
      0
    );

  const vendasFiltradas =
    useMemo(() => {
      const termo =
        busca
          .trim()
          .toLowerCase();

      if (!termo) {
        return vendas;
      }

      return vendas.filter(
        (venda) => {
          const textoVenda = [
            String(
              venda.id || ''
            ),
            String(
              venda.caixaId || ''
            ),
            String(
              venda.operadorId || ''
            ),
            venda.formaPagamento ||
              '',
            venda.mercadoPagoId ||
              '',
            ...(venda.itens ||
              []
            ).flatMap(
              (item) => [
                item.produto
                  ?.nome || '',
                item.produto
                  ?.codigo || '',
                item.produto
                  ?.ean || '',
              ]
            ),
          ]
            .join(' ')
            .toLowerCase();

          return textoVenda.includes(
            termo
          );
        }
      );
    }, [vendas, busca]);

  // =====================================================
  // FORMATADORES
  // =====================================================

  function formatarData(
    data?: string
  ) {
    if (!data) return '--';

    const dataObj =
      new Date(data);

    if (
      Number.isNaN(
        dataObj.getTime()
      )
    ) {
      return data;
    }

    return dataObj.toLocaleString(
      'pt-BR'
    );
  }

  function nomeFormaPagamento(
    forma?: string
  ) {
    switch (forma) {
      case 'dinheiro':
        return 'Dinheiro';

      case 'pix':
        return 'Pix';

      case 'cartao':
        return 'Cartão';

      case 'cartao_credito':
        return 'Cartão de crédito';

      case 'cartao_debito':
        return 'Cartão de débito';

      case 'meio_externo':
        return 'Meio Externo POS';

      case 'pos':
        return 'Meio Externo POS';

      default:
        return (
          forma ||
          'Não informado'
        );
    }
  }

  function toggleVenda(
    id: number
  ) {
    setVendasExpandidas(
      (atual) => ({
        ...atual,
        [id]: !atual[id],
      })
    );
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (carregando) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color="#2563eb"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Carregando relatórios...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              atualizando
            }
            onRefresh={
              atualizar
            }
          />
        }
      >
        {/* ================================================= */}
        {/* CABEÇALHO */}
        {/* ================================================= */}

        <View
          style={styles.header}
        >
          <View
            style={
              styles.headerLeft
            }
          >
         

            <View>
              <Text
                style={styles.title}
              >
                Relatórios
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Estoque, avarias e vendas detalhadas
              </Text>
            </View>
          </View>

         
        </View>

        {!!erro && (
          <View
            style={styles.errorBox}
          >
            <Text
              style={
                styles.errorText
              }
            >
              {erro}
            </Text>
          </View>
        )}

        {/* ================================================= */}
        {/* CARDS PRINCIPAIS */}
        {/* ================================================= */}

        <View
          style={styles.cardsGrid}
        >
          <View
            style={styles.card}
          >
            <Text
              style={styles.cardLabel}
            >
              Produtos
            </Text>

            <Text
              style={styles.cardValue}
            >
              {totalProdutos}
            </Text>

            <Text
              style={
                styles.cardDescription
              }
            >
              cadastrados
            </Text>
          </View>

          <View
            style={styles.card}
          >
            <Text
              style={styles.cardLabel}
            >
              Quantidade
            </Text>

            <Text
              style={styles.cardValue}
            >
              {fmt3(
                quantidadeTotal
              )}
            </Text>

            <Text
              style={
                styles.cardDescription
              }
            >
              unidades em estoque
            </Text>
          </View>

          <View
            style={styles.card}
          >
            <Text
              style={styles.cardLabel}
            >
              Valor de custo
            </Text>

            <Text
              style={
                styles.cardValueSmall
              }
            >
              R${' '}
              {fmt(
                valorCustoTotal
              )}
            </Text>

            <Text
              style={
                styles.cardDescription
              }
            >
              estoque atual
            </Text>
          </View>

          <View
            style={styles.card}
          >
            <Text
              style={styles.cardLabel}
            >
              Valor de venda
            </Text>

            <Text
              style={
                styles.cardValueSmall
              }
            >
              R${' '}
              {fmt(
                valorVendaTotal
              )}
            </Text>

            <Text
              style={
                styles.cardDescription
              }
            >
              estoque atual
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* CARDS DE ALERTA */}
        {/* ================================================= */}

        <View
          style={styles.alertGrid}
        >
          <View
            style={styles.alertCard}
          >
            <Text
              style={
                styles.alertNumber
              }
            >
              {
                produtosBaixoEstoque.length
              }
            </Text>

            <Text
              style={
                styles.alertTitle
              }
            >
              Estoque baixo
            </Text>

            <Text
              style={
                styles.alertDescription
              }
            >
              produtos precisam de reposição
            </Text>
          </View>

          <View
            style={styles.alertCard}
          >
            <Text
              style={
                styles.alertNumber
              }
            >
              {
                produtosSemEstoque.length
              }
            </Text>

            <Text
              style={
                styles.alertTitle
              }
            >
              Sem estoque
            </Text>

            <Text
              style={
                styles.alertDescription
              }
            >
              produtos zerados
            </Text>
          </View>

          <View
            style={styles.alertCard}
          >
            <Text
              style={
                styles.alertNumber
              }
            >
              {quantidadeAvarias}
            </Text>

            <Text
              style={
                styles.alertTitle
              }
            >
              Avarias
            </Text>

            <Text
              style={
                styles.alertDescription
              }
            >
              unidades perdidas
            </Text>
          </View>

          <View
            style={styles.alertCard}
          >
            <Text
              style={
                styles.alertNumberSmall
              }
            >
              R${' '}
              {fmt(
                valorAvarias
              )}
            </Text>

            <Text
              style={
                styles.alertTitle
              }
            >
              Valor das perdas
            </Text>

            <Text
              style={
                styles.alertDescription
              }
            >
              custo das avarias
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* CARDS DE VENDAS */}
        {/* ================================================= */}

        <View
          style={styles.salesSummary}
        >
          <View
            style={
              styles.salesSummaryCard
            }
          >
            <Text
              style={
                styles.salesSummaryLabel
              }
            >
              Vendas
            </Text>

            <Text
              style={
                styles.salesSummaryValue
              }
            >
              {totalVendas}
            </Text>
          </View>

          <View
            style={
              styles.salesSummaryCard
            }
          >
            <Text
              style={
                styles.salesSummaryLabel
              }
            >
              Faturamento
            </Text>

            <Text
              style={
                styles.salesSummaryValueSmall
              }
            >
              R${' '}
              {fmt(
                faturamentoTotal
              )}
            </Text>
          </View>

          <View
            style={
              styles.salesSummaryCard
            }
          >
            <Text
              style={
                styles.salesSummaryLabel
              }
            >
              Ticket médio
            </Text>

            <Text
              style={
                styles.salesSummaryValueSmall
              }
            >
              R${' '}
              {fmt(
                ticketMedio
              )}
            </Text>
          </View>

          <View
            style={
              styles.salesSummaryCard
            }
          >
            <Text
              style={
                styles.salesSummaryLabel
              }
            >
              Itens vendidos
            </Text>

            <Text
              style={
                styles.salesSummaryValue
              }
            >
              {fmt3(
                quantidadeItensVendidos
              )}
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* ABAS */}
        {/* ================================================= */}

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              aba === 'geral' &&
                styles.tabActive,
            ]}
            onPress={() => {
              setAba('geral');
              setBusca('');
            }}
          >
            <Text
              style={[
                styles.tabText,
                aba === 'geral' &&
                  styles.tabTextActive,
              ]}
            >
              Estoque
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              aba === 'baixo' &&
                styles.tabActive,
            ]}
            onPress={() => {
              setAba('baixo');
              setBusca('');
            }}
          >
            <Text
              style={[
                styles.tabText,
                aba === 'baixo' &&
                  styles.tabTextActive,
              ]}
            >
              Estoque baixo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              aba === 'avarias' &&
                styles.tabActive,
            ]}
            onPress={() => {
              setAba('avarias');
              setBusca('');
            }}
          >
            <Text
              style={[
                styles.tabText,
                aba === 'avarias' &&
                  styles.tabTextActive,
              ]}
            >
              Avarias
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              aba === 'vendas' &&
                styles.tabActive,
            ]}
            onPress={() => {
              setAba('vendas');
              setBusca('');
            }}
          >
            <Text
              style={[
                styles.tabText,
                aba === 'vendas' &&
                  styles.tabTextActive,
              ]}
            >
              Vendas
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================================================= */}
        {/* ESTOQUE */}
        {/* ================================================= */}

        {aba === 'geral' && (
          <View>
            <TextInput
              style={styles.search}
              placeholder="Buscar produto..."
              value={busca}
              onChangeText={
                setBusca
              }
            />

            {produtosFiltrados.length ===
            0 ? (
              <View
                style={styles.empty}
              >
                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Nenhum produto encontrado.
                </Text>
              </View>
            ) : (
              produtosFiltrados.map(
                (produto) => (
                  <View
                    key={
                      produto.id
                    }
                    style={
                      styles.productCard
                    }
                  >
                    <View
                      style={
                        styles.productHeader
                      }
                    >
                      <View
                        style={
                          styles.productInfo
                        }
                      >
                        <Text
                          style={
                            styles.productName
                          }
                        >
                          {produto.nome}
                        </Text>

                        {!!produto.marca && (
                          <Text
                            style={
                              styles.productBrand
                            }
                          >
                            {produto.marca}
                          </Text>
                        )}

                        <Text
                          style={
                            styles.productCode
                          }
                        >
                          Código:{' '}
                          {produto.codigo ||
                            '--'}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.stockBox
                        }
                      >
                        <Text
                          style={
                            styles.stockLabel
                          }
                        >
                          Estoque
                        </Text>

                        <Text
                          style={[
                            styles.stockValue,
                            Number(
                              produto.quantidade ||
                                0
                            ) <=
                              Number(
                                produto.estoqueMinimo ||
                                  0
                              ) &&
                              styles.stockLow,
                          ]}
                        >
                          {fmt3(
                            produto.quantidade ||
                              0
                          )}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.productDetails
                      }
                    >
                      <Text
                        style={
                          styles.detailText
                        }
                      >
                        Custo: R${' '}
                        {fmt(
                          produto.precoEntrada ||
                            0
                        )}
                      </Text>

                      <Text
                        style={
                          styles.detailText
                        }
                      >
                        Venda: R${' '}
                        {fmt(
                          produto.precoVenda ||
                            0
                        )}
                      </Text>

                      <Text
                        style={
                          styles.detailText
                        }
                      >
                        Mínimo:{' '}
                        {fmt3(
                          produto.estoqueMinimo ||
                            0
                        )}
                      </Text>
                    </View>
                  </View>
                )
              )
            )}
          </View>
        )}

        {/* ================================================= */}
        {/* ESTOQUE BAIXO */}
        {/* ================================================= */}

        {aba === 'baixo' && (
          <View>
            {produtosBaixoEstoque.length ===
            0 ? (
              <View
                style={styles.empty}
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  Estoque normal
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Nenhum produto está abaixo do
                  estoque mínimo.
                </Text>
              </View>
            ) : (
              produtosBaixoEstoque.map(
                (produto) => (
                  <View
                    key={
                      produto.id
                    }
                    style={
                      styles.lowStockCard
                    }
                  >
                    <View
                      style={
                        styles.lowStockTop
                      }
                    >
                      <View
                        style={
                          styles.productInfo
                        }
                      >
                        <Text
                          style={
                            styles.productName
                          }
                        >
                          {produto.nome}
                        </Text>

                        <Text
                          style={
                            styles.productCode
                          }
                        >
                          Código:{' '}
                          {produto.codigo ||
                            '--'}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.lowStockBadge
                        }
                      >
                        <Text
                          style={
                            styles.lowStockBadgeText
                          }
                        >
                          REPOR
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.lowStockDetails
                      }
                    >
                      <View>
                        <Text
                          style={
                            styles.detailLabel
                          }
                        >
                          Atual
                        </Text>

                        <Text
                          style={
                            styles.detailValueRed
                          }
                        >
                          {fmt3(
                            produto.quantidade ||
                              0
                          )}
                        </Text>
                      </View>

                      <View>
                        <Text
                          style={
                            styles.detailLabel
                          }
                        >
                          Mínimo
                        </Text>

                        <Text
                          style={
                            styles.detailValue
                          }
                        >
                          {fmt3(
                            produto.estoqueMinimo ||
                              0
                          )}
                        </Text>
                      </View>

                      <View>
                        <Text
                          style={
                            styles.detailLabel
                          }
                        >
                          Venda
                        </Text>

                        <Text
                          style={
                            styles.detailValue
                          }
                        >
                          R${' '}
                          {fmt(
                            produto.precoVenda ||
                              0
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              )
            )}
          </View>
        )}

        {/* ================================================= */}
        {/* AVARIAS */}
        {/* ================================================= */}

        {aba === 'avarias' && (
          <View>
            {avarias.length ===
            0 ? (
              <View
                style={styles.empty}
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  Nenhuma avaria
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Não existem avarias registradas.
                </Text>
              </View>
            ) : (
              avarias.map(
                (avaria) => (
                  <View
                    key={
                      avaria.id
                    }
                    style={
                      styles.avariaCard
                    }
                  >
                    <View
                      style={
                        styles.avariaHeader
                      }
                    >
                      <View
                        style={
                          styles.productInfo
                        }
                      >
                        <Text
                          style={
                            styles.productName
                          }
                        >
                          {avaria.produtoNome ||
                            `Produto #${avaria.produtoId}`}
                        </Text>

                        <Text
                          style={
                            styles.productCode
                          }
                        >
                          Código:{' '}
                          {avaria.codigo ||
                            '--'}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.avariaQuantity
                        }
                      >
                        -
                        {fmt3(
                          avaria.quantidade
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.avariaReason
                      }
                    >
                      Motivo:{' '}
                      {avaria.motivo ||
                        '--'}
                    </Text>

                    {!!avaria.observacao && (
                      <Text
                        style={
                          styles.avariaObservation
                        }
                      >
                        {
                          avaria.observacao
                        }
                      </Text>
                    )}

                    <View
                      style={
                        styles.avariaFooter
                      }
                    >
                      <Text
                        style={
                          styles.detailText
                        }
                      >
                        Custo: R${' '}
                        {fmt(
                          avaria.precoCusto ||
                            0
                        )}
                      </Text>

                      <Text
                        style={
                          styles.detailText
                        }
                      >
                        Perda: R${' '}
                        {fmt(
                          Number(
                            avaria.quantidade ||
                              0
                          ) *
                            Number(
                              avaria.precoCusto ||
                                0
                            )
                        )}
                      </Text>

                      <Text
                        style={
                          styles.dateText
                        }
                      >
                        {formatarData(
                          avaria.data
                        )}
                      </Text>
                    </View>
                  </View>
                )
              )
            )}
          </View>
        )}

        {/* ================================================= */}
        {/* VENDAS DETALHADAS */}
        {/* ================================================= */}

        {aba === 'vendas' && (
          <View>
            <TextInput
              style={styles.search}
              placeholder="Buscar venda, produto, operador..."
              value={busca}
              onChangeText={
                setBusca
              }
            />

            <View
              style={
                styles.salesHeader
              }
            >
              <Text
                style={
                  styles.salesHeaderTitle
                }
              >
                Vendas realizadas
              </Text>

              <Text
                style={
                  styles.salesHeaderCount
                }
              >
                {
                  vendasFiltradas.length
                }{' '}
                venda(s)
              </Text>
            </View>

            {vendasFiltradas.length ===
            0 ? (
              <View
                style={styles.empty}
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  Nenhuma venda encontrada
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Ainda não existem vendas ou a
                  pesquisa não encontrou resultados.
                </Text>
              </View>
            ) : (
              vendasFiltradas.map(
                (venda) => {
                  const expandida =
                    !!vendasExpandidas[
                      venda.id
                    ];

                  return (
                    <View
                      key={
                        venda.id
                      }
                      style={
                        styles.saleCard
                      }
                    >
                      {/* CABEÇALHO DA VENDA */}

                      <TouchableOpacity
                        onPress={() =>
                          toggleVenda(
                            venda.id
                          )
                        }
                        activeOpacity={
                          0.8
                        }
                      >
                        <View
                          style={
                            styles.saleHeader
                          }
                        >
                          <View
                            style={
                              styles.saleTitleArea
                            }
                          >
                            <Text
                              style={
                                styles.saleTitle
                              }
                            >
                              Venda:{' '}
                              {
                                venda.id
                              }
                            </Text>

                            <Text
                              style={
                                styles.saleDate
                              }
                            >
                              {formatarData(
                                venda.createdAt
                              )}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.saleTotalArea
                            }
                          >
                            <Text
                              style={
                                styles.saleTotalLabel
                              }
                            >
                              Total
                            </Text>

                            <Text
                              style={
                                styles.saleTotal
                              }
                            >
                              R${' '}
                              {fmt(
                                venda.total ||
                                  0
                              )}
                            </Text>
                          </View>
                        </View>

                        {/* INFORMAÇÕES DA VENDA */}

                        <View
                          style={
                            styles.saleInfoGrid
                          }
                        >
                          <View
                            style={
                              styles.saleInfoItem
                            }
                          >
                            <Text
                              style={
                                styles.saleInfoLabel
                              }
                            >
                              Pagamento
                            </Text>

                            <Text
                              style={
                                styles.saleInfoValue
                              }
                            >
                              {nomeFormaPagamento(
                                venda.formaPagamento
                              )}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.saleInfoItem
                            }
                          >
                            <Text
                              style={
                                styles.saleInfoLabel
                              }
                            >
                              Caixa
                            </Text>

                            <Text
                              style={
                                styles.saleInfoValue
                              }
                            >
                              #
                              {venda.caixaId ||
                                '--'}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.saleInfoItem
                            }
                          >
                            <Text
                              style={
                                styles.saleInfoLabel
                              }
                            >
                              Operador
                            </Text>

                            <Text
                              style={
                                styles.saleInfoValue
                              }
                            >
                              #
                              {venda.operadorId ||
                                '--'}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.saleInfoItem
                            }
                          >
                            <Text
                              style={
                                styles.saleInfoLabel
                              }
                            >
                              Itens
                            </Text>

                            <Text
                              style={
                                styles.saleInfoValue
                              }
                            >
                              {
                                (
                                  venda.itens ||
                                  []
                                ).length
                              }
                            </Text>
                          </View>
                        </View>

                        <View
                          style={
                            styles.expandButton
                          }
                        >
                          <Text
                            style={
                              styles.expandButtonText
                            }
                          >
                            {expandida
                              ? 'Ocultar produtos ▲'
                              : 'Ver produtos ▼'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* DETALHES */}

                      {expandida && (
                        <View
                          style={
                            styles.saleDetails
                          }
                        >
                          <Text
                            style={
                              styles.saleDetailsTitle
                            }
                          >
                            Produtos da venda
                          </Text>

                          {(
                            venda.itens ||
                            []
                          ).map(
                            (
                              item,
                              index
                            ) => (
                              <View
                                key={
                                  item.id ||
                                  `${venda.id}-${index}`
                                }
                                style={
                                  styles.saleItem
                                }
                              >
                                <View
                                  style={
                                    styles.saleItemMain
                                  }
                                >
                                  <Text
                                    style={
                                      styles.saleItemName
                                    }
                                  >
                                    {item.produto
                                      ?.nome ||
                                      `Produto #${item.produtoId}`}
                                  </Text>

                                  <Text
                                    style={
                                      styles.saleItemCode
                                    }
                                  >
                                    Código:{' '}
                                    {item
                                      .produto
                                      ?.codigo ||
                                      '--'}
                                  </Text>

                                  {!!item
                                    .produto
                                    ?.ean && (
                                    <Text
                                      style={
                                        styles.saleItemCode
                                      }
                                    >
                                      EAN:{' '}
                                      {
                                        item
                                          .produto
                                          .ean
                                      }
                                    </Text>
                                  )}
                                </View>

                                <View
                                  style={
                                    styles.saleItemValues
                                  }
                                >
                                  <Text
                                    style={
                                      styles.saleItemQuantity
                                    }
                                  >
                                    {fmt3(
                                      item.quantidade
                                    )}{' '}
                                    x R${' '}
                                    {fmt(
                                      item.precoUnitario
                                    )}
                                  </Text>

                                  <Text
                                    style={
                                      styles.saleItemSubtotal
                                    }
                                  >
                                    R${' '}
                                    {fmt(
                                      item.subtotal
                                    )}
                                  </Text>
                                </View>
                              </View>
                            )
                          )}

                          {/* PAGAMENTO */}

                          <View
                            style={
                              styles.paymentDetails
                            }
                          >
                            <View
                              style={
                                styles.paymentRow
                              }
                            >
                              <Text
                                style={
                                  styles.paymentLabel
                                }
                              >
                                Forma de pagamento
                              </Text>

                              <Text
                                style={
                                  styles.paymentValue
                                }
                              >
                                {nomeFormaPagamento(
                                  venda.formaPagamento
                                )}
                              </Text>
                            </View>

                            <View
                              style={
                                styles.paymentRow
                              }
                            >
                              <Text
                                style={
                                  styles.paymentLabel
                                }
                              >
                                Valor pago
                              </Text>

                              <Text
                                style={
                                  styles.paymentValue
                                }
                              >
                                R${' '}
                                {fmt(
                                  venda.valorPago ||
                                    0
                                )}
                              </Text>
                            </View>

                            <View
                              style={
                                styles.paymentRow
                              }
                            >
                              <Text
                                style={
                                  styles.paymentLabel
                                }
                              >
                                Troco
                              </Text>

                              <Text
                                style={
                                  styles.paymentValue
                                }
                              >
                                R${' '}
                                {fmt(
                                  venda.troco ||
                                    0
                                )}
                              </Text>
                            </View>

                            {!!venda.mercadoPagoId && (
                              <View
                                style={
                                  styles.paymentRow
                                }
                              >
                                <Text
                                  style={
                                    styles.paymentLabel
                                  }
                                >
                                  Mercado Pago
                                </Text>

                                <Text
                                  style={
                                    styles.paymentValueSmall
                                  }
                                  numberOfLines={
                                    1
                                  }
                                >
                                  {
                                    venda.mercadoPagoId
                                  }
                                </Text>
                              </View>
                            )}

                            <View
                              style={
                                styles.paymentTotalRow
                              }
                            >
                              <Text
                                style={
                                  styles.paymentTotalLabel
                                }
                              >
                                TOTAL DA VENDA
                              </Text>

                              <Text
                                style={
                                  styles.paymentTotal
                                }
                              >
                                R${' '}
                                {fmt(
                                  venda.total ||
                                    0
                                )}
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }
              )
            )}
          </View>
        )}

        {/* ================================================= */}
        {/* RODAPÉ */}
        {/* ================================================= */}

        <View
          style={styles.footer}
        >
          <Text
            style={styles.footerText}
          >
            Venda Ágil PDV
          </Text>

          <Text
            style={
              styles.footerSubtext
            }
          >
            Relatório atualizado em{' '}
            {new Date().toLocaleString(
              'pt-BR'
            )}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
  },

  // ===================================================
  // HEADER
  // ===================================================

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    elevation: 2,
  },

  backButtonText: {
    fontSize: 32,
    color: '#111827',
    marginTop: -4,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
  },

  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },

  refreshButtonText: {
    fontSize: 25,
    color: '#ffffff',
  },

  // ===================================================
  // ERRO
  // ===================================================

  errorBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
  },

  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },

  // ===================================================
  // CARDS
  // ===================================================

  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  card: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },

  cardLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },

  cardValue: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
    marginTop: 5,
  },

  cardValueSmall: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
  },

  cardDescription: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },

  // ===================================================
  // ALERTAS
  // ===================================================

  alertGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  alertCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },

  alertNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#dc2626',
  },

  alertNumberSmall: {
    fontSize: 17,
    fontWeight: '800',
    color: '#dc2626',
  },

  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 3,
  },

  alertDescription: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 3,
  },

  // ===================================================
  // RESUMO VENDAS
  // ===================================================

  salesSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  salesSummaryCard: {
    width: '48.5%',
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },

  salesSummaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },

  salesSummaryValue: {
    fontSize: 22,
    color: '#1d4ed8',
    fontWeight: '800',
    marginTop: 4,
  },

  salesSummaryValueSmall: {
    fontSize: 17,
    color: '#1d4ed8',
    fontWeight: '800',
    marginTop: 7,
  },

  // ===================================================
  // ABAS
  // ===================================================

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
    elevation: 1,
  },

  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 9,
  },

  tabActive: {
    backgroundColor: '#2563eb',
  },

  tabText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '700',
  },

  tabTextActive: {
    color: '#ffffff',
  },

  // ===================================================
  // PESQUISA
  // ===================================================

  search: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },

  // ===================================================
  // PRODUTO
  // ===================================================

  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
    elevation: 1,
  },

  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  productInfo: {
    flex: 1,
    paddingRight: 10,
  },

  productName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  productBrand: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  productCode: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 5,
  },

  stockBox: {
    alignItems: 'flex-end',
  },

  stockLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },

  stockValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#16a34a',
  },

  stockLow: {
    color: '#dc2626',
  },

  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 12,
    paddingTop: 10,
  },

  detailText: {
    fontSize: 12,
    color: '#6b7280',
  },

  // ===================================================
  // ESTOQUE BAIXO
  // ===================================================

  lowStockCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    elevation: 1,
  },

  lowStockTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  lowStockBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    height: 28,
  },

  lowStockBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b91c1c',
  },

  lowStockDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },

  detailLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },

  detailValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700',
    marginTop: 2,
  },

  detailValueRed: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '800',
    marginTop: 2,
  },

  // ===================================================
  // AVARIAS
  // ===================================================

  avariaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    elevation: 1,
  },

  avariaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  avariaQuantity: {
    fontSize: 18,
    fontWeight: '800',
    color: '#dc2626',
  },

  avariaReason: {
    fontSize: 13,
    color: '#374151',
    marginTop: 12,
  },

  avariaObservation: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 5,
  },

  avariaFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 12,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },

  dateText: {
    fontSize: 11,
    color: '#9ca3af',
  },

  // ===================================================
  // VENDAS
  // ===================================================

  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  salesHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  salesHeaderCount: {
    fontSize: 12,
    color: '#6b7280',
  },

  saleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },

  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
  },

  saleTitleArea: {
    flex: 1,
  },

  saleTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  saleDate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },

  saleTotalArea: {
    alignItems: 'flex-end',
  },

  saleTotalLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },

  saleTotal: {
    fontSize: 19,
    fontWeight: '800',
    color: '#16a34a',
    marginTop: 2,
  },

  saleInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },

  saleInfoItem: {
    width: '50%',
    marginBottom: 8,
  },

  saleInfoLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },

  saleInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 2,
  },

  expandButton: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 11,
    alignItems: 'center',
  },

  expandButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },

  saleDetails: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  saleDetailsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },

  saleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  saleItemMain: {
    flex: 1,
    paddingRight: 10,
  },

  saleItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },

  saleItemCode: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },

  saleItemValues: {
    alignItems: 'flex-end',
  },

  saleItemQuantity: {
    fontSize: 11,
    color: '#6b7280',
  },

  saleItemSubtotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginTop: 3,
  },

  paymentDetails: {
    marginTop: 15,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
  },

  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },

  paymentLabel: {
    fontSize: 12,
    color: '#6b7280',
  },

  paymentValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },

  paymentValueSmall: {
    maxWidth: '55%',
    fontSize: 10,
    color: '#6b7280',
  },

  paymentTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 10,
  },

  paymentTotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },

  paymentTotal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#16a34a',
  },

  // ===================================================
  // VAZIO
  // ===================================================

  empty: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 5,
  },

  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },

  // ===================================================
  // FOOTER
  // ===================================================

  footer: {
    alignItems: 'center',
    marginTop: 25,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  footerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6b7280',
  },

  footerSubtext: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 3,
  },
});