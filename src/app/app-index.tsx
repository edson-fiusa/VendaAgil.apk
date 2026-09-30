import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inicializarBanco } from '../../src/database/banco';
import { useOrientacaoDispositivo } from '../useOrientacaoDispositivo';
import { estilos } from './Estilos';
import { useLicencaTeste } from './Uselicencateste';
import { useSessao } from './Usesessao';
import { PainelAdmin } from './Paineladmin';
import { TelaLogin } from './Telalogin';
import { TelaBloqueioTeste, TelaCarregamentoTeste } from './Telateste';
import Caixa from './caixa';

export default function Index() {
  const { isPaisagem, isLadoALado: isLargo } = useOrientacaoDispositivo();

  const [bancoPronto, setBancoPronto] = useState(false);
  const [erroBanco, setErroBanco] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function prepararBanco() {
      try {
        await inicializarBanco();

        if (ativo) {
          setBancoPronto(true);
          setErroBanco(null);
        }
      } catch (error: any) {
        console.error('Erro ao inicializar banco local:', error);

        if (ativo) {
          setBancoPronto(false);
          setErroBanco(
            error?.message || 'Não foi possível inicializar o banco local.'
          );
        }
      }
    }

    prepararBanco();

    return () => {
      ativo = false;
    };
  }, []);

  const licenca = useLicencaTeste(bancoPronto);
  const sessao = useSessao(bancoPronto, erroBanco);

  if (licenca.verificandoTeste) {
    return <TelaCarregamentoTeste />;
  }

  if (licenca.testeExpirado && !licenca.appDesbloqueado) {
    return (
      <TelaBloqueioTeste
        isLargo={isLargo}
        diasTeste={licenca.DIAS_TESTE}
        senhaDesbloqueio={licenca.senhaDesbloqueio}
        setSenhaDesbloqueio={licenca.setSenhaDesbloqueio}
        verificandoSenha={licenca.verificandoSenha}
        desbloquearComSenha={licenca.desbloquearComSenha}
      />
    );
  }

  if (sessao.tela === 'login') {
    return (
      <TelaLogin
        isPaisagem={isPaisagem}
        isLargo={isLargo}
        bancoPronto={bancoPronto}
        telaLogin={sessao.telaLogin}
        setTelaLogin={sessao.setTelaLogin}
        usuario={sessao.usuario}
        setUsuario={sessao.setUsuario}
        senha={sessao.senha}
        setSenha={sessao.setSenha}
        operadorUsuario={sessao.operadorUsuario}
        setOperadorUsuario={sessao.setOperadorUsuario}
        operadorSenha={sessao.operadorSenha}
        setOperadorSenha={sessao.setOperadorSenha}
        carregando={sessao.carregando}
        loginAdmin={sessao.loginAdmin}
        loginAdminComBiometria={sessao.loginAdminComBiometria}
        loginCaixa={sessao.loginCaixa}
        mostrarBoasVindas={licenca.mostrarBoasVindas}
        setMostrarBoasVindas={licenca.setMostrarBoasVindas}
        diasRestantesTeste={licenca.diasRestantesTeste}
        diasTeste={licenca.DIAS_TESTE}
      />
    );
  }

  if (sessao.tela === 'admin') {
    return (
      <PainelAdmin
        telaAdmin={sessao.telaAdmin}
        setTelaAdmin={sessao.setTelaAdmin}
        isLargo={isLargo}
        onSair={sessao.sair}
      />
    );
  }

  if (sessao.tela === 'caixa') {
    return (
      <SafeAreaView style={estilos.container}>
        <Caixa
          operador={sessao.operador}
          caixa={sessao.caixa}
          onLogout={sessao.sair}
        />
      </SafeAreaView>
    );
  }

  return null;
}