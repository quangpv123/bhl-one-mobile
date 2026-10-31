import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, shadows, ui } from '@/theme/colors';
import { AppIcon } from './app-icon';

export function Card({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'soft' | 'danger' }>) {
  return <View style={[styles.card, tone === 'soft' && styles.cardSoft, tone === 'danger' && styles.cardDanger]}>{children}</View>;
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

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorState}>
      <Text style={styles.errorTitle}>Không thể tải dữ liệu</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {onRetry ? <AppButton compact label="Thử lại" onPress={onRetry} /> : null}
    </View>
  );
}

export function SectionTitle({ children, trailing }: PropsWithChildren<{ trailing?: ReactNode }>) {
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
  tone = 'primary',
  compact = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost';
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'danger' && styles.buttonDanger,
        tone === 'ghost' && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone === 'primary' || tone === 'danger' ? '#FFFFFF' : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            (tone === 'secondary' || tone === 'ghost') && styles.buttonTextSecondary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'info' && styles.badgeInfo,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warning' && styles.badgeWarning,
        tone === 'danger' && styles.badgeDanger,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === 'info' && styles.badgeTextInfo,
          tone === 'success' && styles.badgeTextSuccess,
          tone === 'warning' && styles.badgeTextWarning,
          tone === 'danger' && styles.badgeTextDanger,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function InfoRow({ label, value, emphasize = false }: { label: string; value: ReactNode; emphasize?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[styles.infoValue, emphasize && styles.infoValueEmphasis]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function SearchField({ onSubmit, ...props }: TextInputProps & { onSubmit?: () => void }) {
  return (
    <View style={styles.searchWrap}>
      <AppIcon name="search" color={colors.textMuted} size={19} />
      <TextInput
        {...props}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textPlaceholder}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={[styles.searchInput, props.style]}
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
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: ui.cardPadding,
    borderRadius: ui.cardRadius,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadows.card,
  },
  cardSoft: { backgroundColor: colors.surfaceSubtle },
  cardDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  center: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  errorState: { paddingVertical: 30, paddingHorizontal: 18, alignItems: 'center', gap: 10 },
  errorTitle: { color: colors.danger, fontSize: 16, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '900' },
  button: {
    minHeight: ui.controlHeight,
    paddingHorizontal: 14,
    borderRadius: ui.radius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: ui.compactControlHeight, paddingHorizontal: 9, borderRadius: 7 },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  buttonDanger: { backgroundColor: colors.danger },
  buttonGhost: { minHeight: ui.compactControlHeight, paddingHorizontal: 8, backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  buttonTextSecondary: { color: colors.primaryDark },
  pressed: { opacity: 0.72 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.surfaceMuted },
  badgeInfo: { backgroundColor: colors.primarySoft },
  badgeSuccess: { backgroundColor: '#DCFCE7' },
  badgeWarning: { backgroundColor: '#FEF3C7' },
  badgeDanger: { backgroundColor: '#FEE2E2' },
  badgeText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  badgeTextInfo: { color: colors.primaryDark },
  badgeTextSuccess: { color: colors.success },
  badgeTextWarning: { color: colors.warning },
  badgeTextDanger: { color: colors.danger },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingVertical: 5 },
  infoLabel: { flex: 1, color: colors.textMuted, fontSize: 12 },
  infoValue: { flex: 1.4, color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  infoValueEmphasis: { color: colors.primaryDark, fontSize: 15, fontWeight: '900' },
  searchWrap: {
    minHeight: ui.controlHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ui.radius,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, minHeight: ui.controlHeight - 2, marginLeft: 8, color: colors.text, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 32, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: colors.primaryDark },
});
