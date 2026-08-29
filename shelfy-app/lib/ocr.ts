// Interfaccia OCR condivisa. L'implementazione reale è risolta da Metro per
// piattaforma: ocr.native.ts (ML Kit) su iOS/Android, ocr.web.ts (Tesseract.js)
// sul web/PWA. Questo file è il fallback/typing comune.
export interface OcrResult {
  text: string;
}

// Fallback/typing: nessuna implementazione OCR su questa piattaforma.
export const ocrAvailable = false;

// Riconosce il testo in un'immagine (URI locale o data URL) e lo ritorna grezzo.
export async function recognizeText(_uri: string): Promise<string> {
  throw new Error('recognizeText non implementato per questa piattaforma');
}
