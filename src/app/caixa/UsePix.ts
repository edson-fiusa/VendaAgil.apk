import { useEffect, useRef, useState } from 'react';

import { formatarTempoRestante, gerarIdempotencyKey } from './FormatacaoCaixa';



const MP_ACCESS_TOKEN = process.env
  .EXPO_PUBLIC_MP_ACCESS_TOKEN as string;

const STATUS_FINAIS_ERRO = [
  'cancelled',
  'rejected',
  'refunded',
  'charged_back',
];

const MAX_FALHAS_CONSULTA_PIX = 5;
const TEMPO_AVISO_DEMORA_MS = 45_000;
const TEMPO_EXPIRACAO_PIX_MS = 4 * 60 * 1000; // 4 minutos

interface UsePixParams {
  temItensNoCarrinho: boolean;
  total: number;
  operador: any;
  caixa: any;
  mostrarToast: (mensagem: string) => void;
  // Chamado quando o Mercado Pago confirma o pagamento. Quem
  // decide o que fazer com a venda (gravar no banco local,
  // limpar carrinho, mostrar cupom etc.) é quem usa este hook.
  aoAprovar: (mercadoPagoId: string) => Promise<void>;
}

/**
 * Hook com toda a lógica de cobrança via PIX (Mercado Pago):
 * gerar o QR Code, ficar consultando o status a cada poucos
 * segundos, avisar quando está demorando, expirar automaticamente
 * e permitir cancelamento manual.
 */
export function usePix({
  temItensNoCarrinho,
  total,
  operador,
  caixa,
  mostrarToast,
  aoAprovar,
}: UsePixParams) {
  const [pix, setPix] = useState<any>(null);
  const [pixCarregando, setPixCarregando] = useState(false);
  const [pixVerificando, setPixVerificando] = useState(false);
  const [pixErro, setPixErro] = useState('');
  const [pixPago, setPixPago] = useState(false);
  const [pixAvisoDemora, setPixAvisoDemora] = useState(false);
  const [pixExpiraEm, setPixExpiraEm] = useState<number | null>(null);
  const [pixTempoRestante, setPixTempoRestante] = useState('');

  const pixIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const pixAvisoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const pixContadorIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);

  const pixExpiracaoTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const pixProcessandoRef = useRef(false);
  const falhasConsultaRef = useRef(0);

  function limparTimersPix() {
    if (pixIntervalRef.current) {
      clearInterval(pixIntervalRef.current);
      pixIntervalRef.current = null;
    }

    if (pixAvisoTimeoutRef.current) {
      clearTimeout(pixAvisoTimeoutRef.current);
      pixAvisoTimeoutRef.current = null;
    }

    if (pixContadorIntervalRef.current) {
      clearInterval(pixContadorIntervalRef.current);
      pixContadorIntervalRef.current = null;
    }

    if (pixExpiracaoTimeoutRef.current) {
      clearTimeout(pixExpiracaoTimeoutRef.current);
      pixExpiracaoTimeoutRef.current = null;
    }
  }

  // Limpa os timers automaticamente se quem usa este hook for
  // desmontado (ex.: operador sai do caixa com um PIX em aberto).
  useEffect(() => {
    return () => {
      limparTimersPix();
    };
  }, []);

  function expirarPix() {
    limparTimersPix();

    pixProcessandoRef.current = false;

    setPixExpiraEm(null);
    setPixTempoRestante('');
    setPixErro(
      'O QR Code expirou sem confirmação de pagamento. Gere um novo PIX.'
    );
  }

  function iniciarContadorPix(expiraEm: number) {
    setPixExpiraEm(expiraEm);
    setPixTempoRestante(formatarTempoRestante(expiraEm - Date.now()));

    pixContadorIntervalRef.current = setInterval(() => {
      const restante = expiraEm - Date.now();

      if (restante <= 0) {
        setPixTempoRestante('00:00');
        return;
      }

      setPixTempoRestante(formatarTempoRestante(restante));
    }, 1000);

    pixExpiracaoTimeoutRef.current = setTimeout(() => {
      expirarPix();
    }, Math.max(0, expiraEm - Date.now()));
  }

    async function gerarPix() {
    if (!temItensNoCarrinho) {
      mostrarToast('Adicione produtos ao carrinho.');
      return;
    }

    if (total <= 0) {
      mostrarToast('Valor da venda inválido.');
      return;
    }

    if (!MP_ACCESS_TOKEN) {
      setPixErro(
        'Token do Mercado Pago não configurado. Defina ' +
          'EXPO_PUBLIC_MP_ACCESS_TOKEN no .env do app.'
      );
      return;
    }

    try {
      setPixCarregando(true);
      setPixErro('');
      setPixPago(false);
      setPixAvisoDemora(false);

      pixProcessandoRef.current = false;
      falhasConsultaRef.current = 0;

      limparTimersPix();

      const emailCliente =
        operador?.email || 'cliente@vendaagil.com';

      const nomeCliente = operador?.nome || 'Cliente';

      if (nomeCliente.trim().toUpperCase() === 'APRO') {
        console.log(
          '⚠️ ATENÇÃO: payer.first_name está como "APRO". ' +
            'Esse valor é um gatilho de TESTE do Mercado Pago.'
        );
      }

      // Cálculo correto usando a constante global de 4 minutos (ou altere para 2 se preferir)
      const agoraMs = Date.now();
      const expiraEm = agoraMs + TEMPO_EXPIRACAO_PIX_MS;

      const dataExpiracaoIso = new Date(expiraEm)
        .toISOString()
        .replace('Z', '+00:00');

      const resposta = await fetch(
        'https://api.mercadopago.com/v1/payments',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': gerarIdempotencyKey(),
          },
          body: JSON.stringify({
            transaction_amount: Number(total.toFixed(2)),
            description: 'Venda PDV - Venda Ágil',
            payment_method_id: 'pix',
            date_of_expiration: dataExpiracaoIso,
            payer: {
              email: emailCliente,
              first_name: nomeCliente,
            },
            external_reference: `CAIXA-${Number(
              caixa?.id ?? 0
            )}-${Date.now()}`,
          }),
        }
      );

      let dados: any = null;

      try {
        dados = await resposta.json();
      } catch {
        dados = null;
      }

      if (!resposta.ok) {
        const mensagem =
          dados?.message ||
          dados?.error ||
          dados?.cause?.[0]?.description ||
          `Erro HTTP ${resposta.status}`;

        throw new Error(`Mercado Pago: ${mensagem}`);
      }

      if (!dados) {
        throw new Error(
          'O Mercado Pago não retornou os dados do PIX.'
        );
      }

      const mercadoPagoId = dados.id || dados.payment_id || null;

      if (!mercadoPagoId) {
        throw new Error(
          'O Mercado Pago não retornou o ID do pagamento.'
        );
      }

      console.log(
        '[PIX] Pagamento criado:',
        'id=' + mercadoPagoId,
        'status=' + dados.status,
        'status_detail=' + dados.status_detail,
        'live_mode=' + dados.live_mode
      );

      const transactionData =
        dados?.point_of_interaction?.transaction_data;

      const qrCode =
        transactionData?.qr_code ||
        dados?.qr_code ||
        dados?.qrCode ||
        null;

      const qrCodeBase64 =
        transactionData?.qr_code_base64 ||
        dados?.qr_code_base64 ||
        null;

      const pixData = {
        id: mercadoPagoId,
        mercadoPagoId,
        paymentId: mercadoPagoId,
        status: dados.status,
        qrCode,
        qr_code: qrCode,
        qrCodeBase64,
        qr_code_base64: qrCodeBase64,
        copiaECola: qrCode,
        copyPaste: qrCode,
        pointOfInteraction: dados.point_of_interaction,
        transactionData,
      };

      setPix(pixData);

      iniciarContadorPix(expiraEm);

      pixIntervalRef.current = setInterval(async () => {
        await verificarPagamentoPix(String(mercadoPagoId));
      }, 3000);

      pixAvisoTimeoutRef.current = setTimeout(() => {
        setPixAvisoDemora(true);
      }, TEMPO_AVISO_DEMORA_MS);
    } catch (erro: any) {
      setPixErro(erro?.message || 'Não foi possível gerar o PIX.');
    } finally {
      setPixCarregando(false);
    }
  }
  

  async function verificarPagamentoPix(
    mercadoPagoId: string,
    manual: boolean = false
  ) {
    if (pixProcessandoRef.current) {
      return;
    }

    if (!MP_ACCESS_TOKEN) {
      return;
    }

    try {
      if (manual) {
        setPixVerificando(true);
      }

      const resposta = await fetch(
        `https://api.mercadopago.com/v1/payments/${mercadoPagoId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          },
        }
      );

      let dados: any = null;

      try {
        dados = await resposta.json();
      } catch {
        dados = null;
      }

      if (!resposta.ok) {
        throw new Error(
          dados?.message ||
            `Erro HTTP ${resposta.status} ao consultar o pagamento.`
        );
      }

      falhasConsultaRef.current = 0;

      const status = String(dados?.status ?? '').toLowerCase();

      // Log de diagnóstico: mostra a resposta completa que o
      // Mercado Pago devolveu nesta consulta. Se o pagamento
      // aparecer "approved" segundos depois de criado, sem
      // ninguém ter escaneado o QR Code, olhe aqui:
      // - live_mode: false  → é um pagamento de TESTE (sandbox),
      //   não um pagamento real. O token usado não é o de
      //   produção, ou a conta está em modo de teste.
      // - status_detail: "accredited" num pagamento criado há
      //   poucos segundos, com live_mode false, confirma que foi
      //   uma simulação do Mercado Pago, não um pagamento real.
      console.log(
        '[PIX] Consulta de status:',
        'id=' + mercadoPagoId,
        'status=' + status,
        'status_detail=' + dados?.status_detail,
        'live_mode=' + dados?.live_mode
      );

      if (STATUS_FINAIS_ERRO.includes(status)) {
        limparTimersPix();

        setPixErro(`Pagamento PIX não aprovado. Status: ${status}`);
        return;
      }

      if (
        status === 'approved' ||
        status === 'paid' ||
        status === 'authorized'
      ) {
        if (pixProcessandoRef.current) {
          return;
        }

        pixProcessandoRef.current = true;

        limparTimersPix();

        setPixPago(true);

        await aoAprovar(mercadoPagoId);
        return;
      }

      if (manual) {
        mostrarToast(
          'Pagamento ainda não foi confirmado pelo Mercado Pago. Aguarde alguns segundos e tente de novo.'
        );
      }
    } catch (erro: any) {
      console.error('ERRO AO CONSULTAR PAGAMENTO PIX:', erro);

      falhasConsultaRef.current += 1;

      if (manual) {
        mostrarToast(
          'Não foi possível consultar o Mercado Pago agora. Verifique sua internet e tente de novo.'
        );
      }

      if (falhasConsultaRef.current >= MAX_FALHAS_CONSULTA_PIX) {
        limparTimersPix();

        setPixErro(
          'Não foi possível confirmar automaticamente o pagamento PIX ' +
          '(falha ao consultar o Mercado Pago repetidamente).\n\n' +
          'Verifique o status desse pagamento no aplicativo/site do ' +
          'Mercado Pago antes de repetir a cobrança, para não cobrar o ' +
          'cliente duas vezes.'
        );
      }
    } finally {
      if (manual) {
        setPixVerificando(false);
      }
    }
  }

  function cancelarPix() {
    limparTimersPix();

    pixProcessandoRef.current = false;
    falhasConsultaRef.current = 0;

    setPix(null);
    setPixErro('');
    setPixPago(false);
    setPixAvisoDemora(false);
    setPixExpiraEm(null);
    setPixTempoRestante('');
  }

  // Usado por quem chama este hook quando a gravação da venda no
  // banco local falha DEPOIS do Mercado Pago já ter aprovado o
  // pagamento: libera a trava de processamento sem apagar o QR
  // Code/estado do PIX (o dinheiro já entrou; o operador pode
  // tentar gravar a venda de novo sem gerar um PIX novo).
  function liberarProcessamentoPix() {
    pixProcessandoRef.current = false;
  }

  return {
    pix,
    pixCarregando,
    pixVerificando,
    pixErro,
    pixPago,
    pixAvisoDemora,
    pixExpiraEm,
    pixTempoRestante,
    gerarPix,
    verificarPagamentoPix,
    cancelarPix,
    liberarProcessamentoPix,
  };
}