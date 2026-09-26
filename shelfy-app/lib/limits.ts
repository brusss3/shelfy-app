// Limiti del piano base. La verità sul credito AI sta nella Cloud Function
// (è lì che si spende il budget Groq); il tetto sui prodotti è invece solo
// lato client, perché superarlo non costa nulla se non spazio su Firestore.

/** Prodotti massimi nella dispensa personale per un account base. */
export const FREE_PRODUCT_LIMIT = 50;

/** Sollevato quando un account base prova a superare FREE_PRODUCT_LIMIT. */
export class ProductLimitError extends Error {
  constructor() {
    super('FREE_PRODUCT_LIMIT');
    this.name = 'ProductLimitError';
  }
}

/** Ricette AI: 1 a settimana con il piano base, 1 al giorno con Premium. */
export const AI_FREE_PERIOD = 'week' as const;
export const AI_PREMIUM_PERIOD = 'day' as const;

// Giorno civile italiano (YYYY-MM-DD): stessa chiave usata dalla Cloud
// Function per il credito giornaliero dei Premium.
export function todayKeyRome(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

// Lunedì della settimana corrente, sempre in data civile italiana: chiave del
// credito settimanale del piano base. Il prefisso "w:" evita qualsiasi
// collisione con una chiave giornaliera.
// ⚠️ Duplicata identica in functions/src/index.ts — vanno tenute allineate.
export function weekKeyRome(): string {
  const [y, m, d] = todayKeyRome().split('-').map(Number);
  // Aritmetica di calendario pura sulla data civile: niente fusi di mezzo.
  const date = new Date(Date.UTC(y, m - 1, d));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return `w:${date.toISOString().slice(0, 10)}`;
}

/** Documento di `users/{uid}/aiUsage` che rappresenta il credito corrente. */
export function aiUsageKey(isPremium: boolean): string {
  return isPremium ? todayKeyRome() : weekKeyRome();
}

/** Quando torna disponibile il credito: serve solo per il testo in UI. */
export function aiCreditResetsAt(isPremium: boolean): Date {
  const [y, m, d] = todayKeyRome().split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (isPremium) {
    date.setUTCDate(date.getUTCDate() + 1);
  } else {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset + 7);
  }
  return date;
}
