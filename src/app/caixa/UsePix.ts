import { useEffect, useRef, useState } from 'react';

import { lerTokenMP } from '../Armazenamentoseguro';
import { formatarTempoRestante, gerarIdempotencyKey } from './FormatacaoCaixa';

const STATUS_FINAIS_ERRO = [
  'cancelled',
  'rejected',
  'refunded',
  'charged_back',
];

const MAX_FALHAS_CONSULTA_PIX = 5;
const TEMPO_AVISO_DEMORA_MS = 45_000;
const TEMPO_EXPIRACAO_PIX_MS = 2 * 60 * 1000; // controle só local

// Mude para true se quiser voltar a forçar um pagador fixo nos testes.
const USAR_PAYER_DE_TESTE = false;
const PAYER_TESTE_EMAIL = 'comprador123@teste.com';
const PAYER_TESTE_NOME = 'Cliente';

interface UsePixParams {
  temItensNoCarrinho: boolean;
  total: number;
  operador: any;
  caixa: any;
  mostrarToast: (mensagem: string) => void;
  aoAprovar: (mercadoPagoId: string) => Promise<void>;
  /** Chamado quando não há token salvo (abra a tela de configuração). */
  aoFaltarToken?: () => void;
}

export function usePix({
  temItensNoCarrinho,
  total,
  operador,
  caixa,
  mostrarToast,
  aoAprovar,
  aoFaltarToken,
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

  // Token lido do SecureStore, mantido só em memória durante o PIX
  // para não reler o armazenamento a cada consulta (3 em 3 segundos).
  const tokenRef = useRef<string | null>(null);

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

  useEffect(() => {
    return () => {
      limparTimersPix();
      tokenRef.current = null;
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

    try {
      setPixCarregando(true);
      setPixErro('');
      setPixPago(false);
      setPixAvisoDemora(false);

      pixProcessandoRef.current = false;
      falhasConsultaRef.current = 0;

      limparTimersPix();

      const token = await lerTokenMP();

      if (!token) {
        tokenRef.current = null;
        setPixErro(
          'Token do Mercado Pago não configurado. Cadastre o token ' +
            'nas configurações do app.'
        );
        aoFaltarToken?.();
        return;
      }

      tokenRef.current = token;

      const emailCliente = USAR_PAYER_DE_TESTE
        ? PAYER_TESTE_EMAIL
        : operador?.email || 'cliente@vendaagil.com';

      const nomeCliente = USAR_PAYER_DE_TESTE
        ? PAYER_TESTE_NOME
        : operador?.nome || 'Cliente';

      const expiraEm = Date.now() + TEMPO_EXPIRACAO_PIX_MS;

      // Não enviamos "date_of_expiration" ao Mercado Pago (isso fazia o
      // PIX nascer vencido). O prazo na tela é só o temporizador local.
      const resposta = await fetch(
        'https://api.mercadopago.com/v1/payments',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': gerarIdempotencyKey(),
          },
          body: JSON.stringify({
            transaction_amount: Number(total.toFixed(2)),
            description: 'Venda PDV - Venda Ágil',
            payment_method_id: 'pix',
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

    try {
      if (manual) {
        setPixVerificando(true);
      }

      const token = tokenRef.current ?? (await lerTokenMP());

      if (!token) {
        return;
      }

      tokenRef.current = token;

      const resposta = await fetch(
        `https://api.mercadopago.com/v1/payments/${mercadoPagoId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
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

      if (STATUS_FINAIS_ERRO.includes(status)) {
        limparTimersPix();

        const detalhe = dados?.status_detail
          ? ` | motivo: ${dados.status_detail}`
          : '';

        setPixErro(
          `Pagamento PIX não aprovado. Status: ${status}${detalhe}`
        );
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
    tokenRef.current = null;

    setPix(null);
    setPixErro('');
    setPixPago(false);
    setPixAvisoDemora(false);
    setPixExpiraEm(null);
    setPixTempoRestante('');
  }

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