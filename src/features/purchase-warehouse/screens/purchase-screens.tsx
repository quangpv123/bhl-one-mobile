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
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

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
import { colors } from "@/theme/colors";
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
import { decimalStringSchema, firstZodError, isoDateSchema } from "@/lib/validation";

const reasonSchema = z.string().trim().min(3, "Lý do phải có ít nhất 3 ký tự.");
const paymentAmountSchema = decimalStringSchema({ minimum: 0.000001, message: "Số tiền phải lớn hơn 0." });

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
      style={({ pressed }) => ({ opacity: pressed && canOpen ? 0.72 : 1 })}
    >
      <Card>
        <View className="flex-row items-start justify-between gap-2.5">
          <View className="flex-1">
            <Text className="text-base font-bold leading-[22px] text-content">{warehouse.warehouseName}</Text>
            <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{warehouse.warehouseCode}</Text>
          </View>
          <StatusBadge
            label={warehouse.status === "ACTIVE" ? "Hoạt động" : "Tạm dừng"}
            tone={warehouse.status === "ACTIVE" ? "success" : "neutral"}
          />
        </View>
        <View className="mt-3.5 flex-row flex-wrap gap-2">
          <View className="w-[48.7%] rounded-compact bg-surface-subtle p-2.5">
            <Text className="text-caption font-semibold text-content-muted">Tồn kho</Text>
            <Text className="mt-[5px] text-sm font-bold text-content">
              {formatWeight(warehouse.inventory)}
            </Text>
          </View>
          <View className="w-[48.7%] rounded-compact bg-surface-subtle p-2.5">
            <Text className="text-caption font-semibold text-content-muted">Nhập hôm nay</Text>
            <Text className="mt-[5px] text-sm font-bold text-success">
              {formatWeight(warehouse.currentDayImport)}
            </Text>
          </View>
          <View className="w-[48.7%] rounded-compact bg-surface-subtle p-2.5">
            <Text className="text-caption font-semibold text-content-muted">Tổng nhập</Text>
            <Text className="mt-[5px] text-sm font-bold text-content">
              {formatWeight(warehouse.totalImport)}
            </Text>
          </View>
          <View className="w-[48.7%] rounded-compact bg-surface-subtle p-2.5">
            <Text className="text-caption font-semibold text-content-muted">Tổng xuất</Text>
            <Text className="mt-[5px] text-sm font-bold text-content">
              {formatWeight(warehouse.totalExport)}
            </Text>
          </View>
        </View>
        {!compact ? (
          <View className="mt-2.5">
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
          <Text className="mt-3 text-right text-xs font-bold text-primary">Chạm để xem phiếu cân →</Text>
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
    <Card padded={false} className="-mx-page-x min-h-0 flex-1 overflow-hidden">
      <View className="min-h-[38px] flex-row items-center gap-2 bg-surface-muted px-2.5 py-[7px]">
        <Text
          className="min-w-0 flex-[1.3] text-caption font-semibold uppercase text-content-muted"
        >
          Tên trạm
        </Text>
        <Text
          className="min-w-0 flex-1 text-right text-caption font-semibold uppercase text-content-muted"
        >
          Nhập hôm nay
        </Text>
        <Text
          className="min-w-0 flex-1 text-right text-caption font-semibold uppercase text-content-muted"
        >
          Lũy kế nhập
        </Text>
      </View>
      <ScrollView
        className="min-h-0 flex-1"
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
            className={`min-h-[52px] flex-row items-center gap-2 bg-surface px-2.5 py-2.5 ${index < warehouses.length - 1 ? 'border-b border-border' : ''}`}
            style={({ pressed }) => ({ backgroundColor: pressed && canOpen ? colors.primarySoft : colors.surface })}
          >
            <Text
              numberOfLines={2}
              className="min-w-0 flex-[1.3] text-body font-semibold text-content"
            >
              {warehouse.warehouseName}
            </Text>
            <MonitoringWeight value={warehouse.currentDayImport} />
            <MonitoringWeight value={warehouse.totalImport} />
          </Pressable>
        ))}
      </ScrollView>
      <View className="min-h-12 flex-row items-center gap-2 border-t border-border bg-surface-muted px-2.5 py-[9px]">
        <Text
          className="min-w-0 flex-[1.3] text-body font-semibold uppercase text-content"
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
      className={`min-w-0 flex-1 text-right text-xs font-bold ${total ? 'text-primary-dark' : 'text-content-secondary'}`}
    >
      {formatNumber(value, 3)} <Text className="font-semibold text-content-placeholder">kg</Text>
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
  const reportDateValidation = z.object({ from: isoDateSchema, to: isoDateSchema })
    .refine(value => value.from <= value.to, { path: ["to"], message: "Ngày bắt đầu không được lớn hơn ngày kết thúc." })
    .refine(value => value.to <= maximumReportDate, { path: ["to"], message: "Ngày kết thúc không được lớn hơn ngày hiện tại." })
    .safeParse({ from: reportFromDate, to: reportToDate });
  const reportDateError = firstZodError(reportDateValidation) ?? undefined;
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
        <View className="flex-1 justify-center bg-[rgba(15,23,42,0.48)] p-4">
          <View className="w-full max-w-[480px] self-center gap-3 rounded-card bg-surface p-4">
            <Text className="text-base font-bold text-content">Xuất báo cáo nhập</Text>
            <DateRangeFields
              fromDate={reportFromDate}
              toDate={reportToDate}
              maximumDate={maximumReportDate}
              onFromDateChange={setReportFromDate}
              onToDateChange={setReportToDate}
            />
            <View className="mt-[3px] flex-row gap-[9px]">
              <View className="flex-1">
                <AppButton
                  tone="secondary"
                  label="Hủy"
                  disabled={exporting}
                  onPress={() => setReportDialogOpen(false)}
                />
              </View>
              <View className="flex-1">
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
      <View className="min-h-[54px] flex-row items-center justify-between gap-2 border-t border-border bg-surface px-2.5">
        <AppButton
          compact
          tone="secondary"
          label="Trước"
          disabled={tickets.isFetching || tickets.data.pagination.page <= 1}
          onPress={() =>
            setTicketPage(Math.max(1, tickets.data.pagination.page - 1))
          }
        />
        <View className="min-w-0 flex-1 items-center">
          <Text className="text-caption font-bold leading-[15px] text-content">
            {`Trang ${tickets.data.pagination.page}/${Math.max(1, tickets.data.pagination.totalPages)}`}
          </Text>
          <Text className="mt-px text-caption font-medium text-content-muted">
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
        <View className={`w-full flex-row items-center gap-[7px] ${tab === "payments" ? 'justify-end' : ''}`}>
          {tab === "tickets" ? (
            <View className="h-[34px] min-w-0 flex-1">
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
          <View accessibilityRole="tablist" className="min-h-10 flex-row items-end border-b border-border">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "tickets" }}
              onPress={() => setTab("tickets")}
              className={`min-h-10 items-center justify-center border-b-2 px-[13px] ${tab === "tickets" ? 'border-primary' : 'border-transparent'}`}
            >
              <Text
                className={`text-body leading-[18px] ${tab === "tickets" ? 'font-bold text-primary-dark' : 'font-semibold text-content-muted'}`}
              >
                Phiếu cân
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "payments" }}
              onPress={() => setTab("payments")}
              className={`min-h-10 items-center justify-center border-b-2 px-[13px] ${tab === "payments" ? 'border-primary' : 'border-transparent'}`}
            >
              <Text
                className={`text-body leading-[18px] ${tab === "payments" ? 'font-bold text-primary-dark' : 'font-semibold text-content-muted'}`}
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
          <View className="-mx-page-x min-h-0 flex-1">
            <Card tone="soft" className="border-b-[6px] border-b-surface-muted px-3 py-2">
              <View className="flex-row">
                <View className="min-w-0 flex-1 border-r border-border-subtle py-[7px] pr-3">
                  <Text className="text-caption font-semibold leading-[15px] text-content-muted">
                    Tổng khối lượng nhập
                  </Text>
                  <FormattedValue
                    numberOfLines={1}
                    className="mt-0.5 text-base font-bold leading-[21px] text-primary-dark"
                    value={formatWeight(
                      tickets.data.summary.totalImportNetWeight,
                    )}
                  />
                </View>
                <View className="min-w-0 flex-1 py-[7px] pl-3">
                  <Text className="text-caption font-semibold leading-[15px] text-content-muted">Tổng tiền</Text>
                  <FormattedValue
                    numberOfLines={1}
                    className="mt-0.5 text-base font-bold leading-[21px] text-primary-dark"
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
                <View className="min-h-[34px] flex-row items-center gap-[5px] border-b border-border bg-surface-muted px-2.5">
                  <Text
                    className="min-w-0 flex-[1.45] pr-[3px] text-caption font-semibold uppercase text-content-muted"
                  >
                    Phiếu / thời gian
                  </Text>
                  <Text
                    className="min-w-0 flex-[0.72] text-right text-caption font-semibold uppercase text-content-muted"
                  >
                    KL sạch (kg)
                  </Text>
                  <Text
                    className="min-w-0 flex-[0.72] text-right text-caption font-semibold uppercase text-content-muted"
                  >
                    Đơn giá (đ/kg)
                  </Text>
                  <View className="w-[34px] flex-row items-center justify-center" />
                </View>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  className="min-h-0 flex-1"
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
                        className={`min-h-16 flex-row items-center gap-[5px] border-b border-border-subtle px-2.5 py-2 ${ticket.status === "VOID" ? 'bg-danger-soft' : 'bg-surface'}`}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Xem chi tiết phiếu ${ticket.ticketNumber}`}
                          onPress={() => setViewingTicket(ticket)}
                          className="min-w-0 flex-1 flex-row items-center gap-[5px] self-stretch"
                          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                        >
                          <View className="min-w-0 flex-[1.45] pr-[3px]">
                            <Text
                              numberOfLines={1}
                              className="text-body font-bold leading-[18px] text-content"
                            >
                              #{ticket.ticketNumber} · {ticket.licensePlate}
                            </Text>
                            <Text
                              numberOfLines={1}
                              className="mt-0.5 min-w-0 text-xs text-content-muted"
                            >
                              <Text
                                className={`text-xs font-bold ${ticket.status === "VOID" ? 'text-danger' : ticket.ticketType === "IMPORT" ? 'text-success' : 'text-warning'}`}
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
                                className="mt-0.5 text-caption text-danger"
                              >
                                {ticket.voidReason}
                              </Text>
                            ) : null}
                          </View>
                          <FormattedValue
                            numberOfLines={1}
                            className={`min-w-0 flex-[0.72] text-right text-body font-bold ${ticket.ticketType === "EXPORT" ? 'text-warning' : 'text-primary-dark'}`}
                            value={formatNumber(ticket.netWeight, 3)}
                          />
                          <FormattedValue
                            numberOfLines={1}
                            className={`min-w-0 flex-[0.72] text-right text-body font-bold ${ticket.ticketType === "EXPORT" ? 'text-warning' : 'text-primary-dark'}`}
                            value={
                              ticket.price == null
                                ? "—"
                                : formatNumber(ticket.price, 0)
                            }
                          />
                        </Pressable>
                        <View className="w-[34px] flex-row items-center justify-center">
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
              <Text className="mb-2 text-base font-bold text-content">Đối chiếu thanh toán</Text>
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
                <View className="flex-row items-start justify-between gap-2.5">
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold leading-5 text-content">
                      {payment.transactionType === "PAYMENT"
                        ? "Thanh toán"
                        : "Hoàn tiền"}
                    </Text>
                    <Text className="mt-0.5 text-caption font-medium leading-4 text-content-muted">
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
                <Text className="my-3 text-[22px] font-bold text-primary-dark">
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
                  <View className="mt-2.5 gap-1">
                    <Text className="text-xs font-bold text-content">
                      Chứng từ ({payment.attachments.length})
                    </Text>
                    {payment.attachments.map((attachment) => (
                      <View key={attachment.id} className="flex-row items-center gap-[7px]">
                        <Text numberOfLines={1} className="flex-1 text-xs text-primary-dark">
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
                  <Text className="mt-2 text-body leading-[19px] text-content-muted">{payment.note}</Text>
                ) : null}
                {payment.voidReason ? (
                  <Text className="mt-2.5 text-xs leading-[18px] text-danger">
                    Lý do hủy: {payment.voidReason}
                  </Text>
                ) : null}
                {payment.status === "CONFIRMED" &&
                can(permissions.purchasePaymentsDelete) ? (
                  <View className="mt-1 flex-row flex-wrap items-center justify-end gap-0.5">
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
  const [validationAttempted, setValidationAttempted] = useState(false);
  const submit = async () => {
    setValidationAttempted(true);
    const validation = reasonSchema.safeParse(value);
    if (!validation.success) return;
    const nextReason = validation.data;
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
        className="flex-1 justify-center bg-[rgba(15,23,42,0.48)] p-4"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="gap-3 rounded-card bg-surface p-4">
          <Text className="text-base font-bold text-content">{title}</Text>
          <FormInput
            label={label}
            value={value}
            onChangeText={setValue}
            error={validationAttempted ? firstZodError(reasonSchema.safeParse(value)) : undefined}
            multiline
            autoFocus
          />
          <View className="mt-[3px] flex-row gap-[9px]">
            <View className="flex-1">
              <AppButton tone="secondary" label="Đóng" onPress={onClose} />
            </View>
            <View className="flex-1">
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
  const [validationAttempted, setValidationAttempted] = useState(false);
  const submit = async () => {
    setValidationAttempted(true);
    const validation = paymentAmountSchema.safeParse(amount);
    if (!validation.success) return;
    const numericAmount = Number(validation.data.replace(",", "."));
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
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="min-h-header flex-row items-center justify-between border-b border-border bg-surface px-3">
            <Pressable onPress={onClose}>
              <Text className="text-sm font-semibold text-content-muted">Hủy</Text>
            </Pressable>
            <Text className="text-base font-bold text-content">Ghi nhận thanh toán</Text>
            <Pressable onPress={() => void submit()}>
              <Text className="text-sm font-semibold text-primary">Lưu</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerClassName="gap-3 p-3"
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-body font-semibold text-content">Loại giao dịch</Text>
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
              error={validationAttempted ? firstZodError(paymentAmountSchema.safeParse(amount)) : undefined}
              keyboardType="decimal-pad"
            />
            <Text className="text-body font-semibold text-content">Hình thức</Text>
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
  error,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; error?: string | null }) {
  return (
    <View className="gap-[7px]">
      <Text className="text-body font-semibold text-content">{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textPlaceholder}
        className={`${props.multiline ? 'h-[92px] py-[9px]' : 'h-control py-0'} rounded-control border px-3 text-content ${error ? 'border-danger bg-danger-soft' : 'border-border bg-surface'}`}
        style={{ textAlignVertical: props.multiline ? 'top' : 'center', includeFontPadding: false }}
      />
      {error ? <Text className="text-caption font-medium leading-[15px] text-danger">{error}</Text> : null}
    </View>
  );
}
