import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// Da dove arriva un nuovo utente. Le guide pubbliche (public/guide/…) portano
// alla registrazione con `?src=<slug>`: lo si allega al documento utente alla
// creazione, così la dashboard admin può confrontare le guide sul numero di
// utenti che poi usano davvero l'app. Solo web: le guide sono pagine web e
// l'app nativa non riceve `src`.
//
// Scrivere sul dispositivo dell'utente per questo scopo richiede il suo
// consenso (ePrivacy, art. 122 Codice privacy): finché non risponde al banner
// (components/ConsentBanner.web.tsx) la guida resta solo in memoria, e se
// rifiuta non viene salvata né associata all'account.

const STORAGE_KEY = 'shelfy.acquisition';
const CONSENT_KEY = 'shelfy.consent.acquisition';
const SOURCE_RE = /^[a-z0-9-]{1,60}$/;

export interface Acquisition {
  source: string;
  landedAt: string; // ISO
}

export type AcquisitionConsent = 'granted' | 'denied' | null;

// Guida letta dall'URL in attesa di una risposta: solo in memoria, non su disco.
let pending: Acquisition | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function getAcquisitionConsent(): AcquisitionConsent {
  if (!isWeb()) return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/** Da chiamare all'avvio: legge `?src=` se presente. Vince il primo arrivo. */
export function captureAcquisitionSource(): void {
  if (!isWeb()) return;
  try {
    const source = new URLSearchParams(window.location.search).get('src');
    if (!source || !SOURCE_RE.test(source)) return;
    const consent = getAcquisitionConsent();
    if (consent === 'denied') return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const value: Acquisition = { source, landedAt: new Date().toISOString() };
    if (consent === 'granted') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else pending = value; // si salva solo se l'utente accetta
    notify();
  } catch {
    // localStorage bloccato (navigazione privata ecc.): l'attribuzione è solo statistica.
  }
}

/** Risposta al banner. Accettare salva la guida; rifiutare la scarta; null = revoca. */
export function setAcquisitionConsent(decision: AcquisitionConsent): void {
  if (!isWeb()) return;
  try {
    if (decision === null) {
      window.localStorage.removeItem(CONSENT_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(CONSENT_KEY, decision);
      if (decision === 'granted' && pending) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
      if (decision === 'denied') window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Senza storage non c'è niente da salvare: la scelta vale per questa sessione.
  }
  pending = null;
  notify();
}

/** Origine da scrivere sul documento utente alla creazione: solo con consenso. */
export function getAcquisition(): Acquisition | null {
  if (!isWeb() || getAcquisitionConsent() !== 'granted') return null;
  const parsed = read<Acquisition>(STORAGE_KEY);
  return typeof parsed?.source === 'string' && SOURCE_RE.test(parsed.source) ? parsed : null;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Il banner va mostrato: c'è una guida in attesa e nessuna risposta. */
export function useConsentPrompt(): boolean {
  return useSyncExternalStore(subscribe, () => pending !== null && getAcquisitionConsent() === null, () => false);
}

/** Stato della scelta, per la schermata delle note legali. */
export function useAcquisitionConsent(): AcquisitionConsent {
  return useSyncExternalStore(subscribe, getAcquisitionConsent, () => null);
}
