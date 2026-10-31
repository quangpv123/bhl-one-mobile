import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AppButton, Card, ChoiceChips, EmptyState, ErrorState, InfoRow, LoadingBlock, SearchField, StatusBadge } from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { PaginatedResponse, TransportCompensationRate, TransportSettlement } from '@/types/business';
import { firstDayOfMonthIso, formatDateTime, formatMoney, formatNumber, formatWeight, todayIso } from '@/utils/format';
import { pickSpreadsheet, spreadsheetFormData } from '@/utils/document-upload';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';

type ActiveStatus = 'ACTIVE' | 'INACTIVE';

interface AdministrativeOption {
  id: string;
  provinceCode: string;
  provinceName: string;
  communeCode?: string;
  communeName?: string;
  status: ActiveStatus;
}

interface RateDraft {
  provinceCode: string;
  communeCode: string;
  detail: string;
  content: string;
  tripSalary: string;
  mealAllowance: string;
  canopyWaterAllowance: string;
  loaderAllowance: string;
  freightRatePerKg: string;
  note: string;
  status: ActiveStatus;
}

const emptyRateDraft: RateDraft = {
  provinceCode: '',
  communeCode: '',
  detail: '',
  content: 'Vận chuyển sắn củ',
  tripSalary: '0',
  mealAllowance: '0',
  canopyWaterAllowance: '0',
  loaderAllowance: '0',
  freightRatePerKg: '0',
  note: '',
  status: 'ACTIVE',
};

function rateNumber(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function includesSettlementSearch(search: string, ...values: (string | null | undefined)[]) {
  return !search || values.some(value => value?.toLocaleLowerCase('vi-VN').includes(search));
}

export function TransportRatesScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<TransportCompensationRate | null | undefined>();
  const [draft, setDraft] = useState<RateDraft>(emptyRateDraft);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const query = useQuery({
    queryKey: ['mobile-transport-rates', search],
    queryFn: async () => (
      await api.get<PaginatedResponse<TransportCompensationRate>>('/transport/compensation-rates', {
        params: { page: 1, limit: 100, search: search || undefined },
      })
    ).data,
  });
  const provincesQuery = useQuery({
    queryKey: ['mobile-rate-provinces'],
    queryFn: async () => (
      await api.get<PaginatedResponse<AdministrativeOption>>('/catalog/administrative-units/provinces', {
        params: { page: 1, limit: 200, status: 'ACTIVE' },
      })
    ).data.data,
  });
  const communesQuery = useQuery({
    queryKey: ['mobile-rate-communes', draft.provinceCode],
    enabled: Boolean(draft.provinceCode && editing !== undefined),
    queryFn: async () => (
      await api.get<PaginatedResponse<AdministrativeOption>>('/catalog/administrative-units/communes', {
        params: { page: 1, limit: 500, provinceCode: draft.provinceCode, status: 'ACTIVE' },
      })
    ).data.data,
  });
  const provinceOptions = useMemo(() => (provincesQuery.data ?? []).map(item => ({
    value: item.provinceCode,
    label: item.provinceName,
    description: item.provinceCode,
  })), [provincesQuery.data]);
  const communeOptions = useMemo(() => (communesQuery.data ?? []).map(item => ({
    value: item.communeCode ?? '',
    label: item.communeName ?? '',
    description: item.communeCode,
  })), [communesQuery.data]);

  const openCreate = () => {
    setDraft({ ...emptyRateDraft, provinceCode: provincesQuery.data?.[0]?.provinceCode ?? '' });
    setEditing(null);
  };

  const openEdit = (rate: TransportCompensationRate) => {
    setDraft({
      provinceCode: rate.provinceCode,
      communeCode: rate.communeCode,
      detail: rate.detail,
      content: rate.content,
      tripSalary: String(rate.tripSalary),
      mealAllowance: String(rate.mealAllowance),
      canopyWaterAllowance: String(rate.canopyWaterAllowance),
      loaderAllowance: String(rate.loaderAllowance),
      freightRatePerKg: String(rate.freightRatePerKg),
      note: rate.note,
      status: rate.status,
    });
    setEditing(rate);
  };

  const save = async () => {
    if (!draft.provinceCode || !draft.communeCode || !draft.detail.trim() || !draft.content.trim()) {
      Alert.alert('Thiếu thông tin', 'Chọn Tỉnh/Xã và nhập chi tiết, nội dung vận chuyển.');
      return;
    }
    const money = {
      tripSalary: rateNumber(draft.tripSalary),
      mealAllowance: rateNumber(draft.mealAllowance),
      canopyWaterAllowance: rateNumber(draft.canopyWaterAllowance),
      loaderAllowance: rateNumber(draft.loaderAllowance),
      freightRatePerKg: rateNumber(draft.freightRatePerKg),
    };
    if (Object.values(money).some(value => !Number.isFinite(value) || value < 0)) {
      Alert.alert('Định mức chưa hợp lệ', 'Các khoản tiền phải là số lớn hơn hoặc bằng 0.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        provinceCode: draft.provinceCode,
        communeCode: draft.communeCode,
        detail: draft.detail.trim(),
        content: draft.content.trim(),
        ...money,
        note: draft.note.trim(),
        status: draft.status,
      };
      if (editing) await api.patch(`/transport/compensation-rates/${editing.id}`, payload);
      else await api.post('/transport/compensation-rates', payload);
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ['mobile-transport-rates'] });
      Alert.alert('Thành công', editing ? 'Đã cập nhật bảng khoán.' : 'Đã thêm bảng khoán.');
    } catch (error) {
      Alert.alert('Không thể lưu bảng khoán', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = (rate: TransportCompensationRate) => {
    Alert.alert('Xóa bảng khoán?', `Xóa định mức tại ${rate.transportPoint}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void api
            .delete(`/transport/compensation-rates/${rate.id}`)
            .then(() => queryClient.invalidateQueries({ queryKey: ['mobile-transport-rates'] }))
            .catch(error => Alert.alert('Không thể xóa bảng khoán', getApiErrorMessage(error)));
        },
      },
    ]);
  };

  const importRates = async () => {
    if (importing) return;
    try {
      const file = await pickSpreadsheet();
      if (!file) return;
      setImporting(true);
      const response = await api.post<ApiResponse<{ totalCount: number; createdCount: number; updatedCount: number }>>(
        '/transport/compensation-rates/import',
        spreadsheetFormData(file),
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
      );
      await queryClient.invalidateQueries({ queryKey: ['mobile-transport-rates'] });
      const result = response.data.data;
      Alert.alert('Import thành công', `${result.totalCount} dòng: thêm ${result.createdCount}, cập nhật ${result.updatedCount}.`);
    } catch (error) {
      Alert.alert('Không thể import bảng khoán', getApiErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Screen
        title="Bảng khoán tổng hợp"
        subtitle="Lộ trình và đơn giá vận chuyển"
        action={can(permissions.transportCompensationRatesCreate) ? (
          <View style={styles.headerActions}>
            <AppButton compact tone="secondary" label="Import" loading={importing} onPress={() => void importRates()} />
            <AppButton compact label="Thêm" onPress={openCreate} />
          </View>
        ) : undefined}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <SearchField
          placeholder="Tìm điểm hoặc nội dung vận chuyển..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? <EmptyState text="Chưa có lộ trình vận chuyển." /> : null}
        {query.data?.data.map(rate => (
          <Card key={rate.id}>
            <View style={styles.heading}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{rate.transportPoint}</Text>
                <Text style={styles.code}>{rate.transportPointCode}</Text>
              </View>
              <StatusBadge label={rate.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'} tone={rate.status === 'ACTIVE' ? 'success' : 'neutral'} />
            </View>
            <Text style={styles.description}>{rate.content}</Text>
            <View style={styles.rows}>
              <InfoRow label="Lương chuyến" value={formatMoney(rate.tripSalary)} />
              <InfoRow label="Tiền ăn" value={formatMoney(rate.mealAllowance)} />
              <InfoRow label="Bạt + nước" value={formatMoney(rate.canopyWaterAllowance)} />
              <InfoRow label="Bốc xếp" value={formatMoney(rate.loaderAllowance)} />
              <InfoRow label="Cước/kg" value={`${formatNumber(rate.freightRatePerKg, 2)} đ/kg`} emphasize />
            </View>
            {rate.note ? <Text style={styles.note}>{rate.note}</Text> : null}
            {(can(permissions.transportCompensationRatesUpdate) || can(permissions.transportCompensationRatesDelete)) ? (
              <View style={styles.actions}>
                {can(permissions.transportCompensationRatesUpdate) ? (
                  <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(rate)} />
                ) : null}
                {can(permissions.transportCompensationRatesDelete) ? (
                  <AppButton compact tone="danger" label="Xóa" onPress={() => remove(rate)} />
                ) : null}
              </View>
            ) : null}
          </Card>
        ))}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={editing ? `Cập nhật ${editing.transportPointCode}` : 'Thêm bảng khoán'}
          saveLabel="Lưu bảng khoán"
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void save()}
        >
          <OptionPicker
            label="Tỉnh/Thành phố *"
            value={draft.provinceCode}
            options={provinceOptions}
            disabled={saving || provincesQuery.isLoading}
            onChange={provinceCode => setDraft(current => ({ ...current, provinceCode, communeCode: '' }))}
          />
          <OptionPicker
            label="Xã/Phường *"
            value={draft.communeCode}
            options={communeOptions}
            disabled={saving || communesQuery.isLoading || !draft.provinceCode}
            onChange={communeCode => setDraft(current => ({ ...current, communeCode }))}
          />
          <FormField label="Chi tiết điểm vận chuyển *" value={draft.detail} editable={!saving} maxLength={250} onChangeText={detail => setDraft(current => ({ ...current, detail }))} />
          <FormField label="Nội dung *" value={draft.content} editable={!saving} maxLength={250} onChangeText={content => setDraft(current => ({ ...current, content }))} />
          <FormField label="Lương/chuyến" value={draft.tripSalary} editable={!saving} keyboardType="decimal-pad" onChangeText={tripSalary => setDraft(current => ({ ...current, tripSalary }))} />
          <FormField label="Tiền ăn/ngày" value={draft.mealAllowance} editable={!saving} keyboardType="decimal-pad" onChangeText={mealAllowance => setDraft(current => ({ ...current, mealAllowance }))} />
          <FormField label="Tiền nước mui/chuyến" value={draft.canopyWaterAllowance} editable={!saving} keyboardType="decimal-pad" onChangeText={canopyWaterAllowance => setDraft(current => ({ ...current, canopyWaterAllowance }))} />
          <FormField label="Bồi dưỡng máy xúc/chuyến" value={draft.loaderAllowance} editable={!saving} keyboardType="decimal-pad" onChangeText={loaderAllowance => setDraft(current => ({ ...current, loaderAllowance }))} />
          <FormField label="Cước vận chuyển (đ/kg)" value={draft.freightRatePerKg} editable={!saving} keyboardType="decimal-pad" onChangeText={freightRatePerKg => setDraft(current => ({ ...current, freightRatePerKg }))} />
          <FormField label="Ghi chú" value={draft.note} editable={!saving} multiline maxLength={500} onChangeText={note => setDraft(current => ({ ...current, note }))} />
          {editing ? (
            <OptionPicker
              label="Trạng thái"
              value={draft.status}
              options={[
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'INACTIVE', label: 'Tạm dừng' },
              ]}
              disabled={saving}
              onChange={value => setDraft(current => ({ ...current, status: value as ActiveStatus }))}
            />
          ) : null}
        </ManagementSheet>
      ) : null}
    </>
  );
}

export function TransportSettlementsScreen() {
  const [fromInput, setFromInput] = useState(firstDayOfMonthIso());
  const [toInput, setToInput] = useState(todayIso());
  const [range, setRange] = useState({ from: firstDayOfMonthIso(), to: todayIso() });
  const [view, setView] = useState<'vehicles' | 'drivers' | 'materials' | 'expenses'>('vehicles');
  const [search, setSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>();
  const query = useQuery({
    queryKey: ['transport-settlements-mobile', range],
    queryFn: async () =>
      (
        await api.get<ApiResponse<TransportSettlement>>('/transport/settlements', {
          params: range,
        })
      ).data.data,
  });
  const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN');
  const filteredVehicles = useMemo(
    () => query.data?.vehicles.filter(vehicle => includesSettlementSearch(normalizedSearch, vehicle.licensePlate, vehicle.vehicleTypeName)) ?? [],
    [normalizedSearch, query.data?.vehicles],
  );
  const filteredDrivers = useMemo(
    () => query.data?.drivers.filter(driver => includesSettlementSearch(normalizedSearch, driver.driverFullName, driver.driverPhone)) ?? [],
    [normalizedSearch, query.data?.drivers],
  );
  const filteredMaterials = useMemo(
    () => query.data?.materials.filter(material => includesSettlementSearch(
      normalizedSearch,
      material.repairCode,
      material.licensePlate,
      material.materialCode,
      material.materialName,
      material.repairContent,
    )) ?? [],
    [normalizedSearch, query.data?.materials],
  );
  const filteredExpenses = useMemo(
    () => query.data?.expenses.filter(expense => includesSettlementSearch(
      normalizedSearch,
      expense.tripCode,
      expense.licensePlate,
      expense.driverFullName,
      expense.expenseType,
    )) ?? [],
    [normalizedSearch, query.data?.expenses],
  );
  const selectedVehicle = query.data?.vehicles.find(vehicle => vehicle.vehicleId === selectedVehicleId);

  const applyRange = () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromInput) && /^\d{4}-\d{2}-\d{2}$/.test(toInput) && fromInput <= toInput) {
      setRange({ from: fromInput, to: toInput });
    }
  };

  return (
    <Screen
      title="Quyết toán vận tải"
      subtitle="Doanh thu, chi phí và thu nhập tài xế"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <Card tone="soft">
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.label}>Từ ngày</Text>
            <TextInput value={fromInput} onChangeText={setFromInput} placeholder="YYYY-MM-DD" style={styles.input} />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.label}>Đến ngày</Text>
            <TextInput value={toInput} onChangeText={setToInput} placeholder="YYYY-MM-DD" style={styles.input} />
          </View>
        </View>
        <AppButton compact label="Xem quyết toán" onPress={applyRange} />
      </Card>
      <SearchField
        placeholder="Tìm xe, tài xế, phiếu sửa chữa, chi phí..."
        value={search}
        onChangeText={setSearch}
      />
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <Card>
            <Text style={styles.summaryTitle}>Tổng hợp kỳ quyết toán</Text>
            <View style={styles.summaryGrid}>
              <SummaryValue label="Chuyến xe" value={formatNumber(query.data.summary.tripCount, 0)} />
              <SummaryValue label="Khối lượng" value={formatWeight(query.data.summary.cargoWeightKg)} />
              <SummaryValue label="Doanh thu" value={formatMoney(query.data.summary.revenue)} />
              <SummaryValue label="Chi phí biết trước" value={formatMoney(query.data.summary.knownCost)} />
            </View>
            <InfoRow label="Lương & phụ cấp" value={formatMoney(query.data.summary.driverCompensation)} />
            <InfoRow label="Chi phí chuyến" value={formatMoney(query.data.summary.tripExpenses)} />
            <InfoRow label="Chi phí vật tư" value={formatMoney(query.data.summary.materialCost)} />
            <InfoRow label="Cân đối trước nhiên liệu" value={formatMoney(query.data.summary.balanceBeforeFuel)} emphasize />
          </Card>
          <ChoiceChips
            value={view}
            options={[
              { value: 'vehicles', label: 'Theo xe' },
              { value: 'drivers', label: 'Tài xế' },
              { value: 'materials', label: 'Vật tư' },
              { value: 'expenses', label: 'Chi phí khác' },
            ]}
            onChange={setView}
          />
          {view === 'vehicles' && !filteredVehicles.length ? <EmptyState text="Không có dữ liệu phương tiện phù hợp." /> : null}
          {view === 'vehicles' ? filteredVehicles.map(vehicle => (
            <Card key={vehicle.vehicleId}>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text>
                  <Text style={styles.code}>{vehicle.vehicleTypeName}</Text>
                </View>
                <StatusBadge label={`${vehicle.tripCount} chuyến`} tone="info" />
              </View>
              <View style={styles.rows}>
                <InfoRow label="Khối lượng" value={formatWeight(vehicle.cargoWeightKg)} />
                <InfoRow label="Doanh thu" value={formatMoney(vehicle.revenue)} />
                <InfoRow label="Lương tài xế" value={formatMoney(vehicle.driverCompensation)} />
                <InfoRow label="Chi phí" value={formatMoney(vehicle.knownCost)} />
                <InfoRow label="Cân đối" value={formatMoney(vehicle.balanceBeforeFuel)} emphasize />
              </View>
              <View style={styles.actions}>
                <AppButton compact tone="secondary" label="Chi tiết chi phí" onPress={() => setSelectedVehicleId(vehicle.vehicleId)} />
              </View>
            </Card>
          )) : null}
          {view === 'drivers' && !filteredDrivers.length ? <EmptyState text="Không có dữ liệu tài xế phù hợp." /> : null}
          {view === 'drivers' ? filteredDrivers.map(driver => (
            <Card key={driver.driverUserId}>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{driver.driverFullName}</Text>
                  <Text style={styles.code}>{driver.driverPhone || 'Chưa có số điện thoại'}</Text>
                </View>
                <StatusBadge label={`${driver.tripCount} chuyến`} tone="info" />
              </View>
              <View style={styles.rows}>
                <InfoRow label="Số xe" value={formatNumber(driver.vehicleCount, 0)} />
                <InfoRow label="Khối lượng" value={formatWeight(driver.cargoWeightKg)} />
                <InfoRow label="Lương chuyến" value={formatMoney(driver.tripSalary)} />
                <InfoRow label="Tiền ăn" value={formatMoney(driver.mealAllowance)} />
                <InfoRow label="Nước mui" value={formatMoney(driver.canopyWaterAllowance)} />
                <InfoRow label="Bồi dưỡng máy xúc" value={formatMoney(driver.loaderAllowance)} />
                <InfoRow label="Tổng thu nhập" value={formatMoney(driver.totalPay)} emphasize />
              </View>
            </Card>
          )) : null}
          {view === 'materials' && !filteredMaterials.length ? <EmptyState text="Không có chi phí vật tư phù hợp." /> : null}
          {view === 'materials' ? filteredMaterials.map(material => (
            <Card key={material.id}>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{material.materialCode} · {material.materialName}</Text>
                  <Text style={styles.code}>{material.repairCode} · {material.licensePlate}</Text>
                </View>
                <Text style={styles.costAmount}>{formatMoney(material.amount)}</Text>
              </View>
              <Text style={styles.description}>{material.repairContent}</Text>
              <View style={styles.rows}>
                <InfoRow label="Hoàn tất sửa chữa" value={formatDateTime(material.completedAt)} />
                <InfoRow label="Số lượng" value={`${formatNumber(material.quantity, material.unitDecimalScale)} ${material.unitSymbol}`} />
                <InfoRow label="Đơn giá" value={formatMoney(material.unitPrice)} />
              </View>
            </Card>
          )) : null}
          {view === 'expenses' && !filteredExpenses.length ? <EmptyState text="Không có chi phí phát sinh phù hợp." /> : null}
          {view === 'expenses' ? filteredExpenses.map(expense => (
            <Card key={expense.id}>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{expense.expenseType}</Text>
                  <Text style={styles.code}>{expense.tripCode} · {expense.licensePlate}</Text>
                </View>
                <Text style={styles.costAmount}>{formatMoney(expense.amount)}</Text>
              </View>
              <View style={styles.rows}>
                <InfoRow label="Tài xế" value={expense.driverFullName} />
                <InfoRow label="Ngày ghi nhận" value={formatDateTime(expense.occurredAt)} />
              </View>
            </Card>
          )) : null}
        </>
      ) : null}
      {selectedVehicle && query.data ? (
        <ManagementSheet
          title={`Chi tiết chi phí · ${selectedVehicle.licensePlate}`}
          saveLabel="Đóng"
          saving={false}
          onClose={() => setSelectedVehicleId(undefined)}
          onSave={() => setSelectedVehicleId(undefined)}
        >
          <Card tone="soft">
            <InfoRow label="Doanh thu" value={formatMoney(selectedVehicle.revenue)} />
            <InfoRow label="Lương & phụ cấp" value={formatMoney(selectedVehicle.driverCompensation)} />
            <InfoRow label="Chi phí chuyến" value={formatMoney(selectedVehicle.tripExpenses)} />
            <InfoRow label="Vật tư sửa chữa" value={formatMoney(selectedVehicle.materialCost)} />
            <InfoRow label="Kết quả thực hiện" value={formatMoney(selectedVehicle.balanceBeforeFuel)} emphasize />
          </Card>
          <Text style={styles.detailSection}>Chuyến hoàn thành</Text>
          {!query.data.trips.some(trip => trip.vehicleId === selectedVehicle.vehicleId) ? <EmptyState text="Không có chuyến hoàn thành." /> : null}
          {query.data.trips.filter(trip => trip.vehicleId === selectedVehicle.vehicleId).map(trip => (
            <Card key={trip.tripId}>
              <Text style={styles.title}>{trip.tripCode}</Text>
              <Text style={styles.code}>{trip.driverFullName} · {trip.routeSnapshot}</Text>
              <View style={styles.rows}>
                <InfoRow label="Doanh thu" value={formatMoney(trip.revenue)} />
                <InfoRow label="Lương & phụ cấp" value={formatMoney(trip.driverCompensation)} />
                <InfoRow label="Chi phí khác" value={formatMoney(trip.tripExpenses)} />
                <InfoRow label="Cân đối" value={formatMoney(trip.balanceBeforeFuel)} emphasize />
              </View>
            </Card>
          ))}
          <Text style={styles.detailSection}>Vật tư sửa chữa</Text>
          {!query.data.materials.some(material => material.vehicleId === selectedVehicle.vehicleId) ? <EmptyState text="Không có vật tư sửa chữa." /> : null}
          {query.data.materials.filter(material => material.vehicleId === selectedVehicle.vehicleId).map(material => (
            <Card key={material.id}>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{material.materialName}</Text>
                  <Text style={styles.code}>{material.repairCode} · {material.materialCode}</Text>
                </View>
                <Text style={styles.costAmount}>{formatMoney(material.amount)}</Text>
              </View>
            </Card>
          ))}
        </ManagementSheet>
      ) : null}
    </Screen>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  vehiclePlate: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '700' },
  code: { color: colors.primaryDark, fontSize: 12, lineHeight: 18, fontWeight: '800', marginTop: 4 },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  note: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', lineHeight: 18, marginTop: 9 },
  rows: { marginTop: 10 },
  actions: { marginTop: 13, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateField: { flex: 1, gap: 6 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800' },
  input: { minHeight: ui.controlHeight, borderRadius: ui.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 11, color: colors.text },
  summaryTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  summaryBox: { width: '48.7%', padding: 10, borderRadius: ui.smallRadius, backgroundColor: colors.surfaceSubtle },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  metricValue: { color: colors.primaryDark, fontSize: 14, fontWeight: '900', marginTop: 5 },
  costAmount: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  detailSection: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 5 },
});

