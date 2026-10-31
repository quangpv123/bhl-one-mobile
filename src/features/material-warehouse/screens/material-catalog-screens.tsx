import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  AppButton,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorState,
  InfoRow,
  LoadingBlock,
  SearchField,
  StatusBadge,
} from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { PaginatedResponse } from '@/types/business';
import { formatMoney, formatNumber } from '@/utils/format';
import { pickSpreadsheet, spreadsheetFormData } from '@/utils/document-upload';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';

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

function parseDecimal(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function ActiveBadge({ status }: { status: ActiveStatus }) {
  return (
    <StatusBadge
      label={status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng sử dụng'}
      tone={status === 'ACTIVE' ? 'success' : 'neutral'}
    />
  );
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
    const code = draft.materialCode.trim();
    const name = draft.materialName.trim();
    const price = parseDecimal(draft.price);
    if ((!editing && !code) || !name || !draft.unitId) {
      Alert.alert('Thiếu thông tin', 'Nhập mã, tên vật tư và chọn đơn vị tính.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Đơn giá chưa hợp lệ', 'Đơn giá phải là số lớn hơn hoặc bằng 0.');
      return;
    }
    setSaving(true);
    try {
      const common = {
        materialName: name,
        unitId: draft.unitId,
        price,
        requireManufacturerSerial: draft.trackingMode === 'QR',
        status: draft.status,
      };
      if (editing) await api.patch(`/material-inventory/materials/${editing.id}`, common);
      else await api.post('/material-inventory/materials', { materialCode: code, trackingMode: draft.trackingMode, ...common });
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
        subtitle="Mã, đơn vị tính, giá và phương thức theo dõi"
        action={can(permissions.materialsCreate) ? (
          <View style={styles.headerActions}>
            <AppButton compact tone="secondary" label="Import" loading={importing} onPress={() => void importCatalog()} />
            <AppButton compact label="Thêm" onPress={openCreate} />
          </View>
        ) : undefined}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <SearchField
          placeholder="Tìm mã hoặc tên vật tư..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
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
        {query.data?.data.map(material => (
          <Card key={material.id}>
            <View style={styles.heading}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{material.materialName}</Text>
                <Text style={styles.code}>{material.materialCode}</Text>
              </View>
              <ActiveBadge status={material.status} />
            </View>
            <View style={styles.rows}>
              <InfoRow label="Đơn vị" value={`${material.unitName} (${material.unitSymbol})`} />
              <InfoRow label="Đơn giá" value={formatMoney(material.price)} emphasize />
              <InfoRow label="Theo dõi" value={material.trackingMode === 'QR' ? 'Theo QR từng vật tư' : 'Theo số lượng'} />
              <InfoRow label="Serial NSX" value={material.requireManufacturerSerial ? 'Bắt buộc' : 'Không bắt buộc'} />
            </View>
            {can(permissions.materialsUpdate) ? (
              <View style={styles.actions}>
                <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(material)} />
              </View>
            ) : null}
          </Card>
        ))}
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
            value={draft.materialCode}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={50}
            onChangeText={materialCode => setDraft(current => ({ ...current, materialCode }))}
          />
          <FormField
            label="Tên vật tư *"
            value={draft.materialName}
            editable={!saving}
            maxLength={200}
            onChangeText={materialName => setDraft(current => ({ ...current, materialName }))}
          />
          <OptionPicker
            label="Đơn vị tính *"
            value={draft.unitId}
            options={unitOptions}
            disabled={saving}
            onChange={unitId => setDraft(current => ({ ...current, unitId }))}
          />
          <FormField
            label="Đơn giá *"
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
              <Text style={styles.helper}>Vật tư theo QR bắt buộc nhập serial nhà sản xuất và ảnh cho từng serial khi nhập kho.</Text>
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
    const code = draft.unitCode.trim();
    const name = draft.unitName.trim();
    const symbol = draft.symbol.trim();
    const decimalScale = Number(draft.decimalScale);
    if ((!editing && !code) || !name || !symbol) {
      Alert.alert('Thiếu thông tin', 'Nhập mã, tên và ký hiệu đơn vị.');
      return;
    }
    if (!Number.isInteger(decimalScale) || decimalScale < 0 || decimalScale > 3) {
      Alert.alert('Phần thập phân chưa hợp lệ', 'Giá trị phải là số nguyên từ 0 đến 3.');
      return;
    }
    setSaving(true);
    try {
      const common = { unitName: name, symbol, unitType: draft.unitType, decimalScale, status: draft.status };
      if (editing) await api.patch(`/material-inventory/measurement-units/${editing.id}`, common);
      else await api.post('/material-inventory/measurement-units', { unitCode: code, ...common });
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
        subtitle="Đơn vị và độ chính xác số lượng"
        action={can(permissions.measurementUnitsCreate) ? <AppButton compact label="Thêm" onPress={openCreate} /> : undefined}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <SearchField
          placeholder="Tìm mã, tên hoặc ký hiệu..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text="Chưa có đơn vị tính phù hợp." /> : null}
        {query.data?.data.map(unit => (
          <Card key={unit.id}>
            <View style={styles.heading}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{unit.unitName}</Text>
                <Text style={styles.code}>{unit.unitCode} · {unit.symbol}</Text>
              </View>
              <ActiveBadge status={unit.status} />
            </View>
            <View style={styles.rows}>
              <InfoRow label="Nhóm" value={unitTypeLabels.get(unit.unitType) ?? unit.unitType} />
              <InfoRow label="Số lẻ tối đa" value={formatNumber(unit.decimalScale, 0)} />
              <InfoRow label="Số vật tư" value={formatNumber(unit.materialCount, 0)} />
            </View>
            {can(permissions.measurementUnitsUpdate) ? (
              <View style={styles.actions}>
                <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(unit)} />
              </View>
            ) : null}
          </Card>
        ))}
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
            value={draft.unitCode}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={30}
            onChangeText={unitCode => setDraft(current => ({ ...current, unitCode }))}
          />
          <FormField
            label="Tên đơn vị *"
            value={draft.unitName}
            editable={!saving}
            maxLength={100}
            onChangeText={unitName => setDraft(current => ({ ...current, unitName }))}
          />
          <FormField
            label="Ký hiệu *"
            value={draft.symbol}
            editable={!saving}
            maxLength={30}
            onChangeText={symbol => setDraft(current => ({ ...current, symbol }))}
          />
          <FormField
            label="Phần thập phân *"
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

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: ui.gap },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  code: { color: colors.primaryDark, fontSize: 13, fontWeight: '800', marginTop: 4 },
  rows: { marginTop: 10 },
  actions: { marginTop: 13, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
