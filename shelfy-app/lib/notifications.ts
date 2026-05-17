import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Product } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

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
    projectId: 'your-eas-project-id', // sostituisci con il tuo EAS project ID
  });

  return token.data;
}

export async function scheduleExpiryNotifications(products: Product[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const product of products) {
    const expiry = new Date(product.expiry);
    expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86400000);

    if (daysLeft < 0 || daysLeft > 7) continue;

    const triggerDate = new Date(expiry);
    triggerDate.setHours(9, 0, 0, 0); // notifica alle 9:00 del giorno di scadenza

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
