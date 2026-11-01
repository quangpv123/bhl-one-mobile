import { useState, type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';
import { colors, ui } from '@/theme/colors';
import { PasswordInput } from './password-input';

export function ManagementSheet({
  title,
  saveLabel = 'Lưu thay đổi',
  saving,
  onClose,
  onSave,
  children,
}: PropsWithChildren<{
  title: string;
  saveLabel?: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}>) {
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable disabled={saving} onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Hủy</Text>
            </Pressable>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            <Pressable disabled={saving} onPress={onSave} hitSlop={8}>
              <Text style={[styles.save, saving && styles.disabledText]}>Lưu</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
            <AppButton label={saveLabel} loading={saving} onPress={onSave} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function FormField({ label, hint, secureTextEntry, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {secureTextEntry ? (
        <PasswordInput
          {...props}
          containerStyle={props.editable === false && styles.inputDisabled}
        />
      ) : (
        <TextInput
          {...props}
          placeholderTextColor={colors.textPlaceholder}
          style={[styles.input, props.multiline && styles.textArea, props.editable === false && styles.inputDisabled, props.style]}
        />
      )}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function OptionPicker({
  label,
  value,
  options,
  placeholder = 'Chọn giá trị',
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; description?: string }[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.select, disabled && styles.inputDisabled]}
      >
        <Text style={[styles.selectText, !selected && styles.placeholder]}>{selected?.label || placeholder}</Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={styles.cancel}>Đóng</Text>
            </Pressable>
            <Text numberOfLines={1} style={styles.title}>{label}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.options}>
            {options.map(option => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>{option.label}</Text>
                    {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
                  </View>
                  {isSelected ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  header: {
    minHeight: ui.headerHeight,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  cancel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  save: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  disabledText: { opacity: 0.45 },
  headerSpacer: { width: 42 },
  content: { padding: 12, gap: 12, paddingBottom: 24 },
  field: { gap: 7 },
  label: { color: colors.text, fontSize: 13, fontWeight: '800' },
  input: {
    minHeight: ui.controlHeight,
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
  },
  textArea: { minHeight: 92, paddingTop: 13, paddingBottom: 13, textAlignVertical: 'top' },
  inputDisabled: { backgroundColor: colors.surfaceMuted, opacity: 0.72 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  select: {
    minHeight: ui.controlHeight,
    paddingHorizontal: 12,
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  placeholder: { color: colors.textPlaceholder, fontWeight: '400' },
  chevron: { color: colors.textMuted, fontSize: 20 },
  options: { padding: 12, gap: 8, paddingBottom: 24 },
  option: {
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionSelected: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  optionTextWrap: { flex: 1 },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  optionTitleSelected: { color: colors.primaryDark },
  optionDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  check: { color: colors.primary, fontSize: 18, fontWeight: '900' },
});
