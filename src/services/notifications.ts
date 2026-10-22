import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect } from 'react';
import type * as ExpoNotifications from 'expo-notifications';

// Expo Go does not include the complete native push notification runtime.
// Delay loading expo-notifications so the rest of the app can still run there.
const isExpoGo = Constants.expoVersion !== null;

function openNotification(notification: ExpoNotifications.Notification) {
  const url = notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
}

export function useNotificationNavigation() {
  useEffect(() => {
    let disposed = false;
    let removeResponseListener: (() => void) | undefined;

    async function configureNotifications() {
      if (isExpoGo) return;

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
        console.warn('Khong the khoi tao thong bao tren thiet bi nay.', error);
      }
    }

    void configureNotifications();

    return () => {
      disposed = true;
      removeResponseListener?.();
    };
  }, []);
}
