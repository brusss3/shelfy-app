import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import it from './locales/it.json';
import en from './locales/en.json';
import es from './locales/es.json';

export const LANGUAGE_STORAGE_KEY = 'shelfy_language';
export type LanguageOption = 'system' | 'it' | 'en' | 'es';
export type AppLanguage = 'it' | 'en' | 'es';

const resources = {
  it: { translation: it },
  en: { translation: en },
  es: { translation: es },
};

function resolveDeviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode;
  return code === 'it' || code === 'es' ? code : 'en';
}

let ready = false;

// Inizializza i18next leggendo l'eventuale lingua forzata dall'utente
// (salvata in Impostazioni); se non c'è, segue la lingua del dispositivo.
// Va atteso prima del primo render, altrimenti l'app lampeggia un istante
// nella lingua di fallback.
export async function initI18n(): Promise<void> {
  if (ready) return;
  const stored = (await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)) as LanguageOption | null;
  const lng = stored && stored !== 'system' ? stored : resolveDeviceLanguage();
  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  ready = true;
}

/** Locale per formattare date e numeri nella lingua dell'app. */
export function dateLocale(): string {
  const lang = i18n.language;
  return lang === 'it' ? 'it-IT' : lang === 'es' ? 'es-ES' : 'en-US';
}

export async function setAppLanguage(option: LanguageOption): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, option);
  const lng = option === 'system' ? resolveDeviceLanguage() : option;
  await i18n.changeLanguage(lng);
}

export async function getStoredLanguageOption(): Promise<LanguageOption> {
  const stored = (await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)) as LanguageOption | null;
  return stored ?? 'system';
}

export default i18n;
