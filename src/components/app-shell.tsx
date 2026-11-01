import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { colors, ui } from '@/theme/colors';
import { AppIcon } from './app-icon';

function initials(value?: string) {
  return (value || 'BHL')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

export function AppHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isNested = pathname.startsWith('/purchase-warehouse/') || pathname.startsWith('/material-record/');

  const openNavigation = () => {
    if (isNested) {
      router.back();
      return;
    }
    if (pathname !== '/work') router.push('/(app)/work');
  };

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={isNested ? 'Quay lại' : 'Mở menu chức năng'}
        accessibilityRole="button"
        hitSlop={8}
        onPress={openNavigation}
        style={({ pressed }) => [
          styles.headerIconButton,
          !isNested && pathname === '/work' && styles.headerIconButtonActive,
          pressed && styles.pressed,
        ]}
      >
        <AppIcon
          name={isNested ? 'back' : 'apps'}
          color={!isNested && pathname === '/work' ? colors.primary : colors.textSecondary}
          size={20}
        />
      </Pressable>

      <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>

      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel="Tin nhắn"
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => router.push('/(app)/messages')}
          style={({ pressed }) => [
            styles.headerIconButton,
            pathname === '/messages' && styles.headerIconButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <AppIcon
            name="messages"
            color={pathname === '/messages' ? colors.primary : colors.textSecondary}
            size={19}
          />
        </Pressable>
        <Pressable
          accessibilityLabel="Tài khoản"
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => router.push('/(app)/profile')}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
        >
          <Text style={styles.avatarText}>{initials(user?.fullName)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.68 },
  header: {
    minHeight: 52,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderBottomColor: '#E8EDF5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: ui.smallRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonActive: { backgroundColor: colors.primarySoft },
  headerTitle: { flex: 1, color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
  },
  avatarText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
});
