import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, SectionTitle } from '@/components/ui';
import { AppIcon } from '@/components/app-icon';
import { canOpenFeature, featureHref, mobileFeatures } from '@/navigation/moduleRegistry';
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
  const assignedTrips = trips.data?.filter(item => item.status === 'ASSIGNED').length ?? 0;
  const allowedFeatures = mobileFeatures.filter(feature => canOpenFeature(feature, user?.permissions ?? []));

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
      {can('transport-trips.view') ? (
        <Card tone="soft">
          <View style={styles.tripSummary}>
            <View>
              <Text style={styles.tripSummaryValue}>{assignedTrips}</Text>
              <Text style={styles.metricLabel}>Chờ bắt đầu</Text>
            </View>
            <Pressable onPress={() => router.push('/(app)/transport')} style={styles.openTransport}>
              <Text style={styles.openTransportText}>Mở điều phối →</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}
      {allowedFeatures.length ? (
        <View style={styles.quickSection}>
          <SectionTitle>Truy cập nhanh</SectionTitle>
          <View style={styles.quickGrid}>
            {allowedFeatures.slice(0, 4).map(feature => (
              <Pressable
                key={feature.key}
                onPress={() => router.push(featureHref(feature) as never)}
                style={({ pressed }) => [styles.quickItem, pressed && styles.quickPressed]}
              >
                <View style={styles.quickIconWrap}>
                  <AppIcon name={feature.icon} color={colors.primary} size={20} />
                </View>
                <Text numberOfLines={2} style={styles.quickTitle}>{feature.title}</Text>
              </Pressable>
            ))}
          </View>
          {allowedFeatures.length > 4 ? (
            <Pressable onPress={() => router.push('/(app)/work')} style={styles.allFeatures}>
              <Text style={styles.allFeaturesText}>Xem tất cả {allowedFeatures.length} chức năng →</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Card>
        <Text style={styles.sectionTitle}>BHL One</Text>
        <Text style={styles.description}>
          Tin nhắn, kho, vật tư, thu mua và điều phối vận tải được đồng bộ với tài khoản ERP của bạn.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1 },
  metricNumber: { color: colors.text, fontSize: 27, fontWeight: '800' },
  metricLabel: { color: colors.textMuted, marginTop: 3, fontSize: 12 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.textMuted, lineHeight: 22, marginTop: 8 },
  tripSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tripSummaryValue: { color: colors.warning, fontSize: 26, fontWeight: '900' },
  openTransport: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primarySoft },
  openTransportText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  quickSection: { gap: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  quickItem: { width: '48.7%', minHeight: 76, padding: 11, borderRadius: 10, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 9 },
  quickPressed: { opacity: 0.7 },
  quickIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  allFeatures: { alignSelf: 'flex-end', paddingVertical: 4 },
  allFeaturesText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
});
