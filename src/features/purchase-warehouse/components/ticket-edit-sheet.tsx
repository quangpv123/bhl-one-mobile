import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { z } from "zod";

import {
  FormField,
  FormLabel,
  ManagementSheet,
  OptionPicker,
} from "@/components/forms/management-form";
import { ChoiceChips } from "@/components/ui";
import { api, getApiErrorMessage } from "@/services/api";
import type {
  PaginatedResponse,
  PurchaseWarehouseTicket,
  PurchaseWarehouseTicketMutationPayload,
} from "@/types/business";
import { displayDateToIso, formatDate, formatMoney, formatWeight, todayIso } from "@/utils/format";
import {
  compactPhoneSchema,
  decimalStringSchema,
  displayDateSchema,
  isoDateSchema,
  requiredTextSchema,
} from "@/lib/validation";

interface NameRecord {
  id: string;
  status: "ACTIVE" | "INACTIVE";
  productName?: string;
  cassavaVarietyName?: string;
  bankName?: string;
}
interface TicketDraft {
  ticketType: "IMPORT" | "EXPORT";
  closesLot: boolean;
  printTitle: string;
  reason: string;
  firstWeighedDate: string;
  firstWeighedTime: string;
  firstWeight: string;
  secondWeighedDate: string;
  secondWeighedTime: string;
  secondWeight: string;
  productName: string;
  cassavaVarietyName: string;
  impurityPercent: string;
  price: string;
  starchPercent: string;
  buyerName: string;
  sellerName: string;
  licensePlate: string;
  driverName: string;
  driverPhone: string;
  driverCitizenId: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankName: string;
}
const weightSchema = decimalStringSchema();
const priceSchema = decimalStringSchema();
const percentSchema = decimalStringSchema({ maximum: 100, message: "Giá trị phải từ 0 đến 100%." });
const timeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Giờ phải theo định dạng HH:mm hoặc HH:mm:ss.");
const reasonSchema = z.string().trim().min(3, "Lý do phải có ít nhất 3 ký tự.");
const citizenIdSchema = z.string().trim().regex(/^\d{12}$/, "CCCD phải gồm đúng 12 chữ số.");
const ticketDraftSchema = z.object({
  ticketType: z.enum(["IMPORT", "EXPORT"]),
  closesLot: z.boolean(),
  printTitle: requiredTextSchema,
  reason: reasonSchema,
  firstWeighedDate: isoDateSchema,
  firstWeighedTime: timeSchema,
  firstWeight: weightSchema,
  secondWeighedDate: isoDateSchema,
  secondWeighedTime: timeSchema,
  secondWeight: weightSchema,
  productName: requiredTextSchema,
  cassavaVarietyName: z.string(),
  impurityPercent: percentSchema,
  price: priceSchema,
  starchPercent: percentSchema,
  buyerName: requiredTextSchema,
  sellerName: requiredTextSchema,
  licensePlate: requiredTextSchema,
  driverName: requiredTextSchema,
  driverPhone: compactPhoneSchema,
  driverCitizenId: citizenIdSchema,
  bankAccountNumber: z.string(),
  bankAccountHolder: z.string(),
  bankName: z.string(),
});

function localTime() {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ticketDraft(ticket?: PurchaseWarehouseTicket): TicketDraft {
  if (!ticket) {
    const date = todayIso();
    const time = localTime();
    return {
      ticketType: "IMPORT",
      closesLot: false,
      printTitle: "PHIẾU CÂN HÀNG NHẬP",
      reason: "",
      firstWeighedDate: date,
      firstWeighedTime: time,
      firstWeight: "",
      secondWeighedDate: date,
      secondWeighedTime: time,
      secondWeight: "",
      productName: "",
      cassavaVarietyName: "",
      impurityPercent: "0",
      price: "0",
      starchPercent: "0",
      buyerName: "",
      sellerName: "",
      licensePlate: "",
      driverName: "",
      driverPhone: "",
      driverCitizenId: "",
      bankAccountNumber: "",
      bankAccountHolder: "",
      bankName: "",
    };
  }
  const grossFirst =
    `${ticket.grossWeighedDate}T${ticket.grossWeighedTime}` <=
    `${ticket.tareWeighedDate}T${ticket.tareWeighedTime}`;
  return {
    ticketType: ticket.ticketType,
    closesLot: ticket.closesLot,
    printTitle: ticket.printTitle,
    reason: "",
    firstWeighedDate: grossFirst
      ? ticket.grossWeighedDate
      : ticket.tareWeighedDate,
    firstWeighedTime: grossFirst
      ? ticket.grossWeighedTime
      : ticket.tareWeighedTime,
    firstWeight: String(grossFirst ? ticket.grossWeight : ticket.tareWeight),
    secondWeighedDate: grossFirst
      ? ticket.tareWeighedDate
      : ticket.grossWeighedDate,
    secondWeighedTime: grossFirst
      ? ticket.tareWeighedTime
      : ticket.grossWeighedTime,
    secondWeight: String(grossFirst ? ticket.tareWeight : ticket.grossWeight),
    productName: ticket.productName || "",
    cassavaVarietyName: ticket.cassavaVarietyName || "",
    impurityPercent: String(ticket.impurityPercent ?? 0),
    price: String(ticket.price ?? 0),
    starchPercent: String(ticket.starchPercent ?? 0),
    buyerName: ticket.buyerName || "",
    sellerName: ticket.sellerName || "",
    licensePlate: ticket.licensePlate || "",
    driverName: ticket.driverName || "",
    driverPhone: ticket.driverPhone || "",
    driverCitizenId: ticket.driverCitizenId || "",
    bankAccountNumber: ticket.bankAccountNumber || "",
    bankAccountHolder: ticket.bankAccountHolder || "",
    bankName: ticket.bankName || "",
  };
}

function decimal(value: string) {
  return Number(value.trim().replace(",", "."));
}

function normalizeCatalogName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function catalogOptions(
  values: string[],
  currentValue: string,
  allowEmpty = false,
) {
  const names =
    currentValue && !values.includes(currentValue)
      ? [currentValue, ...values]
      : values;
  return [
    ...(allowEmpty ? [{ value: "", label: "Không chọn" }] : []),
    ...names.map((name) => ({ value: name, label: name })),
  ];
}

export function TicketEditSheet({
  warehouseId,
  ticket,
  onClose,
  onSaved,
}: {
  warehouseId: string;
  ticket?: PurchaseWarehouseTicket;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => ticketDraft(ticket));
  const [saving, setSaving] = useState(false);
  const catalogs = useQuery({
    queryKey: ["mobile-ticket-editor-catalogs"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [products, varieties, banks] = await Promise.all([
        api.get<PaginatedResponse<NameRecord>>("/catalog/products", {
          params: { page: 1, limit: 100, status: "ACTIVE" },
        }),
        api.get<PaginatedResponse<NameRecord>>("/catalog/cassava-varieties", {
          params: { page: 1, limit: 100, status: "ACTIVE" },
        }),
        api.get<PaginatedResponse<NameRecord>>("/catalog/banks", {
          params: { page: 1, limit: 100, status: "ACTIVE" },
        }),
      ]);
      return {
        products: products.data.data
          .map((item) => item.productName)
          .filter((name): name is string => Boolean(name)),
        varieties: varieties.data.data
          .map((item) => item.cassavaVarietyName)
          .filter((name): name is string => Boolean(name)),
        banks: banks.data.data
          .map((item) => item.bankName)
          .filter((name): name is string => Boolean(name)),
      };
    },
  });

  const defaultProduct = useMemo(
    () =>
      catalogs.data?.products.find(
        (name) => normalizeCatalogName(name) === "san cu",
      ) ??
      catalogs.data?.products[0] ??
      "",
    [catalogs.data?.products],
  );
  const selectedProductName =
    draft.productName || (!ticket ? defaultProduct : "");

  const calculated = useMemo(() => {
    const first = decimal(draft.firstWeight);
    const second = decimal(draft.secondWeight);
    const impurity = decimal(draft.impurityPercent);
    const price = decimal(draft.price);
    if (![first, second, impurity, price].every(Number.isFinite))
      return undefined;
    const gross = Math.max(first, second);
    const tare = Math.min(first, second);
    const impurityWeight =
      Math.round((((gross - tare) * impurity) / 100) * 1000) / 1000;
    const cleanWeight =
      Math.round((((gross - tare) * (100 - impurity)) / 100) * 1000) / 1000;
    return {
      gross,
      tare,
      impurityWeight,
      cleanWeight,
      amount: Math.round(cleanWeight * price),
    };
  }, [
    draft.firstWeight,
    draft.impurityPercent,
    draft.price,
    draft.secondWeight,
  ]);

  const update = <K extends keyof TicketDraft>(
    key: K,
    value: TicketDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const validation = ticketDraftSchema.safeParse({ ...draft, productName: selectedProductName });
    if (!validation.success) return;
    const firstWeight = decimal(draft.firstWeight);
    const secondWeight = decimal(draft.secondWeight);
    const price = decimal(draft.price);
    const impurityPercent = decimal(draft.impurityPercent);
    const starchPercent = decimal(draft.starchPercent);
    const reason = draft.reason.trim();
    const firstIsGross = firstWeight >= secondWeight;
    const payload: PurchaseWarehouseTicketMutationPayload = {
      ticketType: draft.ticketType,
      closesLot: draft.ticketType === "EXPORT" && draft.closesLot,
      printTitle: draft.printTitle.trim(),
      grossWeighedDate: firstIsGross
        ? draft.firstWeighedDate
        : draft.secondWeighedDate,
      grossWeighedTime: firstIsGross
        ? draft.firstWeighedTime
        : draft.secondWeighedTime,
      tareWeighedDate: firstIsGross
        ? draft.secondWeighedDate
        : draft.firstWeighedDate,
      tareWeighedTime: firstIsGross
        ? draft.secondWeighedTime
        : draft.firstWeighedTime,
      licensePlate: draft.licensePlate.trim(),
      driverName: draft.driverName.trim(),
      driverPhone: draft.driverPhone.trim(),
      driverCitizenId: draft.driverCitizenId.trim(),
      bankAccountNumber: draft.bankAccountNumber.trim() || undefined,
      bankAccountHolder: draft.bankAccountHolder.trim() || undefined,
      bankName: draft.bankName.trim() || undefined,
      productName: selectedProductName.trim(),
      cassavaVarietyName: draft.cassavaVarietyName.trim() || undefined,
      sellerName: draft.sellerName.trim(),
      buyerName: draft.buyerName.trim(),
      grossWeight: Math.max(firstWeight, secondWeight),
      tareWeight: Math.min(firstWeight, secondWeight),
      price,
      impurityPercent,
      starchPercent,
      reason,
    };
    setSaving(true);
    try {
      if (ticket)
        await api.patch(`/purchase-warehouses/tickets/${ticket.id}`, payload);
      else
        await api.post(
          `/purchase-warehouses/${warehouseId}/tickets/manual`,
          payload,
        );
      await onSaved();
      Alert.alert(
        "Thành công",
        ticket
          ? "Đã cập nhật toàn bộ thông tin phiếu cân."
          : "Đã thêm phiếu cân thủ công.",
      );
    } catch (error) {
      Alert.alert(
        ticket ? "Không thể cập nhật phiếu cân" : "Không thể thêm phiếu cân",
        getApiErrorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet
      title={
        ticket ? `Sửa phiếu ${ticket.ticketNumber}` : "Thêm phiếu cân thủ công"
      }
      saveLabel={ticket ? "Lưu thay đổi" : "Thêm phiếu cân"}
      saving={saving}
      onClose={onClose}
      onSave={() => void save()}
    >
      {catalogs.isError ? (
        <Text className="text-xs font-bold leading-[18px] text-danger">
          {getApiErrorMessage(catalogs.error)}
        </Text>
      ) : null}
      <Section title="Thông tin phiếu">
        <View className="flex-row items-center gap-3.5">
          <FormLabel label="Loại phiếu *" />
          <ChoiceChips
            value={draft.ticketType}
            options={[
              { value: "IMPORT", label: "Nhập" },
              { value: "EXPORT", label: "Xuất" },
            ]}
            onChange={(ticketType) =>
              setDraft((current) => ({
                ...current,
                ticketType,
                closesLot: false,
                printTitle: ticket
                  ? current.printTitle
                  : ticketType === "IMPORT"
                    ? "PHIẾU CÂN HÀNG NHẬP"
                    : "PHIẾU CÂN HÀNG XUẤT",
              }))
            }
          />
          <Pressable
            disabled={saving || draft.ticketType !== "EXPORT"}
            onPress={() => update("closesLot", !draft.closesLot)}
            className={`flex-row items-center gap-1.5 ${draft.ticketType !== "EXPORT" ? "opacity-45" : ""}`}
          >
            <View
              className={`h-[19px] w-[19px] items-center justify-center rounded border ${draft.closesLot ? "border-primary bg-primary" : "border-border bg-surface"}`}
            >
              {draft.closesLot ? <Text className="text-body font-bold text-white">✓</Text> : null}
            </View>
            <Text className="text-body font-semibold text-content-secondary">Cắt lô</Text>
          </Pressable>
        </View>
        <FormField
          label="Tên phiếu in *"
          schema={requiredTextSchema}
          value={draft.printTitle}
          maxLength={100}
          onChangeText={(value) => update("printTitle", value)}
        />
        <FormField
          label={ticket ? "Lý do chỉnh sửa *" : "Lý do nhập phiếu thủ công *"}
          schema={reasonSchema}
          value={draft.reason}
          maxLength={500}
          multiline
          placeholder={
            ticket
              ? "Nhập lý do chỉnh sửa phiếu cân"
              : "Nhập lý do không cân bằng phần mềm"
          }
          onChangeText={(value) => update("reason", value)}
        />
      </Section>

      <Section title="Hàng hóa và khối lượng">
        <TwoColumns>
          <FormField
            label="Ngày cân lần 1 *"
            schema={displayDateSchema}
            value={draft.firstWeighedDate ? formatDate(draft.firstWeighedDate) : ""}
            maxLength={10}
            onChangeText={(value) => update("firstWeighedDate", displayDateToIso(value))}
          />
          <FormField
            label="Ngày cân lần 2 *"
            schema={displayDateSchema}
            value={draft.secondWeighedDate ? formatDate(draft.secondWeighedDate) : ""}
            maxLength={10}
            onChangeText={(value) => update("secondWeighedDate", displayDateToIso(value))}
          />
        </TwoColumns>
        <TwoColumns>
          <FormField
            label="Giờ cân lần 1 *"
            schema={timeSchema}
            value={draft.firstWeighedTime}
            maxLength={8}
            onChangeText={(value) => update("firstWeighedTime", value)}
          />
          <FormField
            label="Giờ cân lần 2 *"
            schema={timeSchema}
            value={draft.secondWeighedTime}
            maxLength={8}
            onChangeText={(value) => update("secondWeighedTime", value)}
          />
        </TwoColumns>
        <TwoColumns>
          <FormField
            label="Khối lượng lần 1 *"
            schema={weightSchema}
            value={draft.firstWeight}
            keyboardType="decimal-pad"
            onChangeText={(value) => update("firstWeight", value)}
          />
          <FormField
            label="Khối lượng lần 2 *"
            schema={weightSchema}
            value={draft.secondWeight}
            keyboardType="decimal-pad"
            onChangeText={(value) => update("secondWeight", value)}
          />
        </TwoColumns>
        <TwoColumns>
          <OptionPicker
            label="Mặt hàng *"
            schema={requiredTextSchema}
            value={selectedProductName}
            options={catalogOptions(
              catalogs.data?.products ?? [],
              selectedProductName,
            )}
            disabled={catalogs.isLoading}
            onChange={(value) => update("productName", value)}
          />
          <OptionPicker
            label="Giống sắn"
            value={draft.cassavaVarietyName}
            placeholder="Không chọn"
            options={catalogOptions(
              catalogs.data?.varieties ?? [],
              draft.cassavaVarietyName,
              true,
            )}
            disabled={catalogs.isLoading}
            onChange={(value) => update("cassavaVarietyName", value)}
          />
        </TwoColumns>
        <TwoColumns>
          <FormField
            label="Tạp chất (%) *"
            schema={percentSchema}
            value={draft.impurityPercent}
            keyboardType="decimal-pad"
            onChangeText={(value) => update("impurityPercent", value)}
          />
          <FormField
            label="Giá (đ/kg) *"
            schema={priceSchema}
            value={draft.price}
            keyboardType="decimal-pad"
            onChangeText={(value) => update("price", value)}
          />
        </TwoColumns>
        <TwoColumns>
          <FormField
            label="Độ bột (%) *"
            schema={percentSchema}
            value={draft.starchPercent}
            keyboardType="decimal-pad"
            onChangeText={(value) => update("starchPercent", value)}
          />
          <FormField
            label="Bên mua *"
            schema={requiredTextSchema}
            value={draft.buyerName}
            maxLength={200}
            onChangeText={(value) => update("buyerName", value)}
          />
        </TwoColumns>
        <View className="flex-row flex-wrap gap-2">
          <Preview
            label="Hàng + bì"
            value={calculated ? formatWeight(calculated.gross) : "—"}
          />
          <Preview
            label="Khối lượng bì"
            value={calculated ? formatWeight(calculated.tare) : "—"}
          />
          <Preview
            label="Hao hụt tạp chất"
            value={calculated ? formatWeight(calculated.impurityWeight) : "—"}
          />
          <Preview
            label="Khối lượng sạch"
            value={calculated ? formatWeight(calculated.cleanWeight) : "—"}
            emphasis
          />
          <Preview
            label="Thành tiền"
            value={calculated ? formatMoney(calculated.amount) : "—"}
            emphasis
          />
        </View>
      </Section>

      <Section title="Thông tin bên bán hàng">
        <TwoColumns>
          <FormField
            label="Họ tên bên bán *"
            schema={requiredTextSchema}
            value={draft.sellerName}
            maxLength={200}
            onChangeText={(value) => update("sellerName", value)}
          />
          <FormField
            label="Biển số xe *"
            schema={requiredTextSchema}
            value={draft.licensePlate}
            autoCapitalize="characters"
            maxLength={30}
            onChangeText={(value) => update("licensePlate", value)}
          />
        </TwoColumns>
        <TwoColumns>
          <FormField
            label="Họ tên lái xe *"
            schema={requiredTextSchema}
            value={draft.driverName}
            maxLength={120}
            onChangeText={(value) => update("driverName", value)}
          />
          <FormField
            label="SĐT lái xe *"
            schema={compactPhoneSchema}
            value={draft.driverPhone}
            keyboardType="phone-pad"
            maxLength={20}
            onChangeText={(value) => update("driverPhone", value)}
          />
        </TwoColumns>
        <FormField
          label="CCCD lái xe *"
          schema={citizenIdSchema}
          value={draft.driverCitizenId}
          keyboardType="number-pad"
          maxLength={12}
          onChangeText={(value) => update("driverCitizenId", value)}
        />
      </Section>

      <Section title="Thông tin thanh toán">
        <TwoColumns>
          <FormField
            label="Số tài khoản"
            value={draft.bankAccountNumber}
            maxLength={50}
            onChangeText={(value) => update("bankAccountNumber", value)}
          />
          <FormField
            label="Chủ tài khoản"
            value={draft.bankAccountHolder}
            maxLength={200}
            onChangeText={(value) => update("bankAccountHolder", value)}
          />
        </TwoColumns>
        <OptionPicker
          label="Ngân hàng"
          value={draft.bankName}
          placeholder="Không chọn"
          options={catalogOptions(
            catalogs.data?.banks ?? [],
            draft.bankName,
            true,
          )}
          disabled={catalogs.isLoading}
          onChange={(value) => update("bankName", value)}
        />
      </Section>
    </ManagementSheet>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-[11px] rounded-control border border-border bg-surface-subtle p-3">
      <Text className="text-sm font-bold text-content">{title}</Text>
      {children}
    </View>
  );
}

function TwoColumns({ children }: { children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <View className="flex-row gap-2.5">
      {items.map((item, index) => (
        <View key={index} className="min-w-0 flex-1">
          {item}
        </View>
      ))}
    </View>
  );
}

function Preview({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View className={`min-h-[61px] w-[48.7%] gap-[5px] rounded-compact p-[9px] ${emphasis ? "bg-primary-soft" : "bg-surface-muted"}`}>
      <Text className="text-caption font-semibold text-content-muted">{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className={`text-body font-bold ${emphasis ? "text-primary-dark" : "text-content"}`}
      >
        {value}
      </Text>
    </View>
  );
}
