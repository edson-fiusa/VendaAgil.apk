import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Device from 'expo-device';

// ============================================================
// DETECÇÃO DE TABLET
//
// Usamos o MENOR lado da tela (menorLado), que é uma
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
// - O APP NUNCA GIRA. Celular e tablet ficam sempre travados em
//   retrato (PORTRAIT_UP). Isso é intencional.
// - "isTablet" e "isLadoALado" servem só para as TELAS saberem
//   que estão rodando num aparelho maior e ajustarem o LAYOUT
//   (colunas, tamanhos, larguras máximas) — nunca a rotação.
//   Um tablet em pé já tem largura de sobra pra um layout de
//   duas colunas, por exemplo.
// ============================================================

export function useOrientacaoDispositivo(): OrientacaoDispositivo {
  const { width, height } = useWindowDimensions();

  const isTablet = calcularSeEhTablet(width, height);

  // Como o app está sempre travado em retrato, isso deve ser
  // sempre "false" na prática. Mantido só por segurança/typing,
  // caso algum dia essa trava seja revista.
  const isPaisagem = width > height;

  // O layout "adaptado" (duas colunas, cards maiores, etc.)
  // depende só de ser tablet — não depende mais de orientação,
  // já que tablet em pé também tem espaço de sobra.
  const isLadoALado = isTablet;

  const jaTravouRef = useRef(false);

  useEffect(() => {
    if (jaTravouRef.current) {
      return;
    }

    let cancelado = false;

    async function travarEmRetrato() {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );

        if (!cancelado) {
          jaTravouRef.current = true;
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

    travarEmRetrato();

    return () => {
      cancelado = true;
    };
  }, []);

  return { width, height, isTablet, isPaisagem, isLadoALado };
}   