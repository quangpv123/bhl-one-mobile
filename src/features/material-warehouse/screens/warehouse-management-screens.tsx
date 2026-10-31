import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AppButton, Card, EmptyState, ErrorState, InfoRow, LoadingBlock, SearchField, StatusBadge } from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { PaginatedResponse } from '@/types/business';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';

type ActiveStatus = 'ACTIVE' | 'INACTIVE';
type WarehouseKind = 'material' | 'purchase';

interface WarehouseRecord {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  managerUserId?: string | null;
  managerName: string;
  phone: string;
  address: string;
  materialArea?: string;
  status: ActiveStatus;
}

interface ActiveUserOption {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
}

interface WarehouseDraft {
  warehouseCode: string;
  warehouseName: string;
  managerUserId: string;
  managerName: string;
  phone: string;
  address: string;
  materialArea: string;
  status: ActiveStatus;
}

const emptyDraft: WarehouseDraft = {
  warehouseCode: '',
  warehouseName: '',
  managerUserId: '',
  managerName: '',
  phone: '',
  address: '',
  materialArea: '',
  status: 'ACTIVE',
};

const statusOptions = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Tạm dừng' },
];

function WarehouseManagementScreen({ kind }: { kind: WarehouseKind }) {
  const purchase = kind === 'purchase';
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<WarehouseRecord | null | undefined>();
  const [draft, setDraft] = useState<WarehouseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const endpoint = purchase ? '/purchase-warehouses' : '/material-warehouses';
  const queryKey = purchase ? 'purchase' : 'material';
  const createPermission = purchase ? permissions.purchaseWarehousesCreate : permissions.materialWarehousesCreate;
  const updatePermission = purchase ? permissions.purchaseWarehousesUpdate : permissions.materialWarehousesUpdate;
  const deletePermission = purchase ? permissions.purchaseWarehousesDelete : permissions.materialWarehousesDelete;

  const query = useQuery({
    queryKey: ['mobile-warehouse-management', queryKey, search],
    queryFn: async () => (
      await api.get<PaginatedResponse<WarehouseRecord>>(endpoint, {
        params: { page: 1, limit: 100, search: search || undefined },
      })
    ).data,
  });
  const usersQuery = useQuery({
    queryKey: ['mobile-active-user-options'],
    enabled: purchase,
    queryFn: async () => (await api.get<ApiResponse<ActiveUserOption[]>>('/users/active-options')).data.data,
  });
  const userOptions = useMemo(
    () => (usersQuery.data ?? []).map(item => ({
      value: item.id,
      label: `${item.fullName} (@${item.username})`,
      description: item.phone || undefined,
    })),
    [usersQuery.data],
  );

  const openCreate = () => {
    setDraft({ ...emptyDraft, managerUserId: purchase ? usersQuery.data?.[0]?.id ?? '' : '' });
    setEditing(null);
  };

  const openEdit = (warehouse: WarehouseRecord) => {
    setDraft({
      warehouseCode: warehouse.warehouseCode,
      warehouseName: warehouse.warehouseName,
      managerUserId: warehouse.managerUserId ?? '',
      managerName: warehouse.managerName,
      phone: warehouse.phone,
      address: warehouse.address,
      materialArea: warehouse.materialArea ?? '',
      status: warehouse.status,
    });
    setEditing(warehouse);
  };

  const changeManager = (managerUserId: string) => {
    const manager = usersQuery.data?.find(item => item.id === managerUserId);
    setDraft(current => ({
      ...current,
      managerUserId,
      managerName: manager?.fullName ?? current.managerName,
      phone: manager?.phone ?? current.phone,
    }));
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mobile-warehouse-management', queryKey] });
  };

  const save = async () => {
    const manager = purchase ? usersQuery.data?.find(item => item.id === draft.managerUserId) : null;
    if (!draft.warehouseCode.trim() || !draft.warehouseName.trim() || !draft.phone.trim() || !draft.address.trim()) {
      Alert.alert('Thiếu thông tin', 'Nhập đầy đủ mã, tên, số điện thoại và địa chỉ kho.');
      return;
    }
    if (purchase && (!manager || !draft.materialArea.trim())) {
      Alert.alert('Thiếu thông tin', 'Chọn nhân viên phụ trách và nhập vùng nguyên liệu.');
      return;
    }
    if (!purchase && !draft.managerName.trim()) {
      Alert.alert('Thiếu thông tin', 'Nhập nhân viên phụ trách kho.');
      return;
    }
    if (!/^\+?[0-9 ()-]{8,20}$/.test(draft.phone.trim())) {
      Alert.alert('Số điện thoại chưa hợp lệ', 'Kiểm tra lại số điện thoại phụ trách kho.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        warehouseName: draft.warehouseName.trim(),
        managerName: purchase ? manager!.fullName : draft.managerName.trim(),
        phone: draft.phone.trim(),
        address: draft.address.trim(),
        status: draft.status,
        ...(purchase ? { managerUserId: draft.managerUserId, materialArea: draft.materialArea.trim() } : {}),
      };
      if (editing) await api.patch(`${endpoint}/${editing.id}`, payload);
      else await api.post(endpoint, { warehouseCode: draft.warehouseCode.trim(), ...payload });
      setEditing(undefined);
      await refresh();
      Alert.alert('Thành công', editing ? 'Đã cập nhật thông tin kho.' : 'Đã thêm kho mới.');
    } catch (error) {
      Alert.alert('Không thể lưu kho', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (warehouse: WarehouseRecord) => {
    const nextStatus: ActiveStatus = warehouse.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert(
      nextStatus === 'ACTIVE' ? 'Cho kho hoạt động lại?' : 'Tạm dừng kho?',
      warehouse.warehouseName,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: () => {
            void api
              .patch(`${endpoint}/${warehouse.id}/status`, { status: nextStatus })
              .then(refresh)
              .catch(error => Alert.alert('Không thể cập nhật trạng thái', getApiErrorMessage(error)));
          },
        },
      ],
    );
  };

  const remove = (warehouse: WarehouseRecord) => {
    Alert.alert('Xóa kho?', `Xóa “${warehouse.warehouseName}”?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void api
            .delete(`${endpoint}/${warehouse.id}`)
            .then(refresh)
            .catch(error => Alert.alert('Không thể xóa kho', getApiErrorMessage(error)));
        },
      },
    ]);
  };

  return (
    <>
      <Screen
        title={purchase ? 'Kho thu mua' : 'Kho vật tư'}
        subtitle={purchase ? 'Danh sách và vận hành các kho thu mua' : 'Danh sách và thông tin kho vật tư'}
        action={can(createPermission) ? <AppButton compact label="Thêm" onPress={openCreate} /> : undefined}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <SearchField
          placeholder="Tìm mã hoặc tên kho..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text="Chưa có kho phù hợp." /> : null}
        {query.data?.data.map(warehouse => (
          <Card key={warehouse.id}>
            <View style={styles.heading}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{warehouse.warehouseName}</Text>
                <Text style={styles.code}>{warehouse.warehouseCode}</Text>
              </View>
              <StatusBadge
                label={warehouse.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                tone={warehouse.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
            </View>
            <View style={styles.rows}>
              <InfoRow label="Phụ trách" value={warehouse.managerName || '—'} />
              <InfoRow label="Điện thoại" value={warehouse.phone || '—'} />
              {purchase ? <InfoRow label="Vùng nguyên liệu" value={warehouse.materialArea || '—'} /> : null}
              <InfoRow label="Địa chỉ" value={warehouse.address || '—'} />
            </View>
            <View style={styles.actions}>
              {purchase && (can(permissions.scaleTicketsView) || can(permissions.purchasePaymentsView)) ? (
                <AppButton compact label="Mở kho" onPress={() => router.push(`/purchase-warehouse/${warehouse.id}`)} />
              ) : null}
              {can(updatePermission) ? (
                <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(warehouse)} />
              ) : null}
              {can(updatePermission) ? (
                <AppButton
                  compact
                  tone="ghost"
                  label={warehouse.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
                  onPress={() => toggleStatus(warehouse)}
                />
              ) : null}
              {can(deletePermission) ? (
                <AppButton compact tone="danger" label="Xóa" onPress={() => remove(warehouse)} />
              ) : null}
            </View>
          </Card>
        ))}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={editing ? `Cập nhật ${editing.warehouseCode}` : `Thêm ${purchase ? 'kho thu mua' : 'kho vật tư'}`}
          saveLabel={editing ? 'Lưu thay đổi' : 'Thêm kho'}
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void save()}
        >
          <FormField
            label="Mã kho *"
            placeholder="KHO001"
            value={draft.warehouseCode}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={50}
            onChangeText={warehouseCode => setDraft(current => ({ ...current, warehouseCode }))}
          />
          <FormField
            label="Tên kho *"
            value={draft.warehouseName}
            editable={!saving}
            maxLength={200}
            onChangeText={warehouseName => setDraft(current => ({ ...current, warehouseName }))}
          />
          {purchase ? (
            <OptionPicker
              label="Nhân viên phụ trách *"
              value={draft.managerUserId}
              options={userOptions}
              disabled={saving || usersQuery.isLoading}
              onChange={changeManager}
            />
          ) : (
            <FormField
              label="Nhân viên phụ trách *"
              value={draft.managerName}
              editable={!saving}
              maxLength={150}
              onChangeText={managerName => setDraft(current => ({ ...current, managerName }))}
            />
          )}
          <FormField
            label="Số điện thoại *"
            value={draft.phone}
            editable={!saving}
            keyboardType="phone-pad"
            maxLength={20}
            onChangeText={phone => setDraft(current => ({ ...current, phone }))}
          />
          <FormField
            label="Địa chỉ kho *"
            value={draft.address}
            editable={!saving}
            multiline
            maxLength={500}
            onChangeText={address => setDraft(current => ({ ...current, address }))}
          />
          {purchase ? (
            <FormField
              label="Vùng nguyên liệu *"
              value={draft.materialArea}
              editable={!saving}
              multiline
              maxLength={500}
              onChangeText={materialArea => setDraft(current => ({ ...current, materialArea }))}
            />
          ) : null}
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

export function MaterialWarehousesScreen() {
  return <WarehouseManagementScreen kind="material" />;
}

export function PurchaseWarehouseListScreen() {
  return <WarehouseManagementScreen kind="purchase" />;
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: ui.gap },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  code: { color: colors.primaryDark, fontSize: 13, fontWeight: '800', marginTop: 4 },
  rows: { marginTop: 10 },
  actions: { marginTop: 13, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
});
