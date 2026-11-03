import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const accessTokenKey = 'bhl-one-access-token';
const loginIdentifierKey = 'bhl-one-login-identifier';
const accessTokenOptions = { keychainService: accessTokenKey } as const;
const loginIdentifierOptions = { keychainService: loginIdentifierKey } as const;

export async function getStoredAccessToken() {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(accessTokenKey, accessTokenOptions);
}

export async function storeAccessToken(token: string) {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(accessTokenKey, token, accessTokenOptions);
}

export async function clearStoredAccessToken() {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(accessTokenKey);
    return;
  }
  await SecureStore.deleteItemAsync(accessTokenKey, accessTokenOptions);
}

export async function getStoredLoginIdentifier() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(loginIdentifierKey) ?? null;
  return SecureStore.getItemAsync(loginIdentifierKey, loginIdentifierOptions);
}

export async function storeLoginIdentifier(value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(loginIdentifierKey, value);
    return;
  }
  await SecureStore.setItemAsync(loginIdentifierKey, value, loginIdentifierOptions);
}
