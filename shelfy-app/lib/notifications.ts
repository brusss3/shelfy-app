import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Product } from '@/types';
import { effectiveExpiry } from '@/lib/urgency';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Lazy require — prevents expo-notifications side-effects from running at import time in Expo Go
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function N(): any {
  return require('expo-notifications');
}

export function setupNotificationHandler(): void {
  if (isExpoGo || Platform.OS === 'web') return;
  N().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
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
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-eas-project-id',
  });

  return token.data;
}

export async function scheduleExpiryNotifications(
  products: Product[],
  enabled = true,
): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;

  const Notifications = N();
  // Cancella sempre prima: se l'utente disattiva le notifiche, rimuove anche
  // quelle già programmate.
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const product of products) {
    // Tiene conto della scadenza post-apertura.
    const expiry = new Date(effectiveExpiry(product));
    expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86400000);

    if (daysLeft < 0 || daysLeft > 7) continue;

    const triggerDate = new Date(expiry);
    triggerDate.setHours(9, 0, 0, 0);

    if (triggerDate <= new Date()) continue;

    const body =
      daysLeft === 0
        ? `${product.name} scade oggi — usalo subito!`
        : daysLeft === 1
        ? `${product.name} scade domani`
        : `${product.name} scade tra ${daysLeft} giorni`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Shelfy — Scadenza vicina',
        body,
        data: { productId: product.id },
        sound: true,
      },
      trigger: { date: triggerDate },
    });
  }
}
