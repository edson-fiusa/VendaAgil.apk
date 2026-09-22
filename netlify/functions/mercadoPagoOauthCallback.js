// ============================================================
// netlify/functions/mercadoPagoOauthCallback.js
//
// Configure as variáveis de ambiente no painel do Netlify em
// Site settings > Environment variables:
//   MERCADOPAGO_CLIENT_ID
//   MERCADOPAGO_CLIENT_SECRET
// ============================================================

const MP_CLIENT_ID = process.env.MERCADOPAGO_CLIENT_ID;
const MP_CLIENT_SECRET = process.env.MERCADOPAGO_CLIENT_SECRET;

// Depois do primeiro deploy, troque pela URL pública real desta
// function (veja o passo a passo no README.md deste repositório).
const REDIRECT_URI_DESTA_FUNCAO = 'https://vendaagil.netlify.app/.netlify/functions/mercadoPagoOauthCallback';

  // Esquema de deep link do seu app (o mesmo do app.json)
  const ESQUEMA_APP = 'vendaagil';

  exports.handler = async function handler(event) {
    const { code, state, error } = event.queryStringParameters || {};

    // "state" veio do app contendo o deep link exato de retorno
    const deepLinkDeRetorno = state || `${ESQUEMA_APP}://mp-callback`;

    function redirecionarPara(urlFinal) {
      return {
        statusCode: 302,
        headers: { Location: urlFinal },
        body: '',
      };
    }

    if (error) {
      return redirecionarPara(
        `${deepLinkDeRetorno}?erro=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return redirecionarPara(
        `${deepLinkDeRetorno}?erro=codigo_ausente`
      );
    }

    try {
      const resposta = await fetch(
        'https://api.mercadopago.com/oauth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: MP_CLIENT_ID,
            client_secret: MP_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI_DESTA_FUNCAO,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        console.log('ERRO AO TROCAR CODE POR TOKEN:', dados);

        return redirecionarPara(
          `${deepLinkDeRetorno}?erro=${encodeURIComponent(
            dados?.message || 'falha_ao_obter_token'
          )}`
        );
      }

      return redirecionarPara(
        `${deepLinkDeRetorno}` +
          `?access_token=${encodeURIComponent(dados.access_token)}` +
          `&refresh_token=${encodeURIComponent(dados.refresh_token)}`
      );
    } catch (erroInesperado) {
      console.log('ERRO INESPERADO NO OAUTH CALLBACK:', erroInesperado);

      return redirecionarPara(
        `${deepLinkDeRetorno}?erro=erro_inesperado`
      );
    }
  };
