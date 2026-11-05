import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import {
  ActionMenu,
  AppButton,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorState,
  LoadingBlock,
  SearchField,
  StatusBadge,
} from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { PaginatedResponse } from '@/types/business';
import { formatMoney, formatNumber } from '@/utils/format';
import { pickSpreadsheet, spreadsheetFormData } from '@/utils/document-upload';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';
import { decimalStringSchema, requiredTextSchema } from '@/lib/validation';

type ActiveStatus = 'ACTIVE' | 'INACTIVE';
type TrackingMode = 'QR' | 'QUANTITY';
type UnitType = 'COUNT' | 'WEIGHT' | 'LENGTH' | 'AREA' | 'VOLUME' | 'OTHER';

interface MeasurementUnitRecord {
  id: string;
  unitCode: string;
  unitName: string;
  symbol: string;
  unitType: UnitType;
  decimalScale: number;
  materialCount: number;
  status: ActiveStatus;
}
interface MaterialRecord {
  id: string;
  materialCode: string;
  materialName: string;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  price: number;
  trackingMode: TrackingMode;
  requireManufacturerSerial: boolean;
  status: ActiveStatus;
}
interface MaterialDraft {
  materialCode: string;
  materialName: string;
  unitId: string;
  price: string;
  trackingMode: TrackingMode;
  status: ActiveStatus;
}

interface UnitDraft {
  unitCode: string;
  unitName: string;
  symbol: string;
  unitType: UnitType;
  decimalScale: string;
  status: ActiveStatus;
}

const unitTypeOptions: { value: UnitType; label: string }[] = [
  { value: 'COUNT', label: 'Đếm' },
  { value: 'WEIGHT', label: 'Khối lượng' },
  { value: 'LENGTH', label: 'Chiều dài' },
  { value: 'AREA', label: 'Diện tích' },
  { value: 'VOLUME', label: 'Thể tích' },
  { value: 'OTHER', label: 'Khác' },
];

const statusOptions = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng sử dụng' },
];

const materialPriceSchema = decimalStringSchema({
  minimum: 0,
  message: 'Đơn giá phải là số lớn hơn hoặc bằng 0.',
});
const materialDraftSchema = z.object({
  materialCode: requiredTextSchema,
  materialName: requiredTextSchema,
  unitId: requiredTextSchema,
  price: materialPriceSchema,
  trackingMode: z.enum(['QR', 'QUANTITY']),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
const decimalScaleSchema = decimalStringSchema({
  minimum: 0,
  maximum: 3,
  integer: true,
  message: 'Giá trị phải là số nguyên từ 0 đến 3.',
});
const unitDraftSchema = z.object({
  unitCode: requiredTextSchema,
  unitName: requiredTextSchema,
  symbol: requiredTextSchema,
  unitType: z.enum(['COUNT', 'WEIGHT', 'LENGTH', 'AREA', 'VOLUME', 'OTHER']),
  decimalScale: decimalScaleSchema,
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

function parseDecimal(value: string) {
  return Number(value.trim().replace(',', '.'));
}

export function MaterialsScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [trackingMode, setTrackingMode] = useState<'ALL' | TrackingMode>('ALL');
  const [editing, setEditing] = useState<MaterialRecord | null | undefined>();
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState<MaterialDraft>({
    materialCode: '',
    materialName: '',
    unitId: '',
    price: '0',
    trackingMode: 'QUANTITY',
    status: 'ACTIVE',
  });

  const query = useQuery({
    queryKey: ['mobile-material-catalog', search, trackingMode],
    queryFn: async () => (
      await api.get<PaginatedResponse<MaterialRecord>>('/material-inventory/materials', {
        params: { page: 1, limit: 100, search: search || undefined, trackingMode: trackingMode === 'ALL' ? undefined : trackingMode },
      })
    ).data,
  });
  const unitsQuery = useQuery({
    queryKey: ['mobile-measurement-unit-options'],
    queryFn: async () => (
      await api.get<PaginatedResponse<MeasurementUnitRecord>>('/material-inventory/measurement-units', {
        params: { page: 1, limit: 200 },
      })
    ).data.data,
  });
  const unitOptions = useMemo(
    () => (unitsQuery.data ?? []).map(unit => ({
      value: unit.id,
      label: `${unit.unitName} (${unit.symbol})`,
      description: unit.status === 'INACTIVE' ? 'Đã ngừng sử dụng' : unit.unitCode,
    })),
    [unitsQuery.data],
  );

  const openCreate = () => {
    setDraft({
      materialCode: '',
      materialName: '',
      unitId: unitsQuery.data?.find(unit => unit.status === 'ACTIVE')?.id ?? '',
      price: '0',
      trackingMode: 'QUANTITY',
      status: 'ACTIVE',
    });
    setEditing(null);
  };

  const openEdit = (material: MaterialRecord) => {
    setDraft({
      materialCode: material.materialCode,
      materialName: material.materialName,
      unitId: material.unitId,
      price: String(material.price),
      trackingMode: material.trackingMode,
      status: material.status,
    });
    setEditing(material);
  };

  const save = async () => {
    const validation = materialDraftSchema.safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    const price = parseDecimal(values.price);
    setSaving(true);
    try {
      const common = {
        materialName: values.materialName,
        unitId: values.unitId,
        price,
        requireManufacturerSerial: values.trackingMode === 'QR',
        status: values.status,
      };
      if (editing) await api.patch(`/material-inventory/materials/${editing.id}`, common);
      else await api.post('/material-inventory/materials', { materialCode: values.materialCode, trackingMode: values.trackingMode, ...common });
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ['mobile-material-catalog'] });
      Alert.alert('Thành công', editing ? 'Đã cập nhật vật tư.' : 'Đã thêm vật tư.');
    } catch (error) {
      Alert.alert('Không thể lưu vật tư', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const importCatalog = async () => {
    if (importing) return;
    try {
      const file = await pickSpreadsheet();
      if (!file) return;
      setImporting(true);
      const response = await api.post<ApiResponse<{
        totalCount: number;
        createdCount: number;
        updatedCount: number;
        createdUnitCount: number;
      }>>('/material-inventory/materials/import', spreadsheetFormData(file), {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      });
      await queryClient.invalidateQueries({ queryKey: ['mobile-material-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-measurement-units'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-measurement-unit-options'] });
      const result = response.data.data;
      Alert.alert(
        'Import thành công',
        `${result.totalCount} dòng: thêm ${result.createdCount}, cập nhật ${result.updatedCount}, tạo ${result.createdUnitCount} đơn vị tính.`,
      );
    } catch (error) {
      Alert.alert('Không thể import vật tư', getApiErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Screen
        title="Danh mục vật tư"
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <SearchField
              placeholder="Tìm mã hoặc tên vật tư..."
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmit={() => setSearch(searchInput.trim())}
            />
          </View>
          {can(permissions.materialsCreate) ? (
            <View className="flex-row items-center gap-[7px]">
              <AppButton compact tone="secondary" label="Import" loading={importing} onPress={() => void importCatalog()} />
              <AppButton compact label="Thêm" onPress={openCreate} />
            </View>
          ) : null}
        </View>
        <ChoiceChips
          value={trackingMode}
          options={[
            { value: 'ALL', label: 'Tất cả' },
            { value: 'QUANTITY', label: 'Theo số lượng' },
            { value: 'QR', label: 'Theo QR' },
          ]}
          onChange={setTrackingMode}
        />
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text="Chưa có vật tư phù hợp." /> : null}
        {query.data?.data.length ? (
          <Card padded={false} className="-mx-page-x overflow-hidden">
            <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-[0.65] text-caption font-semibold text-content-muted">Mã</Text>
              <Text className="min-w-0 flex-[1.25] text-caption font-semibold text-content-muted">Vật tư</Text>
              <Text className="w-[46px] shrink-0 text-caption font-semibold text-content-muted">ĐVT</Text>
              <Text className="w-[58px] shrink-0 text-caption font-semibold text-content-muted">Trạng thái</Text>
              <View className="w-[34px] shrink-0 items-end" />
            </View>
            {query.data.data.map((material, index) => (
              <View
                key={material.id}
                className={`min-h-16 flex-row items-center gap-2 px-2.5 ${index < query.data.data.length - 1 ? 'border-b border-border' : ''}`}
              >
                <Text numberOfLines={2} className="min-w-0 flex-[0.65] text-xs font-bold text-primary-dark">{material.materialCode}</Text>
                <View className="min-w-0 flex-[1.25]">
                  <Text numberOfLines={2} className="text-body font-semibold text-content">{material.materialName}</Text>
                  <Text numberOfLines={1} className="mt-0.5 text-caption text-content-muted">
                    {formatMoney(material.price)} · {material.trackingMode === 'QR' ? 'QR' : 'Số lượng'}
                  </Text>
                </View>
                <Text numberOfLines={2} className="w-[46px] shrink-0 text-xs font-semibold text-content-secondary">
                  {material.unitSymbol || material.unitName}
                </Text>
                <View className="w-[58px] shrink-0">
                  <StatusBadge
                    label={material.status === 'ACTIVE' ? 'Dùng' : 'Ngừng'}
                    tone={material.status === 'ACTIVE' ? 'success' : 'neutral'}
                  />
                </View>
                <View className="w-[34px] shrink-0 items-end">
                  {can(permissions.materialsUpdate) ? (
                    <ActionMenu
                      label={`Thao tác với ${material.materialName}`}
                      items={[{ label: 'Chỉnh sửa', onPress: () => openEdit(material) }]}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={editing ? `Cập nhật ${editing.materialCode}` : 'Thêm vật tư'}
          saveLabel="Lưu vật tư"
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void save()}
        >
          <FormField
            label="Mã vật tư *"
            schema={requiredTextSchema}
            value={draft.materialCode}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={50}
            onChangeText={materialCode => setDraft(current => ({ ...current, materialCode }))}
          />
          <FormField
            label="Tên vật tư *"
            schema={requiredTextSchema}
            value={draft.materialName}
            editable={!saving}
            maxLength={200}
            onChangeText={materialName => setDraft(current => ({ ...current, materialName }))}
          />
          <OptionPicker
            label="Đơn vị tính *"
            schema={requiredTextSchema}
            value={draft.unitId}
            options={unitOptions}
            disabled={saving}
            onChange={unitId => setDraft(current => ({ ...current, unitId }))}
          />
          <FormField
            label="Đơn giá *"
            schema={materialPriceSchema}
            value={draft.price}
            editable={!saving}
            keyboardType="decimal-pad"
            onChangeText={price => setDraft(current => ({ ...current, price }))}
          />
          <OptionPicker
            label="Cách quản lý *"
            value={draft.trackingMode}
            options={[
              { value: 'QUANTITY', label: 'Theo số lượng' },
              { value: 'QR', label: 'Theo từng QR', description: 'Bắt buộc serial nhà sản xuất khi nhập kho' },
            ]}
            disabled={Boolean(editing) || saving}
            onChange={value => setDraft(current => ({ ...current, trackingMode: value as TrackingMode }))}
          />
          {draft.trackingMode === 'QR' ? (
            <Card tone="soft">
              <Text className="text-body text-content-muted">Vật tư theo QR bắt buộc nhập serial nhà sản xuất và ảnh cho từng serial khi nhập kho.</Text>
            </Card>
          ) : null}
          {editing ? (
            <OptionPicker
              label="Trạng thái"
              value={draft.status}
              options={statusOptions}
              disabled={saving}
              onChange={value => setDraft(current => ({ ...current, status: value as ActiveStatus }))}
            />
          ) : null}
        </ManagementSheet>
      ) : null}
    </>
  );
}
export function MeasurementUnitsScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MeasurementUnitRecord | null | undefined>();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UnitDraft>({
    unitCode: '',
    unitName: '',
    symbol: '',
    unitType: 'COUNT',
    decimalScale: '0',
    status: 'ACTIVE',
  });
  const query = useQuery({
    queryKey: ['mobile-measurement-units', search],
    queryFn: async () => (
      await api.get<PaginatedResponse<MeasurementUnitRecord>>('/material-inventory/measurement-units', {
        params: { page: 1, limit: 100, search: search || undefined },
      })
    ).data,
  });
  const unitTypeLabels = useMemo(() => new Map(unitTypeOptions.map(option => [option.value, option.label])), []);

  const openCreate = () => {
    setDraft({ unitCode: '', unitName: '', symbol: '', unitType: 'COUNT', decimalScale: '0', status: 'ACTIVE' });
    setEditing(null);
  };

  const openEdit = (unit: MeasurementUnitRecord) => {
    setDraft({
      unitCode: unit.unitCode,
      unitName: unit.unitName,
      symbol: unit.symbol,
      unitType: unit.unitType,
      decimalScale: String(unit.decimalScale),
      status: unit.status,
    });
    setEditing(unit);
  };

  const save = async () => {
    const validation = unitDraftSchema.safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    const decimalScale = Number(values.decimalScale);
    setSaving(true);
    try {
      const common = { unitName: values.unitName, symbol: values.symbol, unitType: values.unitType, decimalScale, status: values.status };
      if (editing) await api.patch(`/material-inventory/measurement-units/${editing.id}`, common);
      else await api.post('/material-inventory/measurement-units', { unitCode: values.unitCode, ...common });
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ['mobile-measurement-units'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-measurement-unit-options'] });
      Alert.alert('Thành công', editing ? 'Đã cập nhật đơn vị tính.' : 'Đã thêm đơn vị tính.');
    } catch (error) {
      Alert.alert('Không thể lưu đơn vị tính', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Screen
        title="Đơn vị tính"
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <SearchField
              placeholder="Tìm mã, tên hoặc ký hiệu..."
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmit={() => setSearch(searchInput.trim())}
            />
          </View>
          {can(permissions.measurementUnitsCreate) ? <AppButton compact label="Thêm" onPress={openCreate} /> : null}
        </View>
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text="Chưa có đơn vị tính phù hợp." /> : null}
        {query.data?.data.length ? (
          <Card padded={false} className="-mx-page-x overflow-hidden">
            <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-[0.65] text-caption font-semibold text-content-muted">Mã</Text>
              <Text className="min-w-0 flex-[1.25] text-caption font-semibold text-content-muted">Đơn vị</Text>
              <Text className="w-[46px] shrink-0 text-caption font-semibold text-content-muted">Ký hiệu</Text>
              <Text className="w-[58px] shrink-0 text-caption font-semibold text-content-muted">Trạng thái</Text>
              <View className="w-[34px] shrink-0 items-end" />
            </View>
            {query.data.data.map((unit, index) => (
              <View
                key={unit.id}
                className={`min-h-16 flex-row items-center gap-2 px-2.5 ${index < query.data.data.length - 1 ? 'border-b border-border' : ''}`}
              >
                <Text numberOfLines={2} className="min-w-0 flex-[0.65] text-xs font-bold text-primary-dark">{unit.unitCode}</Text>
                <View className="min-w-0 flex-[1.25]">
                  <Text numberOfLines={2} className="text-body font-semibold text-content">{unit.unitName}</Text>
                  <Text numberOfLines={1} className="mt-0.5 text-caption text-content-muted">
                    {unitTypeLabels.get(unit.unitType) ?? unit.unitType} · {formatNumber(unit.decimalScale, 0)} số lẻ · {formatNumber(unit.materialCount, 0)} vật tư
                  </Text>
                </View>
                <Text numberOfLines={2} className="w-[46px] shrink-0 text-xs font-semibold text-content-secondary">{unit.symbol}</Text>
                <View className="w-[58px] shrink-0">
                  <StatusBadge
                    label={unit.status === 'ACTIVE' ? 'Dùng' : 'Ngừng'}
                    tone={unit.status === 'ACTIVE' ? 'success' : 'neutral'}
                  />
                </View>
                <View className="w-[34px] shrink-0 items-end">
                  {can(permissions.measurementUnitsUpdate) ? (
                    <ActionMenu
                      label={`Thao tác với ${unit.unitName}`}
                      items={[{ label: 'Chỉnh sửa', onPress: () => openEdit(unit) }]}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={editing ? `Cập nhật ${editing.unitCode}` : 'Thêm đơn vị tính'}
          saveLabel="Lưu đơn vị tính"
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void save()}
        >
          <FormField
            label="Mã đơn vị *"
            placeholder="CAI, KG, M"
            schema={requiredTextSchema}
            value={draft.unitCode}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={30}
            onChangeText={unitCode => setDraft(current => ({ ...current, unitCode }))}
          />
          <FormField
            label="Tên đơn vị *"
            schema={requiredTextSchema}
            value={draft.unitName}
            editable={!saving}
            maxLength={100}
            onChangeText={unitName => setDraft(current => ({ ...current, unitName }))}
          />
          <FormField
            label="Ký hiệu *"
            schema={requiredTextSchema}
            value={draft.symbol}
            editable={!saving}
            maxLength={30}
            onChangeText={symbol => setDraft(current => ({ ...current, symbol }))}
          />
          <FormField
            label="Phần thập phân *"
            schema={decimalScaleSchema}
            hint="0 nếu chỉ cho phép số nguyên; tối đa 3 chữ số sau dấu thập phân."
            value={draft.decimalScale}
            editable={!saving}
            keyboardType="number-pad"
            maxLength={1}
            onChangeText={decimalScale => setDraft(current => ({ ...current, decimalScale }))}
          />
          <OptionPicker
            label="Nhóm đơn vị *"
            value={draft.unitType}
            options={unitTypeOptions}
            disabled={saving}
            onChange={value => setDraft(current => ({ ...current, unitType: value as UnitType }))}
          />
          {editing ? (
            <OptionPicker
              label="Trạng thái"
              value={draft.status}
              options={statusOptions}
              disabled={saving}
              onChange={value => setDraft(current => ({ ...current, status: value as ActiveStatus }))}
            />
          ) : null}
        </ManagementSheet>
      ) : null}
    </>
  );
}
