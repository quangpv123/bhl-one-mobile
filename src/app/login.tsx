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
import { colors } from '@/theme/colors';

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
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>B</Text>
        </View>
        <Text style={styles.title}>BHL One</Text>
        <Text style={styles.subtitle}>Kết nối công việc trong một ứng dụng</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Tài khoản</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            placeholder="Tên đăng nhập, email hoặc số điện thoại"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
          />
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            editable={!submitting}
            placeholder="Nhập mật khẩu"
            placeholderTextColor="#98A2B3"
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, justifyContent: 'center', padding: 24 },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
  },
  brandLetter: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  title: { marginTop: 18, textAlign: 'center', fontSize: 30, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, textAlign: 'center', color: colors.textMuted, fontSize: 15 },
  form: {
    marginTop: 36,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
    gap: 10,
  },
  label: { color: colors.text, fontWeight: '700', marginTop: 4 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  button: {
    minHeight: 50,
    marginTop: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
