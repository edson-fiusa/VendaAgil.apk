import React, { useState } from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import { obterBanco } from '../../src/database/banco';

type ProdutoForm = {
  codigo: string;
  nome: string;
  precoEntrada: string;
  precoVenda: string;
  quantidade: string;
  estoqueMinimo: string;
  categoria: string;
  unidade: string;
};

export default function CadastroProduto() {
  const [produto, setProduto] = useState<ProdutoForm>({
    codigo: '',
    nome: '',
    precoEntrada: '',
    precoVenda: '',
    quantidade: '0',
    estoqueMinimo: '0',
    categoria: 'Geral',
    unidade: 'unidade',
  });

  const [salvando, setSalvando] = useState(false);
  const [cameraAberta, setCameraAberta] = useState(false);

  const [permission, requestPermission] =
    useCameraPermissions();

  const [lendoCodigo, setLendoCodigo] = useState(false);

  // ---------------------------------------------------------
  // ALTERAR CAMPO
  // ---------------------------------------------------------

  function alterarCampo(
    campo: keyof ProdutoForm,
    valor: string
  ) {
    setProduto((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  // ---------------------------------------------------------
  // LIMPAR FORMULÁRIO
  // ---------------------------------------------------------

  function limparFormulario() {
    setProduto({
      codigo: '',
      nome: '',
      precoEntrada: '',
      precoVenda: '',
      quantidade: '0',
      estoqueMinimo: '0',
      categoria: 'Geral',
      unidade: 'unidade',
    });
  }

  // ---------------------------------------------------------
  // ABRIR CÂMERA
  // ---------------------------------------------------------

  async function abrirCamera() {
    try {
      if (!permission) {
        return;
      }

      if (!permission.granted) {
        const resultado = await requestPermission();

        if (!resultado.granted) {
          Alert.alert(
            'Permissão necessária',
            'Permita o acesso à câmera para ler o código de barras.'
          );

          return;
        }
      }

      setLendoCodigo(false);
      setCameraAberta(true);
    } catch (e) {
      console.log(
        'ERRO AO ABRIR CÂMERA:',
        e
      );

      Alert.alert(
        'Erro',
        'Não foi possível abrir a câmera.'
      );
    }
  }

  // ---------------------------------------------------------
  // FECHAR CÂMERA
  // ---------------------------------------------------------

  function fecharCamera() {
    setCameraAberta(false);
    setLendoCodigo(false);
  }

  // ---------------------------------------------------------
  // LER CÓDIGO DE BARRAS
  // ---------------------------------------------------------

  function lerCodigoBarras({
    data,
    type,
  }: {
    data: string;
    type?: string;
  }) {
    if (lendoCodigo) {
      return;
    }

    if (!data) {
      return;
    }

    // Mantém somente números no código lido
    const codigo = data
      .trim()
      .replace(/[^0-9]/g, '');

    if (!codigo) {
      return;
    }

    console.log(
      'CÓDIGO LIDO PELA CÂMERA:',
      codigo,
      'TIPO:',
      type
    );

    setLendoCodigo(true);

    alterarCampo(
      'codigo',
      codigo
    );

    setTimeout(() => {
      setCameraAberta(false);
      setLendoCodigo(false);
    }, 250);
  }

  // ---------------------------------------------------------
  // CADASTRAR PRODUTO
  //
  // OBS: usa obterBanco() do módulo compartilhado
  // (src/database/banco.ts), a MESMA conexão usada pelo
  // restante do aplicativo (Caixa, Avarias, GerenciarProdutos,
  // index). Nunca abra uma conexão SQLite própria aqui —
  // isso causa locks e telas que "não carregam nada" em
  // outras partes do app.
  // ---------------------------------------------------------

  async function cadastrarProduto() {
    // -------------------------------------------------------
    // VALIDAÇÕES
    // -------------------------------------------------------

    // Garante que o código contenha somente números
    const codigo = produto.codigo
      .trim()
      .replace(/[^0-9]/g, '');

    const nome = produto.nome.trim();

    if (!codigo) {
      Alert.alert(
        'Atenção',
        'Informe o código do produto.'
      );

      return;
    }

    if (!nome) {
      Alert.alert(
        'Atenção',
        'Informe o nome do produto.'
      );

      return;
    }

    const precoVenda = Number(
      produto.precoVenda.replace(',', '.')
    );

    if (
      !Number.isFinite(precoVenda) ||
      precoVenda <= 0
    ) {
      Alert.alert(
        'Atenção',
        'Informe um preço de venda maior que zero.'
      );

      return;
    }

    const precoEntrada =
      Number(
        produto.precoEntrada.replace(',', '.')
      ) || 0;

    const quantidade =
      Number(
        produto.quantidade.replace(',', '.')
      ) || 0;

    const estoqueMinimo =
      Number(
        produto.estoqueMinimo.replace(',', '.')
      ) || 0;

    const categoria =
      produto.categoria.trim() || 'Geral';

    const unidade =
      produto.unidade.trim() || 'unidade';

    try {
      setSalvando(true);

      // -----------------------------------------------------
      // ABRIR SQLITE (conexão única e compartilhada)
      // -----------------------------------------------------

      const db = await obterBanco();

      // -----------------------------------------------------
      // VERIFICAR CÓDIGO DUPLICADO
      // -----------------------------------------------------

      const existente =
        await db.getFirstAsync<{
          id: number;
          codigo: string;
          nome: string;
        }>(
          `
          SELECT
            id,
            codigo,
            nome
          FROM produtos_local
          WHERE codigo = ?
          LIMIT 1
          `,
          codigo
        );

      if (existente) {
        Alert.alert(
          'Produto já cadastrado',
          `O código "${codigo}" já está cadastrado para o produto "${existente.nome}".`
        );

        return;
      }

      // -----------------------------------------------------
      // DATA DE ATUALIZAÇÃO
      // -----------------------------------------------------

      const atualizadoEm =
        new Date().toISOString();

      // -----------------------------------------------------
      // SALVAR NO SQLITE
      // -----------------------------------------------------

      const resultado =
        await db.runAsync(
          `
          INSERT INTO produtos_local (
            codigo,
            ean,
            nome,
            marca,
            descricao,
            imagem,
            ncm,
            preco_entrada,
            preco_venda,
            unidade,
            quantidade,
            estoque_minimo,
            categoria,
            ativo,
            sincronizado,
            criado_em,
            atualizado_em
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
          `,
          codigo,
          null,
          nome,
          null,
          null,
          null,
          null,
          precoEntrada,
          precoVenda,
          unidade,
          quantidade,
          estoqueMinimo,
          categoria,
          1,
          0,
          atualizadoEm,
          atualizadoEm
        );

      console.log(
        'PRODUTO SALVO NO SQLITE:',
        resultado
      );

      // -----------------------------------------------------
      // CONFIRMAR QUE FOI GRAVADO
      // -----------------------------------------------------

      const produtoSalvo =
        await db.getFirstAsync<{
          id: number;
          codigo: string;
          nome: string;
          preco_venda: number;
          quantidade: number;
        }>(
          `
          SELECT
            id,
            codigo,
            nome,
            preco_venda,
            quantidade
          FROM produtos_local
          WHERE id = ?
          `,
          resultado.lastInsertRowId
        );

      console.log(
        'PRODUTO CONFIRMADO NO SQLITE:',
        produtoSalvo
      );

      // -----------------------------------------------------
      // SUCESSO
      // -----------------------------------------------------

      Alert.alert(
        'Produto cadastrado',
      );

      limparFormulario();
    } catch (e: any) {
      console.log(
        'ERRO AO CADASTRAR PRODUTO NO SQLITE:',
        e
      );

      const mensagem =
        e?.message ||
        'Não foi possível salvar o produto no banco local.';

      Alert.alert(
        'Erro',
        mensagem
      );
    } finally {
      setSalvando(false);
    }
  }

  // ---------------------------------------------------------
  // TELA
  // ---------------------------------------------------------

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
        >
          {/* TÍTULO */}

          <Text style={styles.titulo}>
            Cadastrar Produto
          </Text>

          <Text style={styles.subtitulo}>
            Cadastre o produto diretamente no aparelho
          </Text>

          {/* CÓDIGO */}

          <Text style={styles.label}>
            Código / Código de barras
          </Text>

          <View style={styles.linhaCodigo}>
            <TextInput
              style={[
                styles.input,
                styles.inputCodigo,
              ]}
              value={produto.codigo}
              onChangeText={(texto) => {
                // Permite somente números
                const somenteNumeros =
                  texto.replace(/[^0-9]/g, '');

                alterarCampo(
                  'codigo',
                  somenteNumeros
                );
              }}
              placeholder="Digite ou leia o código"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              inputMode="numeric"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="next"
            />

            <TouchableOpacity
              style={styles.botaoCamera}
              onPress={abrirCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.iconeCamera}>
                📷
              </Text>
            </TouchableOpacity>
          </View>

          {/* NOME */}

          <Text style={styles.label}>
            Nome do produto
          </Text>

          <TextInput
            style={styles.input}
            value={produto.nome}
            onChangeText={(texto) =>
              alterarCampo(
                'nome',
                texto
              )
            }
            placeholder="Ex.: Refrigerante Cola 2L"
            placeholderTextColor="#999"
            autoCorrect={false}
            returnKeyType="next"
          />

          {/* CATEGORIA */}

          <Text style={styles.label}>
            Categoria
          </Text>

          <TextInput
            style={styles.input}
            value={produto.categoria}
            onChangeText={(texto) =>
              alterarCampo(
                'categoria',
                texto
              )
            }
            placeholder="Ex.: Bebidas"
            placeholderTextColor="#999"
            autoCorrect={false}
            returnKeyType="next"
          />

          {/* PREÇOS */}

          <View style={styles.linha}>
            <View style={styles.coluna}>
              <Text style={styles.label}>
                Preço de entrada
              </Text>

              <TextInput
                style={styles.input}
                value={produto.precoEntrada}
                onChangeText={(texto) =>
                  alterarCampo(
                    'precoEntrada',
                    texto
                  )
                }
                placeholder="0,00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.espaco} />

            <View style={styles.coluna}>
              <Text style={styles.label}>
                Preço de venda
              </Text>

              <TextInput
                style={styles.input}
                value={produto.precoVenda}
                onChangeText={(texto) =>
                  alterarCampo(
                    'precoVenda',
                    texto
                  )
                }
                placeholder="0,00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* ESTOQUE */}

          <View style={styles.linha}>
            <View style={styles.coluna}>
              <Text style={styles.label}>
                Quantidade inicial
              </Text>

              <TextInput
                style={styles.input}
                value={produto.quantidade}
                onChangeText={(texto) =>
                  alterarCampo(
                    'quantidade',
                    texto
                  )
                }
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.espaco} />

            <View style={styles.coluna}>
              <Text style={styles.label}>
                Estoque mínimo
              </Text>

              <TextInput
                style={styles.input}
                value={produto.estoqueMinimo}
                onChangeText={(texto) =>
                  alterarCampo(
                    'estoqueMinimo',
                    texto
                  )
                }
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* UNIDADE */}

          <Text style={styles.label}>
            Unidade
          </Text>

          <View style={styles.unidades}>
            {[
              'unidade',
              'kg',
              'g',
              'litro',
              'ml',
              'caixa',
              'pacote',
            ].map((unidade) => (
              <TouchableOpacity
                key={unidade}
                style={[
                  styles.botaoUnidade,
                  produto.unidade === unidade &&
                    styles.botaoUnidadeSelecionado,
                ]}
                onPress={() =>
                  alterarCampo(
                    'unidade',
                    unidade
                  )
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.textoUnidade,
                    produto.unidade === unidade &&
                      styles.textoUnidadeSelecionado,
                  ]}
                >
                  {unidade}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* INFORMAÇÃO OFFLINE */}

          <View style={styles.infoOffline}>
            <Text style={styles.infoOfflineIcone}>
              ✓
            </Text>

            <View
              style={styles.infoOfflineTextoContainer}
            >
              <Text
                style={styles.infoOfflineTitulo}
              >
                Cadastro local
              </Text>

              <Text
                style={styles.infoOfflineTexto}
              >
                O produto será salvo no aparelho
                mesmo sem internet.
              </Text>
            </View>
          </View>

          {/* BOTÃO CADASTRAR */}

          <TouchableOpacity
            style={[
              styles.botaoCadastrar,
              salvando &&
                styles.botaoDesabilitado,
            ]}
            onPress={cadastrarProduto}
            disabled={salvando}
            activeOpacity={0.8}
          >
            <Text
              style={styles.textoBotaoCadastrar}
            >
              {salvando
                ? 'Salvando...'
                : 'Cadastrar Produto'}
            </Text>
          </TouchableOpacity>

          {/* BOTÃO LIMPAR */}

          <TouchableOpacity
            style={styles.botaoLimpar}
            onPress={limparFormulario}
            disabled={salvando}
            activeOpacity={0.8}
          >
            <Text
              style={styles.textoBotaoLimpar}
            >
              Limpar formulário
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* =====================================================
          MODAL DA CÂMERA
          ===================================================== */}

      <Modal
        visible={cameraAberta}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={fecharCamera}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={
              lendoCodigo
                ? undefined
                : lerCodigoBarras
            }
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'code128',
                'code39',
                'code93',
                'codabar',
                'itf14',
              ],
            }}
          />

          {/* OVERLAY */}

          <View style={styles.cameraOverlay}>
            {/* TOPO */}

            <View style={styles.cameraTopo}>
              <Text style={styles.cameraTitulo}>
                Ler código de barras
              </Text>

              <Text style={styles.cameraSubtitulo}>
                Posicione o código dentro da área
              </Text>
            </View>

            {/* ÁREA DE LEITURA */}

            <View
              style={styles.areaLeituraContainer}
            >
              <View style={styles.areaLeitura}>
                <View
                  style={[
                    styles.canto,
                    styles.cantoSuperiorEsquerdo,
                  ]}
                />

                <View
                  style={[
                    styles.canto,
                    styles.cantoSuperiorDireito,
                  ]}
                />

                <View
                  style={[
                    styles.canto,
                    styles.cantoInferiorEsquerdo,
                  ]}
                />

                <View
                  style={[
                    styles.canto,
                    styles.cantoInferiorDireito,
                  ]}
                />

                <View
                  style={styles.linhaLeitura}
                />
              </View>
            </View>

            {/* RODAPÉ */}

            <View style={styles.cameraRodape}>
              <Text style={styles.cameraInstrucao}>
                {lendoCodigo
                  ? 'Código identificado!'
                  : 'Aponte a câmera para o código de barras'}
              </Text>

              <TouchableOpacity
                style={styles.botaoFecharCamera}
                onPress={fecharCamera}
                activeOpacity={0.8}
              >
                <Text
                  style={styles.textoFecharCamera}
                >
                  Fechar câmera
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ===========================================================
// ESTILOS
// ===========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },

  conteudo: {
    padding: 20,
    paddingBottom: 40,
  },

  titulo: {
    fontSize: 25,
    fontWeight: '700',
    color: '#222',
    marginBottom: 5,
  },

  subtitulo: {
    fontSize: 14,
    color: '#777',
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 7,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#222',
    marginBottom: 17,
  },

  linhaCodigo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },

  inputCodigo: {
    flex: 1,
    marginBottom: 0,
  },

  botaoCamera: {
    width: 48,
    height: 48,
    marginLeft: 8,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconeCamera: {
    fontSize: 23,
  },

  linha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  coluna: {
    flex: 1,
  },

  espaco: {
    width: 10,
  },

  unidades: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  botaoUnidade: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    backgroundColor: '#fff',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 9,
    marginRight: 8,
    marginBottom: 8,
  },

  botaoUnidadeSelecionado: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },

  textoUnidade: {
    color: '#444',
    fontSize: 13,
    fontWeight: '500',
  },

  textoUnidadeSelecionado: {
    color: '#fff',
    fontWeight: '700',
  },

  infoOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 13,
    marginBottom: 18,
  },

  infoOfflineIcone: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 27,
    fontWeight: '700',
    marginRight: 10,
  },

  infoOfflineTextoContainer: {
    flex: 1,
  },

  infoOfflineTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },

  infoOfflineTexto: {
    fontSize: 12,
    color: '#166534',
  },

  botaoCadastrar: {
    height: 52,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  botaoDesabilitado: {
    opacity: 0.6,
  },

  textoBotaoCadastrar: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  botaoLimpar: {
    height: 48,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoBotaoLimpar: {
    color: '#555',
    fontSize: 15,
    fontWeight: '600',
  },

  // =========================================================
  // CÂMERA
  // =========================================================

  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },

  camera: {
    flex: 1,
  },

  cameraOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
  },

  cameraTopo: {
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  cameraTitulo: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },

  cameraSubtitulo: {
    color: '#fff',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },

  areaLeituraContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  areaLeitura: {
    width: 300,
    height: 170,
    position: 'relative',
  },

  canto: {
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

  linhaLeitura: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '50%',
    height: 2,
    backgroundColor: '#ff3333',
  },

  cameraRodape: {
    paddingHorizontal: 20,
    paddingBottom: 35,
    alignItems: 'center',
  },

  cameraInstrucao: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
  },

  botaoFecharCamera: {
    backgroundColor: '#fff',
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 10,
  },

  textoFecharCamera: {
    color: '#222',
    fontSize: 15,
    fontWeight: '700',
  },
});