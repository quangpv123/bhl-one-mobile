import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { z } from "zod";

import {
  FormField,
  ManagementSheet,
  OptionPicker,
} from "@/components/forms/management-form";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import {
  AppButton,
  Card,
  ErrorState,
  LoadingBlock,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { permissions } from "@/features/auth/permissions";
import {
  decimalStringSchema,
  displayDateTimeSchema,
  firstZodError,
  requiredTextSchema,
} from "@/lib/validation";
import { api, getApiErrorMessage } from "@/services/api";
import type { ApiResponse } from "@/types/api";
import type {
  MaterialInventoryUnit,
  PaginatedResponse,
} from "@/types/business";
import {
  displayDateTimeToLocalIso,
  formatLocalDateTimeInput,
} from "@/utils/format";

interface MaterialOption {
  id: string;
  materialCode: string;
  materialName: string;
  unitSymbol: string;
  unitDecimalScale: number;
  trackingMode: "QR" | "QUANTITY";
  status: "ACTIVE" | "INACTIVE";
}

interface WarehouseOption {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  status: "ACTIVE" | "INACTIVE";
}

interface UserOption {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
}

interface SerialDraft {
  key: string;
  value: string;
  images: ImagePicker.ImagePickerAsset[];
}

interface IssueUnitDraft {
  unit: MaterialInventoryUnit;
  images: ImagePicker.ImagePickerAsset[];
}

interface DocumentLineDraft {
  key: string;
  materialId: string;
  quantity: string;
  images: ImagePicker.ImagePickerAsset[];
  serials: SerialDraft[];
  qrInput: string;
  units: IssueUnitDraft[];
  resolvingQr: boolean;
}

interface ReferenceData {
  materials: MaterialOption[];
  warehouses: WarehouseOption[];
}

const dateTimeLocalSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    "Ngày giờ phải theo định dạng dd-mm-yyyy HH:mm.",
  );
const positiveQuantitySchema = decimalStringSchema({
  minimum: 0.000001,
  message: "Số lượng phải lớn hơn 0.",
});
const qrQuantitySchema = decimalStringSchema({
  minimum: 1,
  maximum: 100,
  integer: true,
  message: "Số lượng QR phải là số nguyên từ 1 đến 100.",
});

function documentLinesSchema(
  materials: MaterialOption[],
  mode: "receipt" | "issue",
) {
  return z
    .array(z.custom<DocumentLineDraft>())
    .min(1, "Phiếu phải có ít nhất một dòng vật tư.")
    .superRefine((lines, context) => {
      const materialIds = lines.map((line) => line.materialId);
      if (new Set(materialIds).size !== materialIds.length) {
        context.addIssue({
          code: "custom",
          message: "Mỗi vật tư chỉ được xuất hiện một lần trong phiếu.",
        });
      }
      let imageCount = 0;
      lines.forEach((line, index) => {
        const material = materials.find((item) => item.id === line.materialId);
        if (!material) {
          context.addIssue({
            code: "custom",
            path: [index, "materialId"],
            message: "Vui lòng chọn vật tư còn khả dụng.",
          });
          return;
        }
        if (material.trackingMode === "QR") {
          if (mode === "receipt") {
            const quantityValidation = qrQuantitySchema.safeParse(
              line.quantity,
            );
            if (
              !quantityValidation.success ||
              line.serials.length !== Number(line.quantity)
            ) {
              context.addIssue({
                code: "custom",
                path: [index, "quantity"],
                message: "Số lượng QR phải là số nguyên từ 1 đến 100.",
              });
            }
            const serialValues = line.serials.map((serial) =>
              serial.value.trim(),
            );
            if (serialValues.some((value) => !value))
              context.addIssue({
                code: "custom",
                path: [index, "serials"],
                message: `${material.materialCode}: nhập đủ serial nhà sản xuất.`,
              });
            if (new Set(serialValues).size !== serialValues.length)
              context.addIssue({
                code: "custom",
                path: [index, "serials"],
                message: `${material.materialCode}: các serial không được trùng nhau.`,
              });
            line.serials.forEach((serial) => {
              imageCount += serial.images.length;
              if (!serial.images.length)
                context.addIssue({
                  code: "custom",
                  path: [index, "serials"],
                  message: `${material.materialCode} · ${serial.value || "serial"}: cần ít nhất một ảnh.`,
                });
            });
          } else {
            if (!line.units.length)
              context.addIssue({
                code: "custom",
                path: [index, "units"],
                message: `${material.materialCode}: thêm ít nhất một QR.`,
              });
            line.units.forEach((entry) => {
              imageCount += entry.images.length;
              if (!entry.images.length)
                context.addIssue({
                  code: "custom",
                  path: [index, "units"],
                  message: `${material.materialCode} · ${entry.unit.manufacturerSerial || entry.unit.qrPublicId}: cần ít nhất một ảnh.`,
                });
            });
          }
        } else {
          const quantityValidation = positiveQuantitySchema.safeParse(
            line.quantity,
          );
          if (!quantityValidation.success)
            context.addIssue({
              code: "custom",
              path: [index, "quantity"],
              message: `${material.materialCode}: số lượng phải lớn hơn 0.`,
            });
          imageCount += line.images.length;
          if (!line.images.length)
            context.addIssue({
              code: "custom",
              path: [index, "images"],
              message: `${material.materialCode}: cần ít nhất một ảnh ${mode === "receipt" ? "nhập" : "xuất"} kho.`,
            });
        }
      });
      if (imageCount > 100)
        context.addIssue({
          code: "custom",
          message: `Mỗi phiếu ${mode === "receipt" ? "nhập" : "xuất"} hỗ trợ tối đa 100 ảnh.`,
        });
    });
}

function localDateTimeValue() {
  const date = new Date();
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function createLine(): DocumentLineDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    materialId: "",
    quantity: "",
    images: [],
    serials: [],
    qrInput: "",
    units: [],
    resolvingQr: false,
  };
}

function parseQuantity(value: string) {
  return Number(value.trim().replace(",", "."));
}

function selectedMaterial(
  materials: MaterialOption[],
  line: DocumentLineDraft,
) {
  return materials.find((material) => material.id === line.materialId);
}

function normalizeQrInput(raw: string) {
  const value = raw.trim();
  try {
    const parsed = new URL(value);
    return (
      parsed.searchParams.get("qr") ||
      parsed.pathname.split("/").filter(Boolean).at(-1) ||
      value
    );
  } catch {
    return value;
  }
}

async function selectEvidence(camera: boolean, remaining: number) {
  if (remaining <= 0) {
    Alert.alert("Đã đủ ảnh", "Mỗi mặt hàng hoặc serial hỗ trợ tối đa 5 ảnh.");
    return [];
  }
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Cần quyền camera",
        "Cho phép BHL Work dùng camera để chụp ảnh vật tư.",
      );
      return [];
    }
  }
  const picker = camera
    ? ImagePicker.launchCameraAsync
    : ImagePicker.launchImageLibraryAsync;
  const result = await picker({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsEditing: false,
    ...(camera
      ? {}
      : { allowsMultipleSelection: true, selectionLimit: remaining }),
  });
  if (result.canceled) return [];
  if (result.assets.some((asset) => (asset.fileSize ?? 0) > 10 * 1024 * 1024)) {
    Alert.alert("Ảnh quá lớn", "Mỗi ảnh vật tư không được vượt quá 10 MB.");
    return [];
  }
  return result.assets.slice(0, remaining);
}

export function appendMaterialImages(
  formData: FormData,
  images: ImagePicker.ImagePickerAsset[],
  offset = 0,
  fieldName = "images",
) {
  images.forEach((image, index) => {
    formData.append(fieldName, {
      uri: image.uri,
      name: image.fileName || `evidence-${offset + index + 1}.jpg`,
      type: image.mimeType || "image/jpeg",
    } as unknown as Blob);
  });
}

export function MaterialEvidencePicker({
  images,
  disabled,
  label = "Ảnh vật tư",
  emptyText = "Cần ít nhất một ảnh.",
  onChange,
}: {
  images: ImagePicker.ImagePickerAsset[];
  disabled: boolean;
  label?: string;
  emptyText?: string;
  onChange: (images: ImagePicker.ImagePickerAsset[]) => void;
}) {
  const pick = async (camera: boolean) => {
    const next = await selectEvidence(camera, 5 - images.length);
    if (next.length) onChange([...images, ...next].slice(0, 5));
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text
          numberOfLines={1}
          className="flex-1 text-xs font-semibold text-content"
        >
          {label}
        </Text>
        <StatusBadge
          label={`${images.length}/5 ảnh`}
          tone={images.length ? "success" : "warning"}
        />
      </View>
      {images.length ? (
        <View className="flex-row flex-wrap gap-2">
          {images.map((image, index) => (
            <View key={`${image.uri}-${index}`} className="h-[68px] w-[68px]">
              <Image
                source={{ uri: image.uri }}
                className="h-[68px] w-[68px] rounded-control bg-gray-200"
              />
              <Pressable
                accessibilityLabel="Bỏ ảnh"
                disabled={disabled}
                onPress={() =>
                  onChange(
                    images.filter((_, imageIndex) => imageIndex !== index),
                  )
                }
                className="absolute right-[-6px] top-[-6px] h-[23px] w-[23px] items-center justify-center rounded-full bg-danger"
              >
                <Text className="text-[17px] leading-[19px] font-bold text-white">
                  ×
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-xs italic text-content-muted">{emptyText}</Text>
      )}
      <View className="flex-row flex-wrap gap-[7px]">
        <AppButton
          compact
          tone="secondary"
          label="Chụp ảnh"
          disabled={disabled || images.length >= 5}
          onPress={() => void pick(true)}
        />
        <AppButton
          compact
          tone="ghost"
          label="Thư viện"
          disabled={disabled || images.length >= 5}
          onPress={() => void pick(false)}
        />
      </View>
    </View>
  );
}

function useMaterialReferences() {
  return useQuery({
    queryKey: ["mobile-material-document-references"],
    queryFn: async (): Promise<ReferenceData> => {
      const [materialsResponse, warehousesResponse] = await Promise.all([
        api.get<PaginatedResponse<MaterialOption>>(
          "/material-inventory/materials",
          {
            params: { page: 1, limit: 200, status: "ACTIVE" },
          },
        ),
        api.get<PaginatedResponse<WarehouseOption>>("/material-warehouses", {
          params: { page: 1, limit: 200, status: "ACTIVE" },
        }),
      ]);
      return {
        materials: materialsResponse.data.data,
        warehouses: warehousesResponse.data.data,
      };
    },
  });
}

export function CreateMaterialReceiptSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const references = useMaterialReferences();
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [receivedAt, setReceivedAt] = useState(localDateTimeValue());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DocumentLineDraft[]>([createLine()]);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  const materials = useMemo(
    () => references.data?.materials ?? [],
    [references.data?.materials],
  );
  const materialOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: `${material.materialCode} — ${material.materialName}`,
        description:
          material.trackingMode === "QR"
            ? `Theo QR · ${material.unitSymbol}`
            : `Theo số lượng · ${material.unitSymbol}`,
      })),
    [materials],
  );
  const warehouseOptions = useMemo(
    () =>
      (references.data?.warehouses ?? []).map((warehouse) => ({
        value: warehouse.id,
        label: `${warehouse.warehouseCode} — ${warehouse.warehouseName}`,
      })),
    [references.data?.warehouses],
  );

  const updateLine = (key: string, update: Partial<DocumentLineDraft>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...update } : line)),
    );
  };

  const changeQuantity = (line: DocumentLineDraft, quantity: string) => {
    const material = selectedMaterial(materials, line);
    if (material?.trackingMode !== "QR") {
      updateLine(line.key, { quantity });
      return;
    }
    const count = Number(quantity);
    const serials =
      Number.isInteger(count) && count > 0 && count <= 100
        ? Array.from(
            { length: count },
            (_, index) =>
              line.serials[index] ?? {
                key: `${line.key}-${index}`,
                value: "",
                images: [],
              },
          )
        : [];
    updateLine(line.key, { quantity, serials });
  };

  const submit = async () => {
    const schema = z.object({
      warehouseId: requiredTextSchema,
      supplierName: z
        .string()
        .trim()
        .min(2, "Nhà cung cấp/Nguồn nhập phải có ít nhất 2 ký tự."),
      receivedAt: dateTimeLocalSchema,
      notes: z.string(),
      lines: documentLinesSchema(materials, "receipt"),
    });
    const validation = schema.safeParse({
      warehouseId,
      supplierName,
      receivedAt,
      notes,
      lines,
    });
    setValidationError(firstZodError(validation) ?? undefined);
    if (!validation.success) return;
    const images: ImagePicker.ImagePickerAsset[] = [];
    const payloadLines: Record<string, unknown>[] = [];
    for (const line of validation.data.lines) {
      const material = selectedMaterial(materials, line);
      if (!material) continue;
      const quantity = parseQuantity(line.quantity);
      if (material.trackingMode === "QR") {
        const units = line.serials.map((serial) => {
          images.push(...serial.images);
          return {
            manufacturerSerial: serial.value.trim(),
            evidenceCount: serial.images.length,
          };
        });
        payloadLines.push({ materialId: line.materialId, quantity, units });
      } else {
        images.push(...line.images);
        payloadLines.push({
          materialId: line.materialId,
          quantity,
          evidenceCount: line.images.length,
          units: [],
        });
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          warehouseId: validation.data.warehouseId,
          supplierName: validation.data.supplierName,
          receivedAt: new Date(validation.data.receivedAt).toISOString(),
          notes: validation.data.notes.trim() || undefined,
          lines: payloadLines,
        }),
      );
      appendMaterialImages(formData, images);
      await api.post("/material-inventory/receipts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await onSaved();
      Alert.alert("Thành công", "Đã khởi tạo phiếu nhập vật tư.");
    } catch (error) {
      Alert.alert("Không thể tạo phiếu nhập", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet
      title="Khởi tạo phiếu nhập"
      saveLabel="Lưu khởi tạo"
      saving={saving}
      onClose={onClose}
      onSave={() => void submit()}
    >
      {references.isLoading ? <LoadingBlock /> : null}
      {references.isError ? (
        <ErrorState
          text={getApiErrorMessage(references.error)}
          onRetry={() => void references.refetch()}
        />
      ) : null}
      {validationError ? (
        <Text className="text-caption font-medium text-danger">
          {validationError}
        </Text>
      ) : null}
      <OptionPicker
        label="Kho nhận *"
        schema={requiredTextSchema}
        value={warehouseId}
        options={warehouseOptions}
        disabled={saving}
        onChange={setWarehouseId}
      />
      <FormField
        label="Nhà cung cấp/Nguồn nhập *"
        schema={z
          .string()
          .trim()
          .min(2, "Nhà cung cấp/Nguồn nhập phải có ít nhất 2 ký tự.")}
        value={supplierName}
        editable={!saving}
        maxLength={200}
        onChangeText={setSupplierName}
      />
      <FormField
        label="Ngày giờ nhập *"
        schema={displayDateTimeSchema}
        hint="Định dạng dd-mm-yyyy HH:mm"
        value={formatLocalDateTimeInput(receivedAt)}
        editable={!saving}
        maxLength={16}
        onChangeText={(value) =>
          setReceivedAt(displayDateTimeToLocalIso(value))
        }
      />
      <Text className="mt-1 text-card font-bold text-content">
        Vật tư nhập kho
      </Text>
      {lines.map((line, lineIndex) => {
        const material = selectedMaterial(materials, line);
        return (
          <Card key={line.key} tone="soft">
            <View className="flex-row items-center justify-between gap-2.5">
              <Text className="text-[15px] font-bold text-content">
                Dòng {lineIndex + 1}
              </Text>
              {lines.length > 1 ? (
                <AppButton
                  compact
                  tone="danger-outline"
                  label="Xóa dòng"
                  onPress={() =>
                    setLines((current) =>
                      current.filter((item) => item.key !== line.key),
                    )
                  }
                />
              ) : null}
            </View>
            <View className="mt-3 gap-3">
              <OptionPicker
                label="Vật tư *"
                schema={requiredTextSchema}
                value={line.materialId}
                options={materialOptions}
                disabled={saving}
                onChange={(materialId) =>
                  updateLine(line.key, {
                    materialId,
                    quantity: "",
                    images: [],
                    serials: [],
                  })
                }
              />
              <FormField
                label={`Số lượng${material ? ` (${material.unitSymbol})` : ""} *`}
                schema={
                  material?.trackingMode === "QR"
                    ? qrQuantitySchema
                    : positiveQuantitySchema
                }
                value={line.quantity}
                editable={!saving}
                keyboardType="decimal-pad"
                onChangeText={(quantity) => changeQuantity(line, quantity)}
              />
              {material?.trackingMode === "QR"
                ? line.serials.map((serial, serialIndex) => (
                    <View
                      key={serial.key}
                      className="gap-2.5 rounded-control border border-border bg-surface p-[11px]"
                    >
                      <FormField
                        label={`Serial #${serialIndex + 1} *`}
                        schema={requiredTextSchema}
                        value={serial.value}
                        editable={!saving}
                        maxLength={150}
                        onChangeText={(value) =>
                          updateLine(line.key, {
                            serials: line.serials.map((item) =>
                              item.key === serial.key
                                ? { ...item, value }
                                : item,
                            ),
                          })
                        }
                      />
                      <MaterialEvidencePicker
                        label={
                          serial.value.trim() ||
                          `Ảnh serial #${serialIndex + 1}`
                        }
                        images={serial.images}
                        disabled={saving}
                        onChange={(nextImages) =>
                          updateLine(line.key, {
                            serials: line.serials.map((item) =>
                              item.key === serial.key
                                ? { ...item, images: nextImages }
                                : item,
                            ),
                          })
                        }
                      />
                    </View>
                  ))
                : null}
              {material?.trackingMode === "QUANTITY" ? (
                <MaterialEvidencePicker
                  images={line.images}
                  disabled={saving}
                  onChange={(images) => updateLine(line.key, { images })}
                />
              ) : null}
            </View>
          </Card>
        );
      })}
      <AppButton
        tone="secondary"
        label="Thêm dòng vật tư"
        onPress={() => setLines((current) => [...current, createLine()])}
      />
      <FormField
        label="Ghi chú"
        value={notes}
        editable={!saving}
        multiline
        maxLength={1000}
        onChangeText={setNotes}
      />
    </ManagementSheet>
  );
}

export function CreateMaterialIssueSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { user, can } = useAuth();
  const references = useMaterialReferences();
  const [warehouseId, setWarehouseId] = useState("");
  const [assigneeId, setAssigneeId] = useState(user?.id ?? "");
  const [jobCode, setJobCode] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [issuedAt, setIssuedAt] = useState(localDateTimeValue());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DocumentLineDraft[]>([createLine()]);
  const [scannerLineKey, setScannerLineKey] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  const canAssignOthers = can(permissions.materialIssuesApprove);
  const usersQuery = useQuery({
    queryKey: ["mobile-material-issue-users"],
    enabled: canAssignOthers,
    queryFn: async () =>
      (await api.get<ApiResponse<UserOption[]>>("/users/active-options")).data
        .data,
  });
  const materials = useMemo(
    () => references.data?.materials ?? [],
    [references.data?.materials],
  );
  const userOptions = canAssignOthers
    ? (usersQuery.data ?? []).map((account) => ({
        value: account.id,
        label: account.fullName,
        description: `@${account.username}`,
      }))
    : user
      ? [
          {
            value: user.id,
            label: user.fullName,
            description: `@${user.username}`,
          },
        ]
      : [];
  const materialOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: `${material.materialCode} — ${material.materialName}`,
        description:
          material.trackingMode === "QR"
            ? `Quét QR · ${material.unitSymbol}`
            : `Theo số lượng · ${material.unitSymbol}`,
      })),
    [materials],
  );
  const warehouseOptions = useMemo(
    () =>
      (references.data?.warehouses ?? []).map((warehouse) => ({
        value: warehouse.id,
        label: `${warehouse.warehouseCode} — ${warehouse.warehouseName}`,
      })),
    [references.data?.warehouses],
  );

  const updateLine = (key: string, update: Partial<DocumentLineDraft>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...update } : line)),
    );
  };

  const addQr = async (line: DocumentLineDraft, rawValue = line.qrInput) => {
    const qr = normalizeQrInput(rawValue);
    if (!warehouseId) {
      Alert.alert("Chưa chọn kho", "Chọn kho xuất trước khi thêm QR.");
      return;
    }
    if (!qr) return;
    updateLine(line.key, { resolvingQr: true });
    try {
      const unit = (
        await api.get<ApiResponse<MaterialInventoryUnit>>(
          `/material-inventory/units/qr/${encodeURIComponent(qr)}/available`,
          {
            params: { warehouseId },
          },
        )
      ).data.data;
      if (!unit.materialId || unit.materialId !== line.materialId)
        throw new Error("QR không thuộc vật tư đã chọn.");
      if (
        lines.some((item) =>
          item.units.some((entry) => entry.unit.id === unit.id),
        )
      )
        throw new Error("QR này đã có trong phiếu xuất.");
      updateLine(line.key, {
        qrInput: "",
        units: [...line.units, { unit, images: [] }],
        resolvingQr: false,
      });
    } catch (error) {
      updateLine(line.key, { resolvingQr: false });
      Alert.alert("Không thể thêm QR", getApiErrorMessage(error));
    }
  };

  const submit = async () => {
    const schema = z.object({
      warehouseId: requiredTextSchema,
      assigneeId: requiredTextSchema,
      jobCode: z.string(),
      jobAddress: z.string(),
      issuedAt: dateTimeLocalSchema,
      notes: z.string(),
      lines: documentLinesSchema(materials, "issue"),
    });
    const validation = schema.safeParse({
      warehouseId,
      assigneeId,
      jobCode,
      jobAddress,
      issuedAt,
      notes,
      lines,
    });
    setValidationError(firstZodError(validation) ?? undefined);
    if (!validation.success) return;
    const images: ImagePicker.ImagePickerAsset[] = [];
    const payloadLines: Record<string, unknown>[] = [];
    for (const line of validation.data.lines) {
      const material = selectedMaterial(materials, line);
      if (!material) continue;
      if (material.trackingMode === "QR") {
        const unitEvidence = line.units.map((entry) => {
          images.push(...entry.images);
          return { unitId: entry.unit.id, evidenceCount: entry.images.length };
        });
        payloadLines.push({
          materialId: line.materialId,
          quantity: line.units.length,
          unitIds: line.units.map((entry) => entry.unit.id),
          unitEvidence,
        });
      } else {
        const quantity = parseQuantity(line.quantity);
        images.push(...line.images);
        payloadLines.push({
          materialId: line.materialId,
          quantity,
          unitIds: [],
          evidenceCount: line.images.length,
        });
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          warehouseId: validation.data.warehouseId,
          assigneeId: validation.data.assigneeId,
          jobCode: validation.data.jobCode.trim(),
          jobAddress: validation.data.jobAddress.trim(),
          issuedAt: new Date(validation.data.issuedAt).toISOString(),
          notes: validation.data.notes.trim() || undefined,
          lines: payloadLines,
        }),
      );
      appendMaterialImages(formData, images);
      await api.post("/material-inventory/issues", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await onSaved();
      Alert.alert("Thành công", "Đã khởi tạo phiếu xuất vật tư.");
    } catch (error) {
      Alert.alert("Không thể tạo phiếu xuất", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet
      title="Khởi tạo phiếu xuất"
      saveLabel="Lưu khởi tạo"
      saving={saving}
      onClose={onClose}
      onSave={() => void submit()}
    >
      {references.isLoading ? <LoadingBlock /> : null}
      {references.isError ? (
        <ErrorState
          text={getApiErrorMessage(references.error)}
          onRetry={() => void references.refetch()}
        />
      ) : null}
      {validationError ? (
        <Text className="text-caption font-medium text-danger">
          {validationError}
        </Text>
      ) : null}
      <OptionPicker
        label="Kho xuất *"
        schema={requiredTextSchema}
        value={warehouseId}
        options={warehouseOptions}
        disabled={saving}
        onChange={(value) => {
          setWarehouseId(value);
          setLines([createLine()]);
        }}
      />
      <OptionPicker
        label="Nhân viên nhận *"
        schema={requiredTextSchema}
        value={assigneeId}
        options={userOptions}
        disabled={saving || !canAssignOthers}
        onChange={setAssigneeId}
      />
      <FormField
        label="Mã công trình/Lệnh"
        value={jobCode}
        editable={!saving}
        maxLength={100}
        onChangeText={setJobCode}
      />
      <FormField
        label="Địa chỉ công trình"
        value={jobAddress}
        editable={!saving}
        maxLength={500}
        onChangeText={setJobAddress}
      />
      <FormField
        label="Ngày giờ xuất *"
        schema={displayDateTimeSchema}
        hint="Định dạng dd-mm-yyyy HH:mm"
        value={formatLocalDateTimeInput(issuedAt)}
        editable={!saving}
        maxLength={16}
        onChangeText={(value) => setIssuedAt(displayDateTimeToLocalIso(value))}
      />
      <Text className="mt-1 text-card font-bold text-content">
        Vật tư xuất kho
      </Text>
      {lines.map((line, lineIndex) => {
        const material = selectedMaterial(materials, line);
        return (
          <Card key={line.key} tone="soft">
            <View className="flex-row items-center justify-between gap-2.5">
              <Text className="text-[15px] font-bold text-content">
                Dòng {lineIndex + 1}
              </Text>
              {lines.length > 1 ? (
                <AppButton
                  compact
                  tone="danger-outline"
                  label="Xóa dòng"
                  onPress={() =>
                    setLines((current) =>
                      current.filter((item) => item.key !== line.key),
                    )
                  }
                />
              ) : null}
            </View>
            <View className="mt-3 gap-3">
              <OptionPicker
                label="Vật tư *"
                schema={requiredTextSchema}
                value={line.materialId}
                options={materialOptions}
                disabled={saving}
                onChange={(materialId) =>
                  updateLine(line.key, {
                    materialId,
                    quantity: "",
                    images: [],
                    units: [],
                    qrInput: "",
                  })
                }
              />
              {material?.trackingMode === "QUANTITY" ? (
                <>
                  <FormField
                    label={`Số lượng (${material.unitSymbol}) *`}
                    schema={positiveQuantitySchema}
                    value={line.quantity}
                    editable={!saving}
                    keyboardType="decimal-pad"
                    onChangeText={(quantity) =>
                      updateLine(line.key, { quantity })
                    }
                  />
                  <MaterialEvidencePicker
                    images={line.images}
                    disabled={saving}
                    onChange={(images) => updateLine(line.key, { images })}
                  />
                </>
              ) : null}
              {material?.trackingMode === "QR" ? (
                <>
                  <View className="gap-[9px]">
                    <View className="flex-1">
                      <FormField
                        label="Mã QR/Serial *"
                        placeholder="Quét hoặc nhập mã QR"
                        value={line.qrInput}
                        editable={!saving && !line.resolvingQr}
                        autoCapitalize="none"
                        onChangeText={(qrInput) =>
                          updateLine(line.key, { qrInput })
                        }
                      />
                    </View>
                    <AppButton
                      compact
                      label="Thêm QR"
                      loading={line.resolvingQr}
                      disabled={!line.qrInput.trim()}
                      onPress={() => void addQr(line)}
                    />
                    <AppButton
                      compact
                      tone="secondary"
                      label="Quét QR"
                      disabled={saving || line.resolvingQr}
                      onPress={() => setScannerLineKey(line.key)}
                    />
                  </View>
                  {line.units.map((entry) => (
                    <View
                      key={entry.unit.id}
                      className="gap-2.5 rounded-control border border-border bg-surface p-[11px]"
                    >
                      <View className="flex-row items-start justify-between gap-[9px]">
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-content">
                            {entry.unit.manufacturerSerial ||
                              entry.unit.qrPublicId}
                          </Text>
                          <Text className="mt-[3px] text-caption text-primary-dark">
                            {entry.unit.qrPublicId}
                          </Text>
                        </View>
                        <AppButton
                          compact
                          tone="ghost"
                          label="Bỏ"
                          onPress={() =>
                            updateLine(line.key, {
                              units: line.units.filter(
                                (item) => item.unit.id !== entry.unit.id,
                              ),
                            })
                          }
                        />
                      </View>
                      <MaterialEvidencePicker
                        label="Ảnh xuất kho"
                        images={entry.images}
                        disabled={saving}
                        onChange={(nextImages) =>
                          updateLine(line.key, {
                            units: line.units.map((item) =>
                              item.unit.id === entry.unit.id
                                ? { ...item, images: nextImages }
                                : item,
                            ),
                          })
                        }
                      />
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          </Card>
        );
      })}
      <AppButton
        tone="secondary"
        label="Thêm dòng vật tư"
        onPress={() => setLines((current) => [...current, createLine()])}
      />
      <FormField
        label="Ghi chú"
        value={notes}
        editable={!saving}
        multiline
        maxLength={1000}
        onChangeText={setNotes}
      />
      {scannerLineKey ? (
        <QrScannerModal
          title="Quét QR để thêm vào phiếu xuất"
          onClose={() => setScannerLineKey(undefined)}
          onDetected={(value) => {
            const target = lines.find((line) => line.key === scannerLineKey);
            setScannerLineKey(undefined);
            if (target) void addQr(target, value);
          }}
        />
      ) : null}
    </ManagementSheet>
  );
}
