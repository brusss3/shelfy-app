import { Platform } from 'react-native';
import app from '@/lib/firebase';

// Chiave pubblica VAPID generata su Firebase Console → Project Settings →
// Cloud Messaging → Web Push certificates. Non è un segreto: va incorporata
// nel client, è così che il browser autentica le proprie iscrizioni push
// verso il progetto Firebase giusto.
const VAPID_KEY = 'BEJmg89QXaz4ew2SiJhzZ7JO8KzxZP6DOc3ekkSJiX7xnUhMLm6rImILz8LvSqV3nkaUKHatbTyst0Bv1lQ9x5Y';

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Safari su iOS concede il permesso di notifica SOLO se la PWA è stata
// aggiunta alla Home (Condividi → Aggiungi a Home): da un tab normale la
// richiesta fallisce sempre, silenziosamente. Su Android/desktop non serve.
export function needsHomeScreenInstall(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (!isIos()) return false;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}

export async function isWebPushSupported(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  const { isSupported } = await import('firebase/messaging');
  return isSupported();
}

// Chiede il permesso, registra il service worker e ottiene il token FCM per
// questo browser. Ritorna null se il permesso è negato o la piattaforma non
// supporta i push (in quel caso non è un errore, va gestito in UI).
export async function registerWebPush(): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  if (!(await isWebPushSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const { getMessaging, getToken } = await import('firebase/messaging');
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  return token || null;
}

// Notifiche ricevute mentre il tab è aperto e in foreground: FCM non le
// mostra da solo (a differenza del background, gestito dal service worker),
// quindi le intercettiamo qui per mostrarle noi.
export async function listenForForegroundWebPush(
  onMessageReceived: (title: string, body: string) => void,
): Promise<() => void> {
  if (Platform.OS !== 'web' || !(await isWebPushSupported())) return () => {};

  const { getMessaging, onMessage } = await import('firebase/messaging');
  const messaging = getMessaging(app);
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? '';
    const body = payload.notification?.body ?? payload.data?.body ?? '';
    onMessageReceived(title, body);
  });
}
