import {
  collection, query, where, onSnapshot, getDocs, limit, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/lib/i18n';
import { db, functions } from './firebase';
import { LatestPrice, Store, StoreInput } from '@/types';

// Soglie di recenza del documento di progetto: sotto i 30 giorni un prezzo è
// "attuale", oltre i 90 è solo storico e va mostrato come tale.
export const RECENT_DAYS = 30;
export const STALE_DAYS = 90;

export const CHAINS = [
  'Coop', 'Conad', 'Esselunga', 'Carrefour', 'Lidl', 'Eurospin',
  'MD', 'Aldi', 'Pam', 'Famila', 'Penny', 'Iperal',
] as const;

function tsToIso(ts: unknown): string {
  return ts instanceof Timestamp ? ts.toDate().toISOString() : new Date().toISOString();
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export type Recency = 'fresh' | 'recent' | 'old' | 'stale';

export function recencyOf(iso: string): Recency {
  const d = daysSince(iso);
  if (d < 7) return 'fresh';
  if (d < RECENT_DAYS) return 'recent';
  if (d < STALE_DAYS) return 'old';
  return 'stale';
}

/** "oggi", "ieri", "3 giorni fa", "2 settimane fa", "4 mesi fa". */
export function ageLabel(iso: string): string {
  const d = daysSince(iso);
  if (d === 0) return i18n.t('prices.age.today');
  if (d === 1) return i18n.t('prices.age.yesterday');
  if (d < 14) return i18n.t('prices.age.days', { count: d });
  if (d < 60) return i18n.t('prices.age.weeks', { count: Math.floor(d / 7) });
  return i18n.t('prices.age.months', { count: Math.floor(d / 30) });
}

export function formatPrice(cents: number): string {
  try {
    return (cents / 100).toLocaleString(i18n.language || 'it', { style: 'currency', currency: 'EUR' });
  } catch {
    return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
  }
}

/** Nome leggibile del punto vendita: "Coop · Cisanello" (la zona è facoltativa). */
export function storeLabel(p: Pick<LatestPrice, 'chain' | 'storeName'>): string {
  return p.storeName ? `${p.chain} · ${p.storeName}` : p.chain;
}

/** Il prezzo più basso tra quelli ancora attuali (entro RECENT_DAYS), o null
 *  se non ce n'è nessuno: un minimo di quattro mesi fa non è un riferimento. */
export function bestRecent(prices: LatestPrice[]): LatestPrice | null {
  let best: LatestPrice | null = null;
  for (const p of prices) {
    if (daysSince(p.observedAt) >= RECENT_DAYS) continue;
    if (!best || p.priceCents < best.priceCents) best = p;
  }
  return best;
}

function priceFromDoc(id: string, data: Record<string, unknown>): LatestPrice {
  return {
    id,
    barcode: data.barcode as string,
    storeId: data.storeId as string,
    chain: (data.chain as string) ?? '',
    storeName: (data.storeName as string) ?? '',
    city: (data.city as string) ?? '',
    priceCents: data.priceCents as number,
    observedAt: tsToIso(data.observedAt),
    confirmations: (data.confirmations as number) ?? 1,
  };
}

// Firestore accetta al massimo 30 valori in un `in`: una lista lunga si spezza
// in più ascoltatori e i risultati si riuniscono.
const IN_LIMIT = 30;

/** Ultimi prezzi noti per un insieme di barcode, aggiornati in tempo reale. */
export function subscribeToLatestPrices(
  barcodes: string[],
  onData: (byBarcode: Record<string, LatestPrice[]>) => void,
  onError?: (err: Error) => void,
) {
  const unique = Array.from(new Set(barcodes));
  if (unique.length === 0) {
    onData({});
    return () => {};
  }
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_LIMIT) chunks.push(unique.slice(i, i + IN_LIMIT));

  const parts: LatestPrice[][] = chunks.map(() => []);
  const emit = () => {
    const out: Record<string, LatestPrice[]> = {};
    for (const p of parts.flat()) (out[p.barcode] ??= []).push(p);
    for (const list of Object.values(out)) list.sort((a, b) => a.priceCents - b.priceCents);
    onData(out);
  };

  const unsubs = chunks.map((chunk, i) => onSnapshot(
    query(collection(db, 'latestPrices'), where('barcode', 'in', chunk)),
    (snap) => {
      parts[i] = snap.docs.map((d) => priceFromDoc(d.id, d.data()));
      emit();
    },
    onError,
  ));
  return () => unsubs.forEach((u) => u());
}

/** Negozi già segnalati nel comune indicato. */
export async function getStoresInCity(city: string): Promise<Store[]> {
  const cityKey = slugify(city);
  if (!cityKey) return [];
  const snap = await getDocs(query(collection(db, 'stores'), where('cityKey', '==', cityKey), limit(60)));
  return snap.docs
    .map((d) => {
      const x = d.data();
      return { id: d.id, chain: x.chain as string, name: (x.name as string) ?? '', city: x.city as string };
    })
    .sort((a, b) => a.chain.localeCompare(b.chain) || a.name.localeCompare(b.name));
}

// Stessa normalizzazione della Cloud Function (functions/src/index.ts, slug):
// serve a trovare i negozi del comune scritto in modo diverso ("Pisa", "pisa ").
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type SubmitPriceResult = { status: 'published' | 'held'; storeId: string };

export async function submitPrice(payload: {
  barcode: string;
  productName: string;
  priceCents: number;
  store: StoreInput;
  observedAt: string;
}): Promise<SubmitPriceResult> {
  const fn = httpsCallable<unknown, SubmitPriceResult>(functions, 'submitPrice');
  const res = await fn({
    barcode: payload.barcode,
    productName: payload.productName,
    price: payload.priceCents / 100,
    store: payload.store,
    observedAt: payload.observedAt,
  });
  return res.data;
}

// Comune e ultimo negozio usato si ricordano sul dispositivo: davanti allo
// scaffale si vuole inserire il prezzo in due tocchi, senza riscrivere tutto.
const CITY_KEY = 'shelfy.priceCity';
const LAST_STORE_KEY = 'shelfy.priceLastStore';

export async function loadPricePrefs(): Promise<{ city: string; lastStore: StoreInput | null }> {
  try {
    const [city, store] = await Promise.all([
      AsyncStorage.getItem(CITY_KEY),
      AsyncStorage.getItem(LAST_STORE_KEY),
    ]);
    return { city: city ?? '', lastStore: store ? (JSON.parse(store) as StoreInput) : null };
  } catch {
    return { city: '', lastStore: null };
  }
}

export function savePricePrefs(city: string, store: StoreInput): void {
  AsyncStorage.setItem(CITY_KEY, city).catch(() => {});
  AsyncStorage.setItem(LAST_STORE_KEY, JSON.stringify(store)).catch(() => {});
}
