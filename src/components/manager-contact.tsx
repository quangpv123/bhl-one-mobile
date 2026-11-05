import { Alert, Linking, Pressable, Text, View } from 'react-native';

interface ManagerContactProps {
  name?: string | null;
  phone?: string | null;
  layout?: 'stacked' | 'rows';
  label?: string;
  phoneLabel?: string;
}

async function callPhone(phone: string) {
  const normalizedPhone = phone.replace(/[^+\d]/g, '');
  if (!normalizedPhone) return;

  try {
    await Linking.openURL(`tel:${normalizedPhone}`);
  } catch {
    Alert.alert(
      'Không thể gọi điện',
      'Thiết bị không hỗ trợ mở trình gọi điện.',
    );
  }
}

function PhoneLink({ phone, alignRight = false }: { phone?: string | null; alignRight?: boolean }) {
  const displayPhone = phone?.trim();
  if (!displayPhone) {
    return <Text className={`${alignRight ? 'text-label text-right' : 'text-body'} font-semibold text-content-muted`}>—</Text>;
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Gọi ${displayPhone}`}
      hitSlop={4}
      onPress={event => {
        event.stopPropagation();
        void callPhone(displayPhone);
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      <Text
        numberOfLines={1}
        className={`${alignRight ? 'text-label text-right' : 'text-body'} font-semibold text-primary-dark underline`}
      >
        {displayPhone}
      </Text>
    </Pressable>
  );
}

export function ManagerContact({
  name,
  phone,
  layout = 'stacked',
  label = 'Phụ trách',
  phoneLabel = 'Điện thoại',
}: ManagerContactProps) {
  const displayName = name?.trim() || '—';

  if (layout === 'rows') {
    return (
      <View>
        <View className="flex-row items-start justify-between gap-4 py-[5px]">
          <Text className="flex-1 text-label font-normal text-content-muted">{label}</Text>
          <Text numberOfLines={2} className="flex-[1.4] text-right text-label font-semibold text-content">
            {displayName}
          </Text>
        </View>
        <View className="flex-row items-start justify-between gap-4 py-[5px]">
          <Text className="flex-1 text-label font-normal text-content-muted">{phoneLabel}</Text>
          <View className="flex-[1.4] items-end">
            <PhoneLink phone={phone} alignRight />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="min-w-0">
      <Text numberOfLines={2} className="text-body font-semibold text-content-secondary">
        {displayName}
      </Text>
      <View className="mt-0.5 items-start">
        <PhoneLink phone={phone} />
      </View>
    </View>
  );
}
