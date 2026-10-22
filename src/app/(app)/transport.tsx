import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, EmptyState, LoadingBlock } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/services/api';
import { colors } from '@/theme/colors';
import type { TransportTrip, TransportTripsResponse, TransportTripStatus } from '@/types/models';

const statusLabels: Record<TransportTripStatus, string> = {
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang di chuyển',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

function TripCard({ trip }: { trip: TransportTrip }) {
  return (
    <Card>
      <View style={styles.heading}>
        <View>
          <Text style={styles.code}>{trip.tripCode}</Text>
          <Text style={styles.plate}>{trip.licensePlate}</Text>
        </View>
        <Text style={[styles.status, trip.status === 'IN_PROGRESS' && styles.statusActive]}>{statusLabels[trip.status]}</Text>
      </View>
      <Text style={styles.route}>{trip.routeSnapshot}</Text>
      <Text style={styles.meta}>{trip.driverFullName} · {trip.vehicleTypeName}</Text>
      {trip.content ? <Text style={styles.content}>{trip.content}</Text> : null}
    </Card>
  );
}

export default function TransportScreen() {
  const { can } = useAuth();
  const allowed = can('transport-trips.view');
  const trips = useQuery({
    queryKey: ['transport-trips'],
    enabled: allowed,
    queryFn: async () =>
      (await api.get<TransportTripsResponse>('/transport/trips', { params: { page: 1, limit: 50 } })).data.data,
  });

  return (
    <Screen
      title="Chuyến xe"
      subtitle="Danh sách chuyến theo tài khoản"
      refreshing={trips.isRefetching}
      onRefresh={allowed ? () => void trips.refetch() : undefined}
    >
      {!allowed ? <EmptyState text="Tài khoản chưa có quyền xem danh sách chuyến xe." /> : null}
      {allowed && trips.isLoading ? <LoadingBlock /> : null}
      {allowed && !trips.isLoading && !trips.data?.length ? <EmptyState text="Chưa có chuyến xe nào." /> : null}
      {trips.data?.map(trip => <TripCard key={trip.id} trip={trip} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  code: { color: colors.text, fontWeight: '900', fontSize: 17 },
  plate: { color: colors.primary, fontWeight: '800', marginTop: 4 },
  status: { color: colors.warning, fontSize: 12, fontWeight: '800' },
  statusActive: { color: colors.success },
  route: { color: colors.text, marginTop: 14, fontWeight: '700', lineHeight: 20 },
  meta: { color: colors.textMuted, marginTop: 7 },
  content: { color: colors.textMuted, marginTop: 7, lineHeight: 20 },
});
