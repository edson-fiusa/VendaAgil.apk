import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Device from 'expo-device';

// ============================================================
// DETECÇÃO DE TABLET
//
// Não usamos só a "largura atual" (isso muda quando o aparelho
// gira!). Usamos o MENOR lado da tela (menorLado), que é uma
// característica fixa do aparelho e não muda com a rotação:
// um tablet continua "grande" tanto deitado quanto em pé.
//
// Como reforço, também perguntamos pro sistema operacional
// (expo-device) se ele classifica o aparelho como TABLET.
// ============================================================

const LARGURA_MINIMA_TABLET = 600;

function calcularSeEhTablet(width: number, height: number) {
  const menorLado = Math.min(width, height);

  const pareceTabletPeloTamanho =
    menorLado >= LARGURA_MINIMA_TABLET;

  const sistemaDizQueEhTablet =
    Device.deviceType === Device.DeviceType.TABLET;

  return pareceTabletPeloTamanho || sistemaDizQueEhTablet;
}

export type OrientacaoDispositivo = {
  width: number;
  height: number;
  isTablet: boolean;
  isPaisagem: boolean;
  isLadoALado: boolean;
};

// ============================================================
// HOOK PRINCIPAL
//
// - Detecta tablet x celular.
// - Quando é TABLET, trava a tela em PAISAGEM (deitado).
// - Quando é CELULAR, deixa livre em retrato (padrão do app).
// - Fica escutando o evento de rotação do expo-screen-orientation
//   E também o useWindowDimensions (o React Native já dispara
//   isso sozinho a cada rotação), então qualquer componente que
//   usar este hook é atualizado automaticamente ao girar o
//   aparelho, sem precisar recarregar a tela.
// ============================================================

export function useOrientacaoDispositivo(): OrientacaoDispositivo {
  const { width, height } = useWindowDimensions();

  const isTablet = calcularSeEhTablet(width, height);
  const isPaisagem = width > height;

  // Tablet sempre deitado; celular também conta como "lado a
  // lado" quando já está deitado (largura maior que altura),
  // então o layout de PDV com duas colunas aparece nos dois
  // casos, mesmo antes da trava de orientação ser aplicada.
  const isLadoALado = isTablet || isPaisagem;

  const jaTravouRef = useRef<'tablet' | 'celular' | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function aplicarTravaDeOrientacao() {
      try {
        if (isTablet) {
          if (jaTravouRef.current === 'tablet') {
            return;
          }

          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.LANDSCAPE
          );

          if (!cancelado) {
            jaTravouRef.current = 'tablet';
          }
        } else {
          if (jaTravouRef.current === 'celular') {
            return;
          }

          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP
          );

          if (!cancelado) {
            jaTravouRef.current = 'celular';
          }
        }
      } catch (erro) {
        // Em alguns ambientes (ex.: Expo Go/web) a API pode não
        // estar disponível. Não deve derrubar o app por isso.
        console.log(
          'Não foi possível travar a orientação da tela:',
          erro
        );
      }
    }

    aplicarTravaDeOrientacao();

    return () => {
      cancelado = true;
    };
    // Reavalia sempre que a classificação tablet/celular mudar
    // (ex.: um app rodando numa tela dobrável, ou emulador
    // trocando de perfil de dispositivo em tempo real).
  }, [isTablet]);

  // ==========================================================
  // ESCUTA EXPLÍCITA DE MUDANÇA DE ROTAÇÃO
  //
  // O useWindowDimensions já é reativo, mas em alguns aparelhos
  // Android o evento nativo do expo-screen-orientation chega
  // antes/depois do resize da view. Escutamos os dois para
  // garantir que nada fique com layout desatualizado por um
  // instante após o giro.
  // ==========================================================

  const [, forcarAtualizacao] = useState(0);

  useEffect(() => {
    const assinatura =
      ScreenOrientation.addOrientationChangeListener(() => {
        forcarAtualizacao((valor) => valor + 1);
      });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(
        assinatura
      );
    };
  }, []);

  return { width, height, isTablet, isPaisagem, isLadoALado };
}