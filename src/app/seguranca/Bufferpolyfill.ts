
import { Buffer } from 'buffer';

// Usamos "globalThis" em vez de "global": é um objeto padrão da
// linguagem (não é específico do Node), então o TypeScript já
// reconhece o tipo sem precisar instalar @types/node — e funciona
// igual no Hermes (motor JS do React Native/Expo).
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

export {};