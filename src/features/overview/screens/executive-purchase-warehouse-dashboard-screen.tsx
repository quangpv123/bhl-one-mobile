import { DateTimePicker as ExpoDateTimePicker } from "@expo/ui/community/datetime-picker";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { z } from "zod";
import {
  BarChart,
  type barDataItem,
  type stackDataItem,
} from "react-native-gifted-charts";

import { Screen } from "@/components/screen";
import {
  AppButton,
  Card,
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
import { formatNumber, todayIso } from "@/utils/format";
import { shareProtectedApiFile } from "@/utils/protected-file";
import { firstZodError, isoDateSchema } from "@/lib/validation";

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
type DashboardChartKey = "today" | "cumulative" | "payment";

interface DashboardChartSelection {
  chart: DashboardChartKey;
  index: number;
}

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
const chartTooltipWidth = 174;
const chartTooltipGap = 8;
const importTooltipEstimatedHeight = 76;
const paymentTooltipEstimatedHeight = 132;
const dashboardDateRangeSchema = z.object({ from: isoDateSchema, to: isoDateSchema }).refine(
  value => value.from <= value.to,
  { path: ["to"], message: "Ngày bắt đầu không được lớn hơn ngày kết thúc." },
);
const chartYAxisLabelStyle = { color: colors.textMuted, fontSize: 9 } as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getChartTooltipPosition({
  barWidth,
  chartWidth,
  columnIndex,
  containerHeight,
  edgeSpacing,
  maximumValue,
  plotHeight,
  spacing,
  tooltipHeight,
  value,
}: {
  barWidth: number;
  chartWidth: number;
  columnIndex: number;
  containerHeight: number;
  edgeSpacing: number;
  maximumValue: number;
  plotHeight: number;
  spacing: number;
  tooltipHeight: number;
  value: number;
}) {
  const viewportWidth = chartWidth + chartYAxisLabelWidth;
  const barCenter =
    chartYAxisLabelWidth +
    edgeSpacing +
    columnIndex * (barWidth + spacing) +
    barWidth / 2;
  const preferredLeft =
    barCenter <= viewportWidth / 2
      ? barCenter + chartTooltipGap
      : barCenter - chartTooltipWidth - chartTooltipGap;
  const valueRatio = maximumValue > 0 ? clamp(value / maximumValue, 0, 1) : 0;
  const barTop = plotHeight * (1 - valueRatio);

  return {
    left: clamp(
      preferredLeft,
      0,
      Math.max(0, viewportWidth - chartTooltipWidth),
    ),
    top: clamp(
      barTop - tooltipHeight / 2,
      0,
      Math.max(0, containerHeight - tooltipHeight),
    ),
  };
}

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
  if (!isoDateSchema.safeParse(value).success) return value;
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
    <View className="gap-[7px]">
      <Text className="text-body font-semibold text-content">{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="h-control flex-row items-center gap-[5px] rounded-control border px-[9px]"
        style={({ pressed }) => ({
          borderColor: pressed ? colors.primaryBorder : colors.border,
          backgroundColor: pressed ? colors.primarySoft : colors.surface,
        })}
      >
        <Text numberOfLines={1} className="flex-1 text-xs text-content">
          {displayDate(value)}
        </Text>
        <Text className="text-[15px] font-bold text-primary">▦</Text>
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
      className="h-[14px] text-center text-[10px] font-semibold leading-[14px] text-content-secondary"
      style={{
        includeFontPadding: false,
        marginLeft: (slotWidth - textWidth) / 2,
        transform: additionalRotation ? [{ rotate }] : undefined,
        width: textWidth,
      }}
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
      className="w-full px-px text-center text-[10px] font-semibold leading-[13px]"
      style={{ color }}
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
    <View className="w-[174px] gap-1 rounded-[9px] border border-border bg-surface p-[9px] shadow-lg">
      <Text numberOfLines={2} className="mb-0.5 text-xs font-bold leading-4 text-content">
        {title}
      </Text>
      {rows.map((row) => (
        <View key={row.label} className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-[10px] leading-[14px] text-content-muted">{row.label}</Text>
          <Text
            className="shrink-0 text-right text-[10px] font-bold leading-[14px] text-content"
            style={row.color ? { color: row.color } : undefined}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ImportChart({
  activeIndex,
  onSelectColumn,
  warehouses,
  metric,
  showXAxisLabels,
}: {
  activeIndex?: number;
  onSelectColumn: (index: number) => void;
  warehouses: WarehouseMetric[];
  metric: "today" | "cumulative";
  showXAxisLabels: boolean;
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
      label: showXAxisLabels ? label : "",
      labelComponent: showXAxisLabels
        ? () => (
            <ChartXAxisLabel
              additionalRotation={xAxisLabelLayout.additionalRotation}
              label={label}
              slotWidth={labelWidth}
              textWidth={xAxisLabelLayout.labelTextWidths[index]}
            />
          )
        : undefined,
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
      onPress: () => onSelectColumn(index),
    };
  });
  const selectedWarehouse =
    activeIndex === undefined ? undefined : warehouses[activeIndex];
  const plotHeight = Math.max(
    1,
    Math.floor(
      containerHeight -
        (showXAxisLabels ? xAxisLabelLayout.importLabelsExtraHeight : 0) -
        chartVerticalChromeHeight,
    ),
  );
  const maximumValue = Math.max(0, ...data.map((item) => item.value ?? 0));
  const selectedValue =
    activeIndex === undefined ? 0 : (data[activeIndex]?.value ?? 0);
  const tooltipPosition =
    activeIndex === undefined
      ? undefined
      : getChartTooltipPosition({
          barWidth,
          chartWidth,
          columnIndex: activeIndex,
          containerHeight,
          edgeSpacing,
          maximumValue,
          plotHeight,
          spacing,
          tooltipHeight: importTooltipEstimatedHeight,
          value: selectedValue,
        });

  return (
    <View
      onLayout={({ nativeEvent }) => {
        const nextHeight = Math.floor(nativeEvent.layout.height);
        setContainerHeight((currentHeight) =>
          currentHeight === nextHeight ? currentHeight : nextHeight,
        );
      }}
      className="-ml-1 min-h-0 flex-1 justify-end"
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
        yAxisTextStyle={chartYAxisLabelStyle}
        yAxisLabelSuffix="t"
        formatYLabel={(label) => formatNumber(Number(label), 1)}
        xAxisThickness={1}
        xAxisColor={colors.border}
        xAxisLabelsHeight={showXAxisLabels ? chartXAxisLabelHeight : 0}
        xAxisTextNumberOfLines={1}
        labelsDistanceFromXaxis={
          showXAxisLabels ? xAxisLabelLayout.importLabelsDistance : 0
        }
        labelsExtraHeight={
          showXAxisLabels ? xAxisLabelLayout.importLabelsExtraHeight : 0
        }
        rotateLabel={showXAxisLabels}
        rulesColor={colors.border}
        rulesThickness={1}
        disableScroll
        focusBarOnPress
        focusedBarIndex={activeIndex ?? -1}
        focusedBarConfig={{ color, opacity: 0.72, borderRadius: 5 }}
      />
      {selectedWarehouse && tooltipPosition ? (
        <View
          pointerEvents="box-only"
          className="absolute z-20"
          style={tooltipPosition}
        >
          <ChartTooltip
            title={selectedWarehouse.warehouseName}
            rows={[
              {
                label: "Khối lượng nhập",
                value: formatTons(
                  metric === "today"
                    ? selectedWarehouse.todayImport
                    : selectedWarehouse.cumulativeImport,
                ),
                color,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-[5px]">
      <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <Text className="text-caption font-bold text-content-muted">{label}</Text>
    </View>
  );
}

function PaymentChart({
  activeIndex,
  onSelectColumn,
  warehouses,
  showXAxisLabels,
}: {
  activeIndex?: number;
  onSelectColumn: (index: number) => void;
  warehouses: WarehouseMetric[];
  showXAxisLabels: boolean;
}) {
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
      label: showXAxisLabels ? label : "",
      labelComponent: showXAxisLabels
        ? () => (
            <ChartXAxisLabel
              additionalRotation={xAxisLabelLayout.additionalRotation}
              label={label}
              slotWidth={labelWidth}
              textWidth={xAxisLabelLayout.labelTextWidths[index]}
            />
          )
        : undefined,
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
      onPress: () => onSelectColumn(index),
    };
  });
  const selectedWarehouse =
    activeIndex === undefined ? undefined : warehouses[activeIndex];
  const plotHeight = Math.max(
    1,
    Math.floor(
      containerHeight -
        (showXAxisLabels ? xAxisLabelLayout.paymentLabelsExtraHeight : 0) -
        chartVerticalChromeHeight,
    ),
  );
  const stackValue = (item: stackDataItem) =>
    item.stacks.reduce((total, stack) => total + stack.value, 0);
  const maximumValue = Math.max(0, ...stackData.map(stackValue));
  const selectedValue =
    activeIndex === undefined
      ? 0
      : stackData[activeIndex]
        ? stackValue(stackData[activeIndex])
        : 0;
  const tooltipPosition =
    activeIndex === undefined
      ? undefined
      : getChartTooltipPosition({
          barWidth,
          chartWidth,
          columnIndex: activeIndex,
          containerHeight,
          edgeSpacing,
          maximumValue,
          plotHeight,
          spacing,
          tooltipHeight: paymentTooltipEstimatedHeight,
          value: selectedValue,
        });
  return (
    <>
      <View
        onLayout={({ nativeEvent }) => {
          const nextHeight = Math.floor(nativeEvent.layout.height);
          setContainerHeight((currentHeight) =>
            currentHeight === nextHeight ? currentHeight : nextHeight,
          );
        }}
        className="-ml-1 min-h-0 flex-1 justify-end"
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
          yAxisTextStyle={chartYAxisLabelStyle}
          formatYLabel={(label) => formatNumber(Number(label), 1)}
          xAxisThickness={1}
          xAxisColor={colors.border}
          xAxisLabelsHeight={showXAxisLabels ? chartXAxisLabelHeight : 0}
          xAxisTextNumberOfLines={1}
          labelsDistanceFromXaxis={
            showXAxisLabels ? xAxisLabelLayout.paymentLabelsDistance : 0
          }
          labelsExtraHeight={
            showXAxisLabels ? xAxisLabelLayout.paymentLabelsExtraHeight : 0
          }
          rotateLabel={showXAxisLabels}
          rulesColor={colors.border}
          rulesThickness={1}
          stackBorderTopLeftRadius={5}
          stackBorderTopRightRadius={5}
          disableScroll
          focusBarOnPress
          focusedBarIndex={activeIndex ?? -1}
          focusedBarConfig={{ opacity: 0.72, borderRadius: 5 }}
        />
        {selectedWarehouse && tooltipPosition ? (
          <View
            pointerEvents="box-only"
            className="absolute z-20"
            style={tooltipPosition}
          >
            <ChartTooltip
              title={selectedWarehouse.warehouseName}
              rows={[
                {
                  label: "Tổng tiền",
                  value: formatMillion(selectedWarehouse.totalPurchaseAmount),
                },
                {
                  label: "Đã thanh toán",
                  value: formatMillion(selectedWarehouse.totalPaidAmount),
                  color: "#15803D",
                },
                {
                  label: "Chưa thanh toán",
                  value: formatMillion(selectedWarehouse.outstandingAmount),
                  color: "#D97706",
                },
                {
                  label: "Ứng trước còn dư",
                  value: formatMillion(selectedWarehouse.advanceBalance),
                  color: "#2563EB",
                },
              ]}
            />
          </View>
        ) : null}
      </View>
      <View className="mt-1 flex-row flex-wrap justify-center gap-x-2.5 gap-y-1">
        <LegendItem color="#16A34A" label="Đã thanh toán" />
        <LegendItem color="#F59E0B" label="Chưa thanh toán" />
        <LegendItem color="#2563EB" label="Ứng trước còn dư" />
      </View>
    </>
  );
}

function ImportChartSection({
  activeIndex,
  metric,
  onSelectColumn,
  showXAxisLabels = false,
  title,
  total,
  warehouses,
}: {
  activeIndex?: number;
  metric: "today" | "cumulative";
  onSelectColumn: (index: number) => void;
  showXAxisLabels?: boolean;
  title: string;
  total: number;
  warehouses: WarehouseMetric[];
}) {
  return (
    <View className="min-h-0 min-w-0 flex-1">
      <View className="mb-1 flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-[3px]">
          <Text className="text-[15px] font-bold text-content">{title}</Text>
        </View>
        <Text className="text-[15px] font-bold text-primary-dark">{formatTons(total)}</Text>
      </View>
      <ImportChart
        activeIndex={activeIndex}
        warehouses={warehouses}
        metric={metric}
        onSelectColumn={onSelectColumn}
        showXAxisLabels={showXAxisLabels}
      />
    </View>
  );
}

function PaymentChartSection({
  activeIndex,
  onSelectColumn,
  total,
  warehouses,
}: {
  activeIndex?: number;
  onSelectColumn: (index: number) => void;
  total: number;
  warehouses: WarehouseMetric[];
}) {
  return (
    <View className="min-h-0 min-w-0 flex-[1.35]">
      <View className="mb-1 flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-[3px]">
          <Text className="text-[15px] font-bold text-content">Thanh toán</Text>
        </View>
        <Text className="text-[15px] font-bold text-[#15803D]">{formatMillion(total)}</Text>
      </View>
      <PaymentChart
        activeIndex={activeIndex}
        onSelectColumn={onSelectColumn}
        warehouses={warehouses}
        showXAxisLabels
      />
    </View>
  );
}

export function ExecutivePurchaseWarehouseDashboardScreen() {
  const { can, token } = useAuth();
  const [fromDate, setFromDate] = useState("2026-06-01");
  const [toDate, setToDate] = useState(todayIso());
  const [activeDateField, setActiveDateField] = useState<"from" | "to">();
  const [exporting, setExporting] = useState(false);
  const [selectedChartColumn, setSelectedChartColumn] =
    useState<DashboardChartSelection>();
  const selectedChartColumnRef = useRef<DashboardChartSelection | undefined>(
    undefined,
  );
  const selectionBeforeTouchRef = useRef<DashboardChartSelection | undefined>(
    undefined,
  );
  const dateValidation = dashboardDateRangeSchema.safeParse({ from: fromDate, to: toDate });
  const dateError = firstZodError(dateValidation) ?? undefined;
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
        }),
        {
          todayImport: 0,
          cumulativeImport: 0,
          totalPurchaseAmount: 0,
        },
      ),
    [query.data?.warehouses],
  );
  const activeDate = activeDateField === "from" ? fromDate : toDate;
  const selectDate = (date: Date) => {
    const value = isoDate(date);
    if (activeDateField === "from") setFromDate(value);
    if (activeDateField === "to") setToDate(value);
    selectedChartColumnRef.current = undefined;
    selectionBeforeTouchRef.current = undefined;
    setSelectedChartColumn(undefined);
    if (Platform.OS === "android") setActiveDateField(undefined);
  };
  const dismissChartTooltip = () => {
    selectionBeforeTouchRef.current = selectedChartColumnRef.current;
    selectedChartColumnRef.current = undefined;
    setSelectedChartColumn(undefined);
  };
  const selectChartColumn = (chart: DashboardChartKey, index: number) => {
    const previousSelection = selectionBeforeTouchRef.current;
    const nextSelection =
      previousSelection?.chart === chart && previousSelection.index === index
        ? undefined
        : { chart, index };
    selectionBeforeTouchRef.current = undefined;
    selectedChartColumnRef.current = nextSelection;
    setSelectedChartColumn(nextSelection);
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
      title="Tổng quan thu mua sắn"
      refreshing={query.isRefetching}
      onRefresh={() => {
        if (!dateError) void query.refetch();
      }}
      onTouchStart={dismissChartTooltip}
      scrollEnabled={false}
    >
      <View className="flex-row items-end gap-1.5">
        <View className="min-w-0 flex-1">
          <DateField
            label="Từ ngày"
            value={fromDate}
            onPress={() => setActiveDateField("from")}
          />
        </View>
        <View className="min-w-0 flex-1">
          <DateField
            label="Đến ngày"
            value={toDate}
            onPress={() => setActiveDateField("to")}
          />
        </View>
        {can(permissions.reportsView) ? (
          <AppButton
            compact
            tone="success"
            label="Xuất báo cáo nhập"
            loading={exporting}
            disabled={Boolean(dateError) || exporting}
            onPress={() => void exportImportReport()}
          />
        ) : null}
      </View>
      {dateError ? (
        <Card tone="danger">
          <Text className="text-body font-bold leading-[19px] text-danger">{dateError}</Text>
        </Card>
      ) : null}

      {activeDateField && Platform.OS === "android" ? (
        <ExpoDateTimePicker
          value={parseIsoDate(activeDate)}
          mode="date"
          display="spinner"
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
          <View className="flex-1 items-center justify-center bg-[rgba(15,23,42,0.48)] p-[18px]">
            <View className="w-full max-w-[390px] gap-3 rounded-card bg-surface p-3.5">
              <Text className="text-center text-base font-bold text-content">
                {activeDateField === "from"
                  ? "Chọn ngày bắt đầu"
                  : "Chọn ngày kết thúc"}
              </Text>
              <ExpoDateTimePicker
                value={parseIsoDate(activeDate)}
                mode="date"
                display="spinner"
                maximumDate={parseIsoDate(todayIso())}
                locale="en_GB"
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
        <View className="min-h-0 flex-1">
          <Card className="min-h-0 flex-1">
            <View className="min-h-0 flex-1 gap-2">
              <ImportChartSection
                activeIndex={
                  selectedChartColumn?.chart === "today"
                    ? selectedChartColumn.index
                    : undefined
                }
                metric="today"
                onSelectColumn={(index) => selectChartColumn("today", index)}
                title="Nhập trong ngày"
                total={totals.todayImport}
                warehouses={query.data.warehouses}
              />
              <View className="h-px bg-border" />
              <ImportChartSection
                activeIndex={
                  selectedChartColumn?.chart === "cumulative"
                    ? selectedChartColumn.index
                    : undefined
                }
                metric="cumulative"
                onSelectColumn={(index) =>
                  selectChartColumn("cumulative", index)
                }
                title="Nhập lũy kế"
                total={totals.cumulativeImport}
                warehouses={query.data.warehouses}
              />
              <View className="h-px bg-border" />
              <PaymentChartSection
                activeIndex={
                  selectedChartColumn?.chart === "payment"
                    ? selectedChartColumn.index
                    : undefined
                }
                onSelectColumn={(index) => selectChartColumn("payment", index)}
                total={totals.totalPurchaseAmount}
                warehouses={query.data.warehouses}
              />
            </View>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
