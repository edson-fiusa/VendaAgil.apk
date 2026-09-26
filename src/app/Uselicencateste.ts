import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { verificarSenhaMestre } from './seguranca/seguranca';
import { obterConfig, salvarConfig } from './ConfigLocal';

const DIAS_TESTE = 30;

/**
 * Hook que controla o período de teste gratuito de 30 dias e o
 * desbloqueio do app via senha mestre.
 *
 * Só começa a verificar quando `bancoPronto` for true.
 */
export function useLicencaTeste(bancoPronto: boolean) {
  const [verificandoTeste, setVerificandoTeste] = useState(true);
  const [testeExpirado, setTesteExpirado] = useState(false);
  const [appDesbloqueado, setAppDesbloqueado] = useState(false);
  const [diasRestantesTeste, setDiasRestantesTeste] = useState(DIAS_TESTE);
  const [mostrarBoasVindas, setMostrarBoasVindas] = useState(false);
  const [senhaDesbloqueio, setSenhaDesbloqueio] = useState('');
  const [verificandoSenha, setVerificandoSenha] = useState(false);

  async function verificarPeriodoTeste() {
    try {
      // Se já foi desbloqueado com a senha em algum momento,
      // libera direto, sem checar datas.
      const ativado = await obterConfig('app_ativado');

      if (ativado === '1') {
        setAppDesbloqueado(true);
        setTesteExpirado(false);
        return;
      }

      let dataInstalacaoTexto = await obterConfig('data_instalacao');

      if (!dataInstalacaoTexto) {
        dataInstalacaoTexto = new Date().toISOString();
        await salvarConfig('data_instalacao', dataInstalacaoTexto);
      }

      const dataInstalacao = new Date(dataInstalacaoTexto).getTime();
      const agora = Date.now();

      const diasPassados = Math.floor(
        (agora - dataInstalacao) / (1000 * 60 * 60 * 24)
      );

      const restantes = DIAS_TESTE - diasPassados;

      if (restantes > 0) {
        setDiasRestantesTeste(restantes);
        setTesteExpirado(false);
        setAppDesbloqueado(false);
        setMostrarBoasVindas(true);
      } else {
        setDiasRestantesTeste(0);
        setTesteExpirado(true);
        setAppDesbloqueado(false);
      }
    } catch (error: any) {
      console.error('Erro ao verificar período de teste:', error);

      // Se der algum erro ao verificar (ex.: banco com problema),
      // não travamos o uso do app por causa disso.
      setAppDesbloqueado(true);
      setTesteExpirado(false);
    } finally {
      setVerificandoTeste(false);
    }
  }

  useEffect(() => {
    if (bancoPronto) {
      verificarPeriodoTeste();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bancoPronto]);

  async function desbloquearComSenha() {
    const digitado = senhaDesbloqueio.trim();

    if (!digitado) {
      Alert.alert('Atenção', 'Informe a senha de desbloqueio.');
      return;
    }

    try {
      setVerificandoSenha(true);

      const correta = verificarSenhaMestre(digitado);

      if (!correta) {
        Alert.alert('Senha incorreta', 'A senha informada está incorreta.');
        return;
      }

      await salvarConfig('app_ativado', '1');

      setAppDesbloqueado(true);
      setTesteExpirado(false);
      setSenhaDesbloqueio('');
    } catch (error: any) {
      console.error('Erro ao desbloquear com senha:', error);

      Alert.alert(
        'Erro',
        error?.message || 'Não foi possível validar a senha agora.'
      );
    } finally {
      setVerificandoSenha(false);
    }
  }

  return {
    DIAS_TESTE,
    verificandoTeste,
    testeExpirado,
    appDesbloqueado,
    diasRestantesTeste,
    mostrarBoasVindas,
    setMostrarBoasVindas,
    senhaDesbloqueio,
    setSenhaDesbloqueio,
    verificandoSenha,
    desbloquearComSenha,
  };
}