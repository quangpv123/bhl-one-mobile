import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { z } from 'zod';

import { colors } from '@/theme/colors';
import { validateValue } from '@/lib/validation';
import { PasswordInput } from './password-input';

interface FormValidationContextValue {
  attempt: number;
  reportValidity?: (fieldId: string, invalid: boolean) => void;
}

const FormValidationAttemptContext = createContext<FormValidationContextValue>({ attempt: 0 });

export function FormValidationProvider({
  attempt,
  onValidityChange,
  children,
}: PropsWithChildren<{
  attempt: number;
  onValidityChange?: (fieldId: string, invalid: boolean) => void;
}>) {
  return (
    <FormValidationAttemptContext.Provider value={{ attempt, reportValidity: onValidityChange }}>
      {children}
    </FormValidationAttemptContext.Provider>
  );
}

function isRequiredLabel(label: string) {
  return /\s*\*$/.test(label);
}

export function useFormFieldError(
  label: string,
  value: unknown,
  error?: string | null,
  keyboardType?: TextInputProps['keyboardType'],
  schema?: z.ZodType,
) {
  const fieldId = useId();
  const { attempt, reportValidity } = useContext(FormValidationAttemptContext);
  const validationError = error || validateValue(value, {
    required: isRequiredLabel(label),
    phone: keyboardType === 'phone-pad',
    schema,
  });
  useEffect(() => {
    reportValidity?.(fieldId, Boolean(validationError));
    return () => reportValidity?.(fieldId, false);
  }, [fieldId, reportValidity, validationError]);
  return error || attempt > 0 ? validationError : null;
}

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
  const [validationAttempt, setValidationAttempt] = useState(0);
  const invalidFields = useRef(new Set<string>());
  const reportValidity = useCallback((fieldId: string, invalid: boolean) => {
    if (invalid) invalidFields.current.add(fieldId);
    else invalidFields.current.delete(fieldId);
  }, []);
  const submit = () => {
    setValidationAttempt(current => current + 1);
    if (invalidFields.current.size > 0) return;
    onSave();
  };
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        <FormValidationProvider attempt={validationAttempt} onValidityChange={reportValidity}>
          <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="min-h-header flex-row items-center justify-between gap-3 border-b border-border bg-surface px-4">
              <Pressable disabled={saving} onPress={onClose} hitSlop={8}>
                <Text className="text-sm font-semibold text-content-muted">Hủy</Text>
              </Pressable>
              <Text numberOfLines={1} className="flex-1 text-center text-card font-bold text-content">{title}</Text>
              <Pressable
                accessibilityLabel={saveLabel}
                disabled={saving}
                onPress={submit}
                hitSlop={8}
              >
                <Text className={`text-sm font-semibold text-primary ${saving ? 'opacity-45' : ''}`}>Lưu</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerClassName="gap-3 p-3 pb-6" keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </FormValidationProvider>
      </SafeAreaView>
    </Modal>
  );
}

export function FormLabel({ label }: { label: string }) {
  const required = /\s*\*$/.test(label);
  const text = required ? label.replace(/\s*\*$/, '') : label;
  return (
    <Text className="text-label font-semibold text-content">
      {text}
      {required ? <Text className="text-danger"> *</Text> : null}
    </Text>
  );
}

export function FormField({
  label,
  hint,
  error,
  schema,
  secureTextEntry,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null; schema?: z.ZodType }) {
  const errorMessage = useFormFieldError(label, props.value, error, props.keyboardType, schema);
  return (
    <View className="gap-[7px]">
      <FormLabel label={label} />
      {secureTextEntry ? (
        <PasswordInput
          {...props}
          containerStyle={[
            props.editable === false && { backgroundColor: colors.surfaceMuted, opacity: 0.72 },
            errorMessage && { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
          ]}
        />
      ) : (
        <TextInput
          {...props}
          placeholderTextColor={colors.textPlaceholder}
          className={`rounded-control border px-3 text-sm text-content ${
            props.multiline ? 'h-[92px] py-[13px]' : 'h-control py-0'
          } ${props.editable === false ? 'border-border bg-surface-muted opacity-70' : 'border-border bg-surface'} ${
            errorMessage ? 'border-danger bg-danger-soft' : ''
          }`}
          style={[{ textAlignVertical: props.multiline ? 'top' : 'center', includeFontPadding: false }, props.style]}
        />
      )}
      {errorMessage ? <Text className="text-caption font-medium text-danger">{errorMessage}</Text> : null}
      {!errorMessage && hint ? <Text className="text-xs leading-[18px] text-content-muted">{hint}</Text> : null}
    </View>
  );
}

export function OptionPicker({
  label,
  value,
  options,
  placeholder = 'Chọn giá trị',
  disabled = false,
  hideLabel = false,
  error,
  schema,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; description?: string }[];
  placeholder?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  error?: string | null;
  schema?: z.ZodType;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  const errorMessage = useFormFieldError(label, value, error, undefined, schema);

  return (
    <View className="gap-[7px]">
      {hideLabel ? null : <FormLabel label={label} />}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={`h-control flex-row items-center justify-between gap-2.5 rounded-control border px-3 ${
          disabled ? 'border-border bg-surface-muted opacity-70' : 'border-border bg-surface'
        } ${errorMessage ? 'border-danger bg-danger-soft' : ''}`}
      >
        <Text numberOfLines={1} className={`flex-1 text-sm ${selected ? 'font-semibold text-content' : 'font-normal text-content-placeholder'}`}>{selected?.label || placeholder}</Text>
        <Text className="text-xl text-content-muted">⌄</Text>
      </Pressable>
      {errorMessage ? <Text className="text-caption font-medium text-danger">{errorMessage}</Text> : null}
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 bg-background">
          <View className="min-h-header flex-row items-center justify-between gap-3 border-b border-border bg-surface px-4">
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Text className="text-sm font-semibold text-content-muted">Đóng</Text>
            </Pressable>
            <Text numberOfLines={1} className="flex-1 text-center text-card font-bold text-content">{label}</Text>
            <View className="w-[42px]" />
          </View>
          <ScrollView contentContainerClassName="gap-2 p-3 pb-6">
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
                  className={`min-h-[50px] flex-row items-center gap-3 rounded-control border px-3 py-[9px] ${
                    isSelected ? 'border-primary-border bg-primary-soft' : 'border-border bg-surface'
                  }`}
                >
                  <View className="flex-1">
                    <Text className={`text-[15px] font-semibold ${isSelected ? 'text-primary-dark' : 'text-content'}`}>{option.label}</Text>
                    {option.description ? <Text className="mt-[3px] text-label text-content-muted">{option.description}</Text> : null}
                  </View>
                  {isSelected ? <Text className="text-lg font-bold text-primary">✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
