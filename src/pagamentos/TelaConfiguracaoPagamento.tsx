import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  buscarConfiguracaoPagamento,
  removerConfiguracaoPagamento,
  ConfiguracaoPagamento,
} from './bancoPagamento';

import { conectarMercadoPago } from './mercadoPago';

export default function TelaConfiguracaoPagamento() {
  const [carregando, setCarregando] = useState(true);
  const [conectandoMP, setConectandoMP] = useState(false);

  const [mercadoPago, setMercadoPago] =
    useState<ConfiguracaoPagamento | null>(null);

  async function carregar() {
    setCarregando(true);

    const mp = await buscarConfiguracaoPagamento('mercadopago');

    setMercadoPago(mp);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  // ============================================================
  // MERCADO PAGO
  // ============================================================

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

  // ============================================================
  // RENDER
  // ============================================================

  if (carregando) {
    return (
      <View style={styles.centralizado}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.conteudo}
    >
      <Text style={styles.titulo}>Recebimento via PIX</Text>

      <Text style={styles.subtitulo}>
        Configure a forma de recebimento desta loja.
      </Text>

      {/* ============================================================
          CARD MERCADO PAGO
      ============================================================ */}

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
          Conecte a conta do Mercado Pago da loja. O PIX gerado
          cai direto na conta dela.
        </Text>

        {mercadoPago?.accessToken ? (
          <TouchableOpacity
            style={styles.botaoSecundario}
            onPress={aoDesconectarMercadoPago}
          >
            <Text style={styles.textoBotaoSecundario}>
              Desconectar
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.botaoPrimario}
            onPress={aoConectarMercadoPago}
            disabled={conectandoMP}
          >
            {conectandoMP ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.textoBotaoPrimario}>
                Conectar Mercado Pago
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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

  conteudo: {
    padding: 20,
    paddingBottom: 40,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titulo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },

  subtitulo: {
    marginTop: 5,
    marginBottom: 20,
    fontSize: 14,
    color: '#6b7280',
  },

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

  cardCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },

  cardDescricao: {
    marginTop: 8,
    marginBottom: 14,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },

  selo: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  seloTexto: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },

  botaoPrimario: {
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },

  textoBotaoPrimario: {
    color: '#ffffff',
    fontWeight: '700',
  },

  botaoSecundario: {
    backgroundColor: '#fee2e2',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },

  textoBotaoSecundario: {
    color: '#991b1b',
    fontWeight: '700',
  },
});