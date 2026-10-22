import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useNotificationNavigation } from '@/services/notifications';
import { colors } from '@/theme/colors';

const icons: Record<string, string> = {
  index: '⌂',
  messages: '✉',
  transport: '▣',
  profile: '●',
};

export default function AppTabsLayout() {
  useNotificationNavigation();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons[route.name] || '•'}</Text>,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Tổng quan' }} />
      <Tabs.Screen name="messages" options={{ title: 'Tin nhắn' }} />
      <Tabs.Screen name="transport" options={{ title: 'Chuyến xe' }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { height: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border },
  label: { fontSize: 11, fontWeight: '700' },
  icon: { fontSize: 21, fontWeight: '800' },
});
