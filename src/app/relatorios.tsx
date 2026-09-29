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

type Aba = 'geral' | 'baixo' | 'avarias' | 'vendas';

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

function nomeFormaPagamento(forma?: string) {
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
      return forma || 'Não informado';
  }
}

function formatarData(data?: string) {
  if (!data) return '--';
  const dataObj = new Date(data);
  if (Number.isNaN(dataObj.getTime())) return data;
  return dataObj.toLocaleString('pt-BR');
}

function formatarDataCurta(chaveIso: string) {
  const dataObj = new Date(`${chaveIso}T00:00:00`);
  if (Number.isNaN(dataObj.getTime())) return chaveIso;
  return dataObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
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

  const [aba, setAba] = useState<Aba>('geral');

  const [vendasExpandidas, setVendasExpandidas] = useState<
    Record<number, boolean>
  >({});

  // Dia selecionado no gráfico "vendas dos últimos 7 dias" (chave
  // AAAA-MM-DD). Ao tocar numa barra, mostra o detalhe daquele dia
  // logo abaixo do gráfico; tocar de novo na mesma barra fecha.
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  // =====================================================
  // CARREGAR DADOS DO SQLITE
  // =====================================================

  async function carregarDados() {
    try {
      setErro('');

      const db = await obterBanco();

      const produtosDb = await db.getAllAsync<any>(`
        SELECT id, codigo, ean, nome, marca, unidade, quantidade,
               estoque_minimo, preco_entrada, preco_venda, categoria, ativo
        FROM produtos_local
        WHERE ativo = 1
        ORDER BY nome COLLATE NOCASE ASC
      `);

      const listaProdutos: Produto[] = produtosDb.map((produto) => ({
        id: Number(produto.id),
        codigo: produto.codigo ?? '',
        ean: produto.ean ?? '',
        nome: produto.nome ?? '',
        marca: produto.marca ?? '',
        unidade: produto.unidade ?? 'UN',
        quantidade: Number(produto.quantidade ?? 0),
        estoqueMinimo: Number(produto.estoque_minimo ?? 0),
        precoEntrada: Number(produto.preco_entrada ?? 0),
        precoVenda: Number(produto.preco_venda ?? 0),
        categoria: produto.categoria ?? '',
        ativo: Boolean(produto.ativo),
      }));

      setProdutos(listaProdutos);

      let avariasDb: any[] = [];

      try {
        const tabelaAvarias = await db.getFirstAsync<any>(`
          SELECT name FROM sqlite_master
          WHERE type = 'table' AND name = 'avarias_local'
        `);

        if (tabelaAvarias) {
          const colunasAvarias = await db.getAllAsync<any>(
            `PRAGMA table_info(avarias_local)`
          );

          const nomesColunas = new Set(
            colunasAvarias.map((coluna: any) => coluna.name)
          );

          const temColuna = (nome: string) => nomesColunas.has(nome);

          const motivo = temColuna('motivo') ? `a."motivo"` : `NULL`;
          const observacao = temColuna('observacao')
            ? `a."observacao"`
            : `NULL`;
          const precoCusto = temColuna('preco_custo')
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

          avariasDb = await db.getAllAsync<any>(`
            SELECT a.id, a.produto_id, a.quantidade,
                   ${motivo} AS motivo, ${observacao} AS observacao,
                   ${precoCusto} AS preco_custo, ${dataColuna} AS data,
                   p.nome AS produto_nome, p.codigo AS produto_codigo
            FROM avarias_local a
            LEFT JOIN produtos_local p ON p.id = a.produto_id
            ORDER BY ${ordem} DESC, a.id DESC
          `);
        }
      } catch (erroAvarias) {
        console.log('Erro ao carregar avarias:', erroAvarias);
        avariasDb = [];
      }

      const listaAvarias: Avaria[] = avariasDb.map((avaria) => ({
        id: Number(avaria.id),
        produtoId: Number(avaria.produto_id),
        produtoNome: avaria.produto_nome ?? '',
        codigo: avaria.produto_codigo ?? '',
        quantidade: Number(avaria.quantidade ?? 0),
        motivo: avaria.motivo ?? '',
        observacao: avaria.observacao ?? '',
        precoCusto: Number(avaria.preco_custo ?? 0),
        data: avaria.data ?? undefined,
      }));

      setAvarias(listaAvarias);

      const vendasDb = await db.getAllAsync<any>(`
        SELECT id, caixa_id, operador_id, total, forma_pagamento,
               valor_recebido, troco, criado_em, sincronizado
        FROM vendas_local
        ORDER BY criado_em DESC, id DESC
      `);

      const itensDb = await db.getAllAsync<any>(`
        SELECT i.id, i.venda_id, i.produto_id, i.quantidade,
               i.preco_unitario, i.subtotal,
               p.codigo AS codigo, p.nome AS nome, p.ean, p.marca, p.unidade
        FROM itens_venda_local i
        LEFT JOIN produtos_local p ON p.id = i.produto_id
        ORDER BY i.id ASC
      `);

      const itensPorVenda: Record<number, ItemVenda[]> = {};

      for (const item of itensDb) {
        const vendaId = Number(item.venda_id);
        if (!itensPorVenda[vendaId]) itensPorVenda[vendaId] = [];

        itensPorVenda[vendaId].push({
          id: Number(item.id),
          vendaId,
          produtoId: Number(item.produto_id),
          quantidade: Number(item.quantidade ?? 0),
          precoUnitario: Number(item.preco_unitario ?? 0),
          subtotal: Number(item.subtotal ?? 0),
          produto: {
            id: Number(item.produto_id),
            nome: item.nome ?? '',
            codigo: item.codigo ?? '',
            ean: item.ean ?? '',
            marca: item.marca ?? '',
            unidade: item.unidade ?? 'UN',
          },
        });
      }

      const listaVendas: Venda[] = vendasDb.map((venda) => ({
        id: Number(venda.id),
        caixaId: venda.caixa_id != null ? Number(venda.caixa_id) : undefined,
        operadorId:
          venda.operador_id != null ? Number(venda.operador_id) : undefined,
        total: Number(venda.total ?? 0),
        formaPagamento: venda.forma_pagamento ?? '',
        valorPago: Number(venda.valor_recebido ?? 0),
        troco: Number(venda.troco ?? 0),
        mercadoPagoId: null,
        createdAt: venda.criado_em ?? undefined,
        updatedAt: venda.criado_em ?? undefined,
        itens: itensPorVenda[Number(venda.id)] ?? [],
      }));

      setVendas(listaVendas);
    } catch (error: any) {
      console.error('Erro ao carregar relatórios do SQLite:', error);

      const mensagem =
        error?.message || 'Não foi possível carregar os relatórios locais.';

      setErro(mensagem);

      Alert.alert('Erro', `Não foi possível carregar os relatórios.\n\n${mensagem}`);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  async function atualizar() {
    setAtualizando(true);
    await carregarDados();
  }

  useEffect(() => {
    carregarDados();
  }, []);

  // =====================================================
  // ESTOQUE
  // =====================================================

  const totalProdutos = produtos.length;

  const quantidadeTotal = produtos.reduce(
    (total, produto) => total + Number(produto.quantidade || 0),
    0
  );

  const valorCustoTotal = produtos.reduce(
    (total, produto) =>
      total + Number(produto.quantidade || 0) * Number(produto.precoEntrada || 0),
    0
  );

  const valorVendaTotal = produtos.reduce(
    (total, produto) =>
      total + Number(produto.quantidade || 0) * Number(produto.precoVenda || 0),
    0
  );

  const produtosSemEstoque = produtos.filter(
    (produto) => Number(produto.quantidade || 0) <= 0
  );

  const produtosBaixoEstoque = produtos
    .filter((produto) => {
      const quantidade = Number(produto.quantidade || 0);
      const minimo = Number(produto.estoqueMinimo || 0);
      return quantidade <= minimo;
    })
    .sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));

  const produtosFiltrados = produtos.filter((produto) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;

    return (
      produto.nome?.toLowerCase().includes(termo) ||
      produto.codigo?.toLowerCase().includes(termo) ||
      produto.ean?.toLowerCase().includes(termo) ||
      produto.marca?.toLowerCase().includes(termo) ||
      produto.categoria?.toLowerCase().includes(termo)
    );
  });

  // =====================================================
  // AVARIAS
  // =====================================================

  const quantidadeAvarias = avarias.reduce(
    (total, avaria) => total + Number(avaria.quantidade || 0),
    0
  );

  const valorAvarias = avarias.reduce(
    (total, avaria) =>
      total + Number(avaria.quantidade || 0) * Number(avaria.precoCusto || 0),
    0
  );

  // =====================================================
  // VENDAS
  // =====================================================

  const totalVendas = vendas.length;

  const faturamentoTotal = vendas.reduce(
    (total, venda) => total + Number(venda.total || 0),
    0
  );

  const ticketMedio = totalVendas > 0 ? faturamentoTotal / totalVendas : 0;

  const quantidadeItensVendidos = vendas.reduce(
    (total, venda) =>
      total +
      (venda.itens || []).reduce(
        (subtotal, item) => subtotal + Number(item.quantidade || 0),
        0
      ),
    0
  );

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return vendas;

    return vendas.filter((venda) => {
      const textoVenda = [
        String(venda.id || ''),
        String(venda.caixaId || ''),
        String(venda.operadorId || ''),
        venda.formaPagamento || '',
        venda.mercadoPagoId || '',
        ...(venda.itens || []).flatMap((item) => [
          item.produto?.nome || '',
          item.produto?.codigo || '',
          item.produto?.ean || '',
        ]),
      ]
        .join(' ')
        .toLowerCase();

      return textoVenda.includes(termo);
    });
  }, [vendas, busca]);

  // =====================================================
  // DASHBOARD (dados para os gráficos simples)
  // =====================================================

  const vendasPorDiaSemana = useMemo(() => {
    const hoje = new Date();
    const dias: { label: string; chave: string; total: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);

      const chave = d.toISOString().slice(0, 10);
      const labelBruto = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      const label = labelBruto.replace('.', '');

      dias.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        chave,
        total: 0,
      });
    }

    const mapa = new Map(dias.map((d) => [d.chave, d]));

    for (const venda of vendas) {
      if (!venda.createdAt) continue;

      const chave = venda.createdAt.slice(0, 10);
      const dia = mapa.get(chave);

      if (dia) {
        dia.total += Number(venda.total || 0);
      }
    }

    return dias;
  }, [vendas]);

  const maiorVendaDiaria = Math.max(
    1,
    ...vendasPorDiaSemana.map((d) => d.total)
  );

  const vendasPorFormaPagamento = useMemo(() => {
    const totais: Record<string, number> = {};

    for (const venda of vendas) {
      const forma = venda.formaPagamento || 'outros';
      totais[forma] = (totais[forma] || 0) + Number(venda.total || 0);
    }

    const totalGeral = Object.values(totais).reduce((a, b) => a + b, 0);

    return Object.entries(totais)
      .map(([forma, total]) => ({
        forma,
        label: nomeFormaPagamento(forma),
        total,
        percentual: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [vendas]);

  const produtosMaisVendidos = useMemo(() => {
    const totais: Record<
      string,
      { nome: string; quantidade: number; total: number }
    > = {};

    for (const venda of vendas) {
      for (const item of venda.itens || []) {
        const chave = String(item.produtoId);
        const nome = item.produto?.nome || `Produto #${item.produtoId}`;

        if (!totais[chave]) {
          totais[chave] = { nome, quantidade: 0, total: 0 };
        }

        totais[chave].quantidade += Number(item.quantidade || 0);
        totais[chave].total += Number(item.subtotal || 0);
      }
    }

    return Object.values(totais)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  }, [vendas]);

  const maiorQuantidadeProduto = Math.max(
    1,
    ...produtosMaisVendidos.map((p) => p.quantidade)
  );

  // Detalhe do dia selecionado no gráfico de 7 dias: vendas daquele
  // dia, quebra por forma de pagamento e produtos mais vendidos
  // naquele dia específico.
  const detalheDiaSelecionado = useMemo(() => {
    if (!diaSelecionado) return null;

    const vendasDoDia = vendas.filter(
      (venda) => (venda.createdAt || '').slice(0, 10) === diaSelecionado
    );

    const totalDia = vendasDoDia.reduce(
      (total, venda) => total + Number(venda.total || 0),
      0
    );

    const formasNoDia: Record<string, number> = {};

    for (const venda of vendasDoDia) {
      const forma = venda.formaPagamento || 'outros';
      formasNoDia[forma] = (formasNoDia[forma] || 0) + Number(venda.total || 0);
    }

    const formasOrdenadas = Object.entries(formasNoDia)
      .map(([forma, total]) => ({ forma, label: nomeFormaPagamento(forma), total }))
      .sort((a, b) => b.total - a.total);

    const itensNoDia: Record<string, { nome: string; quantidade: number }> = {};

    for (const venda of vendasDoDia) {
      for (const item of venda.itens || []) {
        const chave = String(item.produtoId);
        const nome = item.produto?.nome || `Produto #${item.produtoId}`;

        if (!itensNoDia[chave]) {
          itensNoDia[chave] = { nome, quantidade: 0 };
        }

        itensNoDia[chave].quantidade += Number(item.quantidade || 0);
      }
    }

    const itensOrdenados = Object.values(itensNoDia)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    return {
      chave: diaSelecionado,
      quantidadeVendas: vendasDoDia.length,
      totalDia,
      formasOrdenadas,
      itensOrdenados,
    };
  }, [diaSelecionado, vendas]);

  function alternarDiaSelecionado(chave: string) {
    setDiaSelecionado((atual) => (atual === chave ? null : chave));
  }

  function toggleVenda(id: number) {
    setVendasExpandidas((atual) => ({ ...atual, [id]: !atual[id] }));
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Carregando relatórios...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={atualizar} />
        }
      >
                <View style={styles.dashboardCard}>
          <Text style={styles.dashboardCardTitle}>
            Vendas nos últimos 7 dias
          </Text>
          <Text style={styles.dashboardCardHint}>
            Toque numa barra para ver o detalhe do dia
          </Text>

          {faturamentoTotal === 0 ? (
            <Text style={styles.emptyText}>Nenhuma venda registrada ainda.</Text>
          ) : (
            <View style={styles.barChartRow}>
              {vendasPorDiaSemana.map((dia) => {
                const altura = Math.max(4, (dia.total / maiorVendaDiaria) * 100);
                const selecionado = diaSelecionado === dia.chave;

                return (
                  <TouchableOpacity
                    key={dia.chave}
                    style={styles.barChartCol}
                    activeOpacity={0.7}
                    onPress={() => alternarDiaSelecionado(dia.chave)}
                  >
                    <Text style={styles.barChartValue} numberOfLines={1}>
                      {dia.total > 0 ? fmt(dia.total) : ''}
                    </Text>

                    <View style={styles.barChartTrack}>
                      <View
                        style={[
                          styles.barChartFill,
                          selecionado && styles.barChartFillSelecionada,
                          { height: `${altura}%` },
                        ]}
                      />
                    </View>

                    <Text
                      style={[
                        styles.barChartLabel,
                        selecionado && styles.barChartLabelSelecionada,
                      ]}
                    >
                      {dia.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {detalheDiaSelecionado && (
            <View style={styles.diaDetalhe}>
              <View style={styles.diaDetalheHeader}>
                <Text style={styles.diaDetalheTitulo}>
                  {formatarDataCurta(detalheDiaSelecionado.chave)} —{' '}
                  {detalheDiaSelecionado.quantidadeVendas} venda(s)
                </Text>
                <Text style={styles.diaDetalheTotal}>
                  R$ {fmt(detalheDiaSelecionado.totalDia)}
                </Text>
              </View>

              {detalheDiaSelecionado.quantidadeVendas === 0 ? (
                <Text style={styles.emptyText}>Nenhuma venda nesse dia.</Text>
              ) : (
                <>
                  <Text style={styles.diaDetalheSubtitulo}>
                    Por forma de pagamento
                  </Text>
                  {detalheDiaSelecionado.formasOrdenadas.map((item) => (
                    <View key={item.forma} style={styles.diaDetalheLinha}>
                      <Text style={styles.diaDetalheLinhaLabel}>
                        {item.label}
                      </Text>
                      <Text style={styles.diaDetalheLinhaValor}>
                        R$ {fmt(item.total)}
                      </Text>
                    </View>
                  ))}

                  <Text style={styles.diaDetalheSubtitulo}>
                    Mercadoria mais vendida no dia
                  </Text>
                  {detalheDiaSelecionado.itensOrdenados.map((item, index) => (
                    <View
                      key={`${item.nome}-${index}`}
                      style={styles.diaDetalheLinha}
                    >
                      <Text style={styles.diaDetalheLinhaLabel} numberOfLines={1}>
                        {index + 1}. {item.nome}
                      </Text>
                      <Text style={styles.diaDetalheLinhaValor}>
                        {fmt3(item.quantidade)}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardCardTitle}>
            Vendas por forma de pagamento
          </Text>

          {vendasPorFormaPagamento.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma venda registrada ainda.</Text>
          ) : (
            vendasPorFormaPagamento.map((item) => (
              <View key={item.forma} style={styles.hBarRow}>
                <View style={styles.hBarLabelRow}>
                  <Text style={styles.hBarLabel}>{item.label}</Text>
                  <Text style={styles.hBarValue}>R$ {fmt(item.total)}</Text>
                </View>

                <View style={styles.hBarTrack}>
                  <View
                    style={[
                      styles.hBarFill,
                      { width: `${Math.max(4, item.percentual)}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardCardTitle}>
            Top 5 produtos mais vendidos
          </Text>

          {produtosMaisVendidos.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma venda registrada ainda.</Text>
          ) : (
            produtosMaisVendidos.map((produto, index) => {
              const largura = Math.max(
                4,
                (produto.quantidade / maiorQuantidadeProduto) * 100
              );

              return (
                <View key={`${produto.nome}-${index}`} style={styles.hBarRow}>
                  <View style={styles.hBarLabelRow}>
                    <Text style={styles.hBarLabel} numberOfLines={1}>
                      {index + 1}. {produto.nome}
                    </Text>
                    <Text style={styles.hBarValue}>
                      {fmt3(produto.quantidade)}
                    </Text>
                  </View>

                  <View style={styles.hBarTrack}>
                    <View
                      style={[
                        styles.hBarFill,
                        styles.hBarFillVerde,
                        { width: `${largura}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View>
              <Text style={styles.title}>Relatórios</Text>
              <Text style={styles.subtitle}>
                Estoque, avarias e vendas detalhadas
              </Text>
            </View>
          </View>
        </View>

        {!!erro && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        )}

        {/* CARDS PRINCIPAIS */}
        <View style={styles.cardsGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Produtos</Text>
            <Text style={styles.cardValue}>{totalProdutos}</Text>
            <Text style={styles.cardDescription}>cadastrados</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Quantidade</Text>
            <Text style={styles.cardValue}>{fmt3(quantidadeTotal)}</Text>
            <Text style={styles.cardDescription}>unidades em estoque</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Valor de custo</Text>
            <Text style={styles.cardValueSmall}>R$ {fmt(valorCustoTotal)}</Text>
            <Text style={styles.cardDescription}>estoque atual</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Valor de venda</Text>
            <Text style={styles.cardValueSmall}>R$ {fmt(valorVendaTotal)}</Text>
            <Text style={styles.cardDescription}>estoque atual</Text>
          </View>
        </View>

        {/* CARDS DE VENDAS */}
        <View style={styles.salesSummary}>
          <View style={styles.salesSummaryCard}>
            <Text style={styles.salesSummaryLabel}>Vendas</Text>
            <Text style={styles.salesSummaryValue}>{totalVendas}</Text>
          </View>

          <View style={styles.salesSummaryCard}>
            <Text style={styles.salesSummaryLabel}>Faturamento</Text>
            <Text style={styles.salesSummaryValueSmall}>
              R$ {fmt(faturamentoTotal)}
            </Text>
          </View>

          <View style={styles.salesSummaryCard}>
            <Text style={styles.salesSummaryLabel}>Ticket médio</Text>
            <Text style={styles.salesSummaryValueSmall}>R$ {fmt(ticketMedio)}</Text>
          </View>

          <View style={styles.salesSummaryCard}>
            <Text style={styles.salesSummaryLabel}>Itens vendidos</Text>
            <Text style={styles.salesSummaryValue}>
              {fmt3(quantidadeItensVendidos)}
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* DASHBOARD — sempre visível, não é mais uma aba */}
        {/* ================================================= */}



        {/* CARDS DE ALERTA */}
        <View style={styles.alertGrid}>
          <View style={styles.alertCard}>
            <Text style={styles.alertNumber}>{produtosBaixoEstoque.length}</Text>
            <Text style={styles.alertTitle}>Estoque baixo</Text>
            <Text style={styles.alertDescription}>
              produtos precisam de reposição
            </Text>
          </View>

          <View style={styles.alertCard}>
            <Text style={styles.alertNumber}>{produtosSemEstoque.length}</Text>
            <Text style={styles.alertTitle}>Sem estoque</Text>
            <Text style={styles.alertDescription}>produtos zerados</Text>
          </View>

          <View style={styles.alertCard}>
            <Text style={styles.alertNumber}>{quantidadeAvarias}</Text>
            <Text style={styles.alertTitle}>Avarias</Text>
            <Text style={styles.alertDescription}>unidades perdidas</Text>
          </View>

          <View style={styles.alertCard}>
            <Text style={styles.alertNumberSmall}>R$ {fmt(valorAvarias)}</Text>
            <Text style={styles.alertTitle}>Valor das perdas</Text>
            <Text style={styles.alertDescription}>custo das avarias</Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* MENUS: Estoque / Estoque baixo / Avarias / Vendas */}
        {/* ================================================= */}

        <View style={styles.tabs}>
          {(
            [
              { chave: 'geral', label: 'Estoque' },
              { chave: 'baixo', label: 'Estoque baixo' },
              { chave: 'avarias', label: 'Avarias' },
              { chave: 'vendas', label: 'Vendas' },
            ] as { chave: Aba; label: string }[]
          ).map((item) => (
            <TouchableOpacity
              key={item.chave}
              style={[styles.tab, aba === item.chave && styles.tabActive]}
              onPress={() => {
                setAba(item.chave);
                setBusca('');
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  aba === item.chave && styles.tabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
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
              onChangeText={setBusca}
            />

            {produtosFiltrados.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nenhum produto encontrado.</Text>
              </View>
            ) : (
              produtosFiltrados.map((produto) => (
                <View key={produto.id} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{produto.nome}</Text>

                      {!!produto.marca && (
                        <Text style={styles.productBrand}>{produto.marca}</Text>
                      )}

                      <Text style={styles.productCode}>
                        Código: {produto.codigo || '--'}
                      </Text>
                    </View>

                    <View style={styles.stockBox}>
                      <Text style={styles.stockLabel}>Estoque</Text>
                      <Text
                        style={[
                          styles.stockValue,
                          Number(produto.quantidade || 0) <=
                            Number(produto.estoqueMinimo || 0) &&
                            styles.stockLow,
                        ]}
                      >
                        {fmt3(produto.quantidade || 0)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.productDetails}>
                    <Text style={styles.detailText}>
                      Custo: R$ {fmt(produto.precoEntrada || 0)}
                    </Text>
                    <Text style={styles.detailText}>
                      Venda: R$ {fmt(produto.precoVenda || 0)}
                    </Text>
                    <Text style={styles.detailText}>
                      Mínimo: {fmt3(produto.estoqueMinimo || 0)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ================================================= */}
        {/* ESTOQUE BAIXO */}
        {/* ================================================= */}

        {aba === 'baixo' && (
          <View>
            {produtosBaixoEstoque.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Estoque normal</Text>
                <Text style={styles.emptyText}>
                  Nenhum produto está abaixo do estoque mínimo.
                </Text>
              </View>
            ) : (
              produtosBaixoEstoque.map((produto) => (
                <View key={produto.id} style={styles.lowStockCard}>
                  <View style={styles.lowStockTop}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{produto.nome}</Text>
                      <Text style={styles.productCode}>
                        Código: {produto.codigo || '--'}
                      </Text>
                    </View>

                    <View style={styles.lowStockBadge}>
                      <Text style={styles.lowStockBadgeText}>REPOR</Text>
                    </View>
                  </View>

                  <View style={styles.lowStockDetails}>
                    <View>
                      <Text style={styles.detailLabel}>Atual</Text>
                      <Text style={styles.detailValueRed}>
                        {fmt3(produto.quantidade || 0)}
                      </Text>
                    </View>

                    <View>
                      <Text style={styles.detailLabel}>Mínimo</Text>
                      <Text style={styles.detailValue}>
                        {fmt3(produto.estoqueMinimo || 0)}
                      </Text>
                    </View>

                    <View>
                      <Text style={styles.detailLabel}>Venda</Text>
                      <Text style={styles.detailValue}>
                        R$ {fmt(produto.precoVenda || 0)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ================================================= */}
        {/* AVARIAS */}
        {/* ================================================= */}

        {aba === 'avarias' && (
          <View>
            {avarias.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nenhuma avaria</Text>
                <Text style={styles.emptyText}>
                  Não existem avarias registradas.
                </Text>
              </View>
            ) : (
              avarias.map((avaria) => (
                <View key={avaria.id} style={styles.avariaCard}>
                  <View style={styles.avariaHeader}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>
                        {avaria.produtoNome || `Produto #${avaria.produtoId}`}
                      </Text>
                      <Text style={styles.productCode}>
                        Código: {avaria.codigo || '--'}
                      </Text>
                    </View>

                    <Text style={styles.avariaQuantity}>
                      -{fmt3(avaria.quantidade)}
                    </Text>
                  </View>

                  <Text style={styles.avariaReason}>
                    Motivo: {avaria.motivo || '--'}
                  </Text>

                  {!!avaria.observacao && (
                    <Text style={styles.avariaObservation}>
                      {avaria.observacao}
                    </Text>
                  )}

                  <View style={styles.avariaFooter}>
                    <Text style={styles.detailText}>
                      Custo: R$ {fmt(avaria.precoCusto || 0)}
                    </Text>
                    <Text style={styles.detailText}>
                      Perda: R${' '}
                      {fmt(
                        Number(avaria.quantidade || 0) *
                          Number(avaria.precoCusto || 0)
                      )}
                    </Text>
                    <Text style={styles.dateText}>
                      {formatarData(avaria.data)}
                    </Text>
                  </View>
                </View>
              ))
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
              onChangeText={setBusca}
            />

            <View style={styles.salesHeader}>
              <Text style={styles.salesHeaderTitle}>Vendas realizadas</Text>
              <Text style={styles.salesHeaderCount}>
                {vendasFiltradas.length} venda(s)
              </Text>
            </View>

            {vendasFiltradas.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nenhuma venda encontrada</Text>
                <Text style={styles.emptyText}>
                  Ainda não existem vendas ou a pesquisa não encontrou
                  resultados.
                </Text>
              </View>
            ) : (
              vendasFiltradas.map((venda) => {
                const expandida = !!vendasExpandidas[venda.id];

                return (
                  <View key={venda.id} style={styles.saleCard}>
                    <TouchableOpacity
                      onPress={() => toggleVenda(venda.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.saleHeader}>
                        <View style={styles.saleTitleArea}>
                          <Text style={styles.saleTitle}>
                            Venda: {venda.id}
                          </Text>
                          {/* Tocar na data (ou em qualquer parte do
                              cabeçalho) expande o detalhe da venda:
                              forma de pagamento e mercadoria vendida. */}
                          <Text style={styles.saleDate}>
                            {formatarData(venda.createdAt)}
                          </Text>
                        </View>

                        <View style={styles.saleTotalArea}>
                          <Text style={styles.saleTotalLabel}>Total</Text>
                          <Text style={styles.saleTotal}>
                            R$ {fmt(venda.total || 0)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.saleInfoGrid}>
                        <View style={styles.saleInfoItem}>
                          <Text style={styles.saleInfoLabel}>Pagamento</Text>
                          <Text style={styles.saleInfoValue}>
                            {nomeFormaPagamento(venda.formaPagamento)}
                          </Text>
                        </View>

                        <View style={styles.saleInfoItem}>
                          <Text style={styles.saleInfoLabel}>Caixa</Text>
                          <Text style={styles.saleInfoValue}>
                            #{venda.caixaId || '--'}
                          </Text>
                        </View>

                        <View style={styles.saleInfoItem}>
                          <Text style={styles.saleInfoLabel}>Operador</Text>
                          <Text style={styles.saleInfoValue}>
                            #{venda.operadorId || '--'}
                          </Text>
                        </View>

                        <View style={styles.saleInfoItem}>
                          <Text style={styles.saleInfoLabel}>Itens</Text>
                          <Text style={styles.saleInfoValue}>
                            {(venda.itens || []).length}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.expandButton}>
                        <Text style={styles.expandButtonText}>
                          {expandida ? 'Ocultar produtos ▲' : 'Ver produtos ▼'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {expandida && (
                      <View style={styles.saleDetails}>
                        <Text style={styles.saleDetailsTitle}>
                          Produtos da venda
                        </Text>

                        {(venda.itens || []).map((item, index) => (
                          <View
                            key={item.id || `${venda.id}-${index}`}
                            style={styles.saleItem}
                          >
                            <View style={styles.saleItemMain}>
                              <Text style={styles.saleItemName}>
                                {item.produto?.nome ||
                                  `Produto #${item.produtoId}`}
                              </Text>

                              <Text style={styles.saleItemCode}>
                                Código: {item.produto?.codigo || '--'}
                              </Text>

                              {!!item.produto?.ean && (
                                <Text style={styles.saleItemCode}>
                                  EAN: {item.produto.ean}
                                </Text>
                              )}
                            </View>

                            <View style={styles.saleItemValues}>
                              <Text style={styles.saleItemQuantity}>
                                {fmt3(item.quantidade)} x R${' '}
                                {fmt(item.precoUnitario)}
                              </Text>
                              <Text style={styles.saleItemSubtotal}>
                                R$ {fmt(item.subtotal)}
                              </Text>
                            </View>
                          </View>
                        ))}

                        <View style={styles.paymentDetails}>
                          <View style={styles.paymentRow}>
                            <Text style={styles.paymentLabel}>
                              Forma de pagamento
                            </Text>
                            <Text style={styles.paymentValue}>
                              {nomeFormaPagamento(venda.formaPagamento)}
                            </Text>
                          </View>

                          <View style={styles.paymentRow}>
                            <Text style={styles.paymentLabel}>Valor pago</Text>
                            <Text style={styles.paymentValue}>
                              R$ {fmt(venda.valorPago || 0)}
                            </Text>
                          </View>

                          <View style={styles.paymentRow}>
                            <Text style={styles.paymentLabel}>Troco</Text>
                            <Text style={styles.paymentValue}>
                              R$ {fmt(venda.troco || 0)}
                            </Text>
                          </View>

                          {!!venda.mercadoPagoId && (
                            <View style={styles.paymentRow}>
                              <Text style={styles.paymentLabel}>
                                Mercado Pago
                              </Text>
                              <Text
                                style={styles.paymentValueSmall}
                                numberOfLines={1}
                              >
                                {venda.mercadoPagoId}
                              </Text>
                            </View>
                          )}

                          <View style={styles.paymentTotalRow}>
                            <Text style={styles.paymentTotalLabel}>
                              TOTAL DA VENDA
                            </Text>
                            <Text style={styles.paymentTotal}>
                              R$ {fmt(venda.total || 0)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Venda Ágil PDV</Text>
          <Text style={styles.footerSubtext}>
            Relatório atualizado em {new Date().toLocaleString('pt-BR')}
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
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { fontSize: 25, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  errorBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
  },
  errorText: { color: '#991b1b', fontSize: 14 },

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
  cardLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  cardValue: { fontSize: 25, fontWeight: '800', color: '#111827', marginTop: 5 },
  cardValueSmall: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
  },
  cardDescription: { fontSize: 11, color: '#9ca3af', marginTop: 4 },

  salesSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  salesSummaryLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
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
  // DASHBOARD
  // ===================================================

  dashboardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  dashboardCardTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  dashboardCardHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    marginBottom: 12,
  },

  barChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barChartCol: { flex: 1, alignItems: 'center' },
  barChartValue: { fontSize: 9, color: '#6b7280', marginBottom: 4, height: 12 },
  barChartTrack: {
    width: 22,
    height: 110,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barChartFill: {
    width: '100%',
    minHeight: 4,
    borderRadius: 6,
    backgroundColor: '#93c5fd',
  },
  barChartFillSelecionada: { backgroundColor: '#2563eb' },
  barChartLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 6,
    fontWeight: '600',
  },
  barChartLabelSelecionada: { color: '#2563eb', fontWeight: '800' },

  diaDetalhe: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  diaDetalheHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  diaDetalheTitulo: { fontSize: 13, fontWeight: '800', color: '#111827' },
  diaDetalheTotal: { fontSize: 14, fontWeight: '800', color: '#2563eb' },
  diaDetalheSubtitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  diaDetalheLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  diaDetalheLinhaLabel: { flex: 1, fontSize: 12, color: '#374151', paddingRight: 8 },
  diaDetalheLinhaValor: { fontSize: 12, fontWeight: '700', color: '#111827' },

  hBarRow: { marginBottom: 12 },
  hBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  hBarLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    paddingRight: 8,
  },
  hBarValue: { fontSize: 12, fontWeight: '800', color: '#111827' },
  hBarTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  hBarFill: { height: '100%', borderRadius: 6, backgroundColor: '#2563eb' },
  hBarFillVerde: { backgroundColor: '#16a34a' },

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
  alertNumber: { fontSize: 22, fontWeight: '800', color: '#dc2626' },
  alertNumberSmall: { fontSize: 17, fontWeight: '800', color: '#dc2626' },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 3 },
  alertDescription: { fontSize: 11, color: '#9ca3af', marginTop: 3 },

  // ===================================================
  // MENUS
  // ===================================================

  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
    elevation: 1,
  },
  tab: {
    flexGrow: 1,
    flexBasis: '25%',
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 11, color: '#6b7280', fontWeight: '700' },
  tabTextActive: { color: '#ffffff' },

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
  productHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  productInfo: { flex: 1, paddingRight: 10 },
  productName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  productBrand: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  productCode: { fontSize: 11, color: '#9ca3af', marginTop: 5 },
  stockBox: { alignItems: 'flex-end' },
  stockLabel: { fontSize: 11, color: '#9ca3af' },
  stockValue: { fontSize: 20, fontWeight: '800', color: '#16a34a' },
  stockLow: { color: '#dc2626' },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 12,
    paddingTop: 10,
  },
  detailText: { fontSize: 12, color: '#6b7280' },

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
  lowStockTop: { flexDirection: 'row', justifyContent: 'space-between' },
  lowStockBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    height: 28,
  },
  lowStockBadgeText: { fontSize: 10, fontWeight: '800', color: '#b91c1c' },
  lowStockDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  detailLabel: { fontSize: 11, color: '#9ca3af' },
  detailValue: { fontSize: 14, color: '#374151', fontWeight: '700', marginTop: 2 },
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
  avariaHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  avariaQuantity: { fontSize: 18, fontWeight: '800', color: '#dc2626' },
  avariaReason: { fontSize: 13, color: '#374151', marginTop: 12 },
  avariaObservation: { fontSize: 12, color: '#6b7280', marginTop: 5 },
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
  dateText: { fontSize: 11, color: '#9ca3af' },

  // ===================================================
  // VENDAS
  // ===================================================

  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  salesHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  salesHeaderCount: { fontSize: 12, color: '#6b7280' },

  saleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15 },
  saleTitleArea: { flex: 1 },
  saleTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  saleDate: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  saleTotalArea: { alignItems: 'flex-end' },
  saleTotalLabel: { fontSize: 10, color: '#9ca3af' },
  saleTotal: { fontSize: 19, fontWeight: '800', color: '#16a34a', marginTop: 2 },

  saleInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  saleInfoItem: { width: '50%', marginBottom: 8 },
  saleInfoLabel: { fontSize: 10, color: '#9ca3af' },
  saleInfoValue: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 2 },

  expandButton: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 11,
    alignItems: 'center',
  },
  expandButtonText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },

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
  saleItemMain: { flex: 1, paddingRight: 10 },
  saleItemName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  saleItemCode: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  saleItemValues: { alignItems: 'flex-end' },
  saleItemQuantity: { fontSize: 11, color: '#6b7280' },
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
  paymentLabel: { fontSize: 12, color: '#6b7280' },
  paymentValue: { fontSize: 12, fontWeight: '700', color: '#374151' },
  paymentValueSmall: { maxWidth: '55%', fontSize: 10, color: '#6b7280' },
  paymentTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 10,
  },
  paymentTotalLabel: { fontSize: 12, fontWeight: '800', color: '#111827' },
  paymentTotal: { fontSize: 17, fontWeight: '800', color: '#16a34a' },

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
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#374151', marginBottom: 5 },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

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
  footerText: { fontSize: 13, fontWeight: '800', color: '#6b7280' },
  footerSubtext: { fontSize: 10, color: '#9ca3af', marginTop: 3 },
});