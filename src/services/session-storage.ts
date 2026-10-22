import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const accessTokenKey = 'bhl-one-access-token';

export async function getStoredAccessToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(accessTokenKey) ?? null;
  return SecureStore.getItemAsync(accessTokenKey);
}

export async function storeAccessToken(token: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(accessTokenKey, token);
    return;
  }
  await SecureStore.setItemAsync(accessTokenKey, token, { keychainService: accessTokenKey });
}

export async function clearStoredAccessToken() {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(accessTokenKey);
    return;
  }
  await SecureStore.deleteItemAsync(accessTokenKey, { keychainService: accessTokenKey });
}
