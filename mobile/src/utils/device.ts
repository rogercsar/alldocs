import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'evdocs_device_id_v1';
let cachedId: string | null = null;

function genId() {
  // Prefer UUID if available
  // @ts-ignore
  const uuid = (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? (globalThis.crypto as any).randomUUID() : null;
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedId) return cachedId;
  try {
    if (Platform.OS === 'web') {
      const k = `__${KEY}`;
      const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
      if (existing) { cachedId = existing; return existing; }
      const id = genId();
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, id);
      cachedId = id;
      return id;
    } else {
      const existing = await SecureStore.getItemAsync(KEY);
      if (existing) { cachedId = existing; return existing; }
      const id = genId();
      await SecureStore.setItemAsync(KEY, id, { keychainService: KEY });
      cachedId = id;
      return id;
    }
  } catch {
    // Fallback
    const id = genId();
    cachedId = id;
    return id;
  }
}

export function deviceLabel(): string {
  try {
    if (Platform.OS === 'web') {
      return (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'web';
    }
    // Minimal label sem depender de expo-device
    return `${Platform.OS} ${Platform.Version ?? ''}`.trim();
  } catch {
    return 'unknown';
  }
}

export async function registerDeviceForUser(userId: string) {
  if (!userId || userId === 'anonymous') return;
  try {
    const deviceId = await getOrCreateDeviceId();
    const label = deviceLabel();
    const platform = Platform.OS;
    const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!base) return;
    await fetch(`${base}/.netlify/functions/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, deviceId, platform, label }),
    });
  } catch (e) {
    // silencioso em dev
    console.warn('Falha ao registrar dispositivo (não crítico)', e);
  }
}