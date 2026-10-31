import Constants from 'expo-constants';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { featureGroups, featureHref, mobileFeatures } from '@/navigation/moduleRegistry';
import { useAuth } from '@/features/auth/auth-context';
import { colors, shadows, ui } from '@/theme/colors';
import { AppIcon, type AppIconName } from './app-icon';

function initials(value?: string) {
  return (value || 'BHL')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

function visiblePath(href: string) {
  return href.replace('/(app)', '') || '/';
}

export function AppHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isNested = pathname.startsWith('/purchase-warehouse/') || pathname.startsWith('/material-record/');

  return (
    <>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={isNested ? 'Quay lại' : 'Mở trình đơn'}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => (isNested ? router.back() : setDrawerOpen(true))}
          style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
        >
          <AppIcon name={isNested ? 'back' : 'menu'} color={colors.textSecondary} size={20} />
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
      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function NavigationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const allowedFeatures = mobileFeatures.filter(feature => {
    if (feature.permission && !user?.permissions?.includes(feature.permission)) return false;
    if (feature.excludedPermission && user?.permissions?.includes(feature.excludedPermission)) return false;
    return true;
  });

  const navigate = (href: string) => {
    onClose();
    router.push(href as never);
  };

  const confirmLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi BHL One?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={open}
    >
      <View style={styles.drawerOverlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.drawer}>
          <View style={styles.drawerBrand}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>E</Text></View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandTitle}>ERP Workspace</Text>
              <Text style={styles.brandSubtitle}>Quản trị doanh nghiệp</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.drawerScroll} showsVerticalScrollIndicator={false}>
            <DrawerItem
              active={pathname === '/'}
              icon="home"
              label="Tổng quan"
              onPress={() => navigate('/(app)')}
            />
            <DrawerItem
              active={pathname === '/work'}
              icon="apps"
              label="Tất cả chức năng"
              onPress={() => navigate('/(app)/work')}
            />
            <DrawerItem
              active={pathname === '/messages'}
              icon="messages"
              label="Tin nhắn"
              onPress={() => navigate('/(app)/messages')}
            />

            {featureGroups.map(group => {
              const items = allowedFeatures.filter(feature => feature.group === group.key);
              if (!items.length) return null;
              return (
                <View key={group.key} style={styles.drawerGroup}>
                  <Text style={styles.drawerGroupTitle}>{group.title}</Text>
                  {items.map(feature => {
                    const href = featureHref(feature);
                    return (
                      <DrawerItem
                        active={pathname === visiblePath(href)}
                        icon={feature.icon}
                        key={feature.key}
                        label={feature.title}
                        onPress={() => navigate(href)}
                      />
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.drawerFooter}>
            <Pressable onPress={() => navigate('/(app)/profile')} style={styles.drawerAccount}>
              <View style={styles.drawerAvatar}><Text style={styles.drawerAvatarText}>{initials(user?.fullName)}</Text></View>
              <View style={styles.drawerAccountCopy}>
                <Text numberOfLines={1} style={styles.drawerAccountName}>{user?.fullName}</Text>
                <Text numberOfLines={1} style={styles.drawerAccountRole}>@{user?.username}</Text>
              </View>
            </Pressable>
            <View style={styles.drawerFooterBottom}>
              <Text style={styles.drawerVersion}>Phiên bản {Constants.expoConfig?.version || '1.0.0'}</Text>
              <Pressable accessibilityLabel="Đăng xuất" hitSlop={8} onPress={confirmLogout}>
                <AppIcon name="logout" color="#FCA5A5" size={19} />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
        <Pressable accessibilityLabel="Đóng trình đơn" onPress={onClose} style={styles.drawerDismiss} />
      </View>
    </Modal>
  );
}

function DrawerItem({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: AppIconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.drawerItem, active && styles.drawerItemActive, pressed && styles.drawerItemPressed]}
    >
      <AppIcon name={icon} color={active ? '#FFFFFF' : '#CBD5E1'} size={18} />
      <Text numberOfLines={1} style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.68 },
  header: {
    minHeight: ui.headerHeight,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderBottomColor: '#E8EDF5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: ui.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonActive: { backgroundColor: colors.primarySoft },
  headerTitle: { flex: 1, color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
  },
  avatarText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(15, 23, 42, 0.48)' },
  drawer: { width: '84%', maxWidth: 280, backgroundColor: colors.sidebar, ...shadows.floating },
  drawerDismiss: { flex: 1 },
  drawerBrand: { height: 76, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  brandCopy: { flex: 1 },
  brandTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  brandSubtitle: { marginTop: 2, color: colors.sidebarMuted, fontSize: 11 },
  drawerScroll: { paddingHorizontal: 10, paddingBottom: 18 },
  drawerItem: {
    minHeight: 42,
    marginVertical: 2,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerItemActive: { backgroundColor: colors.primary },
  drawerItemPressed: { backgroundColor: '#1E293B' },
  drawerItemText: { flex: 1, color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  drawerItemTextActive: { color: '#FFFFFF', fontWeight: '700' },
  drawerGroup: { marginTop: 14 },
  drawerGroupTitle: {
    paddingHorizontal: 12,
    paddingBottom: 5,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  drawerFooter: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#334155' },
  drawerAccount: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  drawerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  drawerAvatarText: { color: colors.primaryDark, fontSize: 11, fontWeight: '900' },
  drawerAccountCopy: { flex: 1 },
  drawerAccountName: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  drawerAccountRole: { marginTop: 2, color: colors.sidebarMuted, fontSize: 10 },
  drawerFooterBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  drawerVersion: { color: '#64748B', fontSize: 10 },
});
