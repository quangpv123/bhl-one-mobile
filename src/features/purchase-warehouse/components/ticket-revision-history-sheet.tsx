import { useQuery } from '@tanstack/react-query';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, ErrorState, LoadingBlock, StatusBadge } from '@/components/ui';
import { api, getApiErrorMessage } from '@/services/api';
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
      <SafeAreaView className="flex-1 bg-background">
        <View className="min-h-header flex-row items-center gap-3 border-b border-border bg-surface px-4">
          <View className="w-9" />
          <Text numberOfLines={1} className="flex-1 text-center text-card font-bold text-content">Lịch sử phiếu {ticket.ticketNumber}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text className="text-sm font-bold text-primary">Đóng</Text></Pressable>
        </View>
        <ScrollView contentContainerClassName="gap-3 p-3 pb-6">
          {revisions.isLoading ? <LoadingBlock /> : null}
          {revisions.isError ? <ErrorState text={getApiErrorMessage(revisions.error)} onRetry={() => void revisions.refetch()} /> : null}
          {!revisions.isLoading && !revisions.isError && !revisions.data?.length ? <EmptyState text="Phiếu chưa có lịch sử chỉnh sửa." /> : null}
          {revisions.data?.map(revision => (
            <Card key={revision.id}>
              <View className="gap-[7px]">
                <View className="flex-row flex-wrap items-center gap-2">
                  <StatusBadge
                    label={revision.action === 'CREATE' ? 'Nhập thủ công' : 'Chỉnh sửa'}
                    tone={revision.action === 'CREATE' ? 'info' : 'warning'}
                  />
                  <Text className="text-body font-bold text-content">{revision.changedByName}</Text>
                </View>
                <Text className="text-caption text-content-muted">{formatDateTime(revision.changedAt)}</Text>
              </View>
              <View className="mt-3 gap-1 rounded-compact bg-surface-muted p-2.5">
                <Text className="text-caption font-semibold uppercase text-content-muted">Lý do</Text>
                <Text className="text-body font-bold text-content">{revision.reason}</Text>
              </View>
              <View className="mt-[11px] overflow-hidden rounded-compact border border-border">
                {changedFields(revision).map(field => (
                  <View key={field} className="gap-[5px] border-b border-border bg-surface p-[9px]">
                    <Text className="text-caption font-semibold text-content-muted">{fieldLabels[field] ?? field}</Text>
                    {revision.action === 'UPDATE' ? (
                      <View className="flex-row items-start gap-[7px]">
                        <Text className="flex-1 text-xs text-content-muted line-through">{formatRevisionValue(field, revision.beforeData?.[field])}</Text>
                        <Text className="text-xs text-content-muted">→</Text>
                        <Text className="flex-1 text-xs font-bold text-primary-dark">{formatRevisionValue(field, revision.afterData[field])}</Text>
                      </View>
                    ) : (
                      <Text className="flex-1 text-xs font-bold text-primary-dark">{formatRevisionValue(field, revision.afterData[field])}</Text>
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
