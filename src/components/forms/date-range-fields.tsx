import { DateTimePicker as ExpoDateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState, type CSSProperties } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { AppButton } from '@/components/ui';
import { colors } from '@/theme/colors';
import { isoDateSchema } from '@/lib/validation';

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
  if (!isoDateSchema.safeParse(value).success) return value;
  return `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
}

function NativeDateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View className="flex-1 gap-[7px]">
      <Text className="text-label font-semibold text-content">{label}</Text>
      <Pressable
        accessibilityLabel={`${label}: ${displayDate(value)}`}
        accessibilityRole="button"
        onPress={onPress}
        className="h-control flex-row items-center gap-1.5 rounded-control border px-2.5"
        style={({ pressed }) => ({
          borderColor: pressed ? colors.primaryBorder : colors.border,
          backgroundColor: pressed ? colors.primarySoft : colors.surface,
        })}
      >
        <Text numberOfLines={1} className="flex-1 text-label text-content">{displayDate(value)}</Text>
        <Text className="text-[15px] font-bold text-primary">▦</Text>
      </Pressable>
    </View>
  );
}

const webInputStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  padding: 0,
  border: 0,
  outline: 0,
  opacity: 0,
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
    <View className="flex-1 gap-[7px]">
      <Text className="text-label font-semibold text-content">{label}</Text>
      <View className="relative h-control flex-row items-center gap-1.5 overflow-hidden rounded-control border border-border bg-surface px-2.5">
        <Text pointerEvents="none" numberOfLines={1} className="flex-1 text-label text-content">
          {displayDate(value)}
        </Text>
        <Text pointerEvents="none" className="text-[15px] font-bold text-primary">▦</Text>
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
      <View className="flex-row items-end gap-2">
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
      <View className="flex-row items-end gap-2">
        <NativeDateField label="Từ ngày" value={fromDate} onPress={() => setActiveField('from')} />
        <NativeDateField label="Đến ngày" value={toDate} onPress={() => setActiveField('to')} />
      </View>

      {activeField && Platform.OS === 'android' ? (
        <ExpoDateTimePicker
          value={parseIsoDate(activeDate)}
          mode="date"
          display="spinner"
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
          <View className="flex-1 items-center justify-center bg-[rgba(15,23,42,0.48)] p-[18px]">
            <View className="w-full max-w-[390px] gap-3 rounded-card bg-surface p-3.5">
              <Text className="text-center text-card font-bold text-content">
                {activeField === 'from' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}
              </Text>
              <ExpoDateTimePicker
                value={parseIsoDate(activeDate)}
                mode="date"
                display="spinner"
                maximumDate={parseIsoDate(maximumDate)}
                locale="en_GB"
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
