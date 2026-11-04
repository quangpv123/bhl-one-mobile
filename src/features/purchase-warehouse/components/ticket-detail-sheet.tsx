import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/ui';
import { colors, typography, ui } from '@/theme/colors';
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
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={[styles.detailValue, danger && styles.detailValueDanger]}>{value}</Text>
    </View>
  );
}

function WeightRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={[styles.weightRow, emphasis && styles.weightRowEmphasis]}>
      <Text style={[styles.weightLabel, emphasis && styles.weightLabelEmphasis]}>{label}</Text>
      <Text style={[styles.weightValue, emphasis && styles.weightValueEmphasis]}>{value}</Text>
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={styles.headerTitle}>Chi tiết phiếu cân</Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              Số {ticketNumber(ticket, warehouseCode)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng chi tiết phiếu cân"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeButtonText}>Đóng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.printHeading}>
            <Text style={styles.stationName}>{warehouseName || ticket.warehouseCode || warehouseCode || 'Kho thu mua'}</Text>
            {ticket.warehouseAddress ? (
              <Text style={styles.stationMeta}>Địa chỉ: {ticket.warehouseAddress}</Text>
            ) : null}
            <View style={styles.headingDivider} />
            <Text style={styles.printTitle}>{ticket.printTitle}</Text>
            <View style={styles.ticketNumberRow}>
              <Text style={styles.printTicketNumber}>Số phiếu: {ticketNumber(ticket, warehouseCode)}</Text>
              <StatusBadge
                label={statusLabel}
                tone={ticket.status === 'VOID' ? 'danger' : ticket.ticketType === 'IMPORT' ? 'success' : 'warning'}
              />
            </View>
          </View>

          {ticket.status === 'VOID' ? (
            <View style={styles.voidNotice}>
              <Text style={styles.voidTitle}>Phiếu đã hủy</Text>
              <Text style={styles.voidText}>Lý do: {textOrDash(ticket.voidReason)}</Text>
              {ticket.voidedByName ? <Text style={styles.voidText}>Người hủy: {ticket.voidedByName}</Text> : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin trên phiếu in</Text>
            <View style={styles.detailGrid}>
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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin cắt lô</Text>
              <View style={styles.detailGrid}>
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Khối lượng</Text>
            <View style={styles.weightTable}>
              <WeightRow label="Khối lượng hàng + bì" value={formatWeight(ticket.grossWeight)} />
              <WeightRow label="Khối lượng bì" value={formatWeight(ticket.tareWeight)} />
              <WeightRow label="Khối lượng hàng" value={formatWeight(goodsWeight)} />
              <WeightRow label="Khối lượng tạp chất" value={formatWeight(impurityWeight)} />
              <WeightRow label="Khối lượng sạch" value={formatWeight(cleanWeight)} emphasis />
              <WeightRow label="Thành tiền" value={amount == null ? '—' : formatMoney(amount)} emphasis />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lái xe và thanh toán</Text>
            <View style={styles.detailGrid}>
              <DetailCell label="Họ tên lái xe" value={textOrDash(ticket.driverName)} />
              <DetailCell label="Số điện thoại" value={textOrDash(ticket.driverPhone)} />
              <DetailCell label="CCCD" value={textOrDash(ticket.driverCitizenId)} />
              <DetailCell label="Số tài khoản" value={textOrDash(ticket.bankAccountNumber)} />
              <DetailCell label="Chủ tài khoản" value={textOrDash(ticket.bankAccountHolder)} />
              <DetailCell label="Ngân hàng" value={textOrDash(ticket.bankName)} />
            </View>
          </View>

          <View style={styles.signatureRow}>
            {['Bên bán', 'Lái xe', 'Người cân', 'Kế toán/Thủ kho', 'Bên mua'].map(label => (
              <Text key={label} style={styles.signatureLabel}>{label}</Text>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  header: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.text, ...typography.cardTitle },
  headerSubtitle: { marginTop: 1, color: colors.textMuted, ...typography.caption },
  closeButton: {
    minHeight: ui.compactControlHeight,
    paddingHorizontal: 10,
    borderRadius: ui.smallRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  closeButtonText: { color: colors.textSecondary, ...typography.button },
  pressed: { opacity: 0.7 },
  content: { padding: 12, paddingBottom: 28, gap: 16 },
  printHeading: { alignItems: 'center' },
  stationName: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' },
  stationMeta: { marginTop: 3, color: colors.textMuted, ...typography.caption, textAlign: 'center' },
  headingDivider: { width: 120, height: StyleSheet.hairlineWidth, marginVertical: 10, backgroundColor: colors.textMuted },
  printTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  ticketNumberRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  printTicketNumber: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' },
  voidNotice: { padding: 10, gap: 3, backgroundColor: colors.dangerSoft, borderLeftWidth: 3, borderLeftColor: colors.danger },
  voidTitle: { color: colors.danger, ...typography.label, fontWeight: '700' },
  voidText: { color: colors.textSecondary, ...typography.caption },
  section: { gap: 7 },
  sectionTitle: { color: colors.text, ...typography.cardTitle },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  detailCell: {
    width: '50%',
    minHeight: 52,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  detailLabel: { color: colors.textMuted, ...typography.caption, fontWeight: '500' },
  detailValue: { marginTop: 2, color: colors.text, ...typography.label, fontWeight: '700' },
  detailValueDanger: { color: colors.danger },
  weightTable: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  weightRow: {
    minHeight: 38,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  weightRowEmphasis: { backgroundColor: colors.primarySoft },
  weightLabel: { flex: 1, color: colors.textSecondary, ...typography.label, fontWeight: '500' },
  weightLabelEmphasis: { color: colors.primaryDark, fontWeight: '700' },
  weightValue: { color: colors.text, ...typography.label, textAlign: 'right', fontWeight: '700' },
  weightValueEmphasis: { color: colors.primaryDark, fontSize: 14 },
  signatureRow: { minHeight: 70, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 },
  signatureLabel: { flex: 1, color: colors.textMuted, fontSize: 9, lineHeight: 12, textAlign: 'center', fontWeight: '600' },
});
