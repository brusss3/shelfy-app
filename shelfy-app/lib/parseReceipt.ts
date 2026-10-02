// Estrae da un testo grezzo OCR di scontrino le righe prodotto con il loro
// prezzo, la catena e la data. Nessuna AI: solo euristiche su formato e parole
// chiave. L'utente corregge e completa nello step successivo: qui l'obiettivo
// è scartare il rumore ovvio (totali, intestazioni, dati fiscali), legare ogni
// nome al suo prezzo e non inventare nulla quando il formato è ambiguo.

export interface ReceiptLine {
  name: string;
  /** Prezzo di una confezione in centesimi; null se non è leggibile o non è
   *  confrontabile (merce a peso, sconti). */
  priceCents: number | null;
}

export interface ParsedReceipt {
  lines: ReceiptLine[];
  /** Catena riconosciuta dall'intestazione (stessi nomi di CHAINS in prices.ts). */
  chain: string | null;
  /** Data dello scontrino, AAAA-MM-GG, solo se plausibile (non futura, entro 30 giorni). */
  date: string | null;
}

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

const CHAIN_PATTERNS: [RegExp, string][] = [
  [/\b(ipercoop|unicoop|coop)\b/i, 'Coop'],
  [/\bconad\b/i, 'Conad'],
  [/\besselunga\b/i, 'Esselunga'],
  [/\bcarrefour\b/i, 'Carrefour'],
  [/\blidl\b/i, 'Lidl'],
  [/\beurospin\b/i, 'Eurospin'],
  [/\bmd\s*(s\.?p\.?a\.?|discount)?\b/i, 'MD'],
  [/\baldi\b/i, 'Aldi'],
  [/\b(pam|panorama)\b/i, 'Pam'],
  [/\bfamila\b/i, 'Famila'],
  [/\bpenny\b/i, 'Penny'],
  [/\biperal\b/i, 'Iperal'],
];

// Riga che è solo un prezzo (es. "3,50", "€ 3.50", "12.90 €", "1,89 A").
const PRICE_ONLY = /^[€\s]*\d{1,4}[.,]\d{2}\s*(?:€|eur)?\s*[A-Za-z*]?\s*$/;

// Riga che è solo una data o un orario.
const DATE_OR_TIME = /^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}$|^\d{1,2}:\d{2}(:\d{2})?$/;

// Prezzo a fine riga, con l'eventuale lettera dell'aliquota IVA ("1,89 A", "1,89 *").
const PRICE_AT_END = /(?:^|\s)(-?\d{1,4}[.,]\d{2})\s*(?:€|eur)?\s*[A-Za-z*]?\s*$/i;
// "2 x 1,89 3,78": quantità, prezzo unitario, totale di riga.
const QTY_UNIT_TOTAL = /(\d+)\s*[xX*]\s*(\d{1,4}[.,]\d{2})\s+\d{1,4}[.,]\d{2}\s*(?:€|eur)?\s*[A-Za-z*]?\s*$/i;
// Merce a peso: "KG", oppure un peso a tre decimali ("0,850").
const WEIGHED = /\bkg\b|\d[.,]\d{3}(?!\d)/i;

// Prezzo/quantità finali da rimuovere dalla riga prodotto, es:
//   "PASTA BARILLA 2X 1,89"   -> "PASTA BARILLA"
//   "LATTE INTERO 1,20 €"     -> "LATTE INTERO"
//   "MELE FUJI KG 0,850 X 2,50 4,25" -> "MELE FUJI"
const TRAILING_PRICE_QTY = /\s+(?:\d+\s*[xX*]\s*)?-?\d+[.,]\d{1,3}\s*(?:€|eur)?\s*[A-Za-z*]?\s*$/;
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

const toCents = (s: string): number => Math.round(parseFloat(s.replace(',', '.')) * 100);

/** Prezzo di una confezione dalla riga, o null se non c'è o non è confrontabile. */
function priceOfLine(raw: string): number | null {
  if (WEIGHED.test(raw)) return null;
  const qty = raw.match(QTY_UNIT_TOTAL);
  const cents = qty ? toCents(qty[2]) : (() => {
    const m = raw.match(PRICE_AT_END);
    return m ? toCents(m[1]) : null;
  })();
  // Prezzi sotto 0,01 € o sopra 999 € non sono di un prodotto (il server li scarta).
  return cents !== null && cents >= 1 && cents <= 99900 ? cents : null;
}

function detectChain(lines: string[]): string | null {
  // L'intestazione sta in testa: guardare tutto lo scontrino farebbe
  // riconoscere "MD" in qualsiasi riga.
  const head = lines.slice(0, 15).join('\n');
  for (const [re, chain] of CHAIN_PATTERNS) if (re.test(head)) return chain;
  return null;
}

function detectDate(text: string, now: Date): string | null {
  const re = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/g;
  for (const m of text.matchAll(re)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const d = new Date(year, month - 1, day, 12);
    if (d.getMonth() !== month - 1) continue;
    const ageDays = (now.getTime() - d.getTime()) / 86400000;
    if (ageDays < -0.5 || ageDays > 30) continue;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

export function parseReceipt(text: string, now: Date = new Date()): ParsedReceipt {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const lines: ReceiptLine[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const lower = raw.toLowerCase();
    if (PRICE_ONLY.test(raw) || DATE_OR_TIME.test(raw)) continue;
    if (isNoise(lower)) continue;

    // Sconti e resi (importo negativo) non sono prodotti.
    if (/-\s*\d+[.,]\d{2}/.test(raw)) continue;

    const cleaned = stripTrailingPriceInfo(raw);
    // Scarta righe troppo corte o senza almeno una lettera (rimasugli di codici/numeri).
    if (cleaned.length < 2 || !/[a-zA-Zà-öø-ÿÀ-ÖØ-ß]/.test(cleaned)) continue;

    let priceCents = priceOfLine(raw);
    // Il nome della catena nell'intestazione non è un prodotto.
    if (priceCents === null && i < 15 && CHAIN_PATTERNS.some(([re]) => re.test(raw))) continue;
    // Molti scontrini stampano il prezzo sulla riga dopo il nome.
    if (priceCents === null && !WEIGHED.test(raw) && i + 1 < rawLines.length && PRICE_ONLY.test(rawLines[i + 1])) {
      priceCents = priceOfLine(rawLines[i + 1]);
    }
    lines.push({ name: cleaned, priceCents });
  }

  return { lines, chain: detectChain(rawLines), date: detectDate(text, now) };
}
