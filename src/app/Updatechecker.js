import React, { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

/**

 * Como usar:
 * 1. Copie este arquivo para a raiz do seu projeto (ex: components/UpdateChecker.js)
 * 2. No seu App.js (ou app/_layout.tsx se usar expo-router), importe e renderize:
 *
 *    import UpdateChecker from './UpdateChecker';
 *    ...
 *    export default function App() {
 *      return (
 *        <>
 *          <UpdateChecker />
 *          <RestoDoSeuApp />
 *        </>
 *      );
 *    }
 *
 * Ele não renderiza nada visualmente — só roda a lógica de checagem.
 */
export default function UpdateChecker() {
  const appState = useRef(AppState.currentState);

  async function checkForUpdate() {
    // Em desenvolvimento (Expo Go / dev build sem publish) isso não funciona,
    // então evitamos rodar e gerar erro no console.
    if (__DEV__) return;

    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        Alert.alert(
          'Atualização disponível',
          'Uma nova versão do app está disponível. Deseja atualizar agora?',
          [
            { text: 'Depois', style: 'cancel' },
            {
              text: 'Atualizar',
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync(); // reinicia o app já com a nova versão
                } catch (err) {
                  Alert.alert('Erro ao atualizar', String(err));
                }
              },
            },
          ],
          { cancelable: true }
        );
      }
    } catch (error) {
      // Falha silenciosa é ok aqui (ex: sem internet)
      console.log('Erro ao checar atualização:', error);
    }
  }

  useEffect(() => {
    // Checa assim que o app abre
    checkForUpdate();

    // Checa também toda vez que o app volta pro primeiro plano
    // (ex: usuário minimizou e voltou)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkForUpdate();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  return null; // não renderiza nada na tela
}