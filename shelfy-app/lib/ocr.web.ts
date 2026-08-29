// OCR web/PWA via Tesseract.js. Gira interamente nel browser.
// I dati lingua (~2-4 MB) sono scaricati dal CDN al primo uso e poi messi in
// cache dal browser. 'ita+eng' copre le diciture italiane ("scad", "entro").
import { createWorker, type Worker } from 'tesseract.js';

// Sul web l'OCR è sempre disponibile (Tesseract.js gira nel browser).
export const ocrAvailable = true;

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('ita+eng');
  }
  return workerPromise;
}

export async function recognizeText(uri: string): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(uri);
  return data.text ?? '';
}
