// OCR web/PWA via Tesseract.js. Gira interamente nel browser.
// I dati lingua (~2-4 MB) sono scaricati dal CDN al primo uso e poi messi in
// cache dal browser. 'ita+eng' copre le diciture italiane ("scad", "entro").
import { createWorker, type Worker } from 'tesseract.js';
import { rowsFromBoxes, type OcrBox } from './ocrRows';

interface TessLine {
  text?: string;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

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
  // Tesseract può leggere le colonne di uno scontrino una alla volta: le righe
  // vengono ricomposte dalle coordinate (vedi ocrRows.ts).
  const boxes: OcrBox[] = ((data as { lines?: TessLine[] }).lines ?? []).map((l) => ({
    text: l.text ?? '',
    left: l.bbox?.x0 ?? NaN,
    top: l.bbox?.y0 ?? NaN,
    width: (l.bbox?.x1 ?? NaN) - (l.bbox?.x0 ?? NaN),
    height: (l.bbox?.y1 ?? NaN) - (l.bbox?.y0 ?? NaN),
  }));
  return rowsFromBoxes(boxes) || (data.text ?? '');
}
