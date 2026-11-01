import { DateTimePicker as ExpoDateTimePicker } from "@expo/ui/community/datetime-picker";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  BarChart,
  type barDataItem,
  type stackDataItem,
} from "react-native-gifted-charts";

import { AppIcon } from "@/components/app-icon";
import { Screen } from "@/components/screen";
import {
  AppButton,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorState,
  LoadingBlock,
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { permissions } from "@/features/auth/permissions";
import {
  api,
  getApiErrorMessage,
  hasProtectedApiSession,
} from "@/services/api";
import { colors, ui } from "@/theme/colors";
import { formatDate, formatNumber, todayIso } from "@/utils/format";
import { shareProtectedApiFile } from "@/utils/protected-file";

interface WarehouseMetric {
  id: string;
  warehouseName: string;
  todayImport: number;
  cumulativeImport: number;
  totalPurchaseAmount: number;
  totalPaidAmount: number;
  outstandingAmount: number;
  advanceBalance: number;
  missingPriceCount: number;
}

interface DashboardResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  todayDate: string;
  warehouses: WarehouseMetric[];
}

type DashboardMetric = "import" | "payment";

const metricOptions: { value: DashboardMetric; label: string }[] = [
  { value: "import", label: "Nhập" },
  { value: "payment", label: "Thanh toán" },
];

const chartYAxisLabelWidth = 38;
const chartEdgeSpacing = 6;
const chartMaximumLabelSlotWidth = 72;
const chartMaximumBarWidth = 60;
const chartXAxisLabelHeight = 14;
const chartXAxisLabelCharacterWidth = 7;
const chartXAxisLabelHorizontalPadding = 6;
const chartXAxisMaximumCharacters = 10;
const chartXAxisBaseRotation = 60;
const chartXAxisMaximumRotation = 88;
const chartVerticalChromeHeight = 34;

function formatTons(kilograms: number) {
  return `${formatNumber(kilograms / 1000, 2)} tấn`;
}

function formatWarehouseChartLabel(warehouseName: string) {
  const shortenedName = warehouseName
    .replace(/^\s*trạm(?:\s+cân)?\s*[-–—:|]?\s*/iu, "")
    .trim();
  const label = shortenedName || warehouseName.trim();
  const characters = Array.from(label);
  return characters.length > chartXAxisMaximumCharacters
    ? `${characters.slice(0, chartXAxisMaximumCharacters - 1).join("")}…`
    : label;
}

function formatMillion(value: number) {
  return `${formatNumber(value / 1_000_000, 2)} triệu`;
}

function formatTonsValue(kilograms: number) {
  return formatNumber(kilograms / 1000, 2);
}

function formatMillionValue(value: number) {
  return formatNumber(value / 1_000_000, 2);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
}

function DateField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.dateFieldContent}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.dateInput,
          pressed && styles.dateInputPressed,
        ]}
      >
        <Text numberOfLines={1} style={styles.dateValue}>
          {displayDate(value)}
        </Text>
        <Text style={styles.calendarIcon}>▦</Text>
      </Pressable>
    </View>
  );
}

function useVerticalChartLayout(columnCount: number) {
  const { width: windowWidth } = useWindowDimensions();
  const viewportWidth =
    windowWidth - ui.pagePaddingHorizontal * 2 - ui.cardPadding * 2;
  const chartWidth = Math.max(1, viewportWidth - chartYAxisLabelWidth);
  const safeColumnCount = Math.max(columnCount, 1);
  const availableWidth = Math.max(1, chartWidth - chartEdgeSpacing * 2);
  const labelWidth = Math.min(
    chartMaximumLabelSlotWidth,
    availableWidth / safeColumnCount,
  );
  const barWidth = Math.min(
    chartMaximumBarWidth,
    Math.max(1, labelWidth * 0.62),
  );
  const spacing = Math.max(0, labelWidth - barWidth);
  const edgeSpacing = Math.max(
    chartEdgeSpacing,
    (chartWidth - labelWidth * safeColumnCount) / 2,
  );
  return {
    barWidth,
    chartWidth,
    edgeSpacing,
    labelWidth,
    spacing,
  };
}

function estimateXAxisLabelWidth(label: string) {
  return Math.max(
    chartXAxisLabelHeight,
    Array.from(label).length * chartXAxisLabelCharacterWidth +
      chartXAxisLabelHorizontalPadding,
  );
}

function getXAxisLabelLayout(labels: string[], labelWidth: number) {
  const labelTextWidths = labels.map(estimateXAxisLabelWidth);
  const maximumTextWidth = Math.max(chartXAxisLabelHeight, ...labelTextWidths);
  const maximumHorizontalFootprint = Math.max(
    chartXAxisLabelHeight,
    labelWidth - 2,
  );
  let rotation = chartXAxisBaseRotation;
  const horizontalFootprint = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return (
      maximumTextWidth * Math.cos(radians) +
      chartXAxisLabelHeight * Math.sin(radians)
    );
  };
  while (
    rotation < chartXAxisMaximumRotation &&
    horizontalFootprint(rotation) > maximumHorizontalFootprint
  ) {
    rotation += 1;
  }
  const rotationRadians = (rotation * Math.PI) / 180;
  const verticalFootprint =
    maximumTextWidth * Math.sin(rotationRadians) +
    chartXAxisLabelHeight * Math.cos(rotationRadians);
  const importLabelsDistance = Math.max(
    0,
    Math.ceil(verticalFootprint / 2 - 29),
  );
  const paymentLabelsDistance = Math.max(
    0,
    Math.ceil(verticalFootprint / 2 - 13),
  );
  // Compensate Gifted Charts' negative root margin, then reserve only the visible rotated overflow.
  const chartRootBottomCompensation = 55 - chartXAxisLabelHeight;

  return {
    additionalRotation: rotation - chartXAxisBaseRotation,
    importLabelsDistance,
    importLabelsExtraHeight: Math.max(
      0,
      Math.ceil(chartRootBottomCompensation + verticalFootprint / 2 - 25),
    ),
    labelTextWidths,
    paymentLabelsDistance,
    paymentLabelsExtraHeight: Math.max(
      0,
      Math.ceil(
        chartRootBottomCompensation +
          paymentLabelsDistance +
          verticalFootprint / 2 -
          41,
      ),
    ),
  };
}

function ChartXAxisLabel({
  additionalRotation,
  label,
  slotWidth,
  textWidth,
}: {
  additionalRotation: number;
  label: string;
  slotWidth: number;
  textWidth: number;
}) {
  const rotate = `${additionalRotation}deg` as `${number}deg`;
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[
        styles.chartXAxisLabel,
        {
          marginLeft: (slotWidth - textWidth) / 2,
          transform: additionalRotation ? [{ rotate }] : undefined,
          width: textWidth,
        },
      ]}
    >
      {label}
    </Text>
  );
}

function ChartTopLabel({ color, value }: { color: string; value: string }) {
  return (
    <Text
      adjustsFontSizeToFit
      minimumFontScale={0.65}
      numberOfLines={1}
      style={[styles.chartTopLabel, { color }]}
    >
      {value}
    </Text>
  );
}

function ChartTooltip({
  title,
  rows,
}: {
  title: string;
  rows: { color?: string; label: string; value: string }[];
}) {
  return (
    <View style={styles.chartTooltip}>
      <Text numberOfLines={2} style={styles.chartTooltipTitle}>
        {title}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.chartTooltipRow}>
          <Text style={styles.chartTooltipLabel}>{row.label}</Text>
          <Text
            style={[
              styles.chartTooltipValue,
              row.color ? { color: row.color } : undefined,
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ImportChart({
  warehouses,
  metric,
}: {
  warehouses: WarehouseMetric[];
  metric: "today" | "cumulative";
}) {
  const color = metric === "today" ? "#16A34A" : colors.primary;
  const [containerHeight, setContainerHeight] = useState(0);
  const { barWidth, chartWidth, edgeSpacing, labelWidth, spacing } =
    useVerticalChartLayout(warehouses.length);
  const labels = warehouses.map((warehouse) =>
    formatWarehouseChartLabel(warehouse.warehouseName),
  );
  const xAxisLabelLayout = getXAxisLabelLayout(labels, labelWidth);
  const data: barDataItem[] = warehouses.map((warehouse, index) => {
    const kilograms =
      metric === "today" ? warehouse.todayImport : warehouse.cumulativeImport;
    const label = labels[index];
    return {
      value: kilograms / 1000,
      frontColor: color,
      label,
      labelComponent: () => (
        <ChartXAxisLabel
          additionalRotation={xAxisLabelLayout.additionalRotation}
          label={label}
          slotWidth={labelWidth}
          textWidth={xAxisLabelLayout.labelTextWidths[index]}
        />
      ),
      labelWidth: barWidth,
      barWidth,
      spacing,
      barBorderTopLeftRadius: 5,
      barBorderTopRightRadius: 5,
      topLabelContainerStyle: {
        width: labelWidth,
        left: -spacing / 2,
      },
      topLabelComponent: () => (
        <ChartTopLabel color={color} value={formatTonsValue(kilograms)} />
      ),
    };
  });
  const plotHeight = Math.max(
    1,
    Math.floor(
      containerHeight -
        xAxisLabelLayout.importLabelsExtraHeight -
        chartVerticalChromeHeight,
    ),
  );

  return (
    <View
      onLayout={({ nativeEvent }) => {
        const nextHeight = Math.floor(nativeEvent.layout.height);
        setContainerHeight((currentHeight) =>
          currentHeight === nextHeight ? currentHeight : nextHeight,
        );
      }}
      style={styles.chartLibraryContainer}
    >
      <BarChart
        data={data}
        height={plotHeight}
        width={chartWidth}
        parentWidth={chartWidth + chartYAxisLabelWidth}
        barWidth={barWidth}
        spacing={spacing}
        initialSpacing={edgeSpacing}
        endSpacing={edgeSpacing}
        noOfSections={4}
        overflowTop={28}
        yAxisLabelWidth={chartYAxisLabelWidth}
        yAxisThickness={0}
        yAxisTextStyle={styles.chartYAxisLabel}
        yAxisLabelSuffix="t"
        formatYLabel={(label) => formatNumber(Number(label), 1)}
        xAxisThickness={StyleSheet.hairlineWidth}
        xAxisColor={colors.border}
        xAxisLabelsHeight={chartXAxisLabelHeight}
        xAxisTextNumberOfLines={1}
        labelsDistanceFromXaxis={xAxisLabelLayout.importLabelsDistance}
        labelsExtraHeight={xAxisLabelLayout.importLabelsExtraHeight}
        rotateLabel
        rulesColor={colors.border}
        rulesThickness={StyleSheet.hairlineWidth}
        disableScroll
        focusBarOnPress
        focusedBarConfig={{ color, opacity: 0.72, borderRadius: 5 }}
        renderTooltip={(_item: barDataItem, index: number) => {
          const warehouse = warehouses[index];
          const value =
            metric === "today"
              ? warehouse.todayImport
              : warehouse.cumulativeImport;
          return (
            <ChartTooltip
              title={warehouse.warehouseName}
              rows={[
                { label: "Khối lượng nhập", value: formatTons(value), color },
              ]}
            />
          );
        }}
      />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function PaymentChart({ warehouses }: { warehouses: WarehouseMetric[] }) {
  const [containerHeight, setContainerHeight] = useState(0);
  const { barWidth, chartWidth, edgeSpacing, labelWidth, spacing } =
    useVerticalChartLayout(warehouses.length);
  const labels = warehouses.map((warehouse) =>
    formatWarehouseChartLabel(warehouse.warehouseName),
  );
  const xAxisLabelLayout = getXAxisLabelLayout(labels, labelWidth);
  const stackData: stackDataItem[] = warehouses.map((warehouse, index) => {
    const settled = Math.max(
      0,
      Math.min(warehouse.totalPaidAmount, warehouse.totalPurchaseAmount),
    );
    const hasAdvance = warehouse.advanceBalance > 0;
    const balance = hasAdvance
      ? warehouse.advanceBalance
      : warehouse.outstandingAmount;
    const label = labels[index];
    return {
      stacks: [
        { value: settled / 1_000_000, color: "#16A34A" },
        { value: warehouse.outstandingAmount / 1_000_000, color: "#F59E0B" },
        { value: warehouse.advanceBalance / 1_000_000, color: "#2563EB" },
      ],
      label,
      labelComponent: () => (
        <ChartXAxisLabel
          additionalRotation={xAxisLabelLayout.additionalRotation}
          label={label}
          slotWidth={labelWidth}
          textWidth={xAxisLabelLayout.labelTextWidths[index]}
        />
      ),
      labelWidth: barWidth,
      barWidth,
      spacing,
      topLabelContainerStyle: {
        width: labelWidth,
        left: -spacing / 2,
      },
      topLabelComponent: () => (
        <ChartTopLabel
          color={hasAdvance ? "#2563EB" : "#D97706"}
          value={formatMillionValue(balance)}
        />
      ),
    };
  });
  const plotHeight = Math.max(
    1,
    Math.floor(
      containerHeight -
        xAxisLabelLayout.paymentLabelsExtraHeight -
        chartVerticalChromeHeight,
    ),
  );
  return (
    <>
      <View
        onLayout={({ nativeEvent }) => {
          const nextHeight = Math.floor(nativeEvent.layout.height);
          setContainerHeight((currentHeight) =>
            currentHeight === nextHeight ? currentHeight : nextHeight,
          );
        }}
        style={styles.chartLibraryContainer}
      >
        <BarChart
          stackData={stackData}
          height={plotHeight}
          width={chartWidth}
          parentWidth={chartWidth + chartYAxisLabelWidth}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={edgeSpacing}
          endSpacing={edgeSpacing + spacing}
          noOfSections={4}
          overflowTop={28}
          yAxisLabelWidth={chartYAxisLabelWidth}
          yAxisThickness={0}
          yAxisTextStyle={styles.chartYAxisLabel}
          formatYLabel={(label) => formatNumber(Number(label), 1)}
          xAxisThickness={StyleSheet.hairlineWidth}
          xAxisColor={colors.border}
          xAxisLabelsHeight={chartXAxisLabelHeight}
          xAxisTextNumberOfLines={1}
          labelsDistanceFromXaxis={xAxisLabelLayout.paymentLabelsDistance}
          labelsExtraHeight={xAxisLabelLayout.paymentLabelsExtraHeight}
          rotateLabel
          rulesColor={colors.border}
          rulesThickness={StyleSheet.hairlineWidth}
          stackBorderTopLeftRadius={5}
          stackBorderTopRightRadius={5}
          disableScroll
          focusBarOnPress
          focusedBarConfig={{ opacity: 0.72, borderRadius: 5 }}
          renderTooltip={(_item: stackDataItem, index: number) => {
            const warehouse = warehouses[index];
            return (
              <ChartTooltip
                title={warehouse.warehouseName}
                rows={[
                  {
                    label: "Tổng tiền",
                    value: formatMillion(warehouse.totalPurchaseAmount),
                  },
                  {
                    label: "Đã thanh toán",
                    value: formatMillion(warehouse.totalPaidAmount),
                    color: "#15803D",
                  },
                  {
                    label: "Chưa thanh toán",
                    value: formatMillion(warehouse.outstandingAmount),
                    color: "#D97706",
                  },
                  {
                    label: "Ứng trước còn dư",
                    value: formatMillion(warehouse.advanceBalance),
                    color: "#2563EB",
                  },
                ]}
              />
            );
          }}
        />
      </View>
      <View style={styles.legend}>
        <LegendItem color="#16A34A" label="Đã thanh toán" />
        <LegendItem color="#F59E0B" label="Chưa thanh toán" />
        <LegendItem color="#2563EB" label="Ứng trước còn dư" />
      </View>
    </>
  );
}

function SummaryMetric({
  label,
  value,
  color = colors.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.summaryValue, { color }]}
      >
        {value}
      </Text>
    </View>
  );
}

function ImportChartSection({
  metric,
  subtitle,
  title,
  total,
  warehouses,
}: {
  metric: "today" | "cumulative";
  subtitle: string;
  title: string;
  total: number;
  warehouses: WarehouseMetric[];
}) {
  return (
    <View style={styles.importChartSection}>
      <View style={styles.importChartHeading}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.importChartTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.totalImport}>{formatTons(total)}</Text>
      </View>
      <ImportChart warehouses={warehouses} metric={metric} />
    </View>
  );
}

export function ExecutivePurchaseWarehouseDashboardScreen() {
  const { can, token } = useAuth();
  const [fromDate, setFromDate] = useState("2026-06-01");
  const [toDate, setToDate] = useState(todayIso());
  const [activeDateField, setActiveDateField] = useState<"from" | "to">();
  const [metric, setMetric] = useState<DashboardMetric>("import");
  const [exporting, setExporting] = useState(false);
  const dateError =
    !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
      ? "Nhập ngày theo định dạng YYYY-MM-DD."
      : fromDate > toDate
        ? "Ngày bắt đầu không được lớn hơn ngày kết thúc."
        : undefined;
  const query = useQuery({
    queryKey: [
      "executive-purchase-warehouse-dashboard-mobile",
      fromDate,
      toDate,
    ],
    enabled: !dateError,
    refetchInterval: 60_000,
    queryFn: async () =>
      (
        await api.get<DashboardResponse>(
          "/executive-dashboard/purchase-warehouses",
          {
            params: { from: fromDate, to: toDate },
          },
        )
      ).data,
  });
  const totals = useMemo(
    () =>
      (query.data?.warehouses ?? []).reduce(
        (result, warehouse) => ({
          todayImport: result.todayImport + warehouse.todayImport,
          cumulativeImport:
            result.cumulativeImport + warehouse.cumulativeImport,
          totalPurchaseAmount:
            result.totalPurchaseAmount + warehouse.totalPurchaseAmount,
          totalPaidAmount: result.totalPaidAmount + warehouse.totalPaidAmount,
          missingPriceCount:
            result.missingPriceCount + warehouse.missingPriceCount,
        }),
        {
          todayImport: 0,
          cumulativeImport: 0,
          totalPurchaseAmount: 0,
          totalPaidAmount: 0,
          missingPriceCount: 0,
        },
      ),
    [query.data?.warehouses],
  );
  const totalOutstanding = Math.max(
    totals.totalPurchaseAmount - totals.totalPaidAmount,
    0,
  );
  const totalAdvance = Math.max(
    totals.totalPaidAmount - totals.totalPurchaseAmount,
    0,
  );
  const activeDate = activeDateField === "from" ? fromDate : toDate;
  const selectDate = (date: Date) => {
    const value = isoDate(date);
    if (activeDateField === "from") setFromDate(value);
    if (activeDateField === "to") setToDate(value);
    if (Platform.OS === "android") setActiveDateField(undefined);
  };
  const exportImportReport = async () => {
    if (!hasProtectedApiSession(token) || dateError || exporting) return;
    setExporting(true);
    try {
      await shareProtectedApiFile({
        path: `/purchase-warehouses/overview/tickets/export?from=${fromDate}&to=${toDate}&ticketType=IMPORT`,
        token,
        fileName: `bao-cao-nhap_${fromDate}_${toDate}.xlsx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Xuất báo cáo nhập",
      });
    } catch (error) {
      Alert.alert("Không thể xuất báo cáo", getApiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      title="Tổng quan"
      refreshing={query.isRefetching}
      onRefresh={() => {
        if (!dateError) void query.refetch();
      }}
      scrollEnabled={false}
    >
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <DateField
            label="Từ ngày"
            value={fromDate}
            onPress={() => setActiveDateField("from")}
          />
        </View>
        <View style={styles.dateField}>
          <DateField
            label="Đến ngày"
            value={toDate}
            onPress={() => setActiveDateField("to")}
          />
        </View>
      </View>
      {dateError ? (
        <Card tone="danger">
          <Text style={styles.errorText}>{dateError}</Text>
        </Card>
      ) : null}

      {activeDateField && Platform.OS === "android" ? (
        <ExpoDateTimePicker
          value={parseIsoDate(activeDate)}
          mode="date"
          presentation="dialog"
          maximumDate={parseIsoDate(todayIso())}
          positiveButton={{ label: "Chọn" }}
          negativeButton={{ label: "Hủy" }}
          onValueChange={(_, date) => selectDate(date)}
          onDismiss={() => setActiveDateField(undefined)}
        />
      ) : null}
      {activeDateField && Platform.OS === "ios" ? (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setActiveDateField(undefined)}
        >
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerCard}>
              <Text style={styles.datePickerTitle}>
                {activeDateField === "from"
                  ? "Chọn ngày bắt đầu"
                  : "Chọn ngày kết thúc"}
              </Text>
              <ExpoDateTimePicker
                value={parseIsoDate(activeDate)}
                mode="date"
                display="inline"
                maximumDate={parseIsoDate(todayIso())}
                locale="vi_VN"
                accentColor={colors.primary}
                onValueChange={(_, date) => selectDate(date)}
              />
              <AppButton
                label="Xong"
                onPress={() => setActiveDateField(undefined)}
              />
            </View>
          </View>
        </Modal>
      ) : null}
      <View style={styles.metricToolbar}>
        <View style={styles.metricTabs}>
          <ChoiceChips
            value={metric}
            options={metricOptions}
            onChange={setMetric}
          />
        </View>
        {can(permissions.reportsView) ? (
          <Pressable
            accessibilityLabel="Xuất báo cáo nhập"
            accessibilityRole="button"
            accessibilityState={{
              disabled: Boolean(dateError) || exporting,
              busy: exporting,
            }}
            disabled={Boolean(dateError) || exporting}
            hitSlop={6}
            onPress={() => void exportImportReport()}
            style={({ pressed }) => [
              styles.exportButton,
              (Boolean(dateError) || exporting) && styles.exportButtonDisabled,
              pressed && styles.exportButtonPressed,
            ]}
          >
            {exporting ? (
              <ActivityIndicator color="#15803D" size="small" />
            ) : (
              <AppIcon color="#15803D" name="download" size={18} />
            )}
            <Text style={styles.exportButtonText}>Xuất báo cáo nhập</Text>
          </Pressable>
        ) : null}
      </View>

      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? (
        <ErrorState
          text={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {!query.isLoading && !query.isError && !query.data?.warehouses.length ? (
        <EmptyState text="Chưa có kho thu mua đang hoạt động." />
      ) : null}

      {query.data?.warehouses.length ? (
        <View style={styles.dashboardBody}>
          <Card style={styles.dashboardCard}>
            {metric === "payment" ? (
              <>
                <View style={styles.cardHeading}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>Thanh toán</Text>
                  </View>
                  <Text style={styles.paymentUnit}>Đơn vị: triệu đồng</Text>
                </View>
                <View style={styles.paymentSummary}>
                  <SummaryMetric
                    label="Tổng tiền"
                    value={formatMillion(totals.totalPurchaseAmount)}
                  />
                  <SummaryMetric
                    label="Đã thanh toán"
                    value={formatMillion(totals.totalPaidAmount)}
                    color="#15803D"
                  />
                  <SummaryMetric
                    label={
                      totalAdvance > 0 ? "Ứng trước còn dư" : "Chưa thanh toán"
                    }
                    value={formatMillion(
                      totalAdvance > 0 ? totalAdvance : totalOutstanding,
                    )}
                    color={totalAdvance > 0 ? "#2563EB" : "#D97706"}
                  />
                </View>
                {totals.missingPriceCount > 0 ? (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      Còn {formatNumber(totals.missingPriceCount, 0)} phiếu nhập
                      chưa có đơn giá; số liệu tài chính chưa hoàn chỉnh.
                    </Text>
                  </View>
                ) : null}
                <PaymentChart warehouses={query.data.warehouses} />
              </>
            ) : (
              <View style={styles.importCharts}>
                <ImportChartSection
                  metric="today"
                  title="Nhập trong ngày"
                  subtitle={`Ngày ${formatDate(query.data.todayDate)}`}
                  total={totals.todayImport}
                  warehouses={query.data.warehouses}
                />
                <View style={styles.importChartDivider} />
                <ImportChartSection
                  metric="cumulative"
                  title="Nhập lũy kế"
                  subtitle={`Từ ${formatDate(query.data.fromDate)} đến ${formatDate(query.data.toDate)}`}
                  total={totals.cumulativeImport}
                  warehouses={query.data.warehouses}
                />
              </View>
            )}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  dateField: { flex: 1 },
  dateFieldContent: { gap: 7 },
  dateLabel: { color: colors.text, fontSize: 13, fontWeight: "800" },
  dateInput: {
    minHeight: ui.controlHeight,
    paddingHorizontal: 9,
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateInputPressed: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  dateValue: { flex: 1, color: colors.text, fontSize: 12 },
  calendarIcon: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  datePickerOverlay: {
    flex: 1,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
  },
  datePickerCard: {
    width: "100%",
    maxWidth: 390,
    padding: 14,
    borderRadius: ui.cardRadius,
    backgroundColor: colors.surface,
    gap: 12,
  },
  datePickerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  metricToolbar: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricTabs: { flex: 1, minWidth: 0 },
  exportButton: {
    minHeight: 34,
    minWidth: 88,
    paddingHorizontal: 8,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#86EFAC",
    backgroundColor: "#F0FDF4",
  },
  exportButtonText: { color: "#15803D", fontSize: 11, fontWeight: "800" },
  exportButtonDisabled: { opacity: 0.5 },
  exportButtonPressed: { opacity: 0.72 },
  dashboardBody: { flex: 1, minHeight: 0 },
  dashboardCard: { flex: 1, minHeight: 0 },
  cardHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: ui.gap,
    marginBottom: 16,
  },
  importCharts: { flex: 1, minHeight: 0, gap: 8 },
  importChartSection: { flex: 1, minWidth: 0, minHeight: 0 },
  importChartHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: ui.gap,
    marginBottom: 4,
  },
  importChartTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  importChartDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  cardTitleWrap: { flex: 1, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  cardSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  totalImport: { color: colors.primaryDark, fontSize: 15, fontWeight: "900" },
  paymentUnit: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  chartLibraryContainer: {
    flex: 1,
    minHeight: 0,
    marginLeft: -4,
    justifyContent: "flex-end",
  },
  chartTopLabel: {
    width: "100%",
    paddingHorizontal: 1,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  chartXAxisLabel: {
    height: chartXAxisLabelHeight,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: chartXAxisLabelHeight,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
  chartYAxisLabel: { color: colors.textMuted, fontSize: 9 },
  chartTooltip: {
    width: 174,
    padding: 9,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: colors.sidebar,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
    gap: 4,
  },
  chartTooltipTitle: {
    marginBottom: 2,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  chartTooltipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  chartTooltipLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  chartTooltipValue: {
    flexShrink: 0,
    color: colors.text,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 18,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendColor: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  paymentSummary: {
    flexDirection: "row",
    gap: 7,
    paddingBottom: 14,
    marginBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  summaryMetric: { flex: 1, minWidth: 0, gap: 4 },
  summaryLabel: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  summaryValue: { fontSize: 13, fontWeight: "900" },
  warningBox: {
    marginBottom: 15,
    padding: 10,
    borderRadius: ui.smallRadius,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warningText: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
});
