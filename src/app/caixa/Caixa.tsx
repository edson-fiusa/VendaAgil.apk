import { useEffect, useMemo, useRef, useState } from 'react';

import {
    ActivityIndicator,
    Alert,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { CameraView, useCameraPermissions } from 'expo-camera';

import { obterBanco } from '../../database/banco';
import { useOrientacaoDispositivo } from '../../useOrientacaoDispositivo';

import { estilosModais } from './EstilosModais';
import { dinheiro, fmt, numero } from './FormatacaoCaixa';
import { PixModal } from './PixModal';
import { usePix } from './UsePix';

type Produto = {
  id: number;
  codigo?: string;
  ean?: string;
  nome: string;
  marca?: string;
  categoria?: string;
  unidade?: string;
  precoVenda?: number | string;
  quantidade?: number | string;
  ativo?: boolean | number;
};

type ItemCarrinho = {
  produtoId: number;
  nome: string;
  preco: number;
  unidade: string;
  quantidade: number;
};

type FormaPagamento = 'dinheiro' | 'pix' | 'outros';

type Fechamento = {
  saldoInicial: number;
  dinheiro: number;
  pix: number;
  outros: number;
  totalVendas: number;
  quantidadeVendas: number;
  dinheiroEsperado: number;
};

type VendaConcluida = {
  id: number;
  itens: ItemCarrinho[];
  total: number;
  formaPagamento: FormaPagamento;
  valorRecebido: number;
  troco: number;
  data: string;
};

type CaixaProps = {
  operador: any;
  caixa: any;
  onLogout: () => void;
  toast?: (mensagem: string) => void;
};

function fmt3(valor: any): string {
  return numero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function nomeFormaPagamento(forma: FormaPagamento): string {
  if (forma === 'pix') return 'PIX';
  if (forma === 'outros') return 'Outros';
  return 'Dinheiro';
}

export default function Caixa({
  operador,
  caixa,
  onLogout,
  toast,
}: CaixaProps) {

  const { isTablet, isLadoALado } = useOrientacaoDispositivo();

  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  const [pagamento, setPagamento] = useState<FormaPagamento>(
    'dinheiro'
  );

  const [valorPago, setValorPago] = useState('');
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const [cameraAberta, setCameraAberta] = useState(false);
  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const [cupom, setCupom] = useState(false);
  const [vendaConcluida, setVendaConcluida] = useState<VendaConcluida | null>(null);

  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [modalFechamento, setModalFechamento] = useState(false);
  const [saldoFinal, setSaldoFinal] = useState('');

  const [flashProduto, setFlashProduto] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const [tecladoAltura, setTecladoAltura] = useState(0);

  useEffect(() => {
    carregarProdutos();
  }, []);

  // Altura do teclado: usada no modo deitado para dar espaço extra no
  // final das listas e permitir rolar até o último item com o teclado aberto.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setTecladoAltura(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setTecladoAltura(0)
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function mostrarToast(mensagem: string) {
    if (toast) {
      toast(mensagem);
      return;
    }

    Alert.alert('Caixa', mensagem);
  }

  async function carregarProdutos() {
    try {
      setCarregandoProdutos(true);

      const db = await obterBanco();

      const resultado = await db.getAllAsync<any>(`
        SELECT
          id,
          codigo,
          ean,
          nome,
          marca,
          categoria,
          unidade,
          preco_venda,
          quantidade,
          ativo
        FROM produtos_local
        WHERE ativo = 1
        ORDER BY nome COLLATE NOCASE ASC
      `);

      const lista: Produto[] = resultado.map((p: any) => ({
        id: Number(p.id),
        codigo: p.codigo ?? '',
        ean: p.ean ?? '',
        nome: p.nome ?? '',
        marca: p.marca ?? '',
        categoria: p.categoria ?? '',
        unidade: p.unidade ?? 'UN',
        precoVenda: numero(p.preco_venda),
        quantidade: numero(p.quantidade),
        ativo: Number(p.ativo) === 1,
      }));

      setProdutos(lista);
    } catch (erro) {
      console.error('ERRO AO CARREGAR PRODUTOS DO SQLITE:', erro);
      mostrarToast('Não foi possível carregar os produtos.');
    } finally {
      setCarregandoProdutos(false);
    }
  }

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return [];
    }

    return produtos
      .filter((produto) => {
        return (
          String(produto.codigo ?? '')
            .toLowerCase()
            .includes(termo) ||
          String(produto.ean ?? '')
            .toLowerCase()
            .includes(termo) ||
          String(produto.nome ?? '')
            .toLowerCase()
            .includes(termo) ||
          String(produto.categoria ?? '')
            .toLowerCase()
            .includes(termo) ||
          String(produto.marca ?? '')
            .toLowerCase()
            .includes(termo)
        );
      })
      .slice(0, 100);
  }, [busca, produtos]);

  const total = useMemo(() => {
    return dinheiro(
      carrinho.reduce(
        (soma, item) => soma + item.preco * item.quantidade,
        0
      )
    );
  }, [carrinho]);

  const quantidadeItens = useMemo(() => {
    return carrinho.reduce(
      (soma, item) => soma + item.quantidade,
      0
    );
  }, [carrinho]);

  const troco = useMemo(() => {
    if (pagamento !== 'dinheiro') {
      return 0;
    }

    return dinheiro(Math.max(numero(valorPago) - total, 0));
  }, [valorPago, total, pagamento]);

  function mostrarFlash() {
    setFlashProduto(true);

    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFlashProduto(false);
    });
  }

  function adicionarProduto(produto: Produto) {
    const estoque = numero(produto.quantidade);

    if (estoque <= 0) {
      mostrarToast('Produto sem estoque.');
      return;
    }

    setCarrinho((atual) => {
      const existente = atual.find(
        (item) => item.produtoId === produto.id
      );

      if (existente) {
        if (existente.quantidade + 1 > estoque) {
          mostrarToast('Quantidade maior que o estoque disponível.');
          return atual;
        }

        return atual.map((item) =>
          item.produtoId === produto.id
            ? {
                ...item,
                quantidade: item.quantidade + 1,
              }
            : item
        );
      }

      return [
        ...atual,
        {
          produtoId: produto.id,
          nome: produto.nome,
          preco: numero(produto.precoVenda),
          unidade: produto.unidade || 'UN',
          quantidade: 1,
        },
      ];
    });

    setBusca('');
    mostrarFlash();
  }

  function aumentarQuantidade(item: ItemCarrinho) {
    const produto = produtos.find((p) => p.id === item.produtoId);

    if (!produto) {
      mostrarToast('Produto não encontrado.');
      return;
    }

    const estoque = numero(produto.quantidade);

    if (item.quantidade + 1 > estoque) {
      mostrarToast('Quantidade maior que o estoque disponível.');
      return;
    }

    setCarrinho((atual) =>
      atual.map((produtoCarrinho) =>
        produtoCarrinho.produtoId === item.produtoId
          ? {
              ...produtoCarrinho,
              quantidade: produtoCarrinho.quantidade + 1,
            }
          : produtoCarrinho
      )
    );
  }

  function diminuirQuantidade(item: ItemCarrinho) {
    setCarrinho((atual) =>
      atual
        .map((produtoCarrinho) =>
          produtoCarrinho.produtoId === item.produtoId
            ? {
                ...produtoCarrinho,
                quantidade: produtoCarrinho.quantidade - 1,
              }
            : produtoCarrinho
        )
        .filter((produtoCarrinho) => produtoCarrinho.quantidade > 0)
    );
  }

  function removerItem(item: ItemCarrinho) {
    setCarrinho((atual) =>
      atual.filter(
        (produtoCarrinho) =>
          produtoCarrinho.produtoId !== item.produtoId
      )
    );
  }

  async function abrirCamera() {
    try {
      if (!cameraPermission?.granted) {
        const permissao = await requestCameraPermission();

        if (!permissao.granted) {
          Alert.alert(
            'Permissão necessária',
            'Permita o acesso à câmera para ler o código de barras.'
          );
          return;
        }
      }

      setCameraAberta(true);
    } catch (erro) {
      console.error('ERRO AO ABRIR CAMERA:', erro);
      Alert.alert(
        'Câmera',
        'Não foi possível abrir a câmera.'
      );
    }
  }

  function fecharCamera() {
    setCameraAberta(false);
  }

  function processarCodigoLido(codigo: string) {
    const codigoLimpo = String(codigo ?? '').trim();

    if (!codigoLimpo) {
      return;
    }

    setCameraAberta(false);
    setBusca(codigoLimpo);

    const produto = produtos.find(
      (p) =>
        String(p.codigo ?? '').trim() === codigoLimpo ||
        String(p.ean ?? '').trim() === codigoLimpo
    );

    if (!produto) {
      mostrarToast(
        `Produto com código ${codigoLimpo} não encontrado.`
      );
      return;
    }

    adicionarProduto(produto);
  }

  async function registrarVendaLocal(
    forma: FormaPagamento,
    mercadoPagoId?: string | null
  ) {
    if (!carrinho.length) {
      throw new Error('Carrinho vazio.');
    }

    const db = await obterBanco();

    const agora = new Date().toISOString();

    const valorRecebido =
      forma === 'dinheiro' ? dinheiro(valorPago) : total;

    if (forma === 'dinheiro' && valorRecebido < total) {
      throw new Error('O valor recebido é menor que o total.');
    }

    const trocoVenda =
      forma === 'dinheiro'
        ? dinheiro(Math.max(valorRecebido - total, 0))
        : 0;

    const observacao = mercadoPagoId
      ? `Mercado Pago: ${mercadoPagoId}`
      : null;

    const vendaResult = await db.runAsync(
      `
        INSERT INTO vendas_local (
          caixa_id,
          operador_id,
          total,
          forma_pagamento,
          status,
          valor_recebido,
          troco,
          observacao,
          criado_em,
          sincronizado
        )
        VALUES (?, ?, ?, ?, 'finalizada', ?, ?, ?, ?, 0)
      `,
      Number(caixa?.id ?? 0),
      Number(operador?.id ?? 0),
      total,
      forma,
      valorRecebido,
      trocoVenda,
      observacao,
      agora
    );

    const vendaId = Number(vendaResult.lastInsertRowId);

    if (!vendaId) {
      throw new Error('Não foi possível criar a venda local.');
    }

    for (const item of carrinho) {
      const produtoAtual = await db.getFirstAsync<any>(
        `
          SELECT
            id,
            codigo,
            nome,
            quantidade,
            preco_venda,
            unidade
          FROM produtos_local
          WHERE id = ?
          LIMIT 1
        `,
        item.produtoId
      );

      if (!produtoAtual) {
        throw new Error(
          `Produto "${item.nome}" não foi encontrado.`
        );
      }

      const estoqueAnterior = numero(produtoAtual.quantidade);

      if (estoqueAnterior < item.quantidade) {
        throw new Error(
          `Estoque insuficiente para "${produtoAtual.nome}".`
        );
      }

      const estoqueNovo = dinheiro(
        estoqueAnterior - item.quantidade
      );

      const subtotal = dinheiro(
        item.preco * item.quantidade
      );

      await db.runAsync(
        `
          INSERT INTO itens_venda_local (
            venda_id,
            produto_id,
            codigo,
            nome,
            quantidade,
            preco_unitario,
            subtotal,
            sincronizado
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `,
        vendaId,
        item.produtoId,
        produtoAtual.codigo ?? '',
        produtoAtual.nome ?? item.nome,
        item.quantidade,
        item.preco,
        subtotal
      );

      const updateProduto = await db.runAsync(
        `
          UPDATE produtos_local
          SET
            quantidade = ?,
            sincronizado = 0,
            atualizado_em = ?
          WHERE id = ?
            AND quantidade >= ?
        `,
        estoqueNovo,
        agora,
        item.produtoId,
        item.quantidade
      );

      if (Number(updateProduto.changes ?? 0) !== 1) {
        throw new Error(
          `Não foi possível atualizar o estoque de "${item.nome}".`
        );
      }

      await db.runAsync(
        `
          INSERT INTO movimentacoes_estoque_local (
            produto_id,
            tipo,
            quantidade,
            quantidade_anterior,
            quantidade_nova,
            motivo,
            referencia_id,
            operador_id,
            criado_em,
            sincronizado
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `,
        item.produtoId,
        'saida_venda',
        item.quantidade,
        estoqueAnterior,
        estoqueNovo,
        'Venda',
        vendaId,
        Number(operador?.id ?? 0),
        agora
      );
    }

    return {
      vendaId,
      total,
      valorRecebido,
      troco: trocoVenda,
      formaPagamento: forma,
    };
  }

  async function finalizarVendaLocal(
    forma: FormaPagamento,
    mercadoPagoId?: string | null
  ) {
    try {
      setFinalizando(true);

      const resultado = await registrarVendaLocal(
        forma,
        mercadoPagoId
      );

      setVendaConcluida({
        id: resultado.vendaId,
        itens: [...carrinho],
        total: resultado.total,
        formaPagamento: forma,
        valorRecebido: resultado.valorRecebido,
        troco: resultado.troco,
        data: new Date().toLocaleString('pt-BR'),
      });

      setCarrinho([]);
      setValorPago('');
      pix.cancelarPix();
      setCupom(true);

      await carregarProdutos();
    } catch (erro: any) {
      console.error('ERRO AO FINALIZAR VENDA LOCAL:', erro);

      Alert.alert(
        'Erro ao finalizar venda',
        erro?.message ||
          'Não foi possível finalizar a venda. O pagamento PIX pode já ' +
          'ter sido aprovado no Mercado Pago: confira lá antes de tentar novamente.'
      );

      pix.liberarProcessamentoPix();
    } finally {
      setFinalizando(false);
    }
  }

  // ============================================================
  // PIX (Mercado Pago) — toda a lógica vive em usePix.ts; aqui só
  // conectamos o resultado (aprovação) com a gravação da venda.
  // ============================================================

  const pix = usePix({
    temItensNoCarrinho: carrinho.length > 0,
    total,
    operador,
    caixa,
    mostrarToast,
    aoAprovar: (mercadoPagoId) =>
      finalizarVendaLocal('pix', mercadoPagoId),
  });

  async function carregarResumoCaixa() {
    try {
      const db = await obterBanco();

      const linhas = await db.getAllAsync<any>(
        `
          SELECT
            forma_pagamento,
            COALESCE(SUM(total), 0) AS total,
            COUNT(*) AS quantidade
          FROM vendas_local
          WHERE caixa_id = ?
            AND status = 'finalizada'
          GROUP BY forma_pagamento
        `,
        Number(caixa?.id ?? 0)
      );

      let dinheiroTotal = 0;
      let pixTotal = 0;
      let outrosTotal = 0;
      let totalVendas = 0;
      let quantidadeVendas = 0;

      for (const linha of linhas) {
        const forma = String(
          linha.forma_pagamento ?? ''
        ).toLowerCase();

        const valor = dinheiro(linha.total);
        const quantidade = Number(linha.quantidade ?? 0);

        totalVendas += valor;
        quantidadeVendas += quantidade;

        if (forma === 'dinheiro') {
          dinheiroTotal += valor;
        } else if (forma === 'pix') {
          pixTotal += valor;
        } else {
          outrosTotal += valor;
        }
      }

      const saldoInicial = dinheiro(
        caixa?.saldoInicial ?? caixa?.saldo_inicial ?? 0
      );

      const dinheiroEsperado = dinheiro(
        saldoInicial + dinheiroTotal
      );

      setFechamento({
        saldoInicial,
        dinheiro: dinheiro(dinheiroTotal),
        pix: dinheiro(pixTotal),
        outros: dinheiro(outrosTotal),
        totalVendas: dinheiro(totalVendas),
        quantidadeVendas,
        dinheiroEsperado,
      });

      setSaldoFinal(dinheiro(dinheiroEsperado).toFixed(2));

      setModalFechamento(true);
    } catch (erro) {
      console.error('ERRO AO CARREGAR RESUMO LOCAL:', erro);

      Alert.alert(
        'Erro',
        'Não foi possível carregar o resumo do caixa.'
      );
    }
  }

  async function confirmarEncerramento() {
    if (!fechamento) {
      return;
    }

    const contado = dinheiro(saldoFinal.replace(',', '.'));

    const diferenca = dinheiro(
      contado - fechamento.dinheiroEsperado
    );

    Alert.alert(
      'Encerrar caixa',
      `Valor contado: ${fmt(contado)}\nValor esperado: ${fmt(
        fechamento.dinheiroEsperado
      )}\nDiferença: ${fmt(diferenca)}`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setEncerrando(true);

              const db = await obterBanco();

              const agora = new Date().toISOString();

              const resultado = await db.runAsync(
                `
                    UPDATE caixas_local
                    SET
                      saldo_final = ?,
                      status = 'fechado',
                      fechado_em = ?,
                      sincronizado = 0
                    WHERE id = ?
                  `,
                contado,
                agora,
                Number(caixa?.id ?? 0)
              );

              if (Number(resultado.changes ?? 0) !== 1) {
                throw new Error(
                  'Caixa não encontrado no banco local.'
                );
              }

              setModalFechamento(false);

              Alert.alert(
                'Caixa encerrado',
                `Caixa encerrado com sucesso.\n\nValor final: ${fmt(
                  contado
                )}\nDiferença: ${fmt(diferenca)}`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      onLogout();
                    },
                  },
                ]
              );
            } catch (erro: any) {
              Alert.alert(
                'Erro ao encerrar',
                erro?.message ||
                  'Não foi possível encerrar o caixa.'
              );
            } finally {
              setEncerrando(false);
            }
          },
        },
      ]
    );
  }

  function fecharCupom() {
    setCupom(false);
  }

  // ============================================================
  // BLOCOS REUTILIZÁVEIS (total e pagamento)
  // Em pé: ficam dentro da coluna do carrinho.
  // Deitado: ficam numa barra fixa embaixo, lado a lado.
  // ============================================================

  const blocoTotal = (
    <View style={[styles.resumo, isLadoALado && styles.resumoLadoALado]}>
      <View style={styles.linhaResumo}>
        <Text style={styles.labelResumo}>Subtotal</Text>

        <Text style={styles.valorResumo}>{fmt(total)}</Text>
      </View>

      <View style={styles.linhaTotal}>
        <Text style={styles.labelTotal}>TOTAL</Text>

        <Text style={styles.valorTotal}>{fmt(total)}</Text>
      </View>
    </View>
  );

  const blocoPagamento = (
    <View
      style={[
        styles.areaPagamento,
        isLadoALado && styles.areaPagamentoLadoALado,
      ]}
    >
      {!isLadoALado && (
        <Text style={styles.tituloPagamento}>
          Forma de pagamento
        </Text>
      )}

      <View style={styles.opcoesPagamento}>
        <TouchableOpacity
          style={[
            styles.botaoPagamento,
            pagamento === 'dinheiro' &&
              styles.pagamentoSelecionado,
          ]}
          onPress={() => setPagamento('dinheiro')}
        >
          <Text
            style={[
              styles.pagamentoTexto,
              pagamento === 'dinheiro' &&
                styles.pagamentoTextoSelecionado,
            ]}
          >
            💵 Dinheiro
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.botaoPagamento,
            pagamento === 'pix' &&
              styles.pagamentoSelecionado,
          ]}
          onPress={() => setPagamento('pix')}
        >
          <Text
            style={[
              styles.pagamentoTexto,
              pagamento === 'pix' &&
                styles.pagamentoTextoSelecionado,
            ]}
          >
            📱 PIX
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.botaoPagamento,
            pagamento === 'outros' &&
              styles.pagamentoSelecionado,
          ]}
          onPress={() => setPagamento('outros')}
        >
          <Text
            style={[
              styles.pagamentoTexto,
              pagamento === 'outros' &&
                styles.pagamentoTextoSelecionado,
            ]}
          >
            💳 Outros
          </Text>
        </TouchableOpacity>
      </View>

      <View style={isLadoALado ? styles.linhaAcaoLadoALado : undefined}>
        {pagamento === 'dinheiro' && (
          <>
            <View style={isLadoALado ? { flex: 1 } : undefined}>
              <Text style={styles.labelCampo}>Valor recebido</Text>

              <TextInput
                style={styles.inputValor}
                value={valorPago}
                onChangeText={setValorPago}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#999"
              />

              {numero(valorPago) > 0 &&
                numero(valorPago) < total && (
                  <Text
                    style={{
                      color: '#dc2626',
                      fontSize: 12,
                      fontWeight: '700',
                      marginTop: 5,
                    }}
                  >
                    ⚠️ {isLadoALado
                      ? 'Falta '
                      : 'O valor recebido é menor que o total (Falta '}
                    {fmt(total - numero(valorPago))}
                    {isLadoALado ? '' : ')'}
                  </Text>
                )}
            </View>

            <View
              style={[
                styles.areaTroco,
                isLadoALado && styles.areaTrocoLadoALado,
              ]}
            >
              <Text style={styles.labelTroco}>Troco</Text>

              <Text style={styles.valorTroco}>{fmt(troco)}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.botaoFinalizar,
                isLadoALado && styles.botaoFinalizarFixo,
                (finalizando ||
                  !carrinho.length ||
                  numero(valorPago) < total) &&
                  styles.botaoDesabilitado,
              ]}
              disabled={
                finalizando ||
                !carrinho.length ||
                numero(valorPago) < total
              }
              onPress={() => finalizarVendaLocal('dinheiro')}
            >
              {finalizando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botaoFinalizarTexto}>
                  Finalizar venda
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {pagamento === 'pix' && (
          <TouchableOpacity
            style={[
              styles.botaoFinalizar,
              isLadoALado && styles.botaoFinalizarLargo,
              (pix.pixCarregando ||
                finalizando ||
                !carrinho.length) &&
                styles.botaoDesabilitado,
            ]}
            disabled={
              pix.pixCarregando || finalizando || !carrinho.length
            }
            onPress={pix.gerarPix}
          >
            {pix.pixCarregando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botaoFinalizarTexto}>
                Gerar PIX
              </Text>
            )}
          </TouchableOpacity>
        )}

        {pagamento === 'outros' && (
          <TouchableOpacity
            style={[
              styles.botaoFinalizar,
              isLadoALado && styles.botaoFinalizarLargo,
              (finalizando || !carrinho.length) &&
                styles.botaoDesabilitado,
            ]}
            disabled={finalizando || !carrinho.length}
            onPress={() => finalizarVendaLocal('outros')}
          >
            {finalizando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botaoFinalizarTexto}>
                Finalizar venda
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      enabled={!isLadoALado}
      behavior="height"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>Caixa</Text>

          <Text style={styles.operador}>
            Operador:{' '}
            {operador?.nome ||
              operador?.usuario ||
              'Não identificado'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.botaoEncerrar}
          onPress={carregarResumoCaixa}
          disabled={encerrando}
        >
          <Text style={styles.botaoEncerrarTexto}>
            Encerrar
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.areaBusca,
          isTablet && styles.areaBuscaTablet,
        ]}
      >
        <TextInput
          style={styles.inputBusca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Digite código, EAN ou nome..."
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={styles.botaoCamera}
          onPress={abrirCamera}
        >
          <Text style={styles.cameraTexto}>📷</Text>
        </TouchableOpacity>
      </View>

      {flashProduto && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { opacity: flashAnim }]}
        >
          <Text style={styles.flashTexto}>✓ Produto adicionado</Text>
        </Animated.View>
      )}

      <View style={styles.conteudo}>
        <View
          style={[
            styles.conteudoPrincipal,
            isLadoALado && styles.conteudoLadoALado,
          ]}
        >
          {busca.trim() !== '' && (
            <View
              style={[
                styles.areaProdutos,
                isLadoALado && styles.areaProdutosLadoALado,
              ]}
            >
              <View style={styles.tituloSecao}>
                <Text style={styles.tituloSecaoTexto}>
                  Produtos encontrados
                </Text>

                <Text style={styles.contadorProdutos}>
                  {produtosFiltrados.length}
                </Text>
              </View>

              {carregandoProdutos ? (
                <View style={styles.carregando}>
                  <ActivityIndicator size="large" color="#2563eb" />

                  <Text style={styles.carregandoTexto}>
                    Carregando produtos...
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={[
                    styles.listaProdutos,
                    isLadoALado && styles.listaProdutosLadoALado,
                  ]}
                  contentContainerStyle={
                    isLadoALado
                      ? { paddingBottom: tecladoAltura }
                      : undefined
                  }
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                >
                  {produtosFiltrados.map((produto) => {
                    const estoque = numero(produto.quantidade);

                    return (
                      <View key={produto.id} style={styles.cardProduto}>
                        <View style={styles.infoProduto}>
                          <Text
                            style={styles.nomeProduto}
                            numberOfLines={2}
                          >
                            {produto.nome}
                          </Text>

                          {!!produto.marca && (
                            <Text style={styles.marcaProduto}>
                              {produto.marca}
                            </Text>
                          )}

                          <Text style={styles.codigoProduto}>
                            Cód.: {produto.codigo || '-'}
                            {produto.ean ? ` • EAN: ${produto.ean}` : ''}
                          </Text>

                          <Text style={styles.estoqueProduto}>
                            Estoque: {fmt3(estoque)}{' '}
                            {produto.unidade || 'UN'}
                          </Text>
                        </View>

                        <View style={styles.ladoProduto}>
                          <Text style={styles.precoProduto}>
                            {fmt(produto.precoVenda)}
                          </Text>

                          <TouchableOpacity
                            style={[
                              styles.botaoAdicionar,
                              estoque <= 0 && styles.botaoDesabilitado,
                            ]}
                            disabled={estoque <= 0}
                            onPress={() => adicionarProduto(produto)}
                          >
                            <Text style={styles.botaoAdicionarTexto}>
                              {estoque <= 0
                                ? 'Sem estoque'
                                : 'Adicionar'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}

                  {!produtosFiltrados.length && !carregandoProdutos && (
                    <View style={styles.vazioProdutos}>
                      <Text style={styles.vazioProdutosTitulo}>
                        Nenhum produto encontrado
                      </Text>

                      <Text style={styles.vazioProdutosTexto}>
                        Digite outro código, EAN ou nome.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          <View
            style={[
              styles.areaCarrinho,
              isLadoALado && styles.areaCarrinhoLadoALado,
            ]}
          >
            <View style={styles.cabecalhoCarrinho}>
              <View>
                <Text style={styles.tituloCarrinho}>Carrinho</Text>

                <Text style={styles.quantidadeCarrinho}>
                  {quantidadeItens}{' '}
                  {quantidadeItens === 1 ? 'item' : 'itens'}
                </Text>
              </View>

              {carrinho.length > 0 && (
                <TouchableOpacity onPress={() => setCarrinho([])}>
                  <Text style={styles.limparTexto}>Limpar</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={styles.listaCarrinho}
              contentContainerStyle={
                isLadoALado
                  ? { paddingBottom: tecladoAltura }
                  : undefined
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {carrinho.map((item) => (
                <View key={item.produtoId} style={styles.cardCarrinho}>
                  <View style={styles.infoCarrinho}>
                    <Text style={styles.nomeCarrinho} numberOfLines={2}>
                      {item.nome}
                    </Text>

                    <Text style={styles.precoUnitario}>
                      {fmt(item.preco)} / {item.unidade}
                    </Text>

                    <Text style={styles.subtotal}>
                      {fmt(item.preco * item.quantidade)}
                    </Text>
                  </View>

                  <View style={styles.controlesQuantidade}>
                    <TouchableOpacity
                      style={styles.botaoQuantidade}
                      onPress={() => diminuirQuantidade(item)}
                    >
                      <Text style={styles.botaoQuantidadeTexto}>
                        −
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.quantidadeTexto}>
                      {fmt3(item.quantidade)}
                    </Text>

                    <TouchableOpacity
                      style={styles.botaoQuantidade}
                      onPress={() => aumentarQuantidade(item)}
                    >
                      <Text style={styles.botaoQuantidadeTexto}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.botaoExcluir}
                    onPress={() => removerItem(item)}
                  >
                    <Text style={styles.botaoExcluirTexto}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {!carrinho.length && (
                <View style={styles.carrinhoVazio}>
                  <Text style={styles.carrinhoVazioIcone}>🛒</Text>

                  <Text style={styles.carrinhoVazioTitulo}>
                    Carrinho vazio
                  </Text>

                  <Text style={styles.carrinhoVazioTexto}>
                    Adicione produtos para iniciar uma venda.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Em pé: total e pagamento dentro do carrinho */}
            {!isLadoALado && (
              <>
                {blocoTotal}
                {blocoPagamento}
              </>
            )}
          </View>
        </View>

        {/* Deitado: barra fixa embaixo, total e pagamento lado a lado */}
        {isLadoALado && (
          <View style={styles.barraInferior}>
            {blocoTotal}
            {blocoPagamento}
          </View>
        )}
      </View>

      {/* CAMERA */}
      <Modal
        visible={cameraAberta}
        animationType="slide"
        onRequestClose={fecharCamera}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'code128',
                'code39',
                'code93',
                'itf14',
                'codabar',
              ],
            }}
            onBarcodeScanned={({ data }) => processarCodigoLido(data)}
          />

          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTopo}>
              <TouchableOpacity
                style={styles.botaoFecharCamera}
                onPress={fecharCamera}
              >
                <Text style={styles.botaoFecharCameraTexto}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.cameraTitulo}>
                Ler código de barras
              </Text>
            </View>

            <View style={styles.molduraScanner}>
              <View
                style={[
                  styles.cantoScanner,
                  styles.cantoSuperiorEsquerdo,
                ]}
              />

              <View
                style={[
                  styles.cantoScanner,
                  styles.cantoSuperiorDireito,
                ]}
              />

              <View
                style={[
                  styles.cantoScanner,
                  styles.cantoInferiorEsquerdo,
                ]}
              />

              <View
                style={[
                  styles.cantoScanner,
                  styles.cantoInferiorDireito,
                ]}
              />
            </View>

            <Text style={styles.cameraInstrucao}>
              Aponte a câmera para o código de barras
            </Text>
          </View>
        </View>
      </Modal>

      {/* PIX */}
      <PixModal
        total={total}
        pix={pix.pix}
        pixErro={pix.pixErro}
        pixPago={pix.pixPago}
        pixVerificando={pix.pixVerificando}
        pixAvisoDemora={pix.pixAvisoDemora}
        pixExpiraEm={pix.pixExpiraEm}
        pixTempoRestante={pix.pixTempoRestante}
        onVerificarAgora={(mercadoPagoId) =>
          pix.verificarPagamentoPix(mercadoPagoId, true)
        }
        onFechar={pix.cancelarPix}
      />

      {/* CUPOM / NOTA FISCAL ESTILO RECIBO TÉRMICO */}
      <Modal
        visible={cupom}
        transparent
        animationType="fade"
        onRequestClose={fecharCupom}
      >
        <View style={estilosModais.modalFundo}>
          <View style={styles.modalCupom}>
            <Text style={styles.cupomTitulo}>VENDA ÁGIL PDV</Text>
            <Text style={styles.cupomSubtitulo}>CNPJ: 00.000.000/0001-00</Text>
            <Text style={styles.cupomEndereco}>Comprovante de Venda / Extrato</Text>

            <View style={styles.linhaSeparadorDashed} />

            <View style={styles.cupomInfoGeral}>
              <Text style={styles.cupomTextoInfo}>Venda: #{vendaConcluida?.id}</Text>
              <Text style={styles.cupomTextoInfo}>{vendaConcluida?.data}</Text>
            </View>

            <View style={styles.linhaSeparadorDashed} />

            <Text style={styles.cupomCabecalhoItens}>ITENS DA COMPRA</Text>

            <ScrollView style={styles.cupomListaItens} showsVerticalScrollIndicator={false}>
              {vendaConcluida?.itens.map((item, index) => (
                <View key={index} style={styles.cupomItemLinha}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cupomItemNome} numberOfLines={2}>
                      {item.quantidade} {item.unidade} - {item.nome}
                    </Text>
                    <Text style={styles.cupomItemDetalhe}>
                      {fmt(item.preco)} un x {fmt3(item.quantidade)}
                    </Text>
                  </View>
                  <Text style={styles.cupomItemSubtotal}>
                    {fmt(item.preco * item.quantidade)}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.linhaSeparadorDashed} />

            <View style={styles.cupomResumoValores}>
              <View style={styles.linhaCupomTotal}>
                <Text style={styles.labelCupomTotal}>TOTAL</Text>
                <Text style={styles.valorCupomTotal}>{fmt(vendaConcluida?.total ?? 0)}</Text>
              </View>

              <View style={styles.linhaCupom}>
                <Text style={styles.labelCupom}>Forma de Pagamento</Text>
                <Text style={styles.valorCupom}>
                  {vendaConcluida
                    ? nomeFormaPagamento(vendaConcluida.formaPagamento)
                    : ''}
                </Text>
              </View>

              {vendaConcluida?.formaPagamento === 'dinheiro' && (
                <>
                  <View style={styles.linhaCupom}>
                    <Text style={styles.labelCupom}>Valor Recebido</Text>
                    <Text style={styles.valorCupom}>{fmt(vendaConcluida?.valorRecebido ?? 0)}</Text>
                  </View>
                  <View style={styles.linhaCupom}>
                    <Text style={styles.labelCupom}>Troco</Text>
                    <Text style={styles.valorCupom}>{fmt(vendaConcluida?.troco ?? 0)}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.linhaSeparadorDashed} />

            <Text style={styles.cupomRodape}>Obrigado pela preferência!</Text>
            <Text style={styles.cupomRodapeSub}>Software Venda Ágil</Text>

            <TouchableOpacity
              style={styles.botaoFecharCupom}
              onPress={fecharCupom}
            >
              <Text style={styles.botaoFecharCupomTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FECHAMENTO */}
      <Modal
        visible={modalFechamento}
        transparent
        animationType="slide"
        onRequestClose={() => setModalFechamento(false)}
      >
        <View style={estilosModais.modalFundo}>
          <View style={styles.modalFechamento}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTituloFechamento}>
                Encerrar caixa
              </Text>

              {fechamento && (
                <>
                  <View style={styles.cardResumoFechamento}>
                    <View style={styles.linhaFechamento}>
                      <Text style={styles.labelFechamento}>
                        Saldo inicial
                      </Text>

                      <Text style={styles.valorFechamento}>
                        {fmt(fechamento.saldoInicial)}
                      </Text>
                    </View>

                    <View style={styles.linhaFechamento}>
                      <Text style={styles.labelFechamento}>
                        Vendas em dinheiro
                      </Text>

                      <Text style={styles.valorFechamento}>
                        {fmt(fechamento.dinheiro)}
                      </Text>
                    </View>

                    <View style={styles.linhaFechamento}>
                      <Text style={styles.labelFechamento}>
                        Vendas PIX
                      </Text>

                      <Text style={styles.valorFechamento}>
                        {fmt(fechamento.pix)}
                      </Text>
                    </View>

                    <View style={styles.linhaFechamento}>
                      <Text style={styles.labelFechamento}>
                        Outros
                      </Text>

                      <Text style={styles.valorFechamento}>
                        {fmt(fechamento.outros)}
                      </Text>
                    </View>

                    <View style={styles.linhaFechamento}>
                      <Text style={styles.labelFechamento}>
                        Quantidade de vendas
                      </Text>

                      <Text style={styles.valorFechamento}>
                        {fechamento.quantidadeVendas}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.linhaFechamento,
                        styles.linhaTotalFechamento,
                      ]}
                    >
                      <Text style={styles.labelTotalFechamento}>
                        Total de vendas
                      </Text>

                      <Text style={styles.valorTotalFechamento}>
                        {fmt(fechamento.totalVendas)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.labelCampoFechamento}>
                    Dinheiro esperado no caixa
                  </Text>

                  <Text style={styles.valorEsperado}>
                    {fmt(fechamento.dinheiroEsperado)}
                  </Text>

                  <Text style={styles.labelCampoFechamento}>
                    Dinheiro contado
                  </Text>

                  <TextInput
                    style={styles.inputFechamento}
                    value={saldoFinal}
                    onChangeText={setSaldoFinal}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#999"
                  />

                  <View style={styles.areaBotoesFechamento}>
                    <TouchableOpacity
                      style={styles.botaoCancelarFechamento}
                      onPress={() => setModalFechamento(false)}
                      disabled={encerrando}
                    >
                      <Text style={styles.textoCancelarFechamento}>
                        Cancelar
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.botaoConfirmarFechamento,
                        encerrando && styles.botaoDesabilitado,
                      ]}
                      onPress={confirmarEncerramento}
                      disabled={encerrando}
                    >
                      {encerrando ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.textoConfirmarFechamento}>
                          Encerrar caixa
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },

  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  titulo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },

  operador: {
    marginTop: 3,
    fontSize: 13,
    color: '#6b7280',
  },

  botaoEncerrar: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 9,
  },

  botaoEncerrarTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  areaBusca: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  areaBuscaTablet: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },

  inputBusca: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 14,
    color: '#111827',
    backgroundColor: '#fff',
    fontSize: 15,
  },

  botaoCamera: {
    width: 48,
    height: 46,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraTexto: {
    fontSize: 23,
  },

  flash: {
    position: 'absolute',
    top: 122,
    left: 20,
    right: 20,
    zIndex: 50,
    backgroundColor: '#16a34a',
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: 'center',
  },

  flashTexto: {
    color: '#fff',
    fontWeight: '700',
  },

  conteudo: {
    flex: 1,
  },

  conteudoPrincipal: {
    flex: 1,
    minHeight: 0,
  },

  conteudoLadoALado: {
    flexDirection: 'row',
  },

  barraInferior: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },

  areaProdutos: {
    backgroundColor: '#f5f6f8',
    maxHeight: 230,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },

  areaProdutosLadoALado: {
    flex: 1,
    maxHeight: undefined,
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
  },

  tituloSecao: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 8,
  },

  tituloSecaoTexto: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  contadorProdutos: {
    marginLeft: 8,
    minWidth: 26,
    textAlign: 'center',
    backgroundColor: '#e5e7eb',
    color: '#374151',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
  },

  listaProdutos: {
    paddingHorizontal: 15,
    maxHeight: 175,
  },

  listaProdutosLadoALado: {
    maxHeight: undefined,
    flex: 1,
  },

  cardProduto: {
    backgroundColor: '#fff',
    borderRadius: 11,
    padding: 12,
    marginBottom: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  infoProduto: {
    flex: 1,
    paddingRight: 10,
  },

  nomeProduto: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  marcaProduto: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  codigoProduto: {
    marginTop: 5,
    fontSize: 11,
    color: '#6b7280',
  },

  estoqueProduto: {
    marginTop: 3,
    fontSize: 11,
    color: '#374151',
  },

  ladoProduto: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  precoProduto: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  botaoAdicionar: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  botaoAdicionarTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  botaoDesabilitado: {
    opacity: 0.45,
  },

  vazioProdutos: {
    padding: 35,
    alignItems: 'center',
  },

  vazioProdutosTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },

  vazioProdutosTexto: {
    marginTop: 5,
    fontSize: 13,
    color: '#6b7280',
  },

  carregando: {
    paddingTop: 50,
    alignItems: 'center',
  },

  carregandoTexto: {
    marginTop: 10,
    color: '#6b7280',
  },

  areaCarrinho: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    minHeight: 0,
  },

  areaCarrinhoLadoALado: {
    borderTopWidth: 0,
    flex: 1,
  },

  cabecalhoCarrinho: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  tituloCarrinho: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  quantidadeCarrinho: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },

  limparTexto: {
    color: '#dc2626',
    fontWeight: '700',
  },

  listaCarrinho: {
    flex: 1,
    paddingHorizontal: 15,
  },

  cardCarrinho: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  infoCarrinho: {
    flex: 1,
    paddingRight: 7,
  },

  nomeCarrinho: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },

  precoUnitario: {
    marginTop: 3,
    fontSize: 11,
    color: '#6b7280',
  },

  subtotal: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },

  controlesQuantidade: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  botaoQuantidade: {
    width: 31,
    height: 31,
    borderRadius: 7,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoQuantidadeTexto: {
    fontSize: 20,
    color: '#111827',
    lineHeight: 22,
  },

  quantidadeTexto: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },

  botaoExcluir: {
    marginLeft: 8,
    width: 30,
    alignItems: 'center',
  },

  botaoExcluirTexto: {
    fontSize: 17,
  },

  carrinhoVazio: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 25,
  },

  carrinhoVazioIcone: {
    fontSize: 32,
  },

  carrinhoVazioTitulo: {
    marginTop: 7,
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },

  carrinhoVazioTexto: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },

  resumo: {
    paddingHorizontal: 15,
    paddingTop: 9,
  },

  resumoLadoALado: {
    width: 240,
    justifyContent: 'center',
    paddingBottom: 9,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },

  linhaResumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },

  labelResumo: {
    color: '#6b7280',
    fontSize: 13,
  },

  valorResumo: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },

  linhaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  labelTotal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },

  valorTotal: {
    fontSize: 21,
    fontWeight: '900',
    color: '#2563eb',
  },

  areaPagamento: {
    padding: 15,
  },

  areaPagamentoLadoALado: {
    flex: 1,
    paddingVertical: 10,
  },

  tituloPagamento: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },

  opcoesPagamento: {
    flexDirection: 'row',
    gap: 8,
  },

  botaoPagamento: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  pagamentoSelecionado: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },

  pagamentoTexto: {
    color: '#374151',
    fontWeight: '700',
  },

  pagamentoTextoSelecionado: {
    color: '#fff',
  },

  linhaAcaoLadoALado: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },

  labelCampo: {
    marginTop: 10,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },

  inputValor: {
    height: 45,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 13,
    fontSize: 17,
    color: '#111827',
    backgroundColor: '#fff',
  },

  areaTroco: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },

  areaTrocoLadoALado: {
    marginTop: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 48,
  },

  labelTroco: {
    fontSize: 13,
    color: '#6b7280',
  },

  valorTroco: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16a34a',
  },

  botaoFinalizar: {
    marginTop: 10,
    height: 48,
    borderRadius: 9,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoFinalizarFixo: {
    marginTop: 0,
    width: 170,
  },

  botaoFinalizarLargo: {
    marginTop: 10,
    flex: 1,
  },

  botaoFinalizarTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },

  camera: {
    flex: 1,
  },

  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cameraTopo: {
    width: '100%',
    paddingTop: 55,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  botaoFecharCamera: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoFecharCameraTexto: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  cameraTitulo: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 15,
  },

  molduraScanner: {
    width: '75%',
    height: 180,
    position: 'relative',
  },

  cantoScanner: {
    position: 'absolute',
    width: 35,
    height: 35,
    borderColor: '#fff',
  },

  cantoSuperiorEsquerdo: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },

  cantoSuperiorDireito: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },

  cantoInferiorEsquerdo: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },

  cantoInferiorDireito: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },

  cameraInstrucao: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9,
    marginBottom: 70,
    fontSize: 14,
  },

  modalCupom: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
    backgroundColor: '#fffdf9',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  cupomTitulo: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },

  cupomSubtitulo: {
    textAlign: 'center',
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },

  cupomEndereco: {
    textAlign: 'center',
    fontSize: 11,
    color: '#374151',
    marginTop: 2,
    fontWeight: '600',
  },

  linhaSeparadorDashed: {
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderStyle: 'dashed',
    marginVertical: 8,
  },

  cupomInfoGeral: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cupomTextoInfo: {
    fontSize: 11,
    color: '#4b5563',
  },

  cupomCabecalhoItens: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },

  cupomListaItens: {
    maxHeight: 160,
  },

  cupomItemLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },

  cupomItemNome: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },

  cupomItemDetalhe: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 1,
  },

  cupomItemSubtotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1f2937',
    marginLeft: 8,
  },

  cupomResumoValores: {
    marginVertical: 2,
  },

  linhaCupom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },

  labelCupom: {
    fontSize: 12,
    color: '#6b7280',
  },

  valorCupom: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },

  linhaCupomTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },

  labelCupomTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },

  valorCupomTotal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2563eb',
  },

  cupomRodape: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4,
  },

  cupomRodapeSub: {
    textAlign: 'center',
    fontSize: 10,
    color: '#9ca3af',
    marginBottom: 12,
  },

  botaoFecharCupom: {
    backgroundColor: '#2563eb',
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoFecharCupomTexto: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  modalFechamento: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
  },

  modalTituloFechamento: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 15,
  },

  cardResumoFechamento: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  linhaFechamento: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },

  labelFechamento: {
    color: '#6b7280',
    fontSize: 13,
  },

  valorFechamento: {
    color: '#111827',
    fontWeight: '700',
  },

  linhaTotalFechamento: {
    marginTop: 5,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },

  labelTotalFechamento: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },

  valorTotalFechamento: {
    color: '#2563eb',
    fontSize: 18,
    fontWeight: '900',
  },

  labelCampoFechamento: {
    marginTop: 17,
    marginBottom: 5,
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },

  valorEsperado: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16a34a',
  },

  inputFechamento: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 13,
    fontSize: 18,
    color: '#111827',
  },

  areaBotoesFechamento: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },

  botaoCancelarFechamento: {
    flex: 1,
    height: 48,
    borderRadius: 9,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoCancelarFechamento: {
    color: '#374151',
    fontWeight: '800',
  },

  botaoConfirmarFechamento: {
    flex: 1,
    height: 48,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoConfirmarFechamento: {
    color: '#fff',
    fontWeight: '800',
  },
});