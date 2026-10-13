import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { toLang, Lang } from './messages';

// Avvisi agli admin quando si iscrive un nuovo utente o arriva un feedback.
// Prima li mandava il telefono di chi si iscriveva, cercando gli admin tra gli
// utenti: le regole del database lo vietano a un utente normale (e dal browser
// exp.host è bloccato dal CORS), quindi gli avvisi non partivano mai. Qui gira
// con l'Admin SDK, che non ha questi limiti.

const TITLES: Record<Lang, { newUser: string; newFeedback: string }> = {
  it: { newUser: '👤 Nuovo utente registrato', newFeedback: '📮 Nuova segnalazione' },
  en: { newUser: '👤 New user registered', newFeedback: '📮 New feedback' },
  es: { newUser: '👤 Nuevo usuario registrado', newFeedback: '📮 Nuevo comentario' },
};

type PrefField = 'adminNotifNewUsers' | 'adminNotifFeedback';

interface Admin { uid: string; lang: Lang; pushToken?: string; webPushToken?: string }

async function adminsWith(pref: PrefField): Promise<Admin[]> {
  const snap = await getFirestore().collection('users').where('isAdmin', '==', true).get();
  return snap.docs
    .filter((d) => d.data()[pref] !== false) // acceso di default, come nelle impostazioni
    .map((d) => ({
      uid: d.id,
      lang: toLang(d.data().language),
      pushToken: d.data().pushToken as string | undefined,
      webPushToken: d.data().webPushToken as string | undefined,
    }));
}

// Telefono: Expo Push API. Browser: FCM.
async function notify(admins: Admin[], text: (lang: Lang) => { title: string; body: string }, type: string): Promise<void> {
  const messaging = getMessaging();
  const jobs: Promise<unknown>[] = [];

  const expo = admins.filter((a) => a.pushToken);
  if (expo.length > 0) {
    const messages = expo.map((a) => ({
      to: a.pushToken, ...text(a.lang), data: { type }, sound: 'default', channelId: 'default',
    }));
    jobs.push(
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      }).then(async (res) => {
        const json = await res.json().catch(() => null) as { data?: { status: string; message?: string; details?: unknown }[] } | null;
        if (!res.ok) {
          console.warn('[adminNotify] Expo push HTTP', res.status, JSON.stringify(json));
          return;
        }
        // 200 anche quando il singolo messaggio fallisce (es. token scaduto): lo dice data[i].status.
        const errors = (json?.data ?? []).filter((r) => r.status === 'error');
        if (errors.length > 0) console.warn('[adminNotify] Expo push, messaggi non consegnati', JSON.stringify(errors));
        else console.log(`[adminNotify] ${type}: ${expo.length} push accettati da Expo`);
      }).catch((e) => console.warn('[adminNotify] Expo push fallito', e)),
    );
  }

  for (const a of admins.filter((x) => x.webPushToken)) {
    jobs.push(
      messaging.send({
        token: a.webPushToken!,
        notification: text(a.lang),
        webpush: { fcmOptions: { link: '/admin' } },
      }).catch((e) => console.warn('[adminNotify] FCM fallito per', a.uid, e)),
    );
  }
  await Promise.all(jobs);
}

const OPTIONS = { region: 'europe-west1' } as const;

// Un utente "vero" compare quando il documento nasce senza essere un ospite, o
// quando un ospite si registra (isGuest passa a false): gli ospiti non contano
// come iscrizioni.
export const notifyAdminsNewUserTrigger = onDocumentWritten(
  { ...OPTIONS, document: 'users/{uid}' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || after.isAdmin === true) return;

    const wasUser = !!before && before.isGuest !== true;
    const isUser = after.isGuest !== true;
    if (wasUser || !isUser) return;
    // Il documento può nascere prima che il nome sia scritto: si guarda solo l'email.
    const who = after.displayName ? `${after.displayName} (${after.email ?? ''})` : (after.email ?? '');

    const admins = await adminsWith('adminNotifNewUsers');
    await notify(admins, (lang) => ({ title: TITLES[lang].newUser, body: who }), 'new_user');
  },
);

export const notifyAdminsNewFeedbackTrigger = onDocumentCreated(
  { ...OPTIONS, document: 'feedback/{id}' },
  async (event) => {
    const f = event.data?.data();
    if (!f) return;
    const who = f.displayName ? `${f.displayName} (${f.email ?? ''})` : (f.email ?? '');
    const body = `${who}: ${String(f.message ?? '').slice(0, 100)}`;

    const admins = await adminsWith('adminNotifFeedback');
    await notify(admins, (lang) => ({ title: TITLES[lang].newFeedback, body }), 'new_feedback');
  },
);
