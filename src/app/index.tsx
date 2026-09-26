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

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function Index() {
  // Hook central: detecta tablet x celular, TRAVA a orientação
  // (tablet = deitado, celular = em pé) e reage sozinho a
  // qualquer rotação do aparelho, atualizando o layout.
  const { isPaisagem, isLadoALado: isLargo } = useOrientacaoDispositivo();

  // ============================================================
  // BANCO LOCAL
  // ============================================================

  const [bancoPronto, setBancoPronto] = useState(false);
  const [erroBanco, setErroBanco] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function prepararBanco() {
      try {
        console.log('Inicializando banco SQLite local...');

        await inicializarBanco();

        if (ativo) {
          setBancoPronto(true);
          setErroBanco(null);
        }

        console.log('Banco SQLite local inicializado.');
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

  // ============================================================
  // TELA DE VERIFICAÇÃO DO PERÍODO DE TESTE
  // ============================================================

  if (licenca.verificandoTeste) {
    return <TelaCarregamentoTeste />;
  }

  // ============================================================
  // TELA DE BLOQUEIO (TESTE EXPIRADO)
  // ============================================================

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

  // ============================================================
  // LOGIN
  // ============================================================

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
        loginCaixa={sessao.loginCaixa}
        mostrarBoasVindas={licenca.mostrarBoasVindas}
        setMostrarBoasVindas={licenca.setMostrarBoasVindas}
        diasRestantesTeste={licenca.diasRestantesTeste}
        diasTeste={licenca.DIAS_TESTE}
      />
    );
  }

  // ============================================================
  // ADMIN
  // ============================================================

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

  // ============================================================
  // CAIXA
  // ============================================================

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