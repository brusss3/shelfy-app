// Estrae una data di scadenza dal testo grezzo restituito dall'OCR.
// Le date sulle confezioni hanno formati molto vari:
//   12/03/2026  ·  12.03.26  ·  12 03 2026  ·  03/2026  ·  12/26
//   "scad. 12 2026"  ·  "da consumarsi entro il 12 mar 2026"
// Strategia: trova tutte le date plausibili, poi scegli la più probabile
// scadenza (la data futura più lontana entro un orizzonte ragionevole).

const MONTHS: Record<string, number> = {
  gen: 1, gennaio: 1, jan: 1, january: 1,
  feb: 2, febbraio: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  apr: 4, aprile: 4, april: 4,
  mag: 5, maggio: 5, may: 5,
  giu: 6, giugno: 6, jun: 6, june: 6,
  lug: 7, luglio: 7, jul: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, sett: 9, settembre: 9, sep: 9, september: 9,
  ott: 10, ottobre: 10, oct: 10, october: 10,
  nov: 11, novembre: 11, november: 11,
  dic: 12, dicembre: 12, dec: 12, december: 12,
};

// Normalizza un anno a 2 o 4 cifre in un anno pieno, verificando che sia plausibile.
function normYear(y: number, currentYear = new Date().getFullYear(), maxYears = 8): number | null {
  let fullYear = y;
  if (y < 100) {
    // Es. se siamo nel 2026, anni accettabili a 2 cifre sono circa 24..35
    fullYear = 2000 + y;
  }
  // Se l'anno è fuori da una finestra sensata (es. da 1 anno fa fino a maxYears nel futuro), scartalo
  if (fullYear < currentYear - 1 || fullYear > currentYear + maxYears + 2) {
    return null;
  }
  return fullYear;
}

function isValid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Ultimo giorno del mese (per date senza giorno, es. "03/2026").
function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export interface ParsedDate {
  iso: string;
  /** Confidenza: 'full' (gg/mm/aaaa) o 'monthYear' (solo mm/aaaa). */
  precision: 'full' | 'monthYear';
}

export type DateFormat = 'dmy' | 'mdy' | 'ymd' | 'my' | 'auto';

// Trova tutte le date candidate nel testo.
function findCandidates(text: string, format: DateFormat = 'auto', maxYears = 8): ParsedDate[] {
  const out: ParsedDate[] = [];
  const currentYear = new Date().getFullYear();

  // Rimuoviamo pattern di prezzi, pesi, percentuali e calorie prima della tokenizzazione
  // Es: 3.50€, 1.50 eur, 250 g, 500ml, 12.5%
  const sanitized = text
    .replace(/\b\d+([.,]\d+)?\s*(?:€|eur|euro|g|kg|ml|cl|l|kcal|kj|%)\b/gi, ' ')
    .toLowerCase();

  const t = sanitized.replace(/[^\w\/\.\-\s]/g, ' ');

  // 0) Data ISO anno-mese-giorno: aaaa sep mm sep gg  (es. 2026-03-12).
  if (format === 'ymd' || format === 'auto') {
    const ymd = /\b(20\d{2})\s*[\/\.\-\s]\s*(\d{1,2})\s*[\/\.\-\s]\s*(\d{1,2})\b/g;
    for (const mtch of t.matchAll(ymd)) {
      const y = parseInt(mtch[1]), mo = parseInt(mtch[2]), d = parseInt(mtch[3]);
      const validY = normYear(y, currentYear, maxYears);
      if (validY && isValid(validY, mo, d)) out.push({ iso: toISO(validY, mo, d), precision: 'full' });
    }
  }

  // 1) Data completa: gg sep mm sep aaaa  (sep = / . - o spazio).
  if (format === 'dmy' || format === 'mdy' || format === 'auto') {
    const full = /\b(\d{1,2})\s*[\/\.\-\s]\s*(\d{1,2})\s*[\/\.\-\s]\s*(\d{2,4})\b/g;
    for (const mtch of t.matchAll(full)) {
      const a = parseInt(mtch[1]), b = parseInt(mtch[2]);
      const rawYear = parseInt(mtch[3]);
      const y = normYear(rawYear, currentYear, maxYears);
      if (!y) continue;

      let d: number, mo: number;
      if (format === 'mdy') {
        mo = a; d = b;
      } else if (format === 'dmy') {
        d = a; mo = b;
      } else {
        // auto: euristica europea, ribaltata se un numero supera 12.
        d = a; mo = b;
        if (a > 12 && b <= 12) { d = a; mo = b; }
        else if (b > 12 && a <= 12) { d = b; mo = a; }
      }
      if (isValid(y, mo, d)) out.push({ iso: toISO(y, mo, d), precision: 'full' });
    }
  }

  // 2) Data con mese testuale: gg mese aaaa  oppure  mese aaaa
  const named = /\b(?:(\d{1,2})\s+)?([a-z]{3,9})\.?\s+(\d{2,4})\b/g;
  for (const mtch of t.matchAll(named)) {
    const mo = MONTHS[mtch[2]];
    if (!mo) continue;
    const rawYear = parseInt(mtch[3]);
    const y = normYear(rawYear, currentYear, maxYears);
    if (!y) continue;
    const d = mtch[1] ? parseInt(mtch[1]) : lastDayOfMonth(y, mo);
    if (isValid(y, mo, d)) {
      out.push({ iso: toISO(y, mo, d), precision: mtch[1] ? 'full' : 'monthYear' });
    }
  }

  // 3) Solo mese/anno: mm sep aaaa  (es. 03/2026 o 12/26 con separatore esplicito)
  // Richiede separatore esplicito (/ . -) per evitare match su parole/numeri sparsi
  if (format === 'my' || format === 'auto') {
    const my = /\b(\d{1,2})\s*[\/\.\-]\s*(\d{2,4})\b/g;
    for (const mtch of t.matchAll(my)) {
      const mo = parseInt(mtch[1]);
      const rawYear = parseInt(mtch[2]);
      const y = normYear(rawYear, currentYear, maxYears);
      if (!y || mo < 1 || mo > 12) continue;
      const iso = toISO(y, mo, lastDayOfMonth(y, mo));
      // Evita di duplicare date già catturate come "full".
      if (!out.some((c) => c.iso.startsWith(`${y}-${String(mo).padStart(2, '0')}`))) {
        out.push({ iso, precision: 'monthYear' });
      }
    }
  }

  return out;
}

/**
 * Sceglie la data di scadenza più probabile dal testo OCR.
 * Preferisce date con precisione 'full' e all'interno della finestra futura plausibile.
 */
export function parseExpiry(text: string, format: DateFormat = 'auto', maxYears = 8): string | null {
  const candidates = findCandidates(text, format, maxYears);
  if (candidates.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setFullYear(horizon.getFullYear() + maxYears);

  // Filtra candidati nella finestra temporale
  const inWindow = candidates.filter((c) => {
    const d = new Date(c.iso + 'T00:00:00');
    return d >= today && d <= horizon;
  });

  const pool = inWindow.length > 0 ? inWindow : candidates;

  // Preferiamo date complete ('full') e le date future ragionevoli
  pool.sort((a, b) => {
    if (a.precision === 'full' && b.precision !== 'full') return -1;
    if (b.precision === 'full' && a.precision !== 'full') return 1;
    return a.iso < b.iso ? 1 : -1;
  });

  return pool[0]?.iso ?? null;
}
