import { useState, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { colors } from "@/theme/colors";
import { AppIcon, type AppIconName } from "./app-icon";

export function Card({
  children,
  style,
  tone = "default",
  padded = true,
  className = "",
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tone?: "default" | "soft" | "danger";
  padded?: boolean;
  className?: string;
}>) {
  return (
    <View
      className={`border-b ${padded ? "p-3" : ""} ${
        tone === "soft"
          ? "border-border-subtle bg-surface-subtle"
          : tone === "danger"
            ? "border-red-200 bg-danger-soft"
            : "border-border-subtle bg-surface"
      } ${className}`}
      style={style}
    >
      {children}
    </View>
  );
}

export function LoadingBlock() {
  return (
    <View className="items-center justify-center py-8">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View className="items-center justify-center py-8">
      <Text className="text-center leading-[21px] text-content-muted">{text}</Text>
    </View>
  );
}

export function ErrorState({
  text,
  onRetry,
}: {
  text: string;
  onRetry?: () => void;
}) {
  return (
    <View className="items-center gap-2.5 px-[18px] py-[30px]">
      <Text className="text-card font-bold text-danger">Không thể tải dữ liệu</Text>
      <Text className="text-center leading-[21px] text-content-muted">{text}</Text>
      {onRetry ? <AppButton compact label="Thử lại" onPress={onRetry} /> : null}
    </View>
  );
}

export function SectionTitle({
  children,
  trailing,
}: PropsWithChildren<{ trailing?: ReactNode }>) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-section font-bold text-content">{children}</Text>
      {trailing}
    </View>
  );
}

export function AppButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = "primary",
  compact = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "danger-outline"
    | "ghost";
  compact?: boolean;
  icon?: AppIconName;
}) {
  const toneClassName =
    tone === "secondary"
      ? "border-border bg-surface"
      : tone === "success"
        ? "border-success-border bg-success-soft"
        : tone === "danger" || tone === "danger-outline"
          ? "border-danger-border bg-danger-soft"
          : tone === "ghost"
            ? "border-border-subtle bg-surface-subtle"
            : "border-primary-border bg-primary-soft";
  const textClassName =
    tone === "success"
      ? "text-success"
      : tone === "danger" || tone === "danger-outline"
        ? "text-danger"
        : tone === "secondary" || tone === "ghost"
          ? "text-content-secondary"
          : "text-primary-dark";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      hitSlop={5}
      onPress={onPress}
      className={`min-h-control flex-row items-center justify-center gap-[5px] rounded-compact border ${
        compact ? "px-2" : "px-2.5"
      } ${toneClassName} ${disabled || loading ? "opacity-50" : ""}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : disabled || loading ? 0.5 : 1 })}
    >
      {loading ? (
        <>
          {icon ? (
            <AppIcon
              name={icon}
              color={colors.textPlaceholder}
              size={16}
              style={{ opacity: 0 }}
            />
          ) : null}
          <Text className={`text-label font-semibold opacity-0 ${textClassName}`}>
            {label}
          </Text>
          <ActivityIndicator
            size="small"
            className="absolute"
            color={
              tone === "success"
                ? colors.success
                : tone === "danger" || tone === "danger-outline"
                  ? colors.danger
                  : tone === "secondary" || tone === "ghost"
                    ? colors.textSecondary
                    : colors.primaryDark
            }
          />
        </>
      ) : (
        <>
          {icon ? (
            <AppIcon
              name={icon}
              color={
                tone === "success"
                  ? colors.success
                  : tone === "danger" || tone === "danger-outline"
                    ? colors.danger
                    : tone === "secondary" || tone === "ghost"
                      ? colors.textSecondary
                      : colors.primaryDark
              }
              size={16}
            />
          ) : null}
          <Text className={`text-label font-semibold ${textClassName}`}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  return (
    <View
      className={`self-start shrink-0 flex-row rounded-md px-[7px] py-[3px] ${
        tone === "info"
          ? "bg-primary-soft"
          : tone === "success"
            ? "bg-green-100"
            : tone === "warning"
              ? "bg-amber-100"
              : tone === "danger"
                ? "bg-red-100"
                : "bg-surface-muted"
      }`}
    >
      <Text numberOfLines={1} className={`shrink-0 text-caption font-bold ${
        tone === "info"
          ? "text-primary-dark"
          : tone === "success"
            ? "text-success"
            : tone === "warning"
              ? "text-warning"
              : tone === "danger"
                ? "text-danger"
                : "text-content-muted"
      }`}>
        {label}
      </Text>
    </View>
  );
}

export function InfoRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-[5px]">
      <Text className="flex-1 text-label font-normal text-content-muted">{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <FormattedValue
          value={value}
          className={`flex-[1.4] text-right text-label font-semibold ${emphasize ? 'text-[15px] leading-5 font-bold text-primary-dark' : 'text-content'}`}
        />
      ) : (
        value
      )}
    </View>
  );
}

export function FormattedValue({
  value,
  style,
  className,
  numberOfLines,
}: {
  value: string | number;
  style?: StyleProp<TextStyle>;
  className?: string;
  numberOfLines?: number;
}) {
  const parts =
    typeof value === "string"
      ? value.match(/^(.*?)(\s+(?:kg|₫|đ|tấn|triệu)|%)$/u)
      : null;
  return (
    <Text numberOfLines={numberOfLines} className={className} style={style}>
      {parts ? (
        <>
          {parts[1]}
          <Text className="text-caption font-medium text-content-placeholder">{parts[2]}</Text>
        </>
      ) : (
        value
      )}
    </Text>
  );
}

export interface ActionMenuItem {
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

export function ActionMenu({
  items,
  label = "Thao tác khác",
}: {
  items: ActionMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => setOpen(true)}
        className="min-h-control min-w-[34px] items-center justify-center rounded-compact border border-border bg-surface"
        style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      >
        <AppIcon name="more" color={colors.textSecondary} size={20} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 items-center justify-end bg-[rgba(15,23,42,0.42)] p-4">
          <Pressable
            accessibilityLabel="Đóng menu thao tác"
            className="absolute inset-0"
            onPress={() => setOpen(false)}
          />
          <View className="w-full max-w-[420px] overflow-hidden rounded-card bg-surface">
            <Text className="px-4 py-[13px] text-label font-semibold text-content-muted">{label}</Text>
            {items.map((item, index) => (
              <Pressable
                accessibilityRole="button"
                disabled={item.disabled}
                key={`${item.label}-${index}`}
                onPress={() => {
                  setOpen(false);
                  item.onPress();
                }}
                className={`min-h-12 justify-center px-4 ${index > 0 ? 'border-t border-border' : ''} ${item.disabled ? 'opacity-50' : ''}`}
                style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : colors.surface })}
              >
                <Text className={`text-sm font-semibold ${item.tone === 'danger' ? 'text-danger' : 'text-content'}`}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

export function SearchField({
  onSubmit,
  showIcon = true,
  ...props
}: TextInputProps & { onSubmit?: () => void; showIcon?: boolean }) {
  return (
    <View className="h-control flex-row items-center rounded-control border border-border bg-surface px-[13px]">
      {showIcon ? (
        <AppIcon name="search" color={colors.textMuted} size={19} />
      ) : null}
      <TextInput
        {...props}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textPlaceholder}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        className={`h-8 flex-1 py-0 text-sm leading-[19px] text-content ${showIcon ? 'ml-2' : ''}`}
        style={[{ textAlignVertical: 'center', includeFontPadding: false }, props.style]}
      />
    </View>
  );
}

export function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`min-h-control items-center justify-center rounded-compact border px-2.5 ${
              selected ? 'border-primary-border bg-primary-soft' : 'border-border bg-surface'
            }`}
          >
            <Text className={`text-label font-semibold ${selected ? 'text-primary-dark' : 'text-content-muted'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
