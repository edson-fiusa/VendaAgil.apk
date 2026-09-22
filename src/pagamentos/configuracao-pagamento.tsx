import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  buscarConfiguracaoPagamento,
  salvarConfiguracaoPagamento,
  removerConfiguracaoPagamento,
  ConfiguracaoPagamento as TipoConfiguracaoPagamento,
} from './bancoPagamento';

import { conectarMercadoPago } from './mercadoPago';

export default function ConfiguracaoPagamento() {
  const [carregando, setCarregando] = useState(true);
  const [conectandoMP, setConectandoMP] = useState(false);
  const [salvandoTaxa, setSalvandoTaxa] = useState(false);

  const [mercadoPago, setMercadoPago] = useState<TipoConfiguracaoPagamento | null>(null);
  const [porcentagemComissao, setPorcentagemComissao] = useState('5'); // Padrão 5%

  async function carregar() {
    setCarregando(true);
    const mp = await buscarConfiguracaoPagamento('mercadopago');
    setMercadoPago(mp);

    // Se já tiver uma porcentagem salva no banco, carrega ela
    if (mp && (mp as any).comissao !== undefined) {
      setPorcentagemComissao(String((mp as any).comissao));
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function aoConectarMercadoPago() {
    try {
      setConectandoMP(true);
      await conectarMercadoPago();
      Alert.alert('Sucesso', 'Mercado Pago conectado com sucesso.');
      await carregar();
    } catch (error: any) {
      Alert.alert(
        'Erro ao conectar',
        error?.message || 'Não foi possível conectar ao Mercado Pago.'
      );
    } finally {
      setConectandoMP(false);
    }
  }

  async function aoSalvarComissao() {
    if (!mercadoPago?.accessToken) {
      Alert.alert('Atenção', 'Conecte o Mercado Pago antes de definir a comissão.');
      return;
    }

    try {
      setSalvandoTaxa(true);
      const taxaNumerica = parseFloat(porcentagemComissao.replace(',', '.'));

      if (isNaN(taxaNumerica) || taxaNumerica < 0 || taxaNumerica > 100) {
        Alert.alert('Erro', 'Digite um valor de porcentagem válido entre 0 e 100.');
        return;
      }

      // Salva mantendo o token atual e adicionando a comissão
      await salvarConfiguracaoPagamento({
        provedor: 'mercadopago',
        accessToken: mercadoPago.accessToken,
        refreshToken: mercadoPago.refreshToken,
        comissao: taxaNumerica, // Salva a porcentagem escolhida
      } as any);

      Alert.alert('Sucesso', 'Porcentagem de comissão salva com sucesso!');
      await carregar();
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível salvar a comissão.');
    } finally {
      setSalvandoTaxa(false);
    }
  }

  function aoDesconectarMercadoPago() {
    Alert.alert(
      'Desconectar Mercado Pago',
      'Tem certeza que deseja remover esta conexão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            await removerConfiguracaoPagamento('mercadopago');
            await carregar();
          },
        },
      ]
    );
  }

  if (carregando) {
    return (
      <View style={styles.centralizado}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <Text style={styles.subtitulo}>
        Configure a forma de recebimento via PIX desta loja e a sua comissão.
      </Text>

      {/* CARD MERCADO PAGO */}
      <View style={styles.card}>
        <View style={styles.cardCabecalho}>
          <Text style={styles.cardTitulo}>Mercado Pago</Text>
          {mercadoPago?.accessToken && (
            <View style={styles.selo}>
              <Text style={styles.seloTexto}>Conectado</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardDescricao}>
          Conecte a conta do Mercado Pago da loja. O PIX gerado cai direto na conta dela, descontando a sua comissão automaticamente.
        </Text>

        {mercadoPago?.accessToken ? (
          <>
            {/* CAMPO DE PORCENTAGEM DE COMISSÃO */}
            <Text style={styles.label}>Sua Porcentagem de Comissão (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={porcentagemComissao}
              onChangeText={setPorcentagemComissao}
              placeholder="Ex: 5"
            />

            <TouchableOpacity
              style={[styles.botaoSecundario, { marginBottom: 10 }]}
              onPress={aoSalvarComissao}
              disabled={salvandoTaxa}
            >
              {salvandoTaxa ? (
                <ActivityIndicator color="#991b1b" />
              ) : (
                <Text style={styles.textoBotaoSecundario}>Salvar Porcentagem</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoVermelho}
              onPress={aoDesconectarMercadoPago}
            >
              <Text style={styles.textoBotaoVermelho}>Desconectar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.botaoPrimario}
            onPress={aoConectarMercadoPago}
            disabled={conectandoMP}
          >
            {conectandoMP ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.textoBotaoPrimario}>Conectar Mercado Pago</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ESTILOS
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  conteudo: { padding: 20, paddingBottom: 40 },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitulo: { marginBottom: 20, fontSize: 14, color: '#6b7280' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitulo: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  cardDescricao: { marginTop: 8, marginBottom: 14, fontSize: 13, color: '#6b7280', lineHeight: 18 },
  selo: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  seloTexto: { color: '#166534', fontSize: 11, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 5 },
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
  botaoPrimario: { backgroundColor: '#2563eb', paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  textoBotaoPrimario: { color: '#ffffff', fontWeight: '700' },
  botaoSecundario: { backgroundColor: '#e0e7ff', paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  textoBotaoSecundario: { color: '#3730a3', fontWeight: '700' },
  botaoVermelho: { backgroundColor: '#fee2e2', paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  textoBotaoVermelho: { color: '#991b1b', fontWeight: '700' },
});