import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/forms/password-input';
import { Screen } from '@/components/screen';
import { AppButton, Card, InfoRow, StatusBadge } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationState,
  type PushNotificationState,
} from '@/services/notifications';
import { colors, ui } from '@/theme/colors';
import { formatDateTime } from '@/utils/format';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [pushState, setPushState] = useState<PushNotificationState>('unavailable');
  const [pushLoading, setPushLoading] = useState(true);

  useEffect(() => {
    const refreshPushState = () => {
      void getPushNotificationState()
        .then(setPushState)
        .finally(() => setPushLoading(false));
    };
    refreshPushState();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshPushState();
    });
    return () => subscription.remove();
  }, []);

  const confirmLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi BHL One?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const closePasswordModal = () => {
    if (saving) return;
    setChangePasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const updatePushNotifications = async () => {
    if (pushState === 'unavailable') return;
    if (pushState === 'denied') {
      await Linking.openSettings();
      return;
    }

    setPushLoading(true);
    try {
      if (pushState === 'enabled') {
        await disablePushNotifications();
        setPushState('disabled');
        return;
      }
      const nextState = await enablePushNotifications();
      setPushState(nextState);
      if (nextState !== 'enabled') {
        Alert.alert('Chưa bật thông báo', 'Vui lòng cho phép BHL One gửi thông báo trong cài đặt thiết bị.');
      }
    } catch (error) {
      Alert.alert('Không thể cập nhật thông báo', getApiErrorMessage(error));
      setPushState(await getPushNotificationState().catch(() => pushState));
    } finally {
      setPushLoading(false);
    }
  };

  const pushDescription = pushState === 'enabled'
    ? 'Đang nhận tin nhắn mới và thông báo nghiệp vụ khi ứng dụng chạy nền hoặc đã đóng.'
    : pushState === 'denied'
      ? 'Quyền thông báo đang bị chặn. Mở cài đặt thiết bị để cấp lại quyền.'
      : pushState === 'unavailable'
        ? 'Push native cần bản development hoặc bản cài Android/iOS, không hoạt động trong Expo Go và trình duyệt.'
        : 'Bật để nhận tin nhắn mới và thông báo nghiệp vụ ngay cả khi không mở ứng dụng.';

  const changePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Thiếu mật khẩu', 'Nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      Alert.alert('Mật khẩu mới chưa hợp lệ', 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Hai lần nhập mật khẩu mới chưa giống nhau.');
      return;
    }
    setSaving(true);
    try {
      const response = await api.patch<{ success: boolean; message?: string }>('/users/me/password', {
        currentPassword,
        newPassword,
      });
      Alert.alert('Đổi mật khẩu thành công', `${response.data.message || 'Mật khẩu đã được cập nhật'}. Vui lòng đăng nhập lại.`, [
        { text: 'Đăng nhập lại', onPress: () => void logout() },
      ]);
    } catch (error) {
      Alert.alert('Không thể đổi mật khẩu', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.fullName || 'BHL')
    .split(/\s+/)
    .slice(-2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');

  return (
    <>
      <Screen title="Tài khoản" subtitle={`@${user?.username || ''}`}>
        <Card>
          <View style={styles.identity}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{user?.fullName}</Text>
              <View style={styles.badges}>
                <StatusBadge label={user?.role || '—'} tone="info" />
                <StatusBadge label={user?.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'} tone={user?.status === 'ACTIVE' ? 'success' : 'danger'} />
              </View>
            </View>
          </View>
          <View style={styles.details}>
            <InfoRow label="Số điện thoại" value={user?.phone || 'Chưa cập nhật'} />
            <InfoRow label="Email" value={user?.email || 'Chưa cập nhật'} />
            <InfoRow label="Đăng nhập gần nhất" value={formatDateTime(user?.lastLoginAt)} />
            <InfoRow label="Số quyền được cấp" value={String(user?.permissions?.length ?? 0)} />
          </View>
        </Card>
        <Card tone="soft">
          <Text style={styles.securityTitle}>Bảo mật tài khoản</Text>
          <Text style={styles.securityDescription}>Đổi mật khẩu định kỳ và không chia sẻ thông tin đăng nhập.</Text>
          <AppButton tone="secondary" label="Đổi mật khẩu" onPress={() => setChangePasswordOpen(true)} />
        </Card>
        <Card tone="soft">
          <View style={styles.notificationHeading}>
            <Text style={styles.securityTitle}>Thông báo đẩy</Text>
            <StatusBadge
              label={pushState === 'enabled' ? 'Đang bật' : pushState === 'denied' ? 'Bị chặn' : 'Đang tắt'}
              tone={pushState === 'enabled' ? 'success' : pushState === 'denied' ? 'danger' : 'neutral'}
            />
          </View>
          <Text style={styles.securityDescription}>{pushDescription}</Text>
          <AppButton
            tone="secondary"
            label={pushState === 'enabled' ? 'Tắt thông báo' : pushState === 'denied' ? 'Mở cài đặt' : 'Bật thông báo'}
            disabled={pushState === 'unavailable'}
            loading={pushLoading}
            onPress={() => void updatePushNotifications()}
          />
        </Card>
        <Text style={styles.version}>BHL One phiên bản {Constants.expoConfig?.version || '1.0.0'}</Text>
        <AppButton tone="danger-outline" label="Đăng xuất" onPress={confirmLogout} />
      </Screen>

      <Modal visible={changePasswordOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closePasswordModal}>
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <Pressable onPress={closePasswordModal}><Text style={styles.cancel}>Hủy</Text></Pressable>
              <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
              <Pressable disabled={saving} onPress={() => void changePassword()}><Text style={styles.save}>Lưu</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <PasswordField label="Mật khẩu hiện tại" value={currentPassword} onChangeText={setCurrentPassword} />
              <PasswordField label="Mật khẩu mới" value={newPassword} onChangeText={setNewPassword} />
              <Text style={styles.hint}>Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.</Text>
              <PasswordField label="Nhập lại mật khẩu mới" value={confirmPassword} onChangeText={setConfirmPassword} />
              <AppButton label="Đổi mật khẩu" loading={saving} onPress={() => void changePassword()} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function PasswordField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <PasswordInput
        value={value}
        onChangeText={onChangeText}
        placeholder="••••••••"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontSize: 23, fontWeight: '700' },
  identityText: { flex: 1 },
  name: { color: colors.text, fontSize: 20, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  details: { marginTop: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  securityTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  securityDescription: { color: colors.textMuted, lineHeight: 20, marginVertical: 8 },
  notificationHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  version: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 8 },
  modalSafeArea: { flex: 1, backgroundColor: colors.background },
  modalHeader: { minHeight: ui.headerHeight, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cancel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  save: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  form: { padding: 12, gap: 12 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: -4 },
});
