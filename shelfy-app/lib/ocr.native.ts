// OCR nativo (iOS/Android) via Google ML Kit on-device. Gratis, offline.
// Richiede una build EAS/dev-client: NON funziona in Expo Go (il modulo nativo
// RNTextRecognition non è incluso nel binario di Expo Go).
import Constants from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Require pigro e protetto: in Expo Go il modulo non è linkato. Non deve
// rompere l'import del file (altrimenti crasha la schermata che lo usa).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TextRecognition: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
} catch {
  TextRecognition = null;
}

// L'OCR nativo è disponibile solo in una build nativa (dev-client/produzione),
// mai in Expo Go.
export const ocrAvailable = !isExpoGo && !!TextRecognition;

export async function recognizeText(uri: string): Promise<string> {
  if (!ocrAvailable || !TextRecognition) {
    throw new Error(
      'OCR non disponibile in Expo Go. Richiede una build nativa (expo run:android / build).',
    );
  }
  const result = await TextRecognition.recognize(uri);
  return result.text ?? '';
}
