import { Stack } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';
import { useNotificationNavigation, usePushNotificationRegistration } from '@/services/notifications';
import { colors } from '@/theme/colors';

export const unstable_settings = {
  anchor: 'index',
};

/**
 * The responsive ERP uses one application shell and a drawer instead of a
 * native bottom tab bar. Screens keep their own URLs, while Screen/AppHeader
 * supplies the shared mobile web-like shell.
 */
export default function AppLayout() {
  const { user } = useAuth();
  useNotificationNavigation();
  usePushNotificationRegistration(user?.id);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade_from_bottom',
      }}
    />
  );
}
