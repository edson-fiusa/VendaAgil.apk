import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ------------------------------------------------------------
// O módulo é nativo. Se o app instalado no celular foi compilado
// antes de o pacote existir, o require falha. Nesse caso o app
// abre SEM bloqueio (e avisa no console) em vez de quebrar.
// Depois de `npx expo run:android` o bloqueio passa a funcionar.
// ------------------------------------------------------------
let LocalAuthentication: typeof import('expo-local-authentication') | null =
  null;

try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  console.warn(
    'expo-local-authentication indisponível: bloqueio biométrico desligado. Recompile o app com "npx expo run:android".'
  );
}

// Tempo em segundo plano tolerado antes de pedir de novo.
const SEGUNDOS_TOLERANCIA = 30;

type Props = {
  children: ReactNode;
};

export function BloqueioBiometrico({ children }: Props) {
  const [bloqueado, setBloqueado] = useState(!!LocalAuthentication);
  const [mensagem, setMensagem] = useState('');

  const autenticando = useRef(false);
  const saiuEm = useRef<number | null>(null);

  const autenticar = useCallback(async () => {
    if (!LocalAuthentication || autenticando.current) {
      return;
    }

    autenticando.current = true;
    setMensagem('');

    try {
      const temHardware = await LocalAuthentication.hasHardwareAsync();
      const cadastrado = await LocalAuthentication.isEnrolledAsync();

      // Aparelho sem biometria nem tela de bloqueio: não há como
      // autenticar, então libera para não trancar o comerciante.
      if (!temHardware || !cadastrado) {
        setBloqueado(false);
        return;
      }

      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloqueie para usar o aplicativo',
        cancelLabel: 'Cancelar',
        // Permite PIN/padrão do aparelho se a digital falhar.
        disableDeviceFallback: false,
      });

      if (resultado.success) {
        setBloqueado(false);
      } else {
        setMensagem('Não foi possível desbloquear. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro na autenticação biométrica:', error);
      setMensagem('Erro ao autenticar. Tente novamente.');
    } finally {
      // Pequena folga: o retorno do diálogo dispara mudanças de
      // AppState que não devem contar como "voltou do fundo".
      setTimeout(() => {
        autenticando.current = false;
      }, 500);
    }
  }, []);

  // Pede a biometria ao abrir o app.
  useEffect(() => {
    autenticar();
  }, [autenticar]);

  // Trava de novo depois de um tempo em segundo plano.
  useEffect(() => {
    if (!LocalAuthentication) {
      return;
    }

    const assinatura = AppState.addEventListener(
      'change',
      (estado: AppStateStatus) => {
        if (autenticando.current) {
          return;
        }

        if (estado === 'background') {
          saiuEm.current = Date.now();
          return;
        }

        if (estado === 'active' && saiuEm.current !== null) {
          const segundos = (Date.now() - saiuEm.current) / 1000;
          saiuEm.current = null;

          if (segundos >= SEGUNDOS_TOLERANCIA) {
            setBloqueado(true);
            autenticar();
          }
        }
      }
    );

    return () => assinatura.remove();
  }, [autenticar]);

  return (
    <View style={estilos.raiz}>
      {/* Os filhos ficam montados: o carrinho e a tela atual não se perdem. */}
      {children}

      {bloqueado && (
        <View style={estilos.cobertura}>
          <Text style={estilos.icone}>🔒</Text>
          <Text style={estilos.titulo}>Aplicativo bloqueado</Text>

          {!!mensagem && <Text style={estilos.mensagem}>{mensagem}</Text>}

          <TouchableOpacity style={estilos.botao} onPress={autenticar}>
            <Text style={estilos.botaoTexto}>Desbloquear</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
  },
  cobertura: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
    elevation: 9999,
  },
  icone: {
    fontSize: 48,
    marginBottom: 12,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  mensagem: {
    fontSize: 14,
    color: '#fca5a5',
    textAlign: 'center',
    marginBottom: 12,
  },
  botao: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  botaoTexto: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});