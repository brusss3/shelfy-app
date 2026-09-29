import { Platform } from 'react-native';

// Da dove arriva un nuovo utente. Le guide pubbliche (public/guide/…) portano
// alla registrazione con `?src=<slug>`: qui lo si salva al primo atterraggio
// e lo si allega al documento utente quando viene creato, così la dashboard
// admin può confrontare le guide sul numero di utenti che poi usano davvero
// l'app. Solo web: le guide sono pagine web e l'app nativa non riceve `src`.

const STORAGE_KEY = 'shelfy.acquisition';
const SOURCE_RE = /^[a-z0-9-]{1,60}$/;

export interface Acquisition {
  source: string;
  landedAt: string; // ISO
}

/** Da chiamare all'avvio: memorizza `?src=` se presente. Vince il primo arrivo. */
export function captureAcquisitionSource(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const source = new URLSearchParams(window.location.search).get('src');
    if (!source || !SOURCE_RE.test(source)) return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const value: Acquisition = { source, landedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage bloccato (navigazione privata ecc.): l'attribuzione è solo statistica.
  }
}

/** Origine salvata, da scrivere sul documento utente alla creazione. */
export function getAcquisition(): Acquisition | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.source === 'string' && SOURCE_RE.test(parsed.source) ? parsed : null;
  } catch {
    return null;
  }
}
