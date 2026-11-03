import { DateTimePicker as ExpoDateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState, type CSSProperties } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui';
import { colors, typography, ui } from '@/theme/colors';

type DateFieldKey = 'from' | 'to';

interface DateRangeFieldsProps {
  fromDate: string;
  toDate: string;
  maximumDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function NativeDateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}: ${displayDate(value)}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.input, pressed && styles.inputPressed]}
      >
        <Text numberOfLines={1} style={styles.value}>{displayDate(value)}</Text>
        <Text style={styles.calendarIcon}>▦</Text>
      </Pressable>
    </View>
  );
}

const webInputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: ui.controlHeight - 2,
  padding: '0 10px',
  border: 0,
  outline: 0,
  background: 'transparent',
  color: colors.text,
  fontFamily: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
};

function WebDateField({
  label,
  maximumDate,
  value,
  onChange,
}: {
  label: string;
  maximumDate: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.webInputWrap}>
        <input
          aria-label={label}
          max={maximumDate}
          onChange={event => onChange(event.currentTarget.value)}
          style={webInputStyle}
          type="date"
          value={value}
        />
      </View>
    </View>
  );
}

export function DateRangeFields({
  fromDate,
  toDate,
  maximumDate,
  onFromDateChange,
  onToDateChange,
}: DateRangeFieldsProps) {
  const [activeField, setActiveField] = useState<DateFieldKey>();

  if (Platform.OS === 'web') {
    return (
      <View style={styles.row}>
        <WebDateField label="Từ ngày" maximumDate={maximumDate} value={fromDate} onChange={onFromDateChange} />
        <WebDateField label="Đến ngày" maximumDate={maximumDate} value={toDate} onChange={onToDateChange} />
      </View>
    );
  }

  const activeDate = activeField === 'from' ? fromDate : toDate;
  const selectDate = (date: Date) => {
    const value = isoDate(date);
    if (activeField === 'from') onFromDateChange(value);
    if (activeField === 'to') onToDateChange(value);
    if (Platform.OS === 'android') setActiveField(undefined);
  };

  return (
    <>
      <View style={styles.row}>
        <NativeDateField label="Từ ngày" value={fromDate} onPress={() => setActiveField('from')} />
        <NativeDateField label="Đến ngày" value={toDate} onPress={() => setActiveField('to')} />
      </View>

      {activeField && Platform.OS === 'android' ? (
        <ExpoDateTimePicker
          value={parseIsoDate(activeDate)}
          mode="date"
          presentation="dialog"
          maximumDate={parseIsoDate(maximumDate)}
          positiveButton={{ label: 'Chọn' }}
          negativeButton={{ label: 'Hủy' }}
          onValueChange={(_, date) => selectDate(date)}
          onDismiss={() => setActiveField(undefined)}
        />
      ) : null}

      {activeField && Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" onRequestClose={() => setActiveField(undefined)}>
          <View style={styles.overlay}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>
                {activeField === 'from' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}
              </Text>
              <ExpoDateTimePicker
                value={parseIsoDate(activeDate)}
                mode="date"
                display="inline"
                maximumDate={parseIsoDate(maximumDate)}
                locale="vi_VN"
                accentColor={colors.primary}
                onValueChange={(_, date) => selectDate(date)}
              />
              <AppButton label="Xong" onPress={() => setActiveField(undefined)} />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  field: { flex: 1, gap: 7 },
  label: { color: colors.text, ...typography.label },
  input: {
    minHeight: ui.controlHeight,
    paddingHorizontal: 10,
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputPressed: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  value: { flex: 1, color: colors.text, fontSize: 12 },
  calendarIcon: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  webInputWrap: {
    minHeight: ui.controlHeight,
    overflow: 'hidden',
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  overlay: {
    flex: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  pickerCard: {
    width: '100%',
    maxWidth: 390,
    padding: 14,
    borderRadius: ui.cardRadius,
    backgroundColor: colors.surface,
    gap: 12,
  },
  pickerTitle: { color: colors.text, ...typography.cardTitle, textAlign: 'center' },
});
