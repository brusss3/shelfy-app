import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product } from '@/types';
import { effectiveExpiry } from '@/lib/urgency';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Categoria con action button "Consumato" mostrata direttamente sulla notifica
// di scadenza. Deve essere registrata prima di schedulare le notifiche.
export const EXPIRY_CATEGORY = 'expiry';

// Lazy require — prevents expo-notifications side-effects from running at import time in Expo Go
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function N(): any {
  return require('expo-notifications');
}

export function setupNotificationHandler(): void {
  if (isExpoGo || Platform.OS === 'web') return;
  const Notifications = N();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  // Fire-and-forget: se fallisce (es. piattaforma non supportata) la notifica
  // resta comunque valida, solo senza il pulsante.
  Notifications.setNotificationCategoryAsync(EXPIRY_CATEGORY, [
    {
      identifier: 'consumed',
      buttonTitle: '✓ Consumato',
      // MVP: apre l'app in foreground; l'handler cancella il prodotto.
      options: { opensAppToForeground: true },
    },
  ]).catch((e: unknown) => console.warn('[notifications] setNotificationCategoryAsync failed:', e));
}

// Registra un listener che intercetta il tap sul pulsante "Consumato" della
// notifica (anche quando l'app parte da chiusa). Chiama `onConsumed` con
// l'id del prodotto. Ritorna la funzione di cleanup.
export function subscribeToConsumedAction(
  onConsumed: (productId: string, pantryId: string | null) => void,
): () => void {
  if (isExpoGo || Platform.OS === 'web') return () => {};

  const Notifications = N();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handle = (response: any) => {
    if (response?.actionIdentifier !== 'consumed') return;
    const data = response?.notification?.request?.content?.data;
    const productId = data?.productId;
    // Il prodotto potrebbe appartenere a una casa condivisa diversa da
    // quella attiva ora (o l'app potrebbe essere ripartita da zero): la
    // notifica porta con sé lo scope in cui il prodotto viveva quando è
    // stata schedulata, così il consumo va sempre nel posto giusto.
    const pantryId = typeof data?.pantryId === 'string' ? data.pantryId : null;
    if (typeof productId === 'string' && productId) onConsumed(productId, pantryId);
  };

  // Cold start: l'app è stata aperta proprio dal pulsante della notifica.
  Notifications.getLastNotificationResponseAsync?.()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((r: any) => { if (r) handle(r); })
    .catch(() => {});

  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice || isExpoGo || Platform.OS === 'web') return null;

  const Notifications = N();
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expiry-alerts', {
      name: 'Avvisi scadenza',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2f4a31',
    });
    // Le push remote (Expo API) senza channelId esplicito finiscono sul
    // canale "default": se non esiste, Android le scarta senza errori.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Generali',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2f4a31',
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    '8ca5efb5-8143-4d62-b20e-a3185df70768';

  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return token.data;
}

// Un "gruppo" = i prodotti di una casa (personale o condivisa — "dispensa"
// nell'app indica già la zona Frigo/Freezer/Dispensa, quindi qui si usa
// "casa" per il contenitore per non sovrapporre i due significati). Le
// notifiche si aggregano per casa, non più per singolo prodotto, per due
// motivi. Primo, con più case una scadenza per prodotto esploderebbe in
// una notifica a testa ("hai il latte in scadenza", "hai le uova in
// scadenza", …) — qui invece diventa una sola per casa+giorno ("hai 3
// prodotti in scadenza nella casa di Via Roma"). Secondo, iOS limita a 64 le
// notifiche locali pendenti per app: pre-schedulare 2 notifiche per OGNI
// prodotto di OGNI casa sfora quel tetto in fretta con una casa piena;
// raggruppando per (casa, giorno di scadenza) restano poche.
export interface NotificationPantryGroup {
  /** `null` = casa personale. */
  pantryId: string | null;
  pantryName: string;
  products: Product[];
}

function groupByExpiryDate(products: Product[]): Map<string, Product[]> {
  const byDate = new Map<string, Product[]>();
  for (const p of products) {
    const iso = effectiveExpiry(p);
    const bucket = byDate.get(iso);
    if (bucket) bucket.push(p);
    else byDate.set(iso, [p]);
  }
  return byDate;
}

function expiryBody(products: Product[], when: 'oggi' | 'domani', pantryId: string | null, pantryName: string): string {
  const where = pantryId === null ? 'nella tua dispensa personale' : `nella casa "${pantryName}"`;
  if (products.length === 1) {
    return when === 'oggi'
      ? `${products[0].name} scade oggi ${where}. Usalo subito o congelalo!`
      : `${products[0].name} scade domani ${where}.`;
  }
  return when === 'oggi'
    ? `Hai ${products.length} prodotti in scadenza oggi ${where}.`
    : `Hai ${products.length} prodotti in scadenza domani ${where}.`;
}

export async function scheduleExpiryNotifications(
  groups: NotificationPantryGroup[],
  enabled = true,
): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;

  const Notifications = N();
  // Cancella sempre prima: se l'utente disattiva le notifiche o modifica i prodotti,
  // rimuove quelle obsolete e rischedula quelle aggiornate.
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;

  const now = new Date();

  for (const group of groups) {
    const byDate = groupByExpiryDate(group.products);

    for (const [expiryIso, prods] of byDate) {
      const expiryDate = new Date(expiryIso + 'T00:00:00');
      // Un solo prodotto nel gruppo: il pulsante "Consumato" ha senso (si sa
      // quale). Più di uno: niente azione diretta, ambigua su quale prodotto.
      const singleProductId = prods.length === 1 ? prods[0].id : undefined;

      // 1) Notifica il giorno stesso della scadenza alle 09:00
      const triggerSameDay = new Date(expiryDate);
      triggerSameDay.setHours(9, 0, 0, 0);
      if (triggerSameDay > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Shelfy — Scade oggi',
            body: expiryBody(prods, 'oggi', group.pantryId, group.pantryName),
            data: { productId: singleProductId, pantryId: group.pantryId },
            categoryIdentifier: singleProductId ? EXPIRY_CATEGORY : undefined,
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerSameDay },
        });
      }

      // 2) Notifica preventiva 1 giorno prima della scadenza alle 09:00
      const triggerDayBefore = new Date(expiryDate);
      triggerDayBefore.setDate(triggerDayBefore.getDate() - 1);
      triggerDayBefore.setHours(9, 0, 0, 0);
      if (triggerDayBefore > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Shelfy — Scadenza vicina',
            body: expiryBody(prods, 'domani', group.pantryId, group.pantryName),
            data: { productId: singleProductId, pantryId: group.pantryId },
            categoryIdentifier: singleProductId ? EXPIRY_CATEGORY : undefined,
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDayBefore },
        });
      }
    }
  }
}

// --- Notifiche push Admin (Expo Push API) ---

interface AdminPushRecipient {
  uid: string;
  pushToken: string;
}

async function getAdminPushRecipients(prefField: 'adminNotifNewUsers' | 'adminNotifFeedback'): Promise<AdminPushRecipient[]> {
  const snap = await getDocs(query(collection(db, 'users'), where('isAdmin', '==', true)));
  const recipients: AdminPushRecipient[] = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    const token: string | undefined = data.pushToken;
    const enabled: boolean = data[prefField] !== false;
    if (token && enabled) recipients.push({ uid: d.id, pushToken: token });
  });
  return recipients;
}

export async function sendExpoPushNotification(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  if (tokens.length === 0) return;

  // exp.host non manda header CORS: dal browser il preflight fallisce sempre.
  // Su nativo (Android/iOS) fetch non passa da CORS, quindi funziona.
  if (Platform.OS === 'web') {
    throw new Error('Invio push non disponibile da browser (limite CORS di Expo). Prova dall\'app su dispositivo mobile.');
  }

  const messages = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: 'default',
    channelId: 'default',
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Expo push API HTTP ${res.status}: ${JSON.stringify(json)}`);
  }

  // La risposta è sempre 200 anche se il singolo messaggio fallisce — lo stato
  // reale è dentro data[i].status ('ok' | 'error').
  const results: Array<{ status: string; message?: string; details?: { error?: string } }> = json?.data ?? [];
  const errors = results.filter((r) => r.status === 'error');
  if (errors.length > 0) {
    console.warn('[notifications] Expo push errors:', errors);
    throw new Error(errors.map((e) => e.details?.error ?? e.message ?? 'errore sconosciuto').join(', '));
  }
}

export async function notifyAdminsNewUser(newUser: { email: string; displayName?: string | null }): Promise<void> {
  const recipients = await getAdminPushRecipients('adminNotifNewUsers');
  if (recipients.length === 0) return;
  const who = newUser.displayName ? `${newUser.displayName} (${newUser.email})` : newUser.email;
  await sendExpoPushNotification(recipients.map((r) => r.pushToken), {
    title: '👤 Nuovo utente registrato',
    body: who,
    data: { type: 'new_user' },
  });
}

export async function notifyAdminsNewFeedback(feedback: {
  email: string;
  displayName?: string | null;
  category: string;
  message: string;
}): Promise<void> {
  const recipients = await getAdminPushRecipients('adminNotifFeedback');
  if (recipients.length === 0) return;
  const who = feedback.displayName ? `${feedback.displayName} (${feedback.email})` : feedback.email;
  await sendExpoPushNotification(recipients.map((r) => r.pushToken), {
    title: '📮 Nuova segnalazione',
    body: `${who}: ${feedback.message.slice(0, 100)}`,
    data: { type: 'new_feedback' },
  });
}

export async function sendAdminTestPushNotification(token: string): Promise<void> {
  await sendExpoPushNotification([token], {
    title: '🔔 Shelfy — Notifica di test',
    body: 'Il canale push admin funziona correttamente.',
    data: { type: 'test' },
  });
}
