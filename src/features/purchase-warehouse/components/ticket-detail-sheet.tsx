import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/ui';
import type { PurchaseWarehouseTicket } from '@/types/business';
import { formatDate, formatMoney, formatNumber, formatWeight } from '@/utils/format';

function textOrDash(value: string | null | undefined) {
  return value?.trim() || '—';
}

function ticketNumber(ticket: PurchaseWarehouseTicket, warehouseCode?: string) {
  const code = (ticket.warehouseCode || warehouseCode || '').trim();
  const number = ticket.ticketNumber.trim();
  return code && !number.startsWith(`${code}-`) ? `${code}-${number}` : number;
}

function DetailCell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <View className="min-h-[52px] w-1/2 justify-center border-b border-r border-border px-[9px] py-[7px]">
      <Text className="text-caption font-medium text-content-muted">{label}</Text>
      <Text selectable className={`mt-0.5 text-label font-bold ${danger ? 'text-danger' : 'text-content'}`}>{value}</Text>
    </View>
  );
}

function WeightRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View className={`min-h-[38px] flex-row items-center gap-2.5 border-b border-border px-2.5 ${emphasis ? 'bg-primary-soft' : ''}`}>
      <Text className={`flex-1 text-label ${emphasis ? 'font-bold text-primary-dark' : 'font-medium text-content-secondary'}`}>{label}</Text>
      <Text className={`text-right font-bold ${emphasis ? 'text-sm text-primary-dark' : 'text-label text-content'}`}>{value}</Text>
    </View>
  );
}

export function TicketDetailSheet({
  ticket,
  warehouseCode,
  warehouseName,
  onClose,
}: {
  ticket: PurchaseWarehouseTicket;
  warehouseCode?: string;
  warehouseName?: string;
  onClose: () => void;
}) {
  const goodsWeight = Number(ticket.grossWeight) - Number(ticket.tareWeight);
  const impurityWeight = goodsWeight * Number(ticket.impurityPercent ?? 0) / 100;
  const cleanWeight = goodsWeight - impurityWeight;
  const amount = ticket.price == null ? null : cleanWeight * ticket.price;
  const statusLabel = ticket.status === 'VOID'
    ? 'Đã hủy'
    : ticket.ticketType === 'IMPORT'
      ? 'Nhập'
      : ticket.closesLot
        ? 'Cắt lô'
        : 'Xuất';

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      visible
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-surface" edges={['top', 'right', 'bottom', 'left']}>
        <View className="min-h-14 flex-row items-center gap-2.5 border-b border-border px-3">
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-card font-bold text-content">Chi tiết phiếu cân</Text>
            <Text numberOfLines={1} className="mt-px text-caption font-semibold text-content-muted">
              Số {ticketNumber(ticket, warehouseCode)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng chi tiết phiếu cân"
            hitSlop={8}
            onPress={onClose}
            className="min-h-control items-center justify-center rounded-compact bg-surface-muted px-2.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-label font-semibold text-content-secondary">Đóng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="gap-4 p-3 pb-7">
          <View className="items-center">
            <Text className="text-center text-section font-extrabold uppercase text-content">{warehouseName || ticket.warehouseCode || warehouseCode || 'Kho thu mua'}</Text>
            {ticket.warehouseAddress ? (
              <Text className="mt-[3px] text-center text-caption font-semibold text-content-muted">Địa chỉ: {ticket.warehouseAddress}</Text>
            ) : null}
            <View className="my-2.5 h-px w-[120px] bg-content-muted" />
            <Text className="text-center text-lg leading-6 font-extrabold text-content">{ticket.printTitle}</Text>
            <View className="mt-[5px] flex-row items-center gap-2">
              <Text className="text-xs italic text-content-secondary">Số phiếu: {ticketNumber(ticket, warehouseCode)}</Text>
              <StatusBadge
                label={statusLabel}
                tone={ticket.status === 'VOID' ? 'danger' : ticket.ticketType === 'IMPORT' ? 'success' : 'warning'}
              />
            </View>
          </View>

          {ticket.status === 'VOID' ? (
            <View className="gap-[3px] border-l-[3px] border-danger bg-danger-soft p-2.5">
              <Text className="text-label font-bold text-danger">Phiếu đã hủy</Text>
              <Text className="text-caption font-semibold text-content-secondary">Lý do: {textOrDash(ticket.voidReason)}</Text>
              {ticket.voidedByName ? <Text className="text-caption font-semibold text-content-secondary">Người hủy: {ticket.voidedByName}</Text> : null}
            </View>
          ) : null}

          <View className="gap-[7px]">
            <Text className="text-card font-bold text-content">Thông tin trên phiếu in</Text>
            <View className="flex-row flex-wrap border-l border-t border-border">
              <DetailCell label="Ngày cân hàng + bì" value={formatDate(ticket.grossWeighedDate)} />
              <DetailCell label="Giờ cân hàng + bì" value={ticket.grossWeighedTime} />
              <DetailCell label="Ngày cân bì" value={formatDate(ticket.tareWeighedDate)} />
              <DetailCell label="Giờ cân bì" value={ticket.tareWeighedTime} />
              <DetailCell label="Biển số xe" value={textOrDash(ticket.licensePlate)} />
              <DetailCell label="Tên hàng" value={textOrDash(ticket.productName)} />
              <DetailCell label="Bên bán hàng" value={textOrDash(ticket.sellerName)} />
              <DetailCell label="Đơn giá" value={ticket.price == null ? '—' : `${formatNumber(ticket.price, 2)} đ/kg`} />
              <DetailCell label="Bên mua hàng" value={textOrDash(ticket.buyerName)} />
              <DetailCell label="Giống sắn" value={textOrDash(ticket.cassavaVarietyName)} />
              <DetailCell label="Tạp chất" value={`${formatNumber(ticket.impurityPercent, 3)}%`} />
              <DetailCell label="Độ bột" value={`${formatNumber(ticket.starchPercent, 3)}%`} />
            </View>
          </View>

          {ticket.closesLot ? (
            <View className="gap-[7px]">
              <Text className="text-card font-bold text-content">Thông tin cắt lô</Text>
              <View className="flex-row flex-wrap border-l border-t border-border">
                <DetailCell
                  label="Tổng nhập lô"
                  value={ticket.lotImportWeight == null ? '—' : formatWeight(ticket.lotImportWeight)}
                />
                <DetailCell
                  label="Tổng xuất lô"
                  value={ticket.lotExportWeight == null ? '—' : formatWeight(ticket.lotExportWeight)}
                />
                <DetailCell
                  danger
                  label="Hao hụt"
                  value={`${formatWeight(ticket.lossWeight)} (${ticket.lossPercent == null ? '—' : `${formatNumber(ticket.lossPercent, 3)}%`})`}
                />
                <DetailCell
                  label="Tổng tiền lô"
                  value={ticket.lotPurchaseAmount == null ? '—' : formatMoney(ticket.lotPurchaseAmount)}
                />
                <DetailCell
                  label="Giá BQ lô"
                  value={ticket.lotActualAveragePrice == null ? '—' : `${formatNumber(ticket.lotActualAveragePrice, 3)} đ/kg`}
                />
              </View>
            </View>
          ) : null}

          <View className="gap-[7px]">
            <Text className="text-card font-bold text-content">Khối lượng</Text>
            <View className="border-t border-border">
              <WeightRow label="Khối lượng hàng + bì" value={formatWeight(ticket.grossWeight)} />
              <WeightRow label="Khối lượng bì" value={formatWeight(ticket.tareWeight)} />
              <WeightRow label="Khối lượng hàng" value={formatWeight(goodsWeight)} />
              <WeightRow label="Khối lượng tạp chất" value={formatWeight(impurityWeight)} />
              <WeightRow label="Khối lượng sạch" value={formatWeight(cleanWeight)} emphasis />
              <WeightRow label="Thành tiền" value={amount == null ? '—' : formatMoney(amount)} emphasis />
            </View>
          </View>

          <View className="gap-[7px]">
            <Text className="text-card font-bold text-content">Lái xe và thanh toán</Text>
            <View className="flex-row flex-wrap border-l border-t border-border">
              <DetailCell label="Họ tên lái xe" value={textOrDash(ticket.driverName)} />
              <DetailCell label="Số điện thoại" value={textOrDash(ticket.driverPhone)} />
              <DetailCell label="CCCD" value={textOrDash(ticket.driverCitizenId)} />
              <DetailCell label="Số tài khoản" value={textOrDash(ticket.bankAccountNumber)} />
              <DetailCell label="Chủ tài khoản" value={textOrDash(ticket.bankAccountHolder)} />
              <DetailCell label="Ngân hàng" value={textOrDash(ticket.bankName)} />
            </View>
          </View>

          <View className="min-h-[70px] flex-row items-start justify-between gap-1">
            {['Bên bán', 'Lái xe', 'Người cân', 'Kế toán/Thủ kho', 'Bên mua'].map(label => (
              <Text key={label} className="flex-1 text-center text-caption font-semibold text-content-muted">{label}</Text>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
