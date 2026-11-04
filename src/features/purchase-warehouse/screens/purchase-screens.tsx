import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImagePickerAsset } from "expo-image-picker";
import * as Print from "expo-print";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Screen } from "@/components/screen";
import {
  ActionMenu,
  AppButton,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorState,
  FormattedValue,
  InfoRow,
  LoadingBlock,
  SearchField,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { permissions } from "@/features/auth/permissions";
import {
  appendMaterialImages,
  MaterialEvidencePicker,
} from "@/features/material-warehouse/components/material-document-create";
import { TicketDetailSheet } from "@/features/purchase-warehouse/components/ticket-detail-sheet";
import { TicketEditSheet } from "@/features/purchase-warehouse/components/ticket-edit-sheet";
import { TicketRevisionHistorySheet } from "@/features/purchase-warehouse/components/ticket-revision-history-sheet";
import {
  api,
  getApiErrorMessage,
  hasProtectedApiSession,
} from "@/services/api";
import { colors, ui } from "@/theme/colors";
import type { ApiResponse, Pagination } from "@/types/api";
import type {
  PurchaseWarehouseOverview,
  PurchaseWarehouseOverviewResponse,
  PurchaseWarehouseTicket,
  PurchaseWarehouseTicketsResponse,
} from "@/types/business";
import { pickSpreadsheet, spreadsheetFormData } from "@/utils/document-upload";
import {
  firstDayOfJuneIso,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatWeight,
  todayIso,
} from "@/utils/format";
import { shareProtectedApiFile } from "@/utils/protected-file";

interface PurchasePayment {
  id: string;
  transactionType: "PAYMENT" | "REFUND";
  amount: number;
  paidAt: string;
  paymentMethod: "BANK_TRANSFER" | "CASH" | "OTHER";
  referenceNumber?: string | null;
  note?: string | null;
  status: "CONFIRMED" | "VOID";
  createdByName: string;
  voidReason?: string | null;
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }[];
}

interface PurchasePaymentsResponse {
  success: boolean;
  summary: {
    totalPurchaseAmount: number;
    totalPaidAmount: number;
    outstandingAmount: number;
    advanceBalance: number;
    hasMissingTicketPrices: boolean;
  };
  data: PurchasePayment[];
  pagination: Pagination;
}

function WarehouseOverviewCard({
  warehouse,
  compact = false,
}: {
  warehouse: PurchaseWarehouseOverview;
  compact?: boolean;
}) {
  const { can } = useAuth();
  const canOpen =
    can(permissions.scaleTicketsView) ||
    can(permissions.purchaseWarehousesOperateAssigned);
  return (
    <Pressable
      accessibilityRole={canOpen ? "button" : undefined}
      disabled={!canOpen}
      onPress={() =>
        router.push({
          pathname: "/purchase-warehouse/[id]",
          params: {
            id: warehouse.id,
            code: warehouse.warehouseCode,
            name: warehouse.warehouseName,
          },
        })
      }
      style={({ pressed }) => (pressed && canOpen ? styles.pressed : undefined)}
    >
      <Card>
        <View style={styles.heading}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{warehouse.warehouseName}</Text>
            <Text style={styles.code}>{warehouse.warehouseCode}</Text>
          </View>
          <StatusBadge
            label={warehouse.status === "ACTIVE" ? "Hoạt động" : "Tạm dừng"}
            tone={warehouse.status === "ACTIVE" ? "success" : "neutral"}
          />
        </View>
        <View style={styles.metricGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Tồn kho</Text>
            <Text style={styles.metricValue}>
              {formatWeight(warehouse.inventory)}
            </Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Nhập hôm nay</Text>
            <Text style={[styles.metricValue, styles.importValue]}>
              {formatWeight(warehouse.currentDayImport)}
            </Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Tổng nhập</Text>
            <Text style={styles.metricValue}>
              {formatWeight(warehouse.totalImport)}
            </Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Tổng xuất</Text>
            <Text style={styles.metricValue}>
              {formatWeight(warehouse.totalExport)}
            </Text>
          </View>
        </View>
        {!compact ? (
          <View style={styles.rows}>
            <InfoRow
              label="Tổng tiền hàng"
              value={formatMoney(warehouse.totalPurchaseAmount)}
            />
            <InfoRow
              label="Đã thanh toán"
              value={formatMoney(warehouse.totalPaidAmount)}
            />
            <InfoRow
              label="Công nợ"
              value={formatMoney(warehouse.outstandingAmount)}
              emphasize
            />
            {warehouse.advanceBalance > 0 ? (
              <InfoRow
                label="Dư ứng"
                value={formatMoney(warehouse.advanceBalance)}
              />
            ) : null}
          </View>
        ) : null}
        {canOpen ? (
          <Text style={styles.openHint}>Chạm để xem phiếu cân →</Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

function WarehouseMonitoringList({
  warehouses,
  refreshing,
  onRefresh,
}: {
  warehouses: PurchaseWarehouseOverview[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { can } = useAuth();
  const canOpen =
    can(permissions.scaleTicketsView) ||
    can(permissions.purchaseWarehousesOperateAssigned);
  const totals = warehouses.reduce(
    (result, warehouse) => ({
      currentDayImport: result.currentDayImport + warehouse.currentDayImport,
      totalImport: result.totalImport + warehouse.totalImport,
    }),
    { currentDayImport: 0, totalImport: 0 },
  );

  return (
    <Card style={styles.monitoringTable}>
      <View style={styles.monitoringHeader}>
        <Text
          style={[styles.monitoringHeaderText, styles.monitoringNameColumn]}
        >
          Tên trạm
        </Text>
        <Text
          style={[styles.monitoringHeaderText, styles.monitoringMetricColumn]}
        >
          Nhập hôm nay
        </Text>
        <Text
          style={[styles.monitoringHeaderText, styles.monitoringMetricColumn]}
        >
          Lũy kế nhập
        </Text>
      </View>
      <ScrollView
        style={styles.monitoringBody}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {warehouses.map((warehouse, index) => (
          <Pressable
            key={warehouse.id}
            accessibilityLabel={`Xem phiếu cân trạm ${warehouse.warehouseName}`}
            accessibilityRole={canOpen ? "button" : undefined}
            disabled={!canOpen}
            onPress={() =>
              router.push({
                pathname: "/purchase-warehouse/[id]",
                params: {
                  id: warehouse.id,
                  code: warehouse.warehouseCode,
                  name: warehouse.warehouseName,
                },
              })
            }
            style={({ pressed }) => [
              styles.monitoringRow,
              index < warehouses.length - 1 && styles.monitoringRowBorder,
              pressed && canOpen && styles.monitoringRowPressed,
            ]}
          >
            <Text
              numberOfLines={2}
              style={[styles.monitoringName, styles.monitoringNameColumn]}
            >
              {warehouse.warehouseName}
            </Text>
            <MonitoringWeight value={warehouse.currentDayImport} />
            <MonitoringWeight value={warehouse.totalImport} />
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.monitoringTotalRow}>
        <Text
          style={[styles.monitoringTotalLabel, styles.monitoringNameColumn]}
        >
          Tổng
        </Text>
        <MonitoringWeight total value={totals.currentDayImport} />
        <MonitoringWeight total value={totals.totalImport} />
      </View>
    </Card>
  );
}

function MonitoringWeight({
  value,
  total = false,
}: {
  value: number;
  total?: boolean;
}) {
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.monitoringValue,
        styles.monitoringMetricColumn,
        total && styles.monitoringTotalValue,
      ]}
    >
      {formatNumber(value, 3)} <Text style={styles.monitoringUnit}>kg</Text>
    </Text>
  );
}

export function PurchaseOverviewScreen({
  assignedOnly = false,
}: {
  assignedOnly?: boolean;
}) {
  const { can, token } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [maximumReportDate] = useState(todayIso);
  const [reportFromDate, setReportFromDate] = useState(firstDayOfJuneIso);
  const [reportToDate, setReportToDate] = useState(todayIso);
  const reportDateError =
    !/^\d{4}-\d{2}-\d{2}$/.test(reportFromDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(reportToDate)
      ? "Chọn đầy đủ ngày bắt đầu và ngày kết thúc."
      : reportFromDate > reportToDate
        ? "Ngày bắt đầu không được lớn hơn ngày kết thúc."
        : reportToDate > maximumReportDate
          ? "Ngày kết thúc không được lớn hơn ngày hiện tại."
          : undefined;
  const query = useQuery({
    queryKey: ["purchase-overview-mobile"],
    queryFn: async () =>
      (
        await api.get<PurchaseWarehouseOverviewResponse>(
          "/purchase-warehouses/overview",
        )
      ).data,
    refetchInterval: 30_000,
  });

  const exportOverview = async (kind: "IMPORT" | "OVERVIEW" | "ALL") => {
    const reportDate = query.data?.reportDate;
    if (!hasProtectedApiSession(token) || !reportDate || exporting) return;
    setExporting(true);
    try {
      const path =
        kind === "ALL"
          ? "/purchase-warehouses/tickets/export-all?template=2026"
          : kind === "OVERVIEW"
            ? `/purchase-warehouses/overview/export?from=${reportDate}&to=${reportDate}`
            : `/purchase-warehouses/overview/tickets/export?from=${reportDate}&to=${reportDate}&ticketType=IMPORT`;
      await shareProtectedApiFile({
        path,
        token,
        fileName:
          kind === "ALL"
            ? "phieu-can-tat-ca-kho_mau-2026.zip"
            : kind === "OVERVIEW"
              ? `bao-cao-nhap-xuat-ton_${reportDate}.xlsx`
              : `bao-cao-nhap_${reportDate}.xlsx`,
        mimeType:
          kind === "ALL"
            ? "application/zip"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle:
          kind === "IMPORT" ? "Xuất báo cáo nhập" : "Xuất báo cáo kho thu mua",
      });
    } catch (error) {
      Alert.alert("Không thể xuất báo cáo", getApiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const chooseOverviewExport = () => {
    const options = [
      { text: "Hủy", style: "cancel" as const },
      {
        text: "Báo cáo nhập hôm nay",
        onPress: () => void exportOverview("IMPORT"),
      },
      {
        text: "Tổng quan hôm nay",
        onPress: () => void exportOverview("OVERVIEW"),
      },
    ];
    if (can(permissions.purchasePaymentsView)) {
      options.push({
        text: "Chi tiết tất cả kho",
        onPress: () => void exportOverview("ALL"),
      });
    }
    Alert.alert("Xuất báo cáo Excel", "Chọn nội dung cần xuất.", options);
  };

  const exportAssignedImportReport = async () => {
    if (!hasProtectedApiSession(token) || reportDateError || exporting) return;
    setExporting(true);
    try {
      await shareProtectedApiFile({
        path: `/purchase-warehouses/overview/tickets/export?from=${reportFromDate}&to=${reportToDate}&ticketType=IMPORT`,
        token,
        fileName: `bao-cao-nhap_${reportFromDate}_${reportToDate}.xlsx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Xuất báo cáo nhập",
      });
      setReportDialogOpen(false);
    } catch (error) {
      Alert.alert("Không thể xuất báo cáo", getApiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      title={assignedOnly ? "Theo dõi thu mua" : "Tổng quan kho thu mua"}
      subtitle={
        query.data?.reportDate
          ? `Số liệu ngày ${formatDate(query.data.reportDate)}`
          : "Nhập, xuất, tồn kho và công nợ"
      }
      action={
        can(permissions.reportsView) ? (
          <AppButton
            compact
            tone={assignedOnly ? "success" : "secondary"}
            icon="download"
            label={assignedOnly ? "Xuất báo cáo nhập" : "Xuất Excel"}
            loading={exporting}
            disabled={!assignedOnly && !query.data?.reportDate}
            onPress={
              assignedOnly
                ? () => setReportDialogOpen(true)
                : chooseOverviewExport
            }
          />
        ) : undefined
      }
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      scrollEnabled={!assignedOnly}
    >
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? (
        <ErrorState
          text={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {!query.isLoading && !query.data?.data.length ? (
        <EmptyState
          text={
            assignedOnly
              ? "Tài khoản chưa được giao kho thu mua nào."
              : "Chưa có kho thu mua."
          }
        />
      ) : null}
      {query.data?.data.length ? (
        assignedOnly ? (
          <WarehouseMonitoringList
            warehouses={query.data.data}
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        ) : (
          query.data.data.map((warehouse) => (
            <WarehouseOverviewCard key={warehouse.id} warehouse={warehouse} />
          ))
        )
      ) : null}

      <Modal
        visible={assignedOnly && reportDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!exporting) setReportDialogOpen(false);
        }}
      >
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialog, styles.reportDialog]}>
            <Text style={styles.modalTitle}>Xuất báo cáo nhập</Text>
            <DateRangeFields
              fromDate={reportFromDate}
              toDate={reportToDate}
              maximumDate={maximumReportDate}
              onFromDateChange={setReportFromDate}
              onToDateChange={setReportToDate}
            />
            <View style={styles.dialogActions}>
              <View style={styles.dialogAction}>
                <AppButton
                  tone="secondary"
                  label="Hủy"
                  disabled={exporting}
                  onPress={() => setReportDialogOpen(false)}
                />
              </View>
              <View style={styles.dialogAction}>
                <AppButton
                  tone="success"
                  icon="download"
                  label="Xuất báo cáo"
                  loading={exporting}
                  disabled={Boolean(reportDateError)}
                  onPress={() => void exportAssignedImportReport()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

export function PurchaseWarehouseDetailScreen({
  warehouseId,
  warehouseCode,
  warehouseName,
}: {
  warehouseId: string;
  warehouseCode?: string;
  warehouseName?: string;
}) {
  const { can, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"tickets" | "payments">("tickets");
  const [ticketPage, setTicketPage] = useState<number>();
  const [ticketSearch, setTicketSearch] = useState("");
  const [debouncedTicketSearch, setDebouncedTicketSearch] = useState("");
  const [editingTicket, setEditingTicket] =
    useState<PurchaseWarehouseTicket | null>();
  const [viewingTicket, setViewingTicket] = useState<PurchaseWarehouseTicket>();
  const [historyTicket, setHistoryTicket] = useState<PurchaseWarehouseTicket>();
  const [importing, setImporting] = useState(false);
  const [downloadingImportTemplate, setDownloadingImportTemplate] =
    useState(false);
  const [exporting, setExporting] = useState(false);
  const [printingTicketId, setPrintingTicketId] = useState<string>();
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string>();
  const [voidingTicket, setVoidingTicket] = useState<PurchaseWarehouseTicket>();
  const [voidingPayment, setVoidingPayment] = useState<PurchasePayment>();
  const [paymentCreateOpen, setPaymentCreateOpen] = useState(false);
  const canCreateTickets =
    can(permissions.scaleTicketsCreate) ||
    can(permissions.purchaseWarehousesOperateAssigned);
  const canUpdateTickets = can(permissions.scaleTicketsUpdate);
  const canVoidTickets = can(permissions.scaleTicketsVoid);
  const canDeleteTickets = can(permissions.scaleTicketsDelete);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextSearch = ticketSearch.trim();
      setDebouncedTicketSearch(nextSearch);
      setTicketPage(nextSearch ? 1 : undefined);
    }, 350);
    return () => clearTimeout(timeout);
  }, [ticketSearch]);
  const ticketSearchActive = Boolean(debouncedTicketSearch);
  const tickets = useQuery({
    queryKey: [
      "purchase-tickets-mobile",
      warehouseId,
      debouncedTicketSearch,
      ticketPage ?? "latest",
    ],
    placeholderData: (previousData) => previousData,
    queryFn: async () =>
      (
        await api.get<PurchaseWarehouseTicketsResponse>(
          `/purchase-warehouses/${warehouseId}/tickets`,
          {
            params: {
              page: ticketPage ?? 1,
              limit: 10,
              search: debouncedTicketSearch || undefined,
              latest:
                ticketPage == null && !ticketSearchActive ? true : undefined,
            },
          },
        )
      ).data,
  });
  const payments = useQuery({
    queryKey: ["purchase-payments-mobile", warehouseId],
    enabled: tab === "payments" && can(permissions.purchasePaymentsView),
    queryFn: async () =>
      (
        await api.get<PurchasePaymentsResponse>(
          `/purchase-warehouses/${warehouseId}/payments`,
          {
            params: { page: 1, limit: 100, includeVoided: true },
          },
        )
      ).data,
  });

  const deleteTicket = (ticket: PurchaseWarehouseTicket) => {
    Alert.alert(
      "Xóa phiếu cân",
      `Xóa vĩnh viễn phiếu ${ticket.ticketNumber}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            void api
              .delete(`/purchase-warehouses/tickets/${ticket.id}`)
              .then(() =>
                queryClient.invalidateQueries({
                  queryKey: ["purchase-tickets-mobile", warehouseId],
                }),
              )
              .catch((error) =>
                Alert.alert(
                  "Không thể xóa phiếu cân",
                  getApiErrorMessage(error),
                ),
              );
          },
        },
      ],
    );
  };

  const importTickets = async () => {
    if (importing) return;
    try {
      const file = await pickSpreadsheet();
      if (!file) return;
      setImporting(true);
      const response = await api.post<{
        success: boolean;
        message: string;
        data: {
          totalCount: number;
          importCount: number;
          exportCount: number;
          firstTicketNumber: string | null;
          lastTicketNumber: string | null;
        };
      }>(
        `/purchase-warehouses/${warehouseId}/tickets/import`,
        spreadsheetFormData(file),
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120_000,
        },
      );
      setTicketPage(undefined);
      await queryClient.invalidateQueries({
        queryKey: ["purchase-tickets-mobile", warehouseId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["purchase-overview-mobile"],
      });
      const result = response.data.data;
      Alert.alert(
        "Import thành công",
        `${result.totalCount} phiếu: ${result.importCount} phiếu nhập, ${result.exportCount} phiếu xuất.${result.firstTicketNumber ? `\nTừ ${result.firstTicketNumber} đến ${result.lastTicketNumber}.` : ""}`,
      );
    } catch (error) {
      Alert.alert("Không thể import phiếu cân", getApiErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  const downloadTicketImportTemplate = async () => {
    if (!hasProtectedApiSession(token) || downloadingImportTemplate) return;
    setDownloadingImportTemplate(true);
    try {
      await shareProtectedApiFile({
        path: `/purchase-warehouses/${warehouseId}/tickets/import-template`,
        token,
        fileName: `mau-import-phieu-can-${warehouseCode || warehouseId}.xlsx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Tải mẫu import phiếu cân",
      });
    } catch (error) {
      Alert.alert("Không thể tải file mẫu", getApiErrorMessage(error));
    } finally {
      setDownloadingImportTemplate(false);
    }
  };

  const chooseTicketImport = () => {
    Alert.alert(
      "Import phiếu cân",
      "Tải file mẫu để nhập đúng định dạng hoặc chọn file Excel đã chuẩn bị.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Tải file mẫu",
          onPress: () => void downloadTicketImportTemplate(),
        },
        { text: "Chọn file Excel", onPress: () => void importTickets() },
      ],
    );
  };

  const printTicket = async (ticket: PurchaseWarehouseTicket) => {
    if (printingTicketId) return;
    setPrintingTicketId(ticket.id);
    try {
      const response = await api.get<ApiResponse<{ html: string }>>(
        `/purchase-warehouses/tickets/${ticket.id}/print`,
      );
      await Print.printAsync({ html: response.data.data.html });
    } catch (error) {
      Alert.alert("Không thể in phiếu cân", getApiErrorMessage(error));
    } finally {
      setPrintingTicketId(undefined);
    }
  };

  const exportTickets = async (template: "2025" | "2026") => {
    if (!hasProtectedApiSession(token) || exporting) return;
    setExporting(true);
    try {
      await shareProtectedApiFile({
        path: `/purchase-warehouses/${warehouseId}/tickets/export?template=${template}`,
        token,
        fileName: `phieu-can_${warehouseCode || warehouseId}${template === "2026" ? "_mau-2026" : ""}.xlsx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: `Xuất phiếu cân mẫu ${template}`,
      });
    } catch (error) {
      Alert.alert("Không thể xuất báo cáo", getApiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const chooseExportTemplate = () => {
    Alert.alert("Xuất phiếu cân", "Chọn mẫu báo cáo Excel.", [
      { text: "Hủy", style: "cancel" },
      { text: "Mẫu 2025", onPress: () => void exportTickets("2025") },
      { text: "Mẫu 2026", onPress: () => void exportTickets("2026") },
    ]);
  };

  const openAttachment = async (
    attachment: PurchasePayment["attachments"][number],
  ) => {
    if (!hasProtectedApiSession(token) || openingAttachmentId) return;
    setOpeningAttachmentId(attachment.id);
    try {
      await shareProtectedApiFile({
        path: `/purchase-warehouses/payment-attachments/${attachment.id}`,
        token,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        dialogTitle: "Mở chứng từ thanh toán",
      });
    } catch (error) {
      Alert.alert("Không thể mở chứng từ", getApiErrorMessage(error));
    } finally {
      setOpeningAttachmentId(undefined);
    }
  };

  const activeQuery = tab === "tickets" ? tickets : payments;
  const ticketPaginationFooter =
    tab === "tickets" && tickets.data?.data.length ? (
      <View style={styles.ticketPagination}>
        <AppButton
          compact
          tone="secondary"
          label="Trước"
          disabled={tickets.isFetching || tickets.data.pagination.page <= 1}
          onPress={() =>
            setTicketPage(Math.max(1, tickets.data.pagination.page - 1))
          }
        />
        <View style={styles.ticketPaginationInfo}>
          <Text style={styles.ticketPaginationPage}>
            {`Trang ${tickets.data.pagination.page}/${Math.max(1, tickets.data.pagination.totalPages)}`}
          </Text>
          <Text style={styles.ticketPaginationTotal}>
            {formatNumber(tickets.data.pagination.total, 0)} phiếu
          </Text>
        </View>
        <AppButton
          compact
          tone="secondary"
          label="Sau"
          disabled={
            tickets.isFetching ||
            tickets.data.pagination.page >= tickets.data.pagination.totalPages
          }
          onPress={() => setTicketPage(tickets.data.pagination.page + 1)}
        />
      </View>
    ) : undefined;
  return (
    <>
      <Screen
        title={warehouseName || warehouseCode || "Chi tiết kho"}
        footer={ticketPaginationFooter}
        refreshing={activeQuery.isRefetching}
        onRefresh={() => void activeQuery.refetch()}
        scrollEnabled={tab === "payments"}
      >
        <View
          style={[
            styles.detailToolbar,
            tab === "payments" && styles.detailToolbarPayments,
          ]}
        >
          {tab === "tickets" ? (
            <View style={styles.detailSearch}>
              <SearchField
                clearButtonMode="while-editing"
                placeholder="Tìm..."
                showIcon={false}
                value={ticketSearch}
                onChangeText={setTicketSearch}
                onSubmit={() => {
                  const nextSearch = ticketSearch.trim();
                  setDebouncedTicketSearch(nextSearch);
                  setTicketPage(nextSearch ? 1 : undefined);
                }}
              />
            </View>
          ) : null}
          {tab === "tickets" && canCreateTickets ? (
            <AppButton
              compact
              label="Thêm phiếu"
              onPress={() => setEditingTicket(null)}
            />
          ) : null}
          {tab === "tickets" && user?.role === "ADMIN" ? (
            <AppButton
              compact
              tone="secondary"
              label="Nhập Excel"
              loading={importing || downloadingImportTemplate}
              onPress={chooseTicketImport}
            />
          ) : null}
          {tab === "tickets" &&
          can(permissions.reportsView) &&
          can(permissions.purchasePaymentsView) ? (
            <AppButton
              compact
              tone="success"
              // icon="download"
              label="Xuất Excel"
              loading={exporting}
              onPress={chooseExportTemplate}
            />
          ) : null}
          {tab === "payments" && can(permissions.purchasePaymentsCreate) ? (
            <AppButton
              compact
              label="Ghi nhận"
              onPress={() => setPaymentCreateOpen(true)}
            />
          ) : null}
        </View>

        {can(permissions.purchasePaymentsView) ? (
          <View accessibilityRole="tablist" style={styles.detailTabs}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "tickets" }}
              onPress={() => setTab("tickets")}
              style={[
                styles.detailTab,
                tab === "tickets" && styles.detailTabActive,
              ]}
            >
              <Text
                style={[
                  styles.detailTabLabel,
                  tab === "tickets" && styles.detailTabLabelActive,
                ]}
              >
                Phiếu cân
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "payments" }}
              onPress={() => setTab("payments")}
              style={[
                styles.detailTab,
                tab === "payments" && styles.detailTabActive,
              ]}
            >
              <Text
                style={[
                  styles.detailTabLabel,
                  tab === "payments" && styles.detailTabLabelActive,
                ]}
              >
                Thanh toán
              </Text>
            </Pressable>
          </View>
        ) : null}

        {activeQuery.isLoading ? <LoadingBlock /> : null}
        {activeQuery.isError ? (
          <ErrorState
            text={getApiErrorMessage(activeQuery.error)}
            onRetry={() => void activeQuery.refetch()}
          />
        ) : null}

        {tab === "tickets" && tickets.data ? (
          <View style={styles.ticketList}>
            <Card tone="soft" style={styles.ticketSummary}>
              <View style={styles.summaryMetrics}>
                <View style={[styles.ticketMetric, styles.ticketMetricDivider]}>
                  <Text style={styles.ticketMetricLabel}>
                    Tổng khối lượng nhập
                  </Text>
                  <FormattedValue
                    numberOfLines={1}
                    style={styles.ticketMetricValue}
                    value={formatWeight(
                      tickets.data.summary.totalImportNetWeight,
                    )}
                  />
                </View>
                <View style={[styles.ticketMetric, styles.ticketMetricLast]}>
                  <Text style={styles.ticketMetricLabel}>Tổng tiền</Text>
                  <FormattedValue
                    numberOfLines={1}
                    style={styles.ticketMetricValue}
                    value={formatMoney(tickets.data.summary.totalAmount)}
                  />
                </View>
              </View>
            </Card>
            {!tickets.data.data.length ? (
              <EmptyState
                text={
                  debouncedTicketSearch
                    ? "Không tìm thấy phiếu phù hợp."
                    : "Chưa có phiếu cân."
                }
              />
            ) : (
              <>
                <View style={styles.ticketTableHeader}>
                  <Text
                    style={[
                      styles.ticketTableHeaderText,
                      styles.ticketTableInfoColumn,
                    ]}
                  >
                    Phiếu / thời gian
                  </Text>
                  <Text
                    style={[
                      styles.ticketTableHeaderText,
                      styles.ticketTableMetricHeader,
                      styles.ticketTableMetricColumn,
                    ]}
                  >
                    KL sạch (kg)
                  </Text>
                  <Text
                    style={[
                      styles.ticketTableHeaderText,
                      styles.ticketTableMetricHeader,
                      styles.ticketTableMetricColumn,
                    ]}
                  >
                    Đơn giá (đ/kg)
                  </Text>
                  <View style={styles.ticketTableActionColumn} />
                </View>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={styles.ticketRowsScroll}
                  refreshControl={
                    <RefreshControl
                      colors={[colors.primary]}
                      tintColor={colors.primary}
                      refreshing={tickets.isRefetching}
                      onRefresh={() => void tickets.refetch()}
                    />
                  }
                >
                  {tickets.data.data.map((ticket) => {
                    const statusLabel =
                      ticket.status === "VOID"
                        ? "Đã hủy"
                        : ticket.ticketType === "IMPORT"
                          ? "Nhập"
                          : ticket.closesLot
                            ? "Cắt lô"
                            : "Xuất";
                    return (
                      <View
                        key={ticket.id}
                        style={[
                          styles.ticketTableRow,
                          ticket.status === "VOID" && styles.ticketTableRowVoid,
                        ]}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Xem chi tiết phiếu ${ticket.ticketNumber}`}
                          onPress={() => setViewingTicket(ticket)}
                          style={({ pressed }) => [
                            styles.ticketTableRowContent,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.ticketTableInfoColumn}>
                            <Text
                              numberOfLines={1}
                              style={styles.ticketTableTicket}
                            >
                              #{ticket.ticketNumber} · {ticket.licensePlate}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={styles.ticketTableMeta}
                            >
                              <Text
                                style={[
                                  styles.ticketTableStatus,
                                  ticket.status === "VOID"
                                    ? styles.ticketTableStatusVoid
                                    : ticket.ticketType === "IMPORT"
                                      ? styles.ticketTableStatusImport
                                      : styles.ticketTableStatusExport,
                                ]}
                              >
                                {statusLabel}
                              </Text>
                              {" · "}
                              {formatDate(ticket.grossWeighedDate)} ·{" "}
                              {ticket.grossWeighedTime.slice(0, 5)}
                            </Text>
                            {ticket.voidReason ? (
                              <Text
                                numberOfLines={1}
                                style={styles.ticketTableVoidReason}
                              >
                                {ticket.voidReason}
                              </Text>
                            ) : null}
                          </View>
                          <FormattedValue
                            numberOfLines={1}
                            style={[
                              styles.ticketTableValue,
                              styles.ticketTableMetricColumn,
                              ticket.ticketType === "EXPORT" &&
                                styles.ticketTableValueExport,
                            ]}
                            value={formatNumber(ticket.netWeight, 3)}
                          />
                          <FormattedValue
                            numberOfLines={1}
                            style={[
                              styles.ticketTableValue,
                              styles.ticketTableMetricColumn,
                              ticket.ticketType === "EXPORT" &&
                                styles.ticketTableValueExport,
                            ]}
                            value={
                              ticket.price == null
                                ? "—"
                                : formatNumber(ticket.price, 0)
                            }
                          />
                        </Pressable>
                        <View style={styles.ticketTableActionColumn}>
                          <ActionMenu
                            label={`Thao tác phiếu #${ticket.ticketNumber}`}
                            items={[
                              {
                                label: "Lịch sử",
                                onPress: () => setHistoryTicket(ticket),
                              },
                              ...(ticket.status === "ACTIVE" && canUpdateTickets
                                ? [
                                    {
                                      label: "Sửa",
                                      disabled: ticket.lockedByLotClosure,
                                      onPress: () => setEditingTicket(ticket),
                                    },
                                  ]
                                : []),
                              ...(ticket.status === "ACTIVE"
                                ? [
                                    {
                                      label:
                                        printingTicketId === ticket.id
                                          ? "Đang in phiếu..."
                                          : "In phiếu",
                                      disabled: Boolean(printingTicketId),
                                      onPress: () => void printTicket(ticket),
                                    },
                                  ]
                                : []),
                              ...(ticket.status === "ACTIVE" && canVoidTickets
                                ? [
                                    {
                                      label: "Hủy phiếu",
                                      tone: "danger" as const,
                                      disabled: ticket.lockedByLotClosure,
                                      onPress: () => setVoidingTicket(ticket),
                                    },
                                  ]
                                : []),
                              ...(ticket.status === "ACTIVE" && canDeleteTickets
                                ? [
                                    {
                                      label: "Xóa",
                                      tone: "danger" as const,
                                      disabled: ticket.lockedByLotClosure,
                                      onPress: () => deleteTicket(ticket),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        ) : null}

        {tab === "payments" && payments.data ? (
          <>
            <Card tone="soft">
              <Text style={styles.summaryTitle}>Đối chiếu thanh toán</Text>
              <InfoRow
                label="Tiền hàng"
                value={formatMoney(payments.data.summary.totalPurchaseAmount)}
              />
              <InfoRow
                label="Đã thanh toán"
                value={formatMoney(payments.data.summary.totalPaidAmount)}
              />
              <InfoRow
                label="Công nợ"
                value={formatMoney(payments.data.summary.outstandingAmount)}
                emphasize
              />
              <InfoRow
                label="Dư ứng"
                value={formatMoney(payments.data.summary.advanceBalance)}
              />
            </Card>
            {!payments.data.data.length ? (
              <EmptyState text="Chưa có giao dịch thanh toán." />
            ) : null}
            {payments.data.data.map((payment) => (
              <Card
                key={payment.id}
                tone={payment.status === "VOID" ? "danger" : "default"}
              >
                <View style={styles.heading}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.ticketNumber}>
                      {payment.transactionType === "PAYMENT"
                        ? "Thanh toán"
                        : "Hoàn tiền"}
                    </Text>
                    <Text style={styles.ticketMeta}>
                      {formatDateTime(payment.paidAt)}
                    </Text>
                  </View>
                  <StatusBadge
                    label={
                      payment.status === "CONFIRMED" ? "Đã xác nhận" : "Đã hủy"
                    }
                    tone={payment.status === "CONFIRMED" ? "success" : "danger"}
                  />
                </View>
                <Text style={styles.paymentAmount}>
                  {formatMoney(payment.amount)}
                </Text>
                <InfoRow
                  label="Hình thức"
                  value={
                    payment.paymentMethod === "BANK_TRANSFER"
                      ? "Chuyển khoản"
                      : payment.paymentMethod === "CASH"
                        ? "Tiền mặt"
                        : "Khác"
                  }
                />
                <InfoRow label="Người ghi nhận" value={payment.createdByName} />
                {payment.referenceNumber ? (
                  <InfoRow label="Tham chiếu" value={payment.referenceNumber} />
                ) : null}
                {payment.attachments?.length ? (
                  <View style={styles.attachmentBlock}>
                    <Text style={styles.attachmentTitle}>
                      Chứng từ ({payment.attachments.length})
                    </Text>
                    {payment.attachments.map((attachment) => (
                      <View key={attachment.id} style={styles.attachmentRow}>
                        <Text numberOfLines={1} style={styles.attachmentName}>
                          • {attachment.fileName}
                        </Text>
                        <AppButton
                          compact
                          tone="ghost"
                          label="Mở"
                          loading={openingAttachmentId === attachment.id}
                          disabled={Boolean(
                            openingAttachmentId &&
                            openingAttachmentId !== attachment.id,
                          )}
                          onPress={() => void openAttachment(attachment)}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
                {payment.note ? (
                  <Text style={styles.description}>{payment.note}</Text>
                ) : null}
                {payment.voidReason ? (
                  <Text style={styles.voidReason}>
                    Lý do hủy: {payment.voidReason}
                  </Text>
                ) : null}
                {payment.status === "CONFIRMED" &&
                can(permissions.purchasePaymentsDelete) ? (
                  <View style={styles.actions}>
                    <AppButton
                      compact
                      tone="danger-outline"
                      label="Hủy giao dịch"
                      onPress={() => setVoidingPayment(payment)}
                    />
                  </View>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}
      </Screen>

      {viewingTicket ? (
        <TicketDetailSheet
          ticket={viewingTicket}
          warehouseCode={warehouseCode}
          warehouseName={warehouseName}
          onClose={() => setViewingTicket(undefined)}
        />
      ) : null}
      {editingTicket !== undefined ? (
        <TicketEditSheet
          warehouseId={warehouseId}
          ticket={editingTicket ?? undefined}
          onClose={() => setEditingTicket(undefined)}
          onSaved={async () => {
            const createdTicket = editingTicket === null;
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["purchase-tickets-mobile", warehouseId],
              }),
              queryClient.invalidateQueries({
                queryKey: ["purchase-overview-mobile"],
              }),
              queryClient.invalidateQueries({
                queryKey: ["executive-purchase-warehouse-dashboard-mobile"],
              }),
            ]);
            if (createdTicket) setTicketPage(undefined);
            setEditingTicket(undefined);
          }}
        />
      ) : null}
      {historyTicket ? (
        <TicketRevisionHistorySheet
          ticket={historyTicket}
          onClose={() => setHistoryTicket(undefined)}
        />
      ) : null}
      {voidingTicket ? (
        <ReasonModal
          title={`Hủy phiếu ${voidingTicket.ticketNumber}`}
          label="Lý do hủy phiếu cân"
          onClose={() => setVoidingTicket(undefined)}
          onSubmit={async (nextReason) => {
            await api.patch(
              `/purchase-warehouses/tickets/${voidingTicket.id}/void`,
              { reason: nextReason },
            );
            await queryClient.invalidateQueries({
              queryKey: ["purchase-tickets-mobile", warehouseId],
            });
            setVoidingTicket(undefined);
          }}
        />
      ) : null}
      {voidingPayment ? (
        <ReasonModal
          title="Hủy giao dịch thanh toán"
          label="Lý do hủy giao dịch"
          onClose={() => setVoidingPayment(undefined)}
          onSubmit={async (nextReason) => {
            await api.patch(
              `/purchase-warehouses/payments/${voidingPayment.id}/void`,
              { reason: nextReason },
            );
            await queryClient.invalidateQueries({
              queryKey: ["purchase-payments-mobile", warehouseId],
            });
            setVoidingPayment(undefined);
          }}
        />
      ) : null}
      {paymentCreateOpen ? (
        <CreatePaymentModal
          warehouseId={warehouseId}
          onClose={() => setPaymentCreateOpen(false)}
          onSaved={async () => {
            await queryClient.invalidateQueries({
              queryKey: ["purchase-payments-mobile", warehouseId],
            });
            setPaymentCreateOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function ReasonModal({
  title,
  label,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    const nextReason = value.trim();
    if (nextReason.length < 3) {
      Alert.alert("Thiếu lý do", "Lý do phải có ít nhất 3 ký tự.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(nextReason);
    } catch (error) {
      Alert.alert("Không thể thực hiện", getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.dialogBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.dialog}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FormInput
            label={label}
            value={value}
            onChangeText={setValue}
            multiline
            autoFocus
          />
          <View style={styles.dialogActions}>
            <View style={{ flex: 1 }}>
              <AppButton tone="secondary" label="Đóng" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <AppButton
                tone="danger"
                label="Xác nhận"
                loading={submitting}
                onPress={() => void submit()}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CreatePaymentModal({
  warehouseId,
  onClose,
  onSaved,
}: {
  warehouseId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [transactionType, setTransactionType] = useState<"PAYMENT" | "REFUND">(
    "PAYMENT",
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "BANK_TRANSFER" | "CASH" | "OTHER"
  >("BANK_TRANSFER");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<ImagePickerAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert("Số tiền chưa hợp lệ", "Nhập số tiền lớn hơn 0.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          transactionType,
          amount: numericAmount,
          paidAt: new Date().toISOString(),
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          note: note.trim() || undefined,
        }),
      );
      appendMaterialImages(formData, attachments, 0, "attachments");
      await api.post(`/purchase-warehouses/${warehouseId}/payments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await onSaved();
    } catch (error) {
      Alert.alert("Không thể ghi nhận thanh toán", getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose}>
              <Text style={styles.cancel}>Hủy</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Ghi nhận thanh toán</Text>
            <Pressable onPress={() => void submit()}>
              <Text style={styles.save}>Lưu</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formLabel}>Loại giao dịch</Text>
            <ChoiceChips
              value={transactionType}
              options={[
                { value: "PAYMENT", label: "Thanh toán" },
                { value: "REFUND", label: "Hoàn tiền" },
              ]}
              onChange={setTransactionType}
            />
            <FormInput
              label="Số tiền (đ)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.formLabel}>Hình thức</Text>
            <ChoiceChips
              value={paymentMethod}
              options={[
                { value: "BANK_TRANSFER", label: "Chuyển khoản" },
                { value: "CASH", label: "Tiền mặt" },
                { value: "OTHER", label: "Khác" },
              ]}
              onChange={setPaymentMethod}
            />
            <FormInput
              label="Số tham chiếu"
              value={referenceNumber}
              onChangeText={setReferenceNumber}
            />
            <FormInput
              label="Ghi chú"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <MaterialEvidencePicker
              label="Ảnh chứng từ (không bắt buộc)"
              emptyText="Có thể thêm tối đa 5 ảnh chứng từ."
              images={attachments}
              disabled={submitting}
              onChange={setAttachments}
            />
            <AppButton
              label="Ghi nhận giao dịch"
              loading={submitting}
              onPress={() => void submit()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function FormInput({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textPlaceholder}
        style={[styles.input, props.multiline && styles.textArea]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  detailToolbar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  detailToolbarPayments: { justifyContent: "flex-end" },
  detailSearch: {
    flex: 1,
    minWidth: 0,
    height: ui.compactControlHeight,
  },
  reportRangeHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  reportRangeError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  reportDialog: { width: "100%", maxWidth: 480, alignSelf: "center" },
  reportDialogDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: { opacity: 0.72 },
  monitoringTable: { flex: 1, minHeight: 0, padding: 0, overflow: "hidden" },
  monitoringHeader: {
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceMuted,
  },
  monitoringHeaderText: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  monitoringNameColumn: { flex: 1.3, minWidth: 0 },
  monitoringMetricColumn: { flex: 1, minWidth: 0, textAlign: "right" },
  monitoringBody: { flex: 1, minHeight: 0 },
  monitoringRow: {
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
  },
  monitoringRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  monitoringRowPressed: { backgroundColor: colors.primarySoft },
  monitoringName: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  monitoringValue: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  monitoringUnit: { color: colors.textPlaceholder, fontWeight: "600" },
  monitoringTotalRow: {
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  monitoringTotalLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  monitoringTotalValue: { color: colors.primaryDark, fontWeight: "700" },
  detailTabs: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailTab: {
    minHeight: 40,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  detailTabActive: { borderBottomColor: colors.primary },
  detailTabLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  detailTabLabelActive: { color: colors.primaryDark, fontWeight: "700" },
  ticketSummary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 6,
    borderBottomColor: colors.surfaceMuted,
  },
  ticketList: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: -ui.pagePaddingHorizontal,
  },
  ticketSummaryTitle: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  ticketTableHeader: {
    minHeight: 34,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  ticketTableHeaderText: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  ticketTableMetricHeader: { textAlign: "right" },
  ticketRowsScroll: { flex: 1, minHeight: 0 },
  ticketTableRow: {
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  ticketTableRowVoid: { backgroundColor: colors.dangerSoft },
  ticketTableRowContent: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ticketTableInfoColumn: { flex: 1.45, minWidth: 0, paddingRight: 3 },
  ticketTableMetricColumn: { flex: 0.72, minWidth: 0 },
  ticketTableActionColumn: {
    width: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketTableTicket: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  ticketTableMeta: {
    marginTop: 2,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "500",
  },
  ticketTableStatus: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
  },
  ticketTableStatusImport: { color: colors.success },
  ticketTableStatusExport: { color: colors.warning },
  ticketTableStatusVoid: { color: colors.danger },
  ticketTableVoidReason: {
    marginTop: 2,
    color: colors.danger,
    fontSize: 9,
    lineHeight: 12,
  },
  ticketTableValue: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "right",
  },
  ticketTableValueExport: { color: colors.warning },
  ticketPagination: {
    minHeight: 54,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  ticketPaginationInfo: { flex: 1, minWidth: 0, alignItems: "center" },
  ticketPaginationPage: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  ticketPaginationTotal: {
    marginTop: 1,
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "500",
  },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  titleWrap: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  ticketNumber: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  ticketMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  code: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  metricBox: {
    width: "48.7%",
    padding: 10,
    borderRadius: ui.smallRadius,
    backgroundColor: colors.surfaceSubtle,
  },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
  },
  importValue: { color: colors.success },
  rows: { marginTop: 10 },
  summaryMetrics: {
    marginTop: 0,
    flexDirection: "row",
  },
  ticketMetric: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 7,
  },
  ticketMetricDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderSubtle,
    paddingRight: 12,
  },
  ticketMetricLast: { paddingLeft: 12 },
  ticketMetricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  ticketMetricValue: {
    color: colors.primaryDark,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    marginTop: 2,
  },
  openHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 12,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  voidReason: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
  },
  paymentAmount: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: "700",
    marginVertical: 12,
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  attachmentBlock: { marginTop: 10, gap: 4 },
  attachmentTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
  attachmentRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  attachmentName: { flex: 1, color: colors.primaryDark, fontSize: 12 },
  modalSafeArea: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    minHeight: ui.headerHeight,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cancel: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  save: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  form: { padding: 12, gap: 12 },
  formLabel: { color: colors.text, fontSize: 13, fontWeight: "600" },
  input: {
    minHeight: ui.controlHeight,
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text,
  },
  textArea: { minHeight: 92, textAlignVertical: "top" },
  dialogBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
  },
  dialog: {
    padding: 16,
    borderRadius: ui.cardRadius,
    backgroundColor: colors.surface,
    gap: 12,
  },
  dialogActions: { flexDirection: "row", gap: 9, marginTop: 3 },
  dialogAction: { flex: 1 },
});
