// Estrae righe prodotto plausibili dal testo grezzo OCR di uno scontrino.
// Nessuna AI: solo euristiche su formato/parole chiave. L'utente corregge e
// completa (nome, scadenza) nello step successivo — qui l'obiettivo è solo
// scartare rumore ovvio (prezzi, totali, intestazioni) e ripulire i residui
// di prezzo/quantità dalla fine di ogni riga prodotto.

// Righe che sono chiaramente NON un prodotto: intestazioni, totali, dati fiscali.
const NOISE_KEYWORDS = [
  'totale', 'subtotale', 'tot parziale', 'iva', 'contanti', 'resto', 'sconto',
  'cassa', 'cassiere', 'operatore', 'scontrino', 'documento commerciale',
  'p.iva', 'piva', 'partita iva', 'cod. fisc', 'codice fiscale', 'c.f.',
  'via ', 'viale ', 'piazza ', 'cap ', 'tel.', 'telefono', 'orario', 'grazie',
  'arrivederci', 'a presto', 'punti fedeltà', 'carta fedeltà', 'buono sconto',
  'pagamento', 'bancomat', 'carta di credito', 'n. articoli', 'numero articoli',
  'reso', 'importo', 'euro', 'valuta', 'scontrino fiscale', 'ricevuta fiscale',
];

// Riga che è solo un numero/prezzo (es. "3,50", "€ 3.50", "12.90 €").
const PURE_PRICE = /^[€\s]*\d+[.,]\d{2}[€\s]*$/;

// Riga che è solo una data o un orario.
const DATE_OR_TIME = /^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}$|^\d{1,2}:\d{2}(:\d{2})?$/;

// Prezzo/quantità finali da rimuovere dalla riga prodotto, es:
//   "PASTA BARILLA 2X 1,89"   -> "PASTA BARILLA"
//   "LATTE INTERO 1,20 €"     -> "LATTE INTERO"
//   "MELE FUJI KG 0,850 X 2,50 4,25" -> "MELE FUJI"
const TRAILING_PRICE_QTY = /\s+(?:\d+\s*[xX]\s*)?\d+[.,]\d{1,3}\s*(?:€|eur)?\s*$/;
const TRAILING_UNIT = /\s+(?:kg|g|ml|cl|l|pz|pza)\.?\s*\d*[.,]?\d*\s*$/i;

function stripTrailingPriceInfo(line: string): string {
  let out = line;
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out.replace(TRAILING_PRICE_QTY, '').replace(TRAILING_UNIT, '').trimEnd();
    if (out === before) break;
  }
  return out;
}

function isNoise(lowerLine: string): boolean {
  return NOISE_KEYWORDS.some((k) => lowerLine.includes(k));
}

export function parseReceiptLines(text: string): string[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const out: string[] = [];
  for (const raw of rawLines) {
    const lower = raw.toLowerCase();
    if (PURE_PRICE.test(raw) || DATE_OR_TIME.test(raw)) continue;
    if (isNoise(lower)) continue;

    const cleaned = stripTrailingPriceInfo(raw);
    // Scarta righe troppo corte o senza almeno una lettera (rimasugli di codici/numeri).
    if (cleaned.length < 2 || !/[a-zA-Zà-öø-ÿÀ-ÖØ-ß]/.test(cleaned)) continue;

    out.push(cleaned);
  }

  return out;
}
