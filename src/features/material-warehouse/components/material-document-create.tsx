import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, ErrorState, LoadingBlock, StatusBadge } from '@/components/ui';
import { QrScannerModal } from '@/components/qr-scanner-modal';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { MaterialInventoryUnit, PaginatedResponse } from '@/types/business';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';

interface MaterialOption {
  id: string;
  materialCode: string;
  materialName: string;
  unitSymbol: string;
  unitDecimalScale: number;
  trackingMode: 'QR' | 'QUANTITY';
  status: 'ACTIVE' | 'INACTIVE';
}

interface WarehouseOption {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  status: 'ACTIVE' | 'INACTIVE';
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

function localDateTimeValue() {
  const date = new Date();
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function createLine(): DocumentLineDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    materialId: '',
    quantity: '',
    images: [],
    serials: [],
    qrInput: '',
    units: [],
    resolvingQr: false,
  };
}

function parseQuantity(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function selectedMaterial(materials: MaterialOption[], line: DocumentLineDraft) {
  return materials.find(material => material.id === line.materialId);
}

function normalizeQrInput(raw: string) {
  const value = raw.trim();
  try {
    const parsed = new URL(value);
    return parsed.searchParams.get('qr') || parsed.pathname.split('/').filter(Boolean).at(-1) || value;
  } catch {
    return value;
  }
}

async function selectEvidence(camera: boolean, remaining: number) {
  if (remaining <= 0) {
    Alert.alert('Đã đủ ảnh', 'Mỗi mặt hàng hoặc serial hỗ trợ tối đa 5 ảnh.');
    return [];
  }
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền camera', 'Cho phép BHL One dùng camera để chụp ảnh vật tư.');
      return [];
    }
  }
  const picker = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await picker({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
    ...(camera ? {} : { allowsMultipleSelection: true, selectionLimit: remaining }),
  });
  if (result.canceled) return [];
  if (result.assets.some(asset => (asset.fileSize ?? 0) > 10 * 1024 * 1024)) {
    Alert.alert('Ảnh quá lớn', 'Mỗi ảnh vật tư không được vượt quá 10 MB.');
    return [];
  }
  return result.assets.slice(0, remaining);
}

export function appendMaterialImages(
  formData: FormData,
  images: ImagePicker.ImagePickerAsset[],
  offset = 0,
  fieldName = 'images',
) {
  images.forEach((image, index) => {
    formData.append(fieldName, {
      uri: image.uri,
      name: image.fileName || `evidence-${offset + index + 1}.jpg`,
      type: image.mimeType || 'image/jpeg',
    } as unknown as Blob);
  });
}

export function MaterialEvidencePicker({
  images,
  disabled,
  label = 'Ảnh vật tư',
  emptyText = 'Cần ít nhất một ảnh.',
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
    <View style={styles.evidenceBlock}>
      <View style={styles.evidenceHeading}>
        <Text numberOfLines={1} style={styles.evidenceLabel}>{label}</Text>
        <StatusBadge label={`${images.length}/5 ảnh`} tone={images.length ? 'success' : 'warning'} />
      </View>
      {images.length ? (
        <View style={styles.thumbnails}>
          {images.map((image, index) => (
            <View key={`${image.uri}-${index}`} style={styles.thumbnailWrap}>
              <Image source={{ uri: image.uri }} style={styles.thumbnail} />
              <Pressable
                accessibilityLabel="Bỏ ảnh"
                disabled={disabled}
                onPress={() => onChange(images.filter((_, imageIndex) => imageIndex !== index))}
                style={styles.removeImage}
              >
                <Text style={styles.removeImageText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : <Text style={styles.evidenceEmpty}>{emptyText}</Text>}
      <View style={styles.inlineActions}>
        <AppButton compact tone="secondary" label="Chụp ảnh" disabled={disabled || images.length >= 5} onPress={() => void pick(true)} />
        <AppButton compact tone="ghost" label="Thư viện" disabled={disabled || images.length >= 5} onPress={() => void pick(false)} />
      </View>
    </View>
  );
}

function useMaterialReferences() {
  return useQuery({
    queryKey: ['mobile-material-document-references'],
    queryFn: async (): Promise<ReferenceData> => {
      const [materialsResponse, warehousesResponse] = await Promise.all([
        api.get<PaginatedResponse<MaterialOption>>('/material-inventory/materials', {
          params: { page: 1, limit: 200, status: 'ACTIVE' },
        }),
        api.get<PaginatedResponse<WarehouseOption>>('/material-warehouses', {
          params: { page: 1, limit: 200, status: 'ACTIVE' },
        }),
      ]);
      return { materials: materialsResponse.data.data, warehouses: warehousesResponse.data.data };
    },
  });
}

export function CreateMaterialReceiptSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const references = useMaterialReferences();
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [receivedAt, setReceivedAt] = useState(localDateTimeValue());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DocumentLineDraft[]>([createLine()]);
  const [saving, setSaving] = useState(false);
  const materials = useMemo(() => references.data?.materials ?? [], [references.data?.materials]);
  const materialOptions = useMemo(() => materials.map(material => ({
    value: material.id,
    label: `${material.materialCode} — ${material.materialName}`,
    description: material.trackingMode === 'QR' ? `Theo QR · ${material.unitSymbol}` : `Theo số lượng · ${material.unitSymbol}`,
  })), [materials]);
  const warehouseOptions = useMemo(() => (references.data?.warehouses ?? []).map(warehouse => ({
    value: warehouse.id,
    label: `${warehouse.warehouseCode} — ${warehouse.warehouseName}`,
  })), [references.data?.warehouses]);

  const updateLine = (key: string, update: Partial<DocumentLineDraft>) => {
    setLines(current => current.map(line => line.key === key ? { ...line, ...update } : line));
  };

  const changeQuantity = (line: DocumentLineDraft, quantity: string) => {
    const material = selectedMaterial(materials, line);
    if (material?.trackingMode !== 'QR') {
      updateLine(line.key, { quantity });
      return;
    }
    const count = Number(quantity);
    const serials = Number.isInteger(count) && count > 0 && count <= 100
      ? Array.from({ length: count }, (_, index) => line.serials[index] ?? { key: `${line.key}-${index}`, value: '', images: [] })
      : [];
    updateLine(line.key, { quantity, serials });
  };

  const submit = async () => {
    if (!warehouseId || supplierName.trim().length < 2 || !receivedAt) {
      Alert.alert('Thiếu thông tin', 'Chọn kho nhận, nhập nhà cung cấp và ngày giờ nhập.');
      return;
    }
    if (!lines.length || lines.some(line => !line.materialId)) {
      Alert.alert('Thiếu vật tư', 'Mỗi dòng phải chọn một vật tư.');
      return;
    }
    if (new Set(lines.map(line => line.materialId)).size !== lines.length) {
      Alert.alert('Vật tư bị trùng', 'Mỗi vật tư chỉ nên xuất hiện một lần trong phiếu.');
      return;
    }
    const images: ImagePicker.ImagePickerAsset[] = [];
    const payloadLines: Record<string, unknown>[] = [];
    try {
      for (const line of lines) {
        const material = selectedMaterial(materials, line);
        if (!material) throw new Error('Có dòng vật tư không còn khả dụng.');
        const quantity = parseQuantity(line.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`${material.materialCode}: số lượng phải lớn hơn 0.`);
        if (material.trackingMode === 'QR') {
          if (!Number.isInteger(quantity) || quantity > 100 || line.serials.length !== quantity) {
            throw new Error(`${material.materialCode}: số lượng QR phải là số nguyên từ 1 đến 100.`);
          }
          const serialValues = line.serials.map(serial => serial.value.trim());
          if (serialValues.some(serial => !serial)) throw new Error(`${material.materialCode}: nhập đủ serial nhà sản xuất.`);
          if (new Set(serialValues).size !== serialValues.length) throw new Error(`${material.materialCode}: các serial không được trùng nhau.`);
          const units = line.serials.map(serial => {
            if (!serial.images.length) throw new Error(`${material.materialCode} · ${serial.value}: cần ít nhất một ảnh.`);
            images.push(...serial.images);
            return { manufacturerSerial: serial.value.trim(), evidenceCount: serial.images.length };
          });
          payloadLines.push({ materialId: line.materialId, quantity, units });
        } else {
          if (!line.images.length) throw new Error(`${material.materialCode}: cần ít nhất một ảnh nhập kho.`);
          images.push(...line.images);
          payloadLines.push({ materialId: line.materialId, quantity, evidenceCount: line.images.length, units: [] });
        }
      }
      if (images.length > 100) throw new Error('Mỗi phiếu nhập hỗ trợ tối đa 100 ảnh.');
    } catch (error) {
      Alert.alert('Phiếu nhập chưa hợp lệ', error instanceof Error ? error.message : String(error));
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('payload', JSON.stringify({
        warehouseId,
        supplierName: supplierName.trim(),
        receivedAt: new Date(receivedAt).toISOString(),
        notes: notes.trim() || undefined,
        lines: payloadLines,
      }));
      appendMaterialImages(formData, images);
      await api.post('/material-inventory/receipts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await onSaved();
      Alert.alert('Thành công', 'Đã khởi tạo phiếu nhập vật tư.');
    } catch (error) {
      Alert.alert('Không thể tạo phiếu nhập', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet title="Khởi tạo phiếu nhập" saveLabel="Lưu khởi tạo" saving={saving} onClose={onClose} onSave={() => void submit()}>
      {references.isLoading ? <LoadingBlock /> : null}
      {references.isError ? <ErrorState text={getApiErrorMessage(references.error)} onRetry={() => void references.refetch()} /> : null}
      <OptionPicker label="Kho nhận *" value={warehouseId} options={warehouseOptions} disabled={saving} onChange={setWarehouseId} />
      <FormField label="Nhà cung cấp/Nguồn nhập *" value={supplierName} editable={!saving} maxLength={200} onChangeText={setSupplierName} />
      <FormField label="Ngày giờ nhập *" hint="Định dạng YYYY-MM-DDTHH:mm" value={receivedAt} editable={!saving} maxLength={16} onChangeText={setReceivedAt} />
      <Text style={styles.sectionTitle}>Vật tư nhập kho</Text>
      {lines.map((line, lineIndex) => {
        const material = selectedMaterial(materials, line);
        return (
          <Card key={line.key} tone="soft">
            <View style={styles.lineHeading}>
              <Text style={styles.lineTitle}>Dòng {lineIndex + 1}</Text>
              {lines.length > 1 ? <AppButton compact tone="ghost" label="Xóa dòng" onPress={() => setLines(current => current.filter(item => item.key !== line.key))} /> : null}
            </View>
            <View style={styles.lineFields}>
              <OptionPicker
                label="Vật tư *"
                value={line.materialId}
                options={materialOptions}
                disabled={saving}
                onChange={materialId => updateLine(line.key, { materialId, quantity: '', images: [], serials: [] })}
              />
              <FormField
                label={`Số lượng${material ? ` (${material.unitSymbol})` : ''} *`}
                value={line.quantity}
                editable={!saving}
                keyboardType="decimal-pad"
                onChangeText={quantity => changeQuantity(line, quantity)}
              />
              {material?.trackingMode === 'QR' ? line.serials.map((serial, serialIndex) => (
                <View key={serial.key} style={styles.serialBlock}>
                  <FormField
                    label={`Serial #${serialIndex + 1} *`}
                    value={serial.value}
                    editable={!saving}
                    maxLength={150}
                    onChangeText={value => updateLine(line.key, {
                      serials: line.serials.map(item => item.key === serial.key ? { ...item, value } : item),
                    })}
                  />
                  <MaterialEvidencePicker
                    label={serial.value.trim() || `Ảnh serial #${serialIndex + 1}`}
                    images={serial.images}
                    disabled={saving}
                    onChange={nextImages => updateLine(line.key, {
                      serials: line.serials.map(item => item.key === serial.key ? { ...item, images: nextImages } : item),
                    })}
                  />
                </View>
              )) : null}
              {material?.trackingMode === 'QUANTITY' ? (
                <MaterialEvidencePicker images={line.images} disabled={saving} onChange={images => updateLine(line.key, { images })} />
              ) : null}
            </View>
          </Card>
        );
      })}
      <AppButton tone="secondary" label="Thêm dòng vật tư" onPress={() => setLines(current => [...current, createLine()])} />
      <FormField label="Ghi chú" value={notes} editable={!saving} multiline maxLength={1000} onChangeText={setNotes} />
    </ManagementSheet>
  );
}

export function CreateMaterialIssueSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { user, can } = useAuth();
  const references = useMaterialReferences();
  const [warehouseId, setWarehouseId] = useState('');
  const [assigneeId, setAssigneeId] = useState(user?.id ?? '');
  const [jobCode, setJobCode] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [issuedAt, setIssuedAt] = useState(localDateTimeValue());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DocumentLineDraft[]>([createLine()]);
  const [scannerLineKey, setScannerLineKey] = useState<string>();
  const [saving, setSaving] = useState(false);
  const canAssignOthers = can(permissions.materialIssuesApprove);
  const usersQuery = useQuery({
    queryKey: ['mobile-material-issue-users'],
    enabled: canAssignOthers,
    queryFn: async () => (await api.get<ApiResponse<UserOption[]>>('/users/active-options')).data.data,
  });
  const materials = useMemo(() => references.data?.materials ?? [], [references.data?.materials]);
  const userOptions = canAssignOthers
    ? (usersQuery.data ?? []).map(account => ({ value: account.id, label: account.fullName, description: `@${account.username}` }))
    : user ? [{ value: user.id, label: user.fullName, description: `@${user.username}` }] : [];
  const materialOptions = useMemo(() => materials.map(material => ({
    value: material.id,
    label: `${material.materialCode} — ${material.materialName}`,
    description: material.trackingMode === 'QR' ? `Quét QR · ${material.unitSymbol}` : `Theo số lượng · ${material.unitSymbol}`,
  })), [materials]);
  const warehouseOptions = useMemo(() => (references.data?.warehouses ?? []).map(warehouse => ({
    value: warehouse.id,
    label: `${warehouse.warehouseCode} — ${warehouse.warehouseName}`,
  })), [references.data?.warehouses]);

  const updateLine = (key: string, update: Partial<DocumentLineDraft>) => {
    setLines(current => current.map(line => line.key === key ? { ...line, ...update } : line));
  };

  const addQr = async (line: DocumentLineDraft, rawValue = line.qrInput) => {
    const qr = normalizeQrInput(rawValue);
    if (!warehouseId) {
      Alert.alert('Chưa chọn kho', 'Chọn kho xuất trước khi thêm QR.');
      return;
    }
    if (!qr) return;
    updateLine(line.key, { resolvingQr: true });
    try {
      const unit = (
        await api.get<ApiResponse<MaterialInventoryUnit>>(`/material-inventory/units/qr/${encodeURIComponent(qr)}/available`, {
          params: { warehouseId },
        })
      ).data.data;
      if (!unit.materialId || unit.materialId !== line.materialId) throw new Error('QR không thuộc vật tư đã chọn.');
      if (lines.some(item => item.units.some(entry => entry.unit.id === unit.id))) throw new Error('QR này đã có trong phiếu xuất.');
      updateLine(line.key, { qrInput: '', units: [...line.units, { unit, images: [] }], resolvingQr: false });
    } catch (error) {
      updateLine(line.key, { resolvingQr: false });
      Alert.alert('Không thể thêm QR', getApiErrorMessage(error));
    }
  };

  const submit = async () => {
    if (!warehouseId || !assigneeId || !issuedAt) {
      Alert.alert('Thiếu thông tin', 'Chọn kho xuất, người nhận và ngày giờ xuất.');
      return;
    }
    if (!lines.length || lines.some(line => !line.materialId)) {
      Alert.alert('Thiếu vật tư', 'Mỗi dòng phải chọn một vật tư.');
      return;
    }
    if (new Set(lines.map(line => line.materialId)).size !== lines.length) {
      Alert.alert('Vật tư bị trùng', 'Mỗi vật tư chỉ nên xuất hiện một lần trong phiếu.');
      return;
    }
    const images: ImagePicker.ImagePickerAsset[] = [];
    const payloadLines: Record<string, unknown>[] = [];
    try {
      for (const line of lines) {
        const material = selectedMaterial(materials, line);
        if (!material) throw new Error('Có dòng vật tư không còn khả dụng.');
        if (material.trackingMode === 'QR') {
          if (!line.units.length) throw new Error(`${material.materialCode}: thêm ít nhất một QR.`);
          const unitEvidence = line.units.map(entry => {
            if (!entry.images.length) throw new Error(`${material.materialCode} · ${entry.unit.manufacturerSerial || entry.unit.qrPublicId}: cần ít nhất một ảnh.`);
            images.push(...entry.images);
            return { unitId: entry.unit.id, evidenceCount: entry.images.length };
          });
          payloadLines.push({
            materialId: line.materialId,
            quantity: line.units.length,
            unitIds: line.units.map(entry => entry.unit.id),
            unitEvidence,
          });
        } else {
          const quantity = parseQuantity(line.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`${material.materialCode}: số lượng phải lớn hơn 0.`);
          if (!line.images.length) throw new Error(`${material.materialCode}: cần ít nhất một ảnh xuất kho.`);
          images.push(...line.images);
          payloadLines.push({ materialId: line.materialId, quantity, unitIds: [], evidenceCount: line.images.length });
        }
      }
      if (images.length > 100) throw new Error('Mỗi phiếu xuất hỗ trợ tối đa 100 ảnh.');
    } catch (error) {
      Alert.alert('Phiếu xuất chưa hợp lệ', error instanceof Error ? error.message : String(error));
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('payload', JSON.stringify({
        warehouseId,
        assigneeId,
        jobCode: jobCode.trim(),
        jobAddress: jobAddress.trim(),
        issuedAt: new Date(issuedAt).toISOString(),
        notes: notes.trim() || undefined,
        lines: payloadLines,
      }));
      appendMaterialImages(formData, images);
      await api.post('/material-inventory/issues', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await onSaved();
      Alert.alert('Thành công', 'Đã khởi tạo phiếu xuất vật tư.');
    } catch (error) {
      Alert.alert('Không thể tạo phiếu xuất', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet title="Khởi tạo phiếu xuất" saveLabel="Lưu khởi tạo" saving={saving} onClose={onClose} onSave={() => void submit()}>
      {references.isLoading ? <LoadingBlock /> : null}
      {references.isError ? <ErrorState text={getApiErrorMessage(references.error)} onRetry={() => void references.refetch()} /> : null}
      <OptionPicker
        label="Kho xuất *"
        value={warehouseId}
        options={warehouseOptions}
        disabled={saving}
        onChange={value => { setWarehouseId(value); setLines([createLine()]); }}
      />
      <OptionPicker label="Nhân viên nhận *" value={assigneeId} options={userOptions} disabled={saving || !canAssignOthers} onChange={setAssigneeId} />
      <FormField label="Mã công trình/Lệnh" value={jobCode} editable={!saving} maxLength={100} onChangeText={setJobCode} />
      <FormField label="Địa chỉ công trình" value={jobAddress} editable={!saving} maxLength={500} onChangeText={setJobAddress} />
      <FormField label="Ngày giờ xuất *" hint="Định dạng YYYY-MM-DDTHH:mm" value={issuedAt} editable={!saving} maxLength={16} onChangeText={setIssuedAt} />
      <Text style={styles.sectionTitle}>Vật tư xuất kho</Text>
      {lines.map((line, lineIndex) => {
        const material = selectedMaterial(materials, line);
        return (
          <Card key={line.key} tone="soft">
            <View style={styles.lineHeading}>
              <Text style={styles.lineTitle}>Dòng {lineIndex + 1}</Text>
              {lines.length > 1 ? <AppButton compact tone="ghost" label="Xóa dòng" onPress={() => setLines(current => current.filter(item => item.key !== line.key))} /> : null}
            </View>
            <View style={styles.lineFields}>
              <OptionPicker
                label="Vật tư *"
                value={line.materialId}
                options={materialOptions}
                disabled={saving}
                onChange={materialId => updateLine(line.key, { materialId, quantity: '', images: [], units: [], qrInput: '' })}
              />
              {material?.trackingMode === 'QUANTITY' ? (
                <>
                  <FormField
                    label={`Số lượng (${material.unitSymbol}) *`}
                    value={line.quantity}
                    editable={!saving}
                    keyboardType="decimal-pad"
                    onChangeText={quantity => updateLine(line.key, { quantity })}
                  />
                  <MaterialEvidencePicker images={line.images} disabled={saving} onChange={images => updateLine(line.key, { images })} />
                </>
              ) : null}
              {material?.trackingMode === 'QR' ? (
                <>
                  <View style={styles.qrRow}>
                    <View style={styles.qrInput}>
                      <FormField
                        label="Mã QR/Serial *"
                        placeholder="Quét hoặc nhập mã QR"
                        value={line.qrInput}
                        editable={!saving && !line.resolvingQr}
                        autoCapitalize="none"
                        onChangeText={qrInput => updateLine(line.key, { qrInput })}
                      />
                    </View>
                    <AppButton compact label="Thêm QR" loading={line.resolvingQr} disabled={!line.qrInput.trim()} onPress={() => void addQr(line)} />
                    <AppButton compact tone="secondary" label="Quét QR" disabled={saving || line.resolvingQr} onPress={() => setScannerLineKey(line.key)} />
                  </View>
                  {line.units.map(entry => (
                    <View key={entry.unit.id} style={styles.serialBlock}>
                      <View style={styles.unitHeading}>
                        <View style={styles.titleWrap}>
                          <Text style={styles.unitTitle}>{entry.unit.manufacturerSerial || entry.unit.qrPublicId}</Text>
                          <Text style={styles.unitCode}>{entry.unit.qrPublicId}</Text>
                        </View>
                        <AppButton compact tone="ghost" label="Bỏ" onPress={() => updateLine(line.key, { units: line.units.filter(item => item.unit.id !== entry.unit.id) })} />
                      </View>
                      <MaterialEvidencePicker
                        label="Ảnh xuất kho"
                        images={entry.images}
                        disabled={saving}
                        onChange={nextImages => updateLine(line.key, {
                          units: line.units.map(item => item.unit.id === entry.unit.id ? { ...item, images: nextImages } : item),
                        })}
                      />
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          </Card>
        );
      })}
      <AppButton tone="secondary" label="Thêm dòng vật tư" onPress={() => setLines(current => [...current, createLine()])} />
      <FormField label="Ghi chú" value={notes} editable={!saving} multiline maxLength={1000} onChangeText={setNotes} />
      {scannerLineKey ? (
        <QrScannerModal
          title="Quét QR để thêm vào phiếu xuất"
          onClose={() => setScannerLineKey(undefined)}
          onDetected={value => {
            const target = lines.find(line => line.key === scannerLineKey);
            setScannerLineKey(undefined);
            if (target) void addQr(target, value);
          }}
        />
      ) : null}
    </ManagementSheet>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  lineHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  lineTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  lineFields: { marginTop: 12, gap: 12 },
  serialBlock: { padding: 11, borderRadius: ui.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 },
  evidenceBlock: { gap: 8 },
  evidenceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  evidenceLabel: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  evidenceEmpty: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbnailWrap: { width: 68, height: 68 },
  thumbnail: { width: 68, height: 68, borderRadius: 10, backgroundColor: '#E4E7EC' },
  removeImage: { position: 'absolute', top: -6, right: -6, width: 23, height: 23, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  removeImageText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', lineHeight: 19 },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  qrRow: { gap: 9 },
  qrInput: { flex: 1 },
  unitHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 9 },
  titleWrap: { flex: 1 },
  unitTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  unitCode: { color: colors.primaryDark, fontSize: 11, marginTop: 3 },
});
