import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import { ManagerContact } from '@/components/manager-contact';
import {
  ActionMenu,
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
import { api, getApiErrorMessage, hasProtectedApiSession } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { PaginatedResponse } from '@/types/business';
import { pickSpreadsheet, spreadsheetFormData } from '@/utils/document-upload';
import { displayDateToIso, formatDate, formatNumber } from '@/utils/format';
import { shareProtectedApiFile } from '@/utils/protected-file';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';
import { decimalStringSchema, displayDateSchema, isoDateSchema, requiredTextSchema } from '@/lib/validation';

type ActiveStatus = 'ACTIVE' | 'INACTIVE';

interface VehicleRecord {
  id: string;
  licensePlate: string;
  vehicleTypeId: string;
  vehicleTypeCode: string;
  vehicleTypeName: string;
  payloadCapacityTons: number | null;
  brand: string | null;
  ownerName: string | null;
  registrationExpiry: string | null;
  managerUserId: string | null;
  managerUsername: string | null;
  managerFullName: string | null;
  managerPhone: string | null;
  status: ActiveStatus;
}
interface VehicleTypeRecord {
  id: string;
  vehicleTypeCode: string;
  vehicleTypeName: string;
  status: ActiveStatus;
}
interface ActiveUserOption {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
}

interface VehicleDraft {
  licensePlate: string;
  vehicleTypeId: string;
  payloadCapacityTons: string;
  brand: string;
  ownerName: string;
  registrationExpiry: string;
  managerUserId: string;
  status: ActiveStatus;
}

interface AdministrativeUnitRecord {
  id: string;
  provinceCode: string;
  provinceName: string;
  communeCode?: string;
  communeName?: string;
  divisionType: string;
  source: string;
  status: ActiveStatus;
}

interface AdministrativeDraft {
  code: string;
  name: string;
  provinceCode: string;
  status: ActiveStatus;
}

const statusOptions = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Tạm dừng' },
];

const optionalPayloadSchema = z.union([
  z.literal(''),
  decimalStringSchema({ minimum: 0.000001, maximum: 1000, message: 'Tải trọng phải lớn hơn 0 và không vượt quá 1.000 tấn.' }),
]);
const optionalIsoDateSchema = z.union([z.literal(''), isoDateSchema]);
const optionalDisplayDateSchema = z.union([z.literal(''), displayDateSchema]);
const vehicleDraftSchema = z.object({
  licensePlate: requiredTextSchema,
  vehicleTypeId: requiredTextSchema,
  payloadCapacityTons: optionalPayloadSchema,
  brand: z.string(),
  ownerName: z.string(),
  registrationExpiry: optionalIsoDateSchema,
  managerUserId: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
const administrativeDraftSchema = z.object({
  code: requiredTextSchema,
  name: requiredTextSchema,
  provinceCode: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
}).superRefine((value, context) => {
  if (!value.provinceCode) {
    context.addIssue({ code: 'custom', path: ['provinceCode'], message: 'Vui lòng chọn tỉnh/thành phố.' });
  }
});

function ActiveBadge({ status }: { status: ActiveStatus }) {
  return <StatusBadge label={status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'} tone={status === 'ACTIVE' ? 'success' : 'neutral'} />;
}

export function VehiclesScreen() {
  const { can, token } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<VehicleRecord | null | undefined>();
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [draft, setDraft] = useState<VehicleDraft>({
    licensePlate: '',
    vehicleTypeId: '',
    payloadCapacityTons: '',
    brand: '',
    ownerName: '',
    registrationExpiry: '',
    managerUserId: '',
    status: 'ACTIVE',
  });

  const query = useQuery({
    queryKey: ['mobile-vehicles', search],
    queryFn: async () => (
      await api.get<PaginatedResponse<VehicleRecord>>('/catalog/vehicles', {
        params: { page: 1, limit: 100, search: search || undefined },
      })
    ).data,
  });
  const referencesQuery = useQuery({
    queryKey: ['mobile-vehicle-references'],
    queryFn: async () => {
      const [typesResponse, usersResponse] = await Promise.all([
        api.get<PaginatedResponse<VehicleTypeRecord>>('/catalog/vehicle-types', { params: { page: 1, limit: 200 } }),
        api.get<ApiResponse<ActiveUserOption[]>>('/users/active-options'),
      ]);
      return { types: typesResponse.data.data, users: usersResponse.data.data };
    },
  });
  const vehicleTypeOptions = useMemo(() => (referencesQuery.data?.types ?? []).map(type => ({
    value: type.id,
    label: type.vehicleTypeName,
    description: type.status === 'INACTIVE' ? `${type.vehicleTypeCode} · Đã ngừng sử dụng` : type.vehicleTypeCode,
  })), [referencesQuery.data?.types]);
  const managerOptions = useMemo(() => [
    { value: '', label: 'Chưa phân công' },
    ...(referencesQuery.data?.users ?? []).map(manager => ({
      value: manager.id,
      label: `${manager.fullName} (@${manager.username})`,
      description: manager.phone || undefined,
    })),
  ], [referencesQuery.data?.users]);

  const openCreate = () => {
    setDraft({
      licensePlate: '',
      vehicleTypeId: referencesQuery.data?.types.find(type => type.status === 'ACTIVE')?.id ?? '',
      payloadCapacityTons: '',
      brand: '',
      ownerName: '',
      registrationExpiry: '',
      managerUserId: '',
      status: 'ACTIVE',
    });
    setEditing(null);
  };

  const openEdit = (vehicle: VehicleRecord) => {
    setDraft({
      licensePlate: vehicle.licensePlate,
      vehicleTypeId: vehicle.vehicleTypeId,
      payloadCapacityTons: vehicle.payloadCapacityTons == null ? '' : String(vehicle.payloadCapacityTons),
      brand: vehicle.brand ?? '',
      ownerName: vehicle.ownerName ?? '',
      registrationExpiry: vehicle.registrationExpiry?.slice(0, 10) ?? '',
      managerUserId: vehicle.managerUserId ?? '',
      status: vehicle.status,
    });
    setEditing(vehicle);
  };

  const save = async () => {
    const validation = vehicleDraftSchema.safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    const plate = values.licensePlate.toUpperCase();
    const payloadCapacityTons = values.payloadCapacityTons ? Number(values.payloadCapacityTons.replace(',', '.')) : null;
    setSaving(true);
    try {
      const payload = {
        vehicleTypeId: values.vehicleTypeId,
        payloadCapacityTons,
        brand: values.brand.trim() || null,
        ownerName: values.ownerName.trim() || null,
        registrationExpiry: values.registrationExpiry || null,
        managerUserId: values.managerUserId || null,
        status: values.status,
      };
      if (editing) await api.patch(`/catalog/vehicles/${editing.id}`, payload);
      else await api.post('/catalog/vehicles', { licensePlate: plate, ...payload });
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ['mobile-vehicles'] });
      Alert.alert('Thành công', editing ? 'Đã cập nhật phương tiện.' : 'Đã thêm phương tiện.');
    } catch (error) {
      Alert.alert('Không thể lưu phương tiện', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = (vehicle: VehicleRecord) => {
    Alert.alert('Xóa phương tiện?', `Xóa phương tiện ${vehicle.licensePlate}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void api
            .delete(`/catalog/vehicles/${vehicle.id}`)
            .then(() => queryClient.invalidateQueries({ queryKey: ['mobile-vehicles'] }))
            .catch(error => Alert.alert('Không thể xóa phương tiện', getApiErrorMessage(error)));
        },
      },
    ]);
  };

  const downloadImportTemplate = async () => {
    if (!hasProtectedApiSession(token) || downloadingTemplate) return;
    setDownloadingTemplate(true);
    try {
      await shareProtectedApiFile({
        path: '/catalog/vehicles/import-template',
        token,
        fileName: 'mau-import-xe.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Tải mẫu import xe',
      });
    } catch (error) {
      Alert.alert('Không thể tải file mẫu', getApiErrorMessage(error));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const importVehicles = async () => {
    if (importing) return;
    try {
      const file = await pickSpreadsheet();
      if (!file) return;
      setImporting(true);
      const response = await api.post<ApiResponse<{ totalCount: number; createdCount: number }>>(
        '/catalog/vehicles/import',
        spreadsheetFormData(file),
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120_000,
        },
      );
      await queryClient.invalidateQueries({ queryKey: ['mobile-vehicles'] });
      Alert.alert(
        'Import thành công',
        response.data.message || `Đã thêm ${response.data.data.createdCount} xe từ ${response.data.data.totalCount} dòng dữ liệu.`,
      );
    } catch (error) {
      Alert.alert('Không thể import xe', getApiErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  const chooseImportAction = () => {
    Alert.alert('Import danh mục xe', 'Tải file mẫu để nhập đúng định dạng hoặc chọn file Excel đã chuẩn bị.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Tải file mẫu', onPress: () => void downloadImportTemplate() },
      { text: 'Chọn file Excel', onPress: () => void importVehicles() },
    ]);
  };

  return (
    <>
      <Screen
        title="Phương tiện"
        subtitle="Thông tin xe và tài khoản phụ trách"
        action={can(permissions.catalogVehiclesCreate) ? (
          <View className="flex-row items-center gap-[7px]">
            <AppButton
              compact
              tone="secondary"
              label="Import"
              loading={importing || downloadingTemplate}
              onPress={chooseImportAction}
            />
            <AppButton compact label="Thêm" disabled={importing || downloadingTemplate} onPress={openCreate} />
          </View>
        ) : undefined}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <SearchField
          placeholder="Tìm biển số, nhãn hiệu hoặc chủ xe..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text="Chưa có phương tiện phù hợp." /> : null}
        {query.data?.data.map(vehicle => (
          <Card key={vehicle.id}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[19px] font-bold leading-6 tracking-[0.5px] text-content">{vehicle.licensePlate}</Text>
                <Text className="mt-1 text-body font-bold text-primary-dark">{vehicle.vehicleTypeName}</Text>
              </View>
              <ActiveBadge status={vehicle.status} />
            </View>
            <View className="mt-2.5">
              <InfoRow label="Nhãn hiệu" value={vehicle.brand || '—'} />
              <InfoRow label="Tải trọng" value={vehicle.payloadCapacityTons == null ? '—' : `${formatNumber(vehicle.payloadCapacityTons)} tấn`} />
              <InfoRow label="Chủ xe" value={vehicle.ownerName || '—'} />
              <InfoRow label="Hạn đăng kiểm" value={formatDate(vehicle.registrationExpiry)} />
              <ManagerContact
                layout="rows"
                label="Người phụ trách"
                name={vehicle.managerFullName}
                phone={vehicle.managerPhone}
              />
            </View>
            {(can(permissions.catalogVehiclesUpdate) || can(permissions.catalogVehiclesDelete)) ? (
              <View className="mt-[13px] flex-row flex-wrap justify-end gap-2">
                {can(permissions.catalogVehiclesUpdate) ? (
                  <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(vehicle)} />
                ) : null}
                {can(permissions.catalogVehiclesDelete) ? (
                  <AppButton compact tone="danger-outline" label="Xóa" onPress={() => remove(vehicle)} />
                ) : null}
              </View>
            ) : null}
          </Card>
        ))}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={editing ? `Cập nhật ${editing.licensePlate}` : 'Thêm phương tiện'}
          saveLabel="Lưu phương tiện"
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void save()}
        >
          <FormField
            label="Biển số xe *"
            placeholder="26C-123.45"
            schema={requiredTextSchema}
            value={draft.licensePlate}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={20}
            onChangeText={licensePlate => setDraft(current => ({ ...current, licensePlate }))}
          />
          <OptionPicker
            label="Loại xe *"
            schema={requiredTextSchema}
            value={draft.vehicleTypeId}
            options={vehicleTypeOptions}
            disabled={saving || referencesQuery.isLoading}
            onChange={vehicleTypeId => setDraft(current => ({ ...current, vehicleTypeId }))}
          />
          <FormField
            label="Tải trọng (tấn)"
            placeholder="15"
            schema={optionalPayloadSchema}
            value={draft.payloadCapacityTons}
            editable={!saving}
            keyboardType="decimal-pad"
            onChangeText={payloadCapacityTons => setDraft(current => ({ ...current, payloadCapacityTons }))}
          />
          <FormField
            label="Nhãn hiệu"
            placeholder="THACO"
            value={draft.brand}
            editable={!saving}
            maxLength={100}
            onChangeText={brand => setDraft(current => ({ ...current, brand }))}
          />
          <FormField
            label="Chủ sở hữu"
            value={draft.ownerName}
            editable={!saving}
            maxLength={200}
            onChangeText={ownerName => setDraft(current => ({ ...current, ownerName }))}
          />
          <FormField
            label="Hạn đăng kiểm"
            hint="Định dạng dd-mm-yyyy"
            placeholder="31-12-2027"
            schema={optionalDisplayDateSchema}
            value={draft.registrationExpiry ? formatDate(draft.registrationExpiry) : ''}
            editable={!saving}
            maxLength={10}
            onChangeText={registrationExpiry =>
              setDraft(current => ({ ...current, registrationExpiry: displayDateToIso(registrationExpiry) }))
            }
          />
          <OptionPicker
            label="Quản lý xe"
            value={draft.managerUserId}
            options={managerOptions}
            disabled={saving || referencesQuery.isLoading}
            onChange={managerUserId => setDraft(current => ({ ...current, managerUserId }))}
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
export function AdministrativeUnitsScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<'provinces' | 'communes'>('provinces');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdministrativeUnitRecord | null | undefined>();
  const [draft, setDraft] = useState<AdministrativeDraft>({ code: '', name: '', provinceCode: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const baseEndpoint = '/catalog/administrative-units';
  const query = useQuery({
    queryKey: ['mobile-administrative-units', kind, search],
    queryFn: async () => (
      await api.get<PaginatedResponse<AdministrativeUnitRecord>>(`${baseEndpoint}/${kind}`, {
        params: { page: 1, limit: 100, search: search || undefined },
      })
    ).data,
  });
  const provincesQuery = useQuery({
    queryKey: ['mobile-administrative-province-options'],
    queryFn: async () => (
      await api.get<PaginatedResponse<AdministrativeUnitRecord>>(`${baseEndpoint}/provinces`, {
        params: { page: 1, limit: 200 },
      })
    ).data.data,
  });
  const provinceOptions = useMemo(() => (provincesQuery.data ?? []).map(province => ({
    value: province.provinceCode,
    label: province.provinceName,
    description: province.provinceCode,
  })), [provincesQuery.data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mobile-administrative-units'] });
    await queryClient.invalidateQueries({ queryKey: ['mobile-administrative-province-options'] });
  };

  const openCreate = () => {
    setDraft({
      code: '',
      name: '',
      provinceCode: kind === 'communes' ? provincesQuery.data?.[0]?.provinceCode ?? '' : '',
      status: 'ACTIVE',
    });
    setEditing(null);
  };

  const openEdit = (record: AdministrativeUnitRecord) => {
    setDraft({
      code: kind === 'provinces' ? record.provinceCode : record.communeCode ?? '',
      name: kind === 'provinces' ? record.provinceName : record.communeName ?? '',
      provinceCode: record.provinceCode,
      status: record.status,
    });
    setEditing(record);
  };

  const save = async () => {
    const validation = (kind === 'communes'
      ? administrativeDraftSchema
      : administrativeDraftSchema.omit({ provinceCode: true })).safeParse(draft);
    if (!validation.success) return;
    const code = draft.code.trim();
    const name = draft.name.trim();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`${baseEndpoint}/${kind}/${editing.id}`, {
          [kind === 'provinces' ? 'provinceName' : 'communeName']: name,
          status: draft.status,
        });
      } else if (kind === 'provinces') {
        await api.post(`${baseEndpoint}/provinces`, { provinceCode: code, provinceName: name, status: draft.status });
      } else {
        await api.post(`${baseEndpoint}/communes`, {
          communeCode: code,
          communeName: name,
          provinceCode: draft.provinceCode,
          status: draft.status,
        });
      }
      setEditing(undefined);
      await refresh();
      Alert.alert('Thành công', 'Đã lưu đơn vị hành chính.');
    } catch (error) {
      Alert.alert('Không thể lưu đơn vị hành chính', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = (record: AdministrativeUnitRecord) => {
    const name = kind === 'provinces' ? record.provinceName : record.communeName;
    Alert.alert('Xóa đơn vị hành chính?', `Xóa “${name}”?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void api.delete(`${baseEndpoint}/${kind}/${record.id}`).then(refresh).catch(error => {
            Alert.alert('Không thể xóa đơn vị hành chính', getApiErrorMessage(error));
          });
        },
      },
    ]);
  };

  const sync = () => {
    Alert.alert('Đồng bộ danh mục Tỉnh/Xã?', 'Dữ liệu từ nguồn hành chính sẽ được cập nhật vào hệ thống.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đồng bộ',
        onPress: () => {
          setSaving(true);
          void api
            .post<ApiResponse<{ provinceCount: number; communeCount: number; source: string }>>(`${baseEndpoint}/sync`)
            .then(async response => {
              await refresh();
              Alert.alert('Đồng bộ thành công', `${response.data.data.provinceCount} tỉnh, ${response.data.data.communeCount} xã từ ${response.data.data.source}.`);
            })
            .catch(error => Alert.alert('Không thể đồng bộ', getApiErrorMessage(error)))
            .finally(() => setSaving(false));
        },
      },
    ]);
  };

  return (
    <>
      <Screen
        title="Danh mục Tỉnh / Xã"
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <View className="flex-row flex-wrap items-center justify-between gap-2.5">
          <ChoiceChips
            value={kind}
            options={[
              { value: 'provinces', label: 'Tỉnh' },
              { value: 'communes', label: 'Xã' },
            ]}
            onChange={nextKind => {
              setKind(nextKind);
              setSearch('');
              setSearchInput('');
            }}
          />
          {can(permissions.catalogAdministrativeUnitsUpdate) ? (
            <AppButton compact tone="secondary" label="Đồng bộ" loading={saving} onPress={sync} />
          ) : null}
        </View>
        <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <SearchField
              placeholder={kind === 'provinces' ? 'Tìm tỉnh/thành phố...' : 'Tìm xã/phường...'}
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmit={() => setSearch(searchInput.trim())}
            />
          </View>
          {can(permissions.catalogAdministrativeUnitsCreate) ? <AppButton compact label="Thêm" onPress={openCreate} /> : null}
        </View>
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text="Chưa có đơn vị hành chính phù hợp." /> : null}
        {query.data?.data.length ? (
          <Card padded={false} className="-mx-page-x overflow-hidden">
            <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-[0.7] text-caption font-semibold text-content-muted">Mã</Text>
              <Text className="min-w-0 flex-[1.45] text-caption font-semibold text-content-muted">
                {kind === 'provinces' ? 'Tỉnh/Thành phố' : 'Xã/Phường'}
              </Text>
              <Text className="w-[58px] shrink-0 text-caption font-semibold text-content-muted">Trạng thái</Text>
              <View className="w-[34px] shrink-0 items-end" />
            </View>
            {query.data.data.map((record, index) => {
              const recordName = kind === 'provinces' ? record.provinceName : record.communeName ?? '—';
              const recordCode = kind === 'provinces' ? record.provinceCode : record.communeCode ?? '—';
              const metadata = [kind === 'communes' ? record.provinceName : null, record.divisionType, record.source]
                .filter(Boolean)
                .join(' · ');
              return (
                <View
                  key={record.id}
                  className={`min-h-[62px] flex-row items-center gap-2 px-2.5 ${index < query.data.data.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <Text numberOfLines={2} className="min-w-0 flex-[0.7] text-xs font-bold text-primary-dark">{recordCode}</Text>
                  <View className="min-w-0 flex-[1.45]">
                    <Text numberOfLines={2} className="text-body font-semibold text-content">{recordName}</Text>
                    {metadata ? <Text numberOfLines={1} className="mt-0.5 text-caption text-content-muted">{metadata}</Text> : null}
                  </View>
                  <View className="w-[58px] shrink-0">
                    <StatusBadge
                      label={record.status === 'ACTIVE' ? 'Dùng' : 'Ngừng'}
                      tone={record.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                  </View>
                  <View className="w-[34px] shrink-0 items-end">
                    {can(permissions.catalogAdministrativeUnitsUpdate) || can(permissions.catalogAdministrativeUnitsDelete) ? (
                      <ActionMenu
                        label={`Thao tác với ${recordName}`}
                        items={[
                          ...(can(permissions.catalogAdministrativeUnitsUpdate)
                            ? [{ label: 'Chỉnh sửa', onPress: () => openEdit(record) }]
                            : []),
                          ...(can(permissions.catalogAdministrativeUnitsDelete)
                            ? [{ label: 'Xóa', tone: 'danger' as const, onPress: () => remove(record) }]
                            : []),
                        ]}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={`${editing ? 'Cập nhật' : 'Thêm'} ${kind === 'provinces' ? 'tỉnh/thành phố' : 'xã/phường'}`}
          saveLabel="Lưu đơn vị hành chính"
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void save()}
        >
          <FormField
            label={`Mã ${kind === 'provinces' ? 'tỉnh' : 'xã'} *`}
            schema={requiredTextSchema}
            value={draft.code}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={20}
            onChangeText={code => setDraft(current => ({ ...current, code }))}
          />
          {kind === 'communes' ? (
            <OptionPicker
              label="Tỉnh/Thành phố *"
              schema={requiredTextSchema}
              value={draft.provinceCode}
              options={provinceOptions}
              disabled={Boolean(editing) || saving || provincesQuery.isLoading}
              onChange={provinceCode => setDraft(current => ({ ...current, provinceCode }))}
            />
          ) : null}
          <FormField
            label={`Tên ${kind === 'provinces' ? 'tỉnh/thành phố' : 'xã/phường'} *`}
            schema={requiredTextSchema}
            value={draft.name}
            editable={!saving}
            maxLength={200}
            onChangeText={name => setDraft(current => ({ ...current, name }))}
          />
          <OptionPicker
            label="Trạng thái"
            value={draft.status}
            options={statusOptions}
            disabled={saving}
            onChange={value => setDraft(current => ({ ...current, status: value as ActiveStatus }))}
          />
        </ManagementSheet>
      ) : null}
    </>
  );
}
