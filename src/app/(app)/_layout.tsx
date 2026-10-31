import { Stack } from 'expo-router';

import { useNotificationNavigation } from '@/services/notifications';
import { colors } from '@/theme/colors';

/**
 * The responsive ERP uses one application shell and a drawer instead of a
 * native bottom tab bar. Screens keep their own URLs, while Screen/AppHeader
 * supplies the shared mobile web-like shell.
 */
export default function AppLayout() {
  useNotificationNavigation();

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade_from_bottom',
      }}
    />
  );
}
