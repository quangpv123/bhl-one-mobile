import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/services/api';
import { colors } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { MessageConversation, TransportTrip } from '@/types/models';

export default function DashboardScreen() {
  const { user, can } = useAuth();
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => (await api.get<ApiResponse<MessageConversation[]>>('/messages/conversations')).data.data,
  });
  const trips = useQuery({
    queryKey: ['transport-trips', 'dashboard'],
    enabled: can('transport-trips.view'),
    queryFn: async () =>
      (
        await api.get<{ data: TransportTrip[] }>('/transport/trips', {
          params: { page: 1, limit: 100, status: 'OPEN' },
        })
      ).data.data,
  });

  const unread = conversations.data?.reduce((total, item) => total + item.unreadCount, 0) ?? 0;
  const activeTrips = trips.data?.filter(item => item.status === 'IN_PROGRESS').length ?? 0;

  const refresh = async () => {
    await Promise.all([conversations.refetch(), can('transport-trips.view') ? trips.refetch() : Promise.resolve()]);
  };

  return (
    <Screen
      title={`Xin chào, ${user?.fullName || ''}`}
      subtitle="Tổng quan công việc hôm nay"
      refreshing={conversations.isRefetching || trips.isRefetching}
      onRefresh={() => void refresh()}
    >
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Card>
            <Text style={styles.metricNumber}>{unread}</Text>
            <Text style={styles.metricLabel}>Tin chưa đọc</Text>
          </Card>
        </View>
        <View style={styles.metric}>
          <Card>
            <Text style={styles.metricNumber}>{activeTrips}</Text>
            <Text style={styles.metricLabel}>Chuyến đang chạy</Text>
          </Card>
        </View>
      </View>
      <Card>
        <Text style={styles.sectionTitle}>BHL One</Text>
        <Text style={styles.description}>
          Tin nhắn, thông báo hệ thống và điều phối vận tải được đồng bộ với tài khoản ERP của bạn.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1 },
  metricNumber: { color: colors.primary, fontSize: 30, fontWeight: '900' },
  metricLabel: { color: colors.textMuted, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  description: { color: colors.textMuted, lineHeight: 22, marginTop: 8 },
});
