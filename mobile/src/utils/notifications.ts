import { Platform } from 'react-native';
import { parseExpiryDate } from './expiry';

let NotificationsMod: any | null = null;

async function getNotifications(): Promise<any | null> {
  if (Platform.OS === 'web') return null;
  if (NotificationsMod) return NotificationsMod;
  try {
    const mod = await import('expo-notifications');
    NotificationsMod = mod as any;
    return NotificationsMod;
  } catch {
    return null;
  }
}

export type DocumentItem = {
  id?: string | number;
  appId?: string | number;
  name?: string;
  title?: string;
  expiryDate?: string | null;
};

export async function configureNotificationHandler() {
  if (Platform.OS === 'web') return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus?.AUTHORIZED) {
    return true;
  }
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted || req.ios?.status === Notifications.IosAuthorizationStatus?.AUTHORIZED;
}

export async function scheduleExpiryNotifications(docs: DocumentItem[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Padrão',
      importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
    });
  }

  const now = new Date();
  for (const doc of docs) {
    const name = doc.title || doc.name || 'Documento';
    const expiry = parseExpiryDate(doc.expiryDate || undefined);
    if (!expiry) continue;

    const msUntil = expiry.getTime() - now.getTime();
    const title = 'Vencimento de documento';

    if (msUntil <= 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: `"${name}" está vencido. Considere renovar ou arquivar.`,
        },
        trigger: { seconds: 5 },
      });
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: `"${name}" vencerá em breve. Abra o app para revisar.`,
      },
      trigger: { date: expiry } as any,
    });
  }
}