import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';

import { api } from '@/services/api';

type NotificationsModule = typeof ExpoNotifications;
export type PushNotificationState = 'enabled' | 'disabled' | 'denied' | 'unavailable';

const pushTokenStorageKey = 'bhl-one-expo-push-token';
const pushPreferenceStorageKey = 'bhl-one-push-preference';
const enabledPreference = 'enabled';
const disabledPreference = 'disabled';
const notificationChannelId = 'messages';

// Remote push is unavailable in Expo Go on Android. A development build can
// share the StoreClient execution environment, so only use Expo Go-specific
// values here and keep push enabled in development/preview/release builds.
const isExpoGo = Constants.expoGoConfig != null
  || Constants.appOwnership === 'expo'
  || Constants.expoVersion != null;
let activeRegistration: Promise<PushNotificationState> | undefined;

function supportsNativePush() {
  return (Platform.OS === 'android' || Platform.OS === 'ios') && !isExpoGo;
}

function getProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function permissionGranted(
  settings: ExpoNotifications.NotificationPermissionsStatus,
  Notifications: NotificationsModule,
) {
  return settings.granted
    || (Platform.OS === 'ios' && settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
}

async function configureAndroidChannel(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(notificationChannelId, {
    name: 'Tin nhắn và thông báo',
    description: 'Tin nhắn mới và các thông báo nghiệp vụ từ BHL One',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: '#2563EB',
    sound: 'default',
  });
}

async function saveTokenToBackend(token: string) {
  const previousToken = await SecureStore.getItemAsync(pushTokenStorageKey);
  await api.post('/messages/push/mobile-devices', {
    token,
    platform: Platform.OS,
    deviceName: Device.deviceName || Device.modelName || '',
    appVersion: Constants.expoConfig?.version || '',
  });
  await SecureStore.setItemAsync(pushTokenStorageKey, token);

  if (previousToken && previousToken !== token) {
    await api.delete('/messages/push/mobile-devices', { data: { token: previousToken } }).catch(() => undefined);
  }
}

async function registerPushToken(requestPermission: boolean): Promise<PushNotificationState> {
  if (!supportsNativePush()) return 'unavailable';
  if (activeRegistration) return activeRegistration;

  activeRegistration = (async () => {
    const Notifications = await import('expo-notifications');
    await configureAndroidChannel(Notifications);

    let permissions = await Notifications.getPermissionsAsync();
    if (!permissionGranted(permissions, Notifications) && requestPermission && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    if (!permissionGranted(permissions, Notifications)) {
      return permissions.canAskAgain ? 'disabled' : 'denied';
    }

    const projectId = getProjectId();
    if (!projectId) throw new Error('Không tìm thấy EAS projectId để đăng ký thông báo.');

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await saveTokenToBackend(token);
    return 'enabled';
  })().finally(() => {
    activeRegistration = undefined;
  });

  return activeRegistration;
}

export async function getPushNotificationState(): Promise<PushNotificationState> {
  if (!supportsNativePush()) return 'unavailable';
  const Notifications = await import('expo-notifications');
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissionGranted(permissions, Notifications)) {
    return permissions.canAskAgain ? 'disabled' : 'denied';
  }
  const [preference, token] = await Promise.all([
    SecureStore.getItemAsync(pushPreferenceStorageKey),
    SecureStore.getItemAsync(pushTokenStorageKey),
  ]);
  return preference === enabledPreference && token ? 'enabled' : 'disabled';
}

export async function enablePushNotifications() {
  if (!supportsNativePush()) return 'unavailable' as const;
  await SecureStore.setItemAsync(pushPreferenceStorageKey, enabledPreference);
  const state = await registerPushToken(true);
  if (state !== 'enabled') {
    await SecureStore.setItemAsync(pushPreferenceStorageKey, disabledPreference);
  }
  return state;
}

export async function unregisterCurrentPushToken() {
  if (!supportsNativePush()) return;
  const token = await SecureStore.getItemAsync(pushTokenStorageKey);
  if (!token) return;
  await api.delete('/messages/push/mobile-devices', { data: { token } });
  await SecureStore.deleteItemAsync(pushTokenStorageKey);
}

export async function disablePushNotifications() {
  if (!supportsNativePush()) return;
  await unregisterCurrentPushToken();
  await SecureStore.setItemAsync(pushPreferenceStorageKey, disabledPreference);
  const Notifications = await import('expo-notifications');
  await Notifications.setBadgeCountAsync(0).catch(() => undefined);
}

function openNotification(notification: ExpoNotifications.Notification) {
  const url = notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
}

export function useNotificationNavigation() {
  useEffect(() => {
    if (!supportsNativePush()) return;
    let disposed = false;
    let removeResponseListener: (() => void) | undefined;

    async function configureNotifications() {
      try {
        const Notifications = await import('expo-notifications');
        if (disposed) return;

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const initialResponse = Notifications.getLastNotificationResponse();
        if (initialResponse?.notification) openNotification(initialResponse.notification);

        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          openNotification(response.notification);
        });
        removeResponseListener = () => subscription.remove();
      } catch (error) {
        console.warn('Không thể khởi tạo thông báo trên thiết bị này.', error);
      }
    }

    void configureNotifications();
    return () => {
      disposed = true;
      removeResponseListener?.();
    };
  }, []);
}

export function usePushNotificationRegistration(userId?: string) {
  useEffect(() => {
    if (!userId || !supportsNativePush()) return;
    let disposed = false;
    let removeTokenListener: (() => void) | undefined;

    const synchronize = async () => {
      const preference = await SecureStore.getItemAsync(pushPreferenceStorageKey);
      if (disposed || preference !== enabledPreference) return;
      await registerPushToken(false);
    };

    void synchronize().catch(error => {
      console.warn('Chưa thể đồng bộ token thông báo.', error);
    });

    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void synchronize().catch(error => console.warn('Chưa thể đồng bộ lại token thông báo.', error));
      }
    });

    void import('expo-notifications')
      .then(Notifications => {
        if (disposed) return;
        const subscription = Notifications.addPushTokenListener(() => {
          void synchronize().catch(error => console.warn('Chưa thể cập nhật token thông báo.', error));
        });
        removeTokenListener = () => subscription.remove();
      })
      .catch(error => {
        console.warn('Không thể lắng nghe thay đổi token thông báo.', error);
      });

    return () => {
      disposed = true;
      appStateSubscription.remove();
      removeTokenListener?.();
    };
  }, [userId]);
}
