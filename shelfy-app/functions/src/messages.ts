// Testi delle notifiche inviate dal server, nella lingua dell'utente. L'app
// salva la lingua in users/{uid}.language (vedi components/LanguageSync.tsx);
// per chi non l'ha ancora salvata si usa l'italiano, come prima.
import { HttpsError, FunctionsErrorCode } from 'firebase-functions/v2/https';

/** Errore per l'app: il testo (italiano) resta per i log e come ripiego, la
 *  `key` è ciò che l'app traduce (serverErrors.<key> nelle lingue dell'app). */
export function fail(code: FunctionsErrorCode, key: string, message: string): HttpsError {
  return new HttpsError(code, message, { key });
}

export type Lang = 'it' | 'en' | 'es';

export function toLang(value: unknown): Lang {
  return value === 'en' || value === 'es' ? value : 'it';
}

interface ReminderTexts {
  titleToday: string;
  titleSoon: string;
  wherePersonal: string;
  whereHome: (name: string) => string;
  single: (name: string, when: 'oggi' | 'domani', where: string) => string;
  multi: (count: number, when: 'oggi' | 'domani', where: string) => string;
}

const REMINDERS: Record<Lang, ReminderTexts> = {
  it: {
    titleToday: '⏰ Shelfy — Scade oggi',
    titleSoon: '⏰ Shelfy — Scadenza vicina',
    wherePersonal: 'nella tua dispensa personale',
    whereHome: (name) => `nella casa "${name}"`,
    single: (name, when, where) => `${name} scade ${when} ${where}.`,
    multi: (count, when, where) => `Hai ${count} prodotti in scadenza ${when} ${where}.`,
  },
  en: {
    titleToday: '⏰ Shelfy — Expires today',
    titleSoon: '⏰ Shelfy — Expiring soon',
    wherePersonal: 'in your personal pantry',
    whereHome: (name) => `in "${name}"`,
    single: (name, when, where) => `${name} expires ${when === 'oggi' ? 'today' : 'tomorrow'} ${where}.`,
    multi: (count, when, where) => `You have ${count} products expiring ${when === 'oggi' ? 'today' : 'tomorrow'} ${where}.`,
  },
  es: {
    titleToday: '⏰ Shelfy — Caduca hoy',
    titleSoon: '⏰ Shelfy — Caduca pronto',
    wherePersonal: 'en tu despensa personal',
    whereHome: (name) => `en "${name}"`,
    single: (name, when, where) => `${name} caduca ${when === 'oggi' ? 'hoy' : 'mañana'} ${where}.`,
    multi: (count, when, where) => `Tienes ${count} productos que caducan ${when === 'oggi' ? 'hoy' : 'mañana'} ${where}.`,
  },
};

export function expiryReminder(
  lang: Lang, when: 'oggi' | 'domani', names: string[], pantryName: string | null,
): { title: string; body: string } {
  const t = REMINDERS[lang];
  const where = pantryName ? t.whereHome(pantryName) : t.wherePersonal;
  return {
    title: when === 'oggi' ? t.titleToday : t.titleSoon,
    body: names.length === 1 ? t.single(names[0], when, where) : t.multi(names.length, when, where),
  };
}
