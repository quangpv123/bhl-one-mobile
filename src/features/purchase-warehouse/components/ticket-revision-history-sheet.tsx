import { useQuery } from '@tanstack/react-query';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, ErrorState, LoadingBlock, StatusBadge } from '@/components/ui';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { PurchaseWarehouseTicket, PurchaseWarehouseTicketRevision } from '@/types/business';
import { formatDateTime, formatNumber } from '@/utils/format';

const fieldLabels: Record<string, string> = {
  ticketNumber: 'Số phiếu',
  ticketType: 'Loại phiếu',
  closesLot: 'Cắt lô',
  lossWeight: 'Hao hụt',
  printTitle: 'Tên phiếu in',
  grossWeighedDate: 'Ngày cân lần 1',
  grossWeighedTime: 'Giờ cân lần 1',
  tareWeighedDate: 'Ngày cân lần 2',
  tareWeighedTime: 'Giờ cân lần 2',
  licensePlate: 'Biển số xe',
  productName: 'Mặt hàng',
  cassavaVarietyName: 'Giống sắn',
  driverName: 'Tên lái xe',
  driverPhone: 'Số điện thoại lái xe',
  driverCitizenId: 'CCCD lái xe',
  bankAccountNumber: 'Số tài khoản',
  bankAccountHolder: 'Chủ tài khoản',
  bankName: 'Ngân hàng',
  sellerName: 'Bên bán',
  buyerName: 'Bên mua',
  grossWeight: 'Hàng + bì',
  tareWeight: 'Khối lượng bì',
  netWeight: 'Khối lượng sạch',
  price: 'Giá',
  impurityPercent: 'Tạp chất',
  starchPercent: 'Độ bột',
};

function formatRevisionValue(field: string, value: unknown) {
  if (value == null || value === '') return '—';
  if (field === 'ticketType') return value === 'IMPORT' ? 'Nhập' : 'Xuất';
  if (field === 'closesLot') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return formatNumber(value, 3);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function changedFields(revision: PurchaseWarehouseTicketRevision) {
  if (revision.action === 'CREATE') return Object.keys(revision.afterData);
  return Object.keys(revision.afterData).filter(
    field => JSON.stringify(revision.beforeData?.[field] ?? null) !== JSON.stringify(revision.afterData[field] ?? null),
  );
}

export function TicketRevisionHistorySheet({ ticket, onClose }: { ticket: PurchaseWarehouseTicket; onClose: () => void }) {
  const revisions = useQuery({
    queryKey: ['purchase-ticket-revisions-mobile', ticket.id],
    queryFn: async () => (
      await api.get<ApiResponse<PurchaseWarehouseTicketRevision[]>>(`/purchase-warehouses/tickets/${ticket.id}/revisions`)
    ).data.data,
  });

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text numberOfLines={1} style={styles.title}>Lịch sử phiếu {ticket.ticketNumber}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text style={styles.close}>Đóng</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {revisions.isLoading ? <LoadingBlock /> : null}
          {revisions.isError ? <ErrorState text={getApiErrorMessage(revisions.error)} onRetry={() => void revisions.refetch()} /> : null}
          {!revisions.isLoading && !revisions.isError && !revisions.data?.length ? <EmptyState text="Phiếu chưa có lịch sử chỉnh sửa." /> : null}
          {revisions.data?.map(revision => (
            <Card key={revision.id}>
              <View style={styles.revisionHeading}>
                <View style={styles.revisionActor}>
                  <StatusBadge
                    label={revision.action === 'CREATE' ? 'Nhập thủ công' : 'Chỉnh sửa'}
                    tone={revision.action === 'CREATE' ? 'info' : 'warning'}
                  />
                  <Text style={styles.actor}>{revision.changedByName}</Text>
                </View>
                <Text style={styles.time}>{formatDateTime(revision.changedAt)}</Text>
              </View>
              <View style={styles.reason}>
                <Text style={styles.reasonLabel}>Lý do</Text>
                <Text style={styles.reasonValue}>{revision.reason}</Text>
              </View>
              <View style={styles.changes}>
                {changedFields(revision).map(field => (
                  <View key={field} style={styles.changeRow}>
                    <Text style={styles.fieldLabel}>{fieldLabels[field] ?? field}</Text>
                    {revision.action === 'UPDATE' ? (
                      <View style={styles.changeValues}>
                        <Text style={styles.oldValue}>{formatRevisionValue(field, revision.beforeData?.[field])}</Text>
                        <Text style={styles.arrow}>→</Text>
                        <Text style={styles.newValue}>{formatRevisionValue(field, revision.afterData[field])}</Text>
                      </View>
                    ) : (
                      <Text style={styles.newValue}>{formatRevisionValue(field, revision.afterData[field])}</Text>
                    )}
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: ui.headerHeight, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerSpacer: { width: 36 },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  close: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  content: { padding: 12, paddingBottom: 24, gap: 12 },
  revisionHeading: { gap: 7 },
  revisionActor: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  actor: { color: colors.text, fontSize: 13, fontWeight: '800' },
  time: { color: colors.textMuted, fontSize: 11 },
  reason: { marginTop: 12, padding: 10, borderRadius: ui.smallRadius, backgroundColor: colors.surfaceMuted, gap: 4 },
  reasonLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  reasonValue: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  changes: { marginTop: 11, gap: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: ui.smallRadius, overflow: 'hidden' },
  changeRow: { padding: 9, gap: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  changeValues: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  oldValue: { flex: 1, color: colors.textMuted, fontSize: 12, textDecorationLine: 'line-through' },
  arrow: { color: colors.textMuted, fontSize: 12 },
  newValue: { flex: 1, color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
});
