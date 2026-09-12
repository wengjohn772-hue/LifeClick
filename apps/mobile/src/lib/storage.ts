import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore is not implemented on web. The app targets iOS and Android, but
// `expo start --web` should degrade rather than crash.
const webFallback = new Map<string, string>();
const isWeb = Platform.OS === 'web';

export const StorageKeys = {
  session: 'lifeclick.session',
  tokens: 'lifeclick.tokens',
  safety: 'lifeclick.safety',
  pushToken: 'lifeclick.pushToken',
  theme: 'lifeclick.theme',
} as const;

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) return webFallback.get(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    webFallback.set(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // A failed secure write must not take the app down mid-flow.
  }
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    webFallback.delete(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore; the value may already be absent.
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or truncated value; drop it rather than failing every launch.
    await removeItem(key);
    return null;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
}
