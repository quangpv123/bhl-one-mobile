import { useState, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { colors, typography, ui } from "@/theme/colors";
import { AppIcon, type AppIconName } from "./app-icon";

export function Card({
  children,
  style,
  tone = "default",
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tone?: "default" | "soft" | "danger";
}>) {
  return (
    <View
      style={[
        styles.card,
        tone === "soft" && styles.cardSoft,
        tone === "danger" && styles.cardDanger,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function LoadingBlock() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>{text}</Text>
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
    <View style={styles.errorState}>
      <Text style={styles.errorTitle}>Không thể tải dữ liệu</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {onRetry ? <AppButton compact label="Thử lại" onPress={onRetry} /> : null}
    </View>
  );
}

export function SectionTitle({
  children,
  trailing,
}: PropsWithChildren<{ trailing?: ReactNode }>) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{children}</Text>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      hitSlop={5}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        tone === "secondary" && styles.buttonSecondary,
        tone === "success" && styles.buttonSuccess,
        tone === "danger" && styles.buttonDanger,
        tone === "danger-outline" && styles.buttonDangerOutline,
        tone === "ghost" && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <>
          {icon ? (
            <AppIcon
              name={icon}
              color={colors.textPlaceholder}
              size={16}
              style={styles.buttonLoadingPlaceholder}
            />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              tone === "secondary" && styles.buttonTextSecondary,
              tone === "success" && styles.buttonTextSuccess,
              tone === "ghost" && styles.buttonTextGhost,
              (tone === "danger" || tone === "danger-outline") &&
                styles.buttonTextDanger,
              styles.buttonLoadingPlaceholder,
            ]}
          >
            {label}
          </Text>
          <ActivityIndicator
            size="small"
            style={styles.buttonSpinner}
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
          <Text
            style={[
              styles.buttonText,
              tone === "secondary" && styles.buttonTextSecondary,
              tone === "success" && styles.buttonTextSuccess,
              tone === "ghost" && styles.buttonTextGhost,
              (tone === "danger" || tone === "danger-outline") &&
                styles.buttonTextDanger,
            ]}
          >
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
      style={[
        styles.badge,
        tone === "info" && styles.badgeInfo,
        tone === "success" && styles.badgeSuccess,
        tone === "warning" && styles.badgeWarning,
        tone === "danger" && styles.badgeDanger,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === "info" && styles.badgeTextInfo,
          tone === "success" && styles.badgeTextSuccess,
          tone === "warning" && styles.badgeTextWarning,
          tone === "danger" && styles.badgeTextDanger,
        ]}
      >
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
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <FormattedValue
          value={value}
          style={[styles.infoValue, emphasize && styles.infoValueEmphasis]}
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
  numberOfLines,
}: {
  value: string | number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const parts =
    typeof value === "string"
      ? value.match(/^(.*?)(\s+(?:kg|₫|đ|tấn|triệu)|%)$/u)
      : null;
  return (
    <Text numberOfLines={numberOfLines} style={style}>
      {parts ? (
        <>
          {parts[1]}
          <Text style={styles.valueUnit}>{parts[2]}</Text>
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
        style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
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
        <View style={styles.menuOverlay}>
          <Pressable
            accessibilityLabel="Đóng menu thao tác"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{label}</Text>
            {items.map((item, index) => (
              <Pressable
                accessibilityRole="button"
                disabled={item.disabled}
                key={`${item.label}-${index}`}
                onPress={() => {
                  setOpen(false);
                  item.onPress();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  index > 0 && styles.menuItemBorder,
                  item.disabled && styles.buttonDisabled,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <Text
                  style={[
                    styles.menuItemText,
                    item.tone === "danger" && styles.menuItemDanger,
                  ]}
                >
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
    <View style={styles.searchWrap}>
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
        style={[
          styles.searchInput,
          !showIcon && styles.searchInputWithoutIcon,
          props.style,
        ]}
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
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text
              style={[styles.chipText, selected && styles.chipTextSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: ui.cardPadding,
    backgroundColor: colors.surface,
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardSoft: { backgroundColor: colors.surfaceSubtle },
  cardDanger: { backgroundColor: "#FEF2F2", borderBottomColor: "#FECACA" },
  center: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: colors.textMuted, textAlign: "center", lineHeight: 21 },
  errorState: {
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 10,
  },
  errorTitle: { color: colors.danger, ...typography.cardTitle },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { flex: 1, color: colors.text, ...typography.sectionTitle },
  button: {
    minHeight: ui.compactControlHeight,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  buttonCompact: { paddingHorizontal: 8 },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  buttonSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder,
  },
  buttonDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  buttonDangerOutline: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  buttonGhost: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderSubtle,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.primaryDark, ...typography.button },
  buttonTextSecondary: { color: colors.textSecondary },
  buttonTextSuccess: { color: colors.success },
  buttonTextGhost: { color: colors.textSecondary },
  buttonTextDanger: { color: colors.danger },
  buttonLoadingPlaceholder: { opacity: 0 },
  buttonSpinner: { position: "absolute" },
  pressed: { opacity: 0.72 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  badgeInfo: { backgroundColor: colors.primarySoft },
  badgeSuccess: { backgroundColor: "#DCFCE7" },
  badgeWarning: { backgroundColor: "#FEF3C7" },
  badgeDanger: { backgroundColor: "#FEE2E2" },
  badgeText: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "700",
  },
  badgeTextInfo: { color: colors.primaryDark },
  badgeTextSuccess: { color: colors.success },
  badgeTextWarning: { color: colors.warning },
  badgeTextDanger: { color: colors.danger },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 5,
  },
  infoLabel: {
    flex: 1,
    color: colors.textMuted,
    ...typography.label,
    fontWeight: "400",
  },
  infoValue: {
    flex: 1.4,
    color: colors.text,
    ...typography.label,
    textAlign: "right",
  },
  infoValueEmphasis: {
    color: colors.primaryDark,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  valueUnit: { color: colors.textPlaceholder, fontSize: 11, fontWeight: "500" },
  searchWrap: {
    minHeight: ui.controlHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ui.radius,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    height: ui.controlHeight - 2,
    marginLeft: 8,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  searchInputWithoutIcon: { marginLeft: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: ui.compactControlHeight,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  chipText: { color: colors.textMuted, ...typography.button },
  chipTextSelected: { color: colors.primaryDark },
  moreButton: {
    minWidth: ui.compactControlHeight,
    minHeight: ui.compactControlHeight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  menuOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  menuCard: {
    width: "100%",
    maxWidth: 420,
    overflow: "hidden",
    borderRadius: ui.cardRadius,
    backgroundColor: colors.surface,
  },
  menuTitle: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: colors.textMuted,
    ...typography.label,
  },
  menuItem: { minHeight: 48, paddingHorizontal: 16, justifyContent: "center" },
  menuItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  menuItemPressed: { backgroundColor: colors.surfaceMuted },
  menuItemText: { color: colors.text, ...typography.button, fontSize: 14 },
  menuItemDanger: { color: colors.danger },
});
