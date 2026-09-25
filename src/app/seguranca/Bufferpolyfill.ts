// ============================================================
// POLYFILL DO BUFFER
//
// O pdf-lib-plus-encrypt (assim como vários pacotes portados do
// Node.js) espera encontrar o global "Buffer" disponível, do jeito
// que existe nativamente no Node. O React Native não tem isso por
// padrão — por isso instalamos o pacote "buffer" via:
//
//   npm install buffer
//
// e registramos aqui como global.
//
// IMPORTANTE: este arquivo precisa ser importado ANTES de qualquer
// outro import que use pdf-lib-plus-encrypt (direta ou
// indiretamente). O jeito mais seguro é importar como a PRIMEIRA
// linha do arquivo de entrada do app.
//
// Se o seu projeto usa Expo Router ou expo-router/entry, normalmente
// o entry point é o próprio "expo" (index.js gerado automaticamente).
// Nesse caso, crie (ou edite) um arquivo `index.js` na raiz do
// projeto assim:
//
//   import './utils/bufferPolyfill';
//   import 'expo-router/entry';
//
// Se o seu entry point for App.tsx (projeto sem expo-router), coloque
// como a primeira linha do App.tsx:
//
//   import './utils/bufferPolyfill';
//   // ...resto dos imports
// ============================================================

import { Buffer } from 'buffer';

// Usamos "globalThis" em vez de "global": é um objeto padrão da
// linguagem (não é específico do Node), então o TypeScript já
// reconhece o tipo sem precisar instalar @types/node — e funciona
// igual no Hermes (motor JS do React Native/Expo).
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

export {};