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
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { FormLabel } from "@/components/forms/management-form";
import { PasswordInput } from "@/components/forms/password-input";
import { Screen } from "@/components/screen";
import { AppButton, Card, InfoRow, StatusBadge } from "@/components/ui";
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
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất khỏi BHL One?", [
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
          "Vui lòng cho phép BHL One gửi thông báo trong cài đặt thiết bị.",
        );
      }
    } catch (error) {
      Alert.alert("Không thể cập nhật thông báo", getApiErrorMessage(error));
      setPushState(await getPushNotificationState().catch(() => pushState));
    } finally {
      setPushLoading(false);
    }
  };

  const pushDescription =
    pushState === "enabled"
      ? "Đang nhận tin nhắn mới và thông báo nghiệp vụ khi ứng dụng chạy nền hoặc đã đóng."
      : pushState === "denied"
        ? "Quyền thông báo đang bị chặn. Mở cài đặt thiết bị để cấp lại quyền."
        : pushState === "unavailable"
          ? "Push native cần bản development hoặc bản cài Android/iOS, không hoạt động trong Expo Go và trình duyệt."
          : "Bật để nhận tin nhắn mới và thông báo nghiệp vụ ngay cả khi không mở ứng dụng.";

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
        <Card tone="soft">
          <Text className="text-card font-bold text-content">
            Bảo mật tài khoản
          </Text>
          <Text className="my-2 leading-5 text-content-muted">
            Đổi mật khẩu định kỳ và không chia sẻ thông tin đăng nhập.
          </Text>
          <AppButton
            tone="secondary"
            label="Đổi mật khẩu"
            onPress={() => {
              setPasswordValidationAttempted(false);
              setChangePasswordOpen(true);
            }}
          />
        </Card>
        <Card tone="soft">
          <View className="flex-row items-center justify-between gap-2.5">
            <Text className="text-card font-bold text-content">
              Thông báo đẩy
            </Text>
            <StatusBadge
              label={
                pushState === "enabled"
                  ? "Đang bật"
                  : pushState === "denied"
                    ? "Bị chặn"
                    : "Đang tắt"
              }
              tone={
                pushState === "enabled"
                  ? "success"
                  : pushState === "denied"
                    ? "danger"
                    : "neutral"
              }
            />
          </View>
          <Text className="my-2 leading-5 text-content-muted">
            {pushDescription}
          </Text>
          <AppButton
            tone="secondary"
            label={
              pushState === "enabled"
                ? "Tắt thông báo"
                : pushState === "denied"
                  ? "Mở cài đặt"
                  : "Bật thông báo"
            }
            disabled={pushState === "unavailable"}
            loading={pushLoading}
            onPress={() => void updatePushNotifications()}
          />
        </Card>
        <Text className="mt-2 text-center text-xs text-content-muted">
          BHL One phiên bản {Constants.expoConfig?.version || "1.0.0"}
        </Text>
        <AppButton
          tone="danger-outline"
          label="Đăng xuất"
          onPress={confirmLogout}
        />
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
