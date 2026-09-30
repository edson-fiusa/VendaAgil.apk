import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import QRCode from 'react-native-qrcode-svg';

import { useOrientacaoDispositivo } from '../../useOrientacaoDispositivo';

import { estilosModais } from './EstilosModais';
import { fmt } from './FormatacaoCaixa';

interface PixModalProps {
  total: number;
  pix: any;
  pixErro: string;
  pixPago: boolean;
  pixVerificando: boolean;
  pixAvisoDemora: boolean;
  pixExpiraEm: number | null;
  pixTempoRestante: string;
  onVerificarAgora: (mercadoPagoId: string) => void;
  onFechar: () => void;
}

/**
 * Modal exibido enquanto o operador está gerando/aguardando um
 * pagamento PIX (QR Code, tempo até expirar, botão "Já paguei" e
 * a confirmação visual quando o Mercado Pago aprova o pagamento).
 *
 * Em pé: tudo em uma coluna.
 * Deitado (enquanto aguarda o pagamento): QR Code à esquerda e
 * informações/botões à direita, para não cortar nem precisar rolar.
 */
export function PixModal({
  total,
  pix,
  pixErro,
  pixPago,
  pixVerificando,
  pixAvisoDemora,
  pixExpiraEm,
  pixTempoRestante,
  onVerificarAgora,
  onFechar,
}: PixModalProps) {
  const { isLadoALado } = useOrientacaoDispositivo();

  const codigoPix =
    pix?.qrCode ||
    pix?.qr_code ||
    pix?.copiaECola ||
    pix?.copyPaste ||
    pix?.pointOfInteraction?.transactionData?.qrCode;

  // Só usamos duas colunas enquanto o QR Code está na tela.
  // Erro e "pagamento aprovado" são mensagens curtas: ficam centralizadas.
  const aguardandoPagamento = !pixErro && !pixPago;
  const duasColunas = isLadoALado && aguardandoPagamento;

  const cabecalho = (
    <>
      <Text style={estilos.modalTitulo}>Pagamento PIX</Text>

      <Text style={estilos.modalValor}>{fmt(total)}</Text>
    </>
  );

  const qrBloco = codigoPix ? (
    <View
      style={[
        estilos.qrContainer,
        duasColunas && estilos.qrContainerLadoALado,
      ]}
    >
      {String(codigoPix).length < 5000 ? (
        <QRCode
          value={String(codigoPix)}
          size={duasColunas ? 190 : 220}
        />
      ) : (
        <Text style={estilos.erroPix}>QR Code indisponível</Text>
      )}
    </View>
  ) : (
    <ActivityIndicator size="large" color="#2563eb" />
  );

  const detalhes = (
    <>
      <Text
        style={[
          estilos.pixAguardando,
          duasColunas && estilos.pixAguardandoLadoALado,
        ]}
      >
        Aguardando pagamento...
      </Text>

      {!!pixExpiraEm && !!pixTempoRestante && (
        <Text style={estilos.pixExpiracaoTexto}>
          Expira em {pixTempoRestante}
        </Text>
      )}

      {pixAvisoDemora && (
        <Text style={estilos.pixAvisoDemoraTexto}>
          Está demorando mais que o normal. Se o cliente já pagou,
          toque em "Já paguei" abaixo para confirmar manualmente.
        </Text>
      )}

      {!!codigoPix && (
        <Text selectable style={estilos.pixCopiaCola}>
          {String(codigoPix)}
        </Text>
      )}

      {!!pix?.mercadoPagoId && (
        <TouchableOpacity
          style={estilos.botaoVerificarPix}
          onPress={() => onVerificarAgora(String(pix.mercadoPagoId))}
          disabled={pixVerificando}
        >
          {pixVerificando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.botaoVerificarPixTexto}>
              Já paguei, verificar agora
            </Text>
          )}
        </TouchableOpacity>
      )}
    </>
  );

  const botaoFechar = (
    <TouchableOpacity
      style={[
        estilos.botaoFecharModal,
        duasColunas && estilos.botaoFecharModalLadoALado,
      ]}
      onPress={onFechar}
    >
      <Text style={estilos.botaoFecharModalTexto}>Fechar</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={!!pix || !!pixErro}
      transparent
      animationType="fade"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onFechar}
    >
      <View style={estilosModais.modalFundo}>
        <View
          style={[
            estilos.modalPix,
            isLadoALado && estilos.modalPixLadoALado,
            duasColunas && estilos.modalPixDuasColunas,
          ]}
        >
          <ScrollView
            contentContainerStyle={estilos.conteudoScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {duasColunas ? (
              <View style={estilos.linhaLadoALado}>
                <View style={estilos.colunaQr}>{qrBloco}</View>

                <View style={estilos.colunaInfo}>
                  {cabecalho}
                  {detalhes}
                  {botaoFechar}
                </View>
              </View>
            ) : (
              <>
                {cabecalho}

                {pixErro ? (
                  <Text style={estilos.erroPix}>{pixErro}</Text>
                ) : pixPago ? (
                  <View style={estilos.pixAprovado}>
                    <Text style={estilos.pixAprovadoIcone}>✓</Text>

                    <Text style={estilos.pixAprovadoTexto}>
                      Pagamento aprovado
                    </Text>
                  </View>
                ) : (
                  <>
                    {qrBloco}
                    {detalhes}
                  </>
                )}

                {botaoFechar}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  modalPix: {
    width: '100%',
    maxWidth: 450,
    // O modal tem um teto de altura e o conteúdo rola dentro dele,
    // para não ser cortado em telas baixas.
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
  },

  modalPixLadoALado: {
    maxHeight: '96%',
    padding: 16,
  },

  modalPixDuasColunas: {
    maxWidth: 820,
  },

  conteudoScroll: {
    alignItems: 'center',
  },

  linhaLadoALado: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },

  colunaQr: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 20,
  },

  colunaInfo: {
    flex: 1,
    alignItems: 'center',
  },

  modalTitulo: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111827',
  },

  modalValor: {
    marginTop: 5,
    fontSize: 22,
    fontWeight: '900',
    color: '#2563eb',
  },

  qrContainer: {
    marginTop: 18,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
  },

  qrContainerLadoALado: {
    marginTop: 0,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  pixAguardando: {
    marginTop: 15,
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
  },

  pixAguardandoLadoALado: {
    marginTop: 8,
  },

  pixExpiracaoTexto: {
    marginTop: 6,
    color: '#374151',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  pixAvisoDemoraTexto: {
    marginTop: 10,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    textAlign: 'center',
  },

  pixCopiaCola: {
    marginTop: 12,
    padding: 10,
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    fontSize: 10,
    color: '#374151',
  },

  botaoVerificarPix: {
    width: '100%',
    marginTop: 14,
    backgroundColor: '#16a34a',
    height: 46,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoVerificarPixTexto: {
    color: '#fff',
    fontWeight: '800',
  },

  erroPix: {
    marginTop: 15,
    color: '#dc2626',
    fontWeight: '700',
    textAlign: 'center',
  },

  pixAprovado: {
    alignItems: 'center',
    paddingVertical: 25,
  },

  pixAprovadoIcone: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: '#16a34a',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 65,
    fontSize: 38,
    fontWeight: '900',
  },

  pixAprovadoTexto: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '800',
    color: '#16a34a',
  },

  botaoFecharModal: {
    width: '100%',
    marginTop: 18,
    backgroundColor: '#374151',
    height: 46,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoFecharModalLadoALado: {
    marginTop: 10,
  },

  botaoFecharModalTexto: {
    color: '#fff',
    fontWeight: '800',
  },
});