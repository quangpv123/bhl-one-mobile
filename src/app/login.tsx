import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { getApiErrorMessage } from '@/services/api';
import { colors, shadows, ui } from '@/theme/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Thiếu thông tin', 'Nhập tài khoản và mật khẩu để tiếp tục.');
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (error) {
      Alert.alert('Không thể đăng nhập', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View pointerEvents="none" style={styles.glowOne} />
        <View pointerEvents="none" style={styles.glowTwo} />

        <View style={styles.form}>
          <View style={styles.heading}>
            <View style={styles.brandMark}><Text style={styles.brandLetter}>E</Text></View>
            <View>
              <Text style={styles.title}>Đăng nhập</Text>
              <Text style={styles.subtitle}>ERP Workspace · BHL One</Text>
            </View>
          </View>
          <Text style={styles.label}>Tên đăng nhập, email hoặc số điện thoại</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            placeholder="Ví dụ: admin hoặc 0901234567"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={username}
            onChangeText={setUsername}
          />
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            editable={!submitting}
            placeholder="Nhập mật khẩu"
            placeholderTextColor={colors.textPlaceholder}
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
          />
          <Pressable disabled={submitting} onPress={() => void submit()} style={styles.button}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.sidebar },
  page: { flex: 1, justifyContent: 'center', padding: 16, overflow: 'hidden', backgroundColor: colors.sidebar },
  glowOne: { position: 'absolute', right: -130, top: '9%', width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(37, 99, 235, 0.28)' },
  glowTwo: { position: 'absolute', left: -110, bottom: -150, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(14, 165, 233, 0.12)' },
  heading: { marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  brandLetter: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: 3, color: colors.textMuted, fontSize: 12 },
  form: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
    borderRadius: ui.cardRadius,
    backgroundColor: colors.surface,
    gap: 9,
    ...shadows.floating,
  },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: {
    minHeight: ui.controlHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ui.radius,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    minHeight: ui.controlHeight,
    marginTop: 10,
    borderRadius: ui.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
