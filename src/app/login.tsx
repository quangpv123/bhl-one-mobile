import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { PasswordInput } from '@/components/forms/password-input';
import { AppButton } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { getApiErrorMessage } from '@/services/api';
import { getStoredLoginIdentifier } from '@/services/session-storage';
import { colors } from '@/theme/colors';
import { requiredTextSchema, zodErrorMap } from '@/lib/validation';

const loginSchema = z.object({
  username: requiredTextSchema,
  password: requiredTextSchema,
});

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const usernameEdited = useRef(false);
  const usernameValue = useRef('');
  const passwordValue = useRef('');
  const submittingRef = useRef(false);
  const autoLoginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    void getStoredLoginIdentifier()
      .then(value => {
        if (active && value && !usernameEdited.current) {
          usernameValue.current = value;
          setUsername(value);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (autoLoginTimer.current) clearTimeout(autoLoginTimer.current);
    };
  }, []);

  const submit = async () => {
    const loginIdentifier = usernameValue.current.trim();
    const currentPassword = passwordValue.current;
    setValidationAttempted(true);
    if (!loginSchema.safeParse({ username: loginIdentifier, password: currentPassword }).success) return;
    if (submittingRef.current) return;
    if (autoLoginTimer.current) {
      clearTimeout(autoLoginTimer.current);
      autoLoginTimer.current = null;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await login(loginIdentifier, currentPassword);
    } catch (error) {
      passwordValue.current = '';
      setPassword('');
      Alert.alert('Không thể đăng nhập', getApiErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const scheduleAutofillLogin = () => {
    if (autoLoginTimer.current) clearTimeout(autoLoginTimer.current);
    autoLoginTimer.current = setTimeout(() => {
      autoLoginTimer.current = null;
      if (usernameValue.current.trim() && passwordValue.current && !submittingRef.current) void submit();
    }, 350);
  };

  const validation = loginSchema.safeParse({ username, password });
  const validationErrors = validation.success ? {} : zodErrorMap(validation.error);
  const usernameError = validationAttempted ? validationErrors.username : undefined;
  const passwordError = validationAttempted ? validationErrors.password : undefined;

  return (
    <SafeAreaView className="flex-1 bg-sidebar">
      <KeyboardAvoidingView className="flex-1 justify-center overflow-hidden bg-sidebar p-4" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View pointerEvents="none" className="absolute right-[-130px] top-[9%] h-[340px] w-[340px] rounded-full bg-[rgba(37,99,235,0.28)]" />
        <View pointerEvents="none" className="absolute bottom-[-150px] left-[-110px] h-[360px] w-[360px] rounded-full bg-[rgba(14,165,233,0.12)]" />

        <View className="w-full max-w-[440px] self-center gap-[9px] rounded-card bg-surface px-[22px] py-[26px] shadow-lg">
          <View className="mb-[18px] flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-card bg-primary shadow-md"><Text className="text-[23px] font-bold text-white">E</Text></View>
            <View>
              <Text className="text-[28px] leading-8 font-bold text-content">Đăng nhập</Text>
              <Text className="mt-[3px] text-xs text-content-muted">ERP Workspace · BHL One</Text>
            </View>
          </View>
          <Text className="mt-1 text-body font-semibold text-content-secondary">Tên đăng nhập, email hoặc số điện thoại</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            editable={!submitting}
            placeholder="Ví dụ: admin hoặc 0901234567"
            placeholderTextColor={colors.textPlaceholder}
            className={`h-control rounded-control border px-3 py-0 text-content ${usernameError ? 'border-danger bg-danger-soft' : 'border-border bg-surface'}`}
            style={{ textAlignVertical: 'center', includeFontPadding: false }}
            value={username}
            onChangeText={value => {
              const previousValue = usernameValue.current;
              usernameEdited.current = true;
              usernameValue.current = value;
              setUsername(value);
              if (!previousValue && value.length > 1 && passwordValue.current.length > 1) scheduleAutofillLogin();
            }}
          />
          {usernameError ? <Text className="text-caption font-medium text-danger">{usernameError}</Text> : null}
          <Text className="mt-1 text-body font-semibold text-content-secondary">Mật khẩu</Text>
          <PasswordInput
            autoComplete="current-password"
            editable={!submitting}
            placeholder="Nhập mật khẩu"
            containerStyle={passwordError ? { borderColor: colors.danger, backgroundColor: colors.dangerSoft } : undefined}
            value={password}
            onChangeText={value => {
              const previousValue = passwordValue.current;
              passwordValue.current = value;
              setPassword(value);
              if (!previousValue && value.length > 1 && usernameValue.current.trim()) scheduleAutofillLogin();
            }}
            onSubmitEditing={() => void submit()}
          />
          {passwordError ? <Text className="text-caption font-medium text-danger">{passwordError}</Text> : null}
          <View className="mt-2.5">
            <AppButton label="Đăng nhập" loading={submitting} onPress={() => void submit()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
