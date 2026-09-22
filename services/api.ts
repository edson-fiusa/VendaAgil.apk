
import axios from 'axios';

export const API_URL = 'http://192.168.0.145:3000';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function fmt(valor: number | string | null | undefined) {
  const numero = Number(valor || 0);

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmt3(valor: number | string | null | undefined) {
  const numero = Number(valor || 0);

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/**
 * Testa se o celular consegue chegar ao backend.
 *
 * Não confundir:
 * - Internet funcionando
 * - Backend acessível
 *
 * O celular pode ter internet normalmente e ainda não conseguir
 * acessar o IP 192.168.0.145.
 */
export async function testarBackend() {
  try {
    await api.get('/', {
      timeout: 5000,
    });

    return {
      conectado: true,
      mensagem: 'Backend acessível.',
    };
  } catch (erro: any) {
    const codigo = erro?.code;
    const status = erro?.response?.status;

    console.log('ERRO AO ACESSAR BACKEND:', {
      codigo,
      status,
      mensagem: erro?.message,
      url: `${API_URL}/`,
    });

    // Se chegou até o servidor e ele respondeu com 404,
    // por exemplo, significa que o backend está acessível.
    if (status) {
      return {
        conectado: true,
        mensagem: `Backend acessível. HTTP ${status}.`,
      };
    }

    return {
      conectado: false,
      mensagem:
        'O celular não conseguiu acessar o backend em ' + API_URL,
    };
  }
}
