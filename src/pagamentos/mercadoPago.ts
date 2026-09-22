import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import {
  salvarConfiguracaoPagamento,
  buscarConfiguracaoPagamento,
} from './bancoPagamento';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

// client_id é PÚBLICO, pode ficar no app tranquilamente.
const MP_CLIENT_ID = process.env.EXPO_PUBLIC_MP_CLIENT_ID as string;

// URL da função serverless no Netlify
const URL_FUNCAO_OAUTH =
  'https://vendaagil.netlify.app/.netlify/functions/mercadoPagoOauthCallback';

// Esquema do deep link do seu app (o mesmo do app.json)
const ESQUEMA_APP = 'vendaagil';

// ============================================================
// PASSO 1 — ABRIR TELA DE AUTORIZAÇÃO DO MERCADO PAGO
// ============================================================

export async function conectarMercadoPago() {
  const redirectUri = Linking.createURL('mp-callback');

  const urlAutorizacao =
    `https://auth.mercadopago.com.br/authorization` +
    `?client_id=${MP_CLIENT_ID}` +
    `&response_type=code` +
    `&platform_id=mp` +
    `&redirect_uri=${encodeURIComponent(URL_FUNCAO_OAUTH)}` +
    `&state=${encodeURIComponent(redirectUri)}`;

  const resultado = await WebBrowser.openAuthSessionAsync(
    urlAutorizacao,
    redirectUri
  );

  if (resultado.type !== 'success' || !resultado.url) {
    throw new Error(
      'Conexão com o Mercado Pago cancelada ou não concluída.'
    );
  }

  return tratarRetornoOAuth(resultado.url);
}

// ============================================================
// PASSO 2 — TRATAR O RETORNO DO DEEP LINK
// ============================================================

async function tratarRetornoOAuth(urlRetorno: string) {
  const { queryParams } = Linking.parse(urlRetorno);

  const accessToken = queryParams?.access_token as string | undefined;
  const refreshToken = queryParams?.refresh_token as string | undefined;
  const erro = queryParams?.erro as string | undefined;

  if (erro) {
    throw new Error(`Mercado Pago recusou a conexão: ${erro}`);
  }

  if (!accessToken) {
    throw new Error(
      'Não foi possível obter o token do Mercado Pago.'
    );
  }

  // Preserva a comissão configurada anteriormente (se houver), ou assume 5%
  const configuracaoAtual = await buscarConfiguracaoPagamento('mercadopago');
  const comissaoAtual = (configuracaoAtual as any)?.comissao ?? 5;

  await salvarConfiguracaoPagamento({
    provedor: 'mercadopago',
    accessToken,
    refreshToken: refreshToken ?? null,
    comissao: comissaoAtual,
  } as any);

  return { accessToken, refreshToken };
}

// ============================================================
// CRIAR COBRANÇA PIX (com Split de Pagamento / Comissão)
// ============================================================

export async function criarPixMercadoPago(params: {
  valor: number;
  descricao: string;
  emailComprador: string;
}) {
  const configuracao = await buscarConfiguracaoPagamento('mercadopago');

  if (!configuracao?.accessToken) {
    throw new Error(
      'Mercado Pago não está conectado. Conecte a conta antes de gerar o PIX.'
    );
  }

  // Pega a comissão salva no banco (ex: 5). Se não houver, assume 5% como padrão seguro.
  const percentualSalvo = (configuracao as any)?.comissao ?? 5; 
  const porcentagemComissao = percentualSalvo / 100; // Transforma 5 em 0.05
  
  // Calcula o valor em dinheiro da sua comissão
  const applicationFee = Number((params.valor * porcentagemComissao).toFixed(2));

  const resposta = await fetch(
    'https://api.mercadopago.com/v1/payments',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuracao.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction_amount: params.valor,
        description: params.descricao,
        payment_method_id: 'pix',
        payer: {
          email: params.emailComprador,
        },
        application_fee: applicationFee, // Taxa de comissão que vai direto para a sua conta
      }),
    }
  );

  const dados = await resposta.json();

  if (!resposta.ok) {
    console.log('ERRO AO CRIAR PIX MERCADO PAGO:', dados);
    throw new Error(
      dados?.message || 'Não foi possível gerar o PIX no Mercado Pago.'
    );
  }

  return {
    qrCodeBase64:
      dados?.point_of_interaction?.transaction_data?.qr_code_base64,
    qrCode: dados?.point_of_interaction?.transaction_data?.qr_code,
    id: dados?.id,
  };
}