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
import { formatNumber } from '@/utils/format';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';

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

function ActiveBadge({ status }: { status: ActiveStatus }) {
  return <StatusBadge label={status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'} tone={status === 'ACTIVE' ? 'success' : 'neutral'} />;
}

export function VehiclesScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<VehicleRecord | null | undefined>();
  const [saving, setSaving] = useState(false);
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
    const plate = draft.licensePlate.trim().toUpperCase();
    const payloadCapacityTons = draft.payloadCapacityTons.trim() ? Number(draft.payloadCapacityTons.replace(',', '.')) : null;
    if ((!editing && !plate) || !draft.vehicleTypeId) {
      Alert.alert('Thiếu thông tin', 'Nhập biển số và chọn loại xe.');
      return;
    }
    if (payloadCapacityTons != null && (!Number.isFinite(payloadCapacityTons) || payloadCapacityTons <= 0 || payloadCapacityTons > 1000)) {
      Alert.alert('Tải trọng chưa hợp lệ', 'Tải trọng phải lớn hơn 0 và không vượt quá 1.000 tấn.');
      return;
    }
    if (draft.registrationExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(draft.registrationExpiry)) {
      Alert.alert('Hạn đăng kiểm chưa hợp lệ', 'Nhập ngày theo định dạng YYYY-MM-DD.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vehicleTypeId: draft.vehicleTypeId,
        payloadCapacityTons,
        brand: draft.brand.trim() || null,
        ownerName: draft.ownerName.trim() || null,
        registrationExpiry: draft.registrationExpiry || null,
        managerUserId: draft.managerUserId || null,
        status: draft.status,
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

  return (
    <>
      <Screen
        title="Phương tiện"
        subtitle="Thông tin xe và tài khoản phụ trách"
        action={can(permissions.catalogVehiclesCreate) ? <AppButton compact label="Thêm" onPress={openCreate} /> : undefined}
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
            <View style={styles.heading}>
              <View style={styles.titleWrap}>
                <Text style={styles.plate}>{vehicle.licensePlate}</Text>
                <Text style={styles.code}>{vehicle.vehicleTypeName}</Text>
              </View>
              <ActiveBadge status={vehicle.status} />
            </View>
            <View style={styles.rows}>
              <InfoRow label="Nhãn hiệu" value={vehicle.brand || '—'} />
              <InfoRow label="Tải trọng" value={vehicle.payloadCapacityTons == null ? '—' : `${formatNumber(vehicle.payloadCapacityTons)} tấn`} />
              <InfoRow label="Chủ xe" value={vehicle.ownerName || '—'} />
              <InfoRow label="Hạn đăng kiểm" value={vehicle.registrationExpiry?.slice(0, 10) || '—'} />
              <InfoRow label="Người phụ trách" value={vehicle.managerFullName || '—'} />
              <InfoRow label="Điện thoại" value={vehicle.managerPhone || '—'} />
            </View>
            {(can(permissions.catalogVehiclesUpdate) || can(permissions.catalogVehiclesDelete)) ? (
              <View style={styles.actions}>
                {can(permissions.catalogVehiclesUpdate) ? (
                  <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(vehicle)} />
                ) : null}
                {can(permissions.catalogVehiclesDelete) ? (
                  <AppButton compact tone="danger" label="Xóa" onPress={() => remove(vehicle)} />
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
            value={draft.licensePlate}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={20}
            onChangeText={licensePlate => setDraft(current => ({ ...current, licensePlate }))}
          />
          <OptionPicker
            label="Loại xe *"
            value={draft.vehicleTypeId}
            options={vehicleTypeOptions}
            disabled={saving || referencesQuery.isLoading}
            onChange={vehicleTypeId => setDraft(current => ({ ...current, vehicleTypeId }))}
          />
          <FormField
            label="Tải trọng (tấn)"
            placeholder="15"
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
            hint="Định dạng YYYY-MM-DD"
            placeholder="2027-12-31"
            value={draft.registrationExpiry}
            editable={!saving}
            maxLength={10}
            onChangeText={registrationExpiry => setDraft(current => ({ ...current, registrationExpiry }))}
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
    const code = draft.code.trim();
    const name = draft.name.trim();
    if ((!editing && !code) || !name || (kind === 'communes' && !draft.provinceCode)) {
      Alert.alert('Thiếu thông tin', `Nhập đầy đủ mã, tên ${kind === 'provinces' ? 'tỉnh/thành phố' : 'xã/phường'}${kind === 'communes' ? ' và chọn tỉnh' : ''}.`);
      return;
    }
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
        subtitle="Đơn vị hành chính dùng chung trong hệ thống"
        action={can(permissions.catalogAdministrativeUnitsCreate) ? <AppButton compact label="Thêm" onPress={openCreate} /> : undefined}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <View style={styles.toolbar}>
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
        <SearchField
          placeholder={kind === 'provinces' ? 'Tìm tỉnh/thành phố...' : 'Tìm xã/phường...'}
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text="Chưa có đơn vị hành chính phù hợp." /> : null}
        {query.data?.data.map(record => (
          <Card key={record.id}>
            <View style={styles.heading}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{kind === 'provinces' ? record.provinceName : record.communeName}</Text>
                <Text style={styles.code}>{kind === 'provinces' ? record.provinceCode : record.communeCode}</Text>
              </View>
              <ActiveBadge status={record.status} />
            </View>
            <View style={styles.rows}>
              {kind === 'communes' ? <InfoRow label="Tỉnh/Thành phố" value={record.provinceName} /> : null}
              <InfoRow label="Loại đơn vị" value={record.divisionType || '—'} />
              <InfoRow label="Nguồn" value={record.source || '—'} />
            </View>
            {(can(permissions.catalogAdministrativeUnitsUpdate) || can(permissions.catalogAdministrativeUnitsDelete)) ? (
              <View style={styles.actions}>
                {can(permissions.catalogAdministrativeUnitsUpdate) ? (
                  <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(record)} />
                ) : null}
                {can(permissions.catalogAdministrativeUnitsDelete) ? (
                  <AppButton compact tone="danger" label="Xóa" onPress={() => remove(record)} />
                ) : null}
              </View>
            ) : null}
          </Card>
        ))}
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
            value={draft.code}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={20}
            onChangeText={code => setDraft(current => ({ ...current, code }))}
          />
          {kind === 'communes' ? (
            <OptionPicker
              label="Tỉnh/Thành phố *"
              value={draft.provinceCode}
              options={provinceOptions}
              disabled={Boolean(editing) || saving || provincesQuery.isLoading}
              onChange={provinceCode => setDraft(current => ({ ...current, provinceCode }))}
            />
          ) : null}
          <FormField
            label={`Tên ${kind === 'provinces' ? 'tỉnh/thành phố' : 'xã/phường'} *`}
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

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: ui.gap },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  plate: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '700', letterSpacing: 0.5 },
  code: { color: colors.primaryDark, fontSize: 13, fontWeight: '800', marginTop: 4 },
  rows: { marginTop: 10 },
  actions: { marginTop: 13, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
});
