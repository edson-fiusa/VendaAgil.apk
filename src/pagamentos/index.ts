  import { buscarProvedorAtivo } from './bancoPagamento';
  import { criarPixMercadoPago, conectarMercadoPago } from './mercadoPago';

  export {
    conectarMercadoPago,
    criarPixMercadoPago,
  };

  // ============================================================
  // GERAR PIX COM O MERCADO PAGO
  // (isso é o que sua tela de checkout deve chamar)
  // ============================================================

  export async function gerarCobrancaPix(params: {
    valor: number;
    descricao: string;
    emailComprador: string;
  }) {
    const provedor = await buscarProvedorAtivo();

    if (!provedor) {
      throw new Error(
        'Nenhuma forma de recebimento PIX configurada. Vá em Configurações e conecte o Mercado Pago.'
      );
    }

    return criarPixMercadoPago({
      valor: params.valor,
      descricao: params.descricao,
      emailComprador: params.emailComprador,
    });
  }