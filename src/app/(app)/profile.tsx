import Constants from 'expo-constants';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { Card } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { colors } from '@/theme/colors';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi BHL One?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <Screen title="Tài khoản" subtitle={user?.username}>
      <Card>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.detail}>{user?.phone || 'Chưa có số điện thoại'}</Text>
        <Text style={styles.detail}>{user?.email || 'Chưa có email'}</Text>
        <Text style={styles.role}>{user?.role}</Text>
      </Card>
      <Text style={styles.version}>BHL One phiên bản {Constants.expoConfig?.version || '1.0.0'}</Text>
      <Pressable onPress={confirmLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 20, fontWeight: '900' },
  detail: { color: colors.textMuted, marginTop: 8 },
  role: { color: colors.primaryDark, marginTop: 12, fontWeight: '800' },
  version: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 8 },
  logoutButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  logoutText: { color: colors.danger, fontWeight: '800' },
});
