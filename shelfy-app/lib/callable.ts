import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import i18n from '@/lib/i18n';
import { functions } from './firebase';

// Come `httpsCallable`, ma traduce gli errori del server. Le Cloud Function
// lanciano errori con una `key` (vedi `fail` in functions/src/messages.ts):
// qui la si cerca in `serverErrors.<key>` nella lingua in uso e diventa il
// `message` dell'errore, così ogni schermata che mostra `e.message` lo mostra
// già tradotto. Senza traduzione resta il testo italiano del server.
export function callable<Req, Res>(name: string) {
  const fn = httpsCallable<Req, Res>(functions, name);
  return async (data?: Req): Promise<HttpsCallableResult<Res>> => {
    try {
      return await fn(data);
    } catch (e: any) {
      const key = e?.details?.key;
      if (typeof key === 'string' && i18n.exists(`serverErrors.${key}`)) {
        e.message = i18n.t(`serverErrors.${key}`);
      }
      throw e;
    }
  };
}
