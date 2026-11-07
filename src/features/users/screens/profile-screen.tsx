import Constants from "expo-constants";
import { useEffect, useState } from "react";
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { AppIcon } from "@/components/app-icon";
import { FormLabel } from "@/components/forms/management-form";
import { PasswordInput } from "@/components/forms/password-input";
import { Screen } from "@/components/screen";
import { Card, InfoRow, StatusBadge } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import {
  passwordSchema,
  requiredTextSchema,
  zodErrorMap,
} from "@/lib/validation";
import { api, getApiErrorMessage } from "@/services/api";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationState,
  type PushNotificationState,
} from "@/services/notifications";
import { colors } from "@/theme/colors";
import { formatDateTime } from "@/utils/format";

const changePasswordSchema = z
  .object({
    currentPassword: requiredTextSchema,
    newPassword: passwordSchema,
    confirmPassword: requiredTextSchema,
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Hai lần nhập mật khẩu mới chưa giống nhau.",
  });

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordValidationAttempted, setPasswordValidationAttempted] =
    useState(false);
  const [pushState, setPushState] =
    useState<PushNotificationState>("unavailable");
  const [pushLoading, setPushLoading] = useState(true);

  useEffect(() => {
    const refreshPushState = () => {
      void getPushNotificationState()
        .then(setPushState)
        .finally(() => setPushLoading(false));
    };
    refreshPushState();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshPushState();
    });
    return () => subscription.remove();
  }, []);

  const confirmLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất khỏi BHL Work?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: () => void logout() },
    ]);
  };

  const closePasswordModal = () => {
    if (saving) return;
    setChangePasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordValidationAttempted(false);
  };

  const updatePushNotifications = async () => {
    if (pushState === "unavailable") return;
    if (pushState === "denied") {
      await Linking.openSettings();
      return;
    }

    setPushLoading(true);
    try {
      if (pushState === "enabled") {
        await disablePushNotifications();
        setPushState("disabled");
        return;
      }
      const nextState = await enablePushNotifications();
      setPushState(nextState);
      if (nextState !== "enabled") {
        Alert.alert(
          "Chưa bật thông báo",
          "Vui lòng cho phép BHL Work gửi thông báo trong cài đặt thiết bị.",
        );
      }
    } catch (error) {
      Alert.alert("Không thể cập nhật thông báo", getApiErrorMessage(error));
      setPushState(await getPushNotificationState().catch(() => pushState));
    } finally {
      setPushLoading(false);
    }
  };

  const pushSubtitle =
    pushState === "enabled"
      ? "Đang nhận thông báo trên thiết bị"
      : pushState === "denied"
        ? "Quyền thông báo đang bị chặn"
        : pushState === "unavailable"
          ? "Cần bản cài Android/iOS"
          : "Nhận thông báo trên thiết bị";

  const changePassword = async () => {
    setPasswordValidationAttempted(true);
    if (
      !changePasswordSchema.safeParse({
        currentPassword,
        newPassword,
        confirmPassword,
      }).success
    )
      return;
    setSaving(true);
    try {
      const response = await api.patch<{ success: boolean; message?: string }>(
        "/users/me/password",
        {
          currentPassword,
          newPassword,
        },
      );
      Alert.alert(
        "Đổi mật khẩu thành công",
        `${response.data.message || "Mật khẩu đã được cập nhật"}. Vui lòng đăng nhập lại.`,
        [{ text: "Đăng nhập lại", onPress: () => void logout() }],
      );
    } catch (error) {
      Alert.alert("Không thể đổi mật khẩu", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.fullName || "BHL")
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const passwordValidation = changePasswordSchema.safeParse({
    currentPassword,
    newPassword,
    confirmPassword,
  });
  const passwordErrors = passwordValidation.success
    ? {}
    : zodErrorMap(passwordValidation.error);
  const currentPasswordError = passwordValidationAttempted
    ? (passwordErrors.currentPassword ?? null)
    : null;
  const newPasswordError = passwordValidationAttempted
    ? (passwordErrors.newPassword ?? null)
    : null;
  const confirmPasswordError = passwordValidationAttempted
    ? (passwordErrors.confirmPassword ?? null)
    : null;

  return (
    <>
      <Screen title="Tài khoản">
        <Card>
          <View className="flex-row items-center gap-3.5">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
              <Text className="text-[23px] font-bold text-primary-dark">
                {initials}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-content">
                {user?.fullName}
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-1.5">
                <StatusBadge label={user?.role || "—"} tone="info" />
                <StatusBadge
                  label={
                    user?.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"
                  }
                  tone={user?.status === "ACTIVE" ? "success" : "danger"}
                />
              </View>
            </View>
          </View>
          <View className="mt-4 border-t border-border pt-2.5">
            <InfoRow
              label="Số điện thoại"
              value={user?.phone || "Chưa cập nhật"}
            />
            <InfoRow label="Email" value={user?.email || "Chưa cập nhật"} />
            <InfoRow
              label="Đăng nhập gần nhất"
              value={formatDateTime(user?.lastLoginAt)}
            />
            <InfoRow
              label="Số quyền được cấp"
              value={String(user?.permissions?.length ?? 0)}
            />
          </View>
        </Card>
        <View className="overflow-hidden rounded-[16px] border border-border-subtle bg-surface">
          <Pressable
            accessibilityLabel="Đổi mật khẩu"
            accessibilityRole="button"
            onPress={() => {
              setPasswordValidationAttempted(false);
              setChangePasswordOpen(true);
            }}
            className="min-h-[58px] flex-row items-center gap-3 px-4 py-3"
            style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : colors.surface })}
          >
            <AppIcon name="change-password" size={18} color={colors.textMuted} />
            <Text className="flex-1 text-body font-medium text-content">Đổi mật khẩu</Text>
            <AppIcon name="chevron-right" size={18} color={colors.textPlaceholder} />
          </Pressable>

          <View className="mx-4 border-t border-border" />

          <View className="min-h-[68px] flex-row items-center gap-3 px-4 py-3">
            <AppIcon name="notifications" size={18} color={colors.textMuted} />
            <View className="min-w-0 flex-1">
              <Text className="text-body font-medium text-content">Thông báo đẩy</Text>
              <Text numberOfLines={1} className="mt-0.5 text-[11px] text-content-muted">
                {pushSubtitle}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Thông báo đẩy"
              disabled={pushLoading || pushState === "unavailable"}
              ios_backgroundColor="#DCE3EC"
              thumbColor="#FFFFFF"
              trackColor={{ false: "#DCE3EC", true: colors.primary }}
              value={pushState === "enabled"}
              onValueChange={() => void updatePushNotifications()}
            />
          </View>
        </View>

        <Pressable
          accessibilityLabel="Đăng xuất"
          accessibilityRole="button"
          onPress={confirmLogout}
          className="min-h-[58px] flex-row items-center gap-3 rounded-[16px] border border-border-subtle bg-surface px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
        >
          <AppIcon name="logout" size={18} color={colors.danger} />
          <Text className="flex-1 text-body font-medium text-danger">Đăng xuất</Text>
          <AppIcon name="chevron-right" size={18} color={colors.dangerBorder} />
        </Pressable>

        <Text className="mt-0.5 text-center text-xs text-content-muted">
          BHL Work • Phiên bản {Constants.expoConfig?.version || "1.0.0"}
        </Text>
      </Screen>

      <Modal
        visible={changePasswordOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePasswordModal}
      >
        <SafeAreaView className="flex-1 bg-background">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="min-h-header flex-row items-center justify-between border-b border-border bg-surface px-3">
              <Pressable onPress={closePasswordModal}>
                <Text className="text-sm font-semibold text-content-muted">
                  Hủy
                </Text>
              </Pressable>
              <Text className="text-card font-bold text-content">
                Đổi mật khẩu
              </Text>
              <Pressable
                disabled={saving}
                onPress={() => void changePassword()}
              >
                <Text className="text-sm font-semibold text-primary">Lưu</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerClassName="gap-3 p-3"
              keyboardShouldPersistTaps="handled"
            >
              <PasswordField
                label="Mật khẩu hiện tại *"
                value={currentPassword}
                error={currentPasswordError}
                onChangeText={setCurrentPassword}
              />
              <PasswordField
                label="Mật khẩu mới *"
                value={newPassword}
                error={newPasswordError}
                onChangeText={setNewPassword}
              />
              <Text className="mt-[-4px] text-xs leading-[18px] text-content-muted">
                Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.
              </Text>
              <PasswordField
                label="Nhập lại mật khẩu mới *"
                value={confirmPassword}
                error={confirmPasswordError}
                onChangeText={setConfirmPassword}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function PasswordField({
  label,
  value,
  error,
  onChangeText,
}: {
  label: string;
  value: string;
  error: string | null;
  onChangeText: (value: string) => void;
}) {
  return (
    <View className="gap-[7px]">
      <FormLabel label={label} />
      <PasswordInput
        value={value}
        onChangeText={onChangeText}
        placeholder="••••••••"
        containerStyle={
          error
            ? { borderColor: colors.danger, backgroundColor: colors.dangerSoft }
            : undefined
        }
      />
      {error ? (
        <Text className="text-caption font-medium text-danger">{error}</Text>
      ) : null}
    </View>
  );
}
