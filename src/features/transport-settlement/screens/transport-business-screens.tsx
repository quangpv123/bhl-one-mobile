import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import { AppButton, Card, ChoiceChips, EmptyState, ErrorState, InfoRow, LoadingBlock, SearchField, StatusBadge } from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { PaginatedResponse, TransportCompensationRate, TransportSettlement } from '@/types/business';
import { firstDayOfMonthIso, formatDateTime, formatMoney, formatNumber, formatWeight, todayIso } from '@/utils/format';
import { pickSpreadsheet, spreadsheetFormData } from '@/utils/document-upload';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';
import { DateRangeFields } from '@/components/forms/date-range-fields';
import { decimalStringSchema, isoDateSchema, requiredTextSchema } from '@/lib/validation';

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

const rateAmountSchema = decimalStringSchema();
const rateDraftSchema = z.object({
  provinceCode: requiredTextSchema,
  communeCode: requiredTextSchema,
  detail: requiredTextSchema,
  content: requiredTextSchema,
  tripSalary: rateAmountSchema,
  mealAllowance: rateAmountSchema,
  canopyWaterAllowance: rateAmountSchema,
  loaderAllowance: rateAmountSchema,
  freightRatePerKg: rateAmountSchema,
  note: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
const settlementRangeSchema = z.object({ from: isoDateSchema, to: isoDateSchema }).refine(
  value => value.from <= value.to,
  { path: ['to'], message: 'Ngày kết thúc không được trước ngày bắt đầu.' },
);

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
    const validation = rateDraftSchema.safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    const money = {
      tripSalary: rateNumber(values.tripSalary),
      mealAllowance: rateNumber(values.mealAllowance),
      canopyWaterAllowance: rateNumber(values.canopyWaterAllowance),
      loaderAllowance: rateNumber(values.loaderAllowance),
      freightRatePerKg: rateNumber(values.freightRatePerKg),
    };
    setSaving(true);
    try {
      const payload = {
        provinceCode: values.provinceCode,
        communeCode: values.communeCode,
        detail: values.detail,
        content: values.content,
        ...money,
        note: values.note.trim(),
        status: values.status,
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
          <View className="flex-row flex-wrap justify-end gap-[7px]">
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
            <View className="flex-row items-start justify-between gap-2.5">
              <View className="flex-1">
                <Text className="text-[15px] font-bold leading-[21px] text-content">{rate.transportPoint}</Text>
                <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{rate.transportPointCode}</Text>
              </View>
              <StatusBadge label={rate.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'} tone={rate.status === 'ACTIVE' ? 'success' : 'neutral'} />
            </View>
            <Text className="mt-2.5 text-body leading-[19px] text-content-muted">{rate.content}</Text>
            <View className="mt-2.5">
              <InfoRow label="Lương chuyến" value={formatMoney(rate.tripSalary)} />
              <InfoRow label="Tiền ăn" value={formatMoney(rate.mealAllowance)} />
              <InfoRow label="Bạt + nước" value={formatMoney(rate.canopyWaterAllowance)} />
              <InfoRow label="Bốc xếp" value={formatMoney(rate.loaderAllowance)} />
              <InfoRow label="Cước/kg" value={`${formatNumber(rate.freightRatePerKg, 2)} đ/kg`} emphasize />
            </View>
            {rate.note ? <Text className="mt-[9px] text-xs italic leading-[18px] text-content-muted">{rate.note}</Text> : null}
            {(can(permissions.transportCompensationRatesUpdate) || can(permissions.transportCompensationRatesDelete)) ? (
              <View className="mt-[13px] flex-row flex-wrap justify-end gap-2">
                {can(permissions.transportCompensationRatesUpdate) ? (
                  <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(rate)} />
                ) : null}
                {can(permissions.transportCompensationRatesDelete) ? (
                  <AppButton compact tone="danger-outline" label="Xóa" onPress={() => remove(rate)} />
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
            schema={requiredTextSchema}
            value={draft.provinceCode}
            options={provinceOptions}
            disabled={saving || provincesQuery.isLoading}
            onChange={provinceCode => setDraft(current => ({ ...current, provinceCode, communeCode: '' }))}
          />
          <OptionPicker
            label="Xã/Phường *"
            schema={requiredTextSchema}
            value={draft.communeCode}
            options={communeOptions}
            disabled={saving || communesQuery.isLoading || !draft.provinceCode}
            onChange={communeCode => setDraft(current => ({ ...current, communeCode }))}
          />
          <FormField label="Chi tiết điểm vận chuyển *" schema={requiredTextSchema} value={draft.detail} editable={!saving} maxLength={250} onChangeText={detail => setDraft(current => ({ ...current, detail }))} />
          <FormField label="Nội dung *" schema={requiredTextSchema} value={draft.content} editable={!saving} maxLength={250} onChangeText={content => setDraft(current => ({ ...current, content }))} />
          <FormField label="Lương/chuyến" schema={rateAmountSchema} value={draft.tripSalary} editable={!saving} keyboardType="decimal-pad" onChangeText={tripSalary => setDraft(current => ({ ...current, tripSalary }))} />
          <FormField label="Tiền ăn/ngày" schema={rateAmountSchema} value={draft.mealAllowance} editable={!saving} keyboardType="decimal-pad" onChangeText={mealAllowance => setDraft(current => ({ ...current, mealAllowance }))} />
          <FormField label="Tiền nước mui/chuyến" schema={rateAmountSchema} value={draft.canopyWaterAllowance} editable={!saving} keyboardType="decimal-pad" onChangeText={canopyWaterAllowance => setDraft(current => ({ ...current, canopyWaterAllowance }))} />
          <FormField label="Bồi dưỡng máy xúc/chuyến" schema={rateAmountSchema} value={draft.loaderAllowance} editable={!saving} keyboardType="decimal-pad" onChangeText={loaderAllowance => setDraft(current => ({ ...current, loaderAllowance }))} />
          <FormField label="Cước vận chuyển (đ/kg)" schema={rateAmountSchema} value={draft.freightRatePerKg} editable={!saving} keyboardType="decimal-pad" onChangeText={freightRatePerKg => setDraft(current => ({ ...current, freightRatePerKg }))} />
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
  const [rangeValidationAttempted, setRangeValidationAttempted] = useState(false);
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
    setRangeValidationAttempted(true);
    const validation = settlementRangeSchema.safeParse({ from: fromInput, to: toInput });
    if (validation.success) setRange(validation.data);
  };
  const rangeValidation = settlementRangeSchema.safeParse({ from: fromInput, to: toInput });

  return (
    <Screen
      title="Quyết toán vận tải"
      subtitle="Doanh thu, chi phí và thu nhập tài xế"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <Card tone="soft">
        <View className="mb-3">
          <DateRangeFields
            fromDate={fromInput}
            toDate={toInput}
            maximumDate={todayIso()}
            onFromDateChange={setFromInput}
            onToDateChange={setToInput}
          />
        </View>
        {rangeValidationAttempted && !rangeValidation.success ? (
          <Text className="mb-2 text-caption font-medium text-danger">{rangeValidation.error.issues[0]?.message}</Text>
        ) : null}
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
            <Text className="mb-3 text-base font-bold text-content">Tổng hợp kỳ quyết toán</Text>
            <View className="mb-2.5 flex-row flex-wrap gap-2">
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
              <View className="flex-row items-start justify-between gap-2.5">
                <View className="flex-1">
                  <Text className="text-[19px] font-bold leading-6 text-content">{vehicle.licensePlate}</Text>
                  <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{vehicle.vehicleTypeName}</Text>
                </View>
                <StatusBadge label={`${vehicle.tripCount} chuyến`} tone="info" />
              </View>
              <View className="mt-2.5">
                <InfoRow label="Khối lượng" value={formatWeight(vehicle.cargoWeightKg)} />
                <InfoRow label="Doanh thu" value={formatMoney(vehicle.revenue)} />
                <InfoRow label="Lương tài xế" value={formatMoney(vehicle.driverCompensation)} />
                <InfoRow label="Chi phí" value={formatMoney(vehicle.knownCost)} />
                <InfoRow label="Cân đối" value={formatMoney(vehicle.balanceBeforeFuel)} emphasize />
              </View>
              <View className="mt-[13px] flex-row flex-wrap justify-end gap-2">
                <AppButton compact tone="secondary" label="Chi tiết chi phí" onPress={() => setSelectedVehicleId(vehicle.vehicleId)} />
              </View>
            </Card>
          )) : null}
          {view === 'drivers' && !filteredDrivers.length ? <EmptyState text="Không có dữ liệu tài xế phù hợp." /> : null}
          {view === 'drivers' ? filteredDrivers.map(driver => (
            <Card key={driver.driverUserId}>
              <View className="flex-row items-start justify-between gap-2.5">
                <View className="flex-1">
                  <Text className="text-[15px] font-bold leading-[21px] text-content">{driver.driverFullName}</Text>
                  <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{driver.driverPhone || 'Chưa có số điện thoại'}</Text>
                </View>
                <StatusBadge label={`${driver.tripCount} chuyến`} tone="info" />
              </View>
              <View className="mt-2.5">
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
              <View className="flex-row items-start justify-between gap-2.5">
                <View className="flex-1">
                  <Text className="text-[15px] font-bold leading-[21px] text-content">{material.materialCode} · {material.materialName}</Text>
                  <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{material.repairCode} · {material.licensePlate}</Text>
                </View>
                <Text className="text-sm font-bold text-primary-dark">{formatMoney(material.amount)}</Text>
              </View>
              <Text className="mt-2.5 text-body leading-[19px] text-content-muted">{material.repairContent}</Text>
              <View className="mt-2.5">
                <InfoRow label="Hoàn tất sửa chữa" value={formatDateTime(material.completedAt)} />
                <InfoRow label="Số lượng" value={`${formatNumber(material.quantity, material.unitDecimalScale)} ${material.unitSymbol}`} />
                <InfoRow label="Đơn giá" value={formatMoney(material.unitPrice)} />
              </View>
            </Card>
          )) : null}
          {view === 'expenses' && !filteredExpenses.length ? <EmptyState text="Không có chi phí phát sinh phù hợp." /> : null}
          {view === 'expenses' ? filteredExpenses.map(expense => (
            <Card key={expense.id}>
              <View className="flex-row items-start justify-between gap-2.5">
                <View className="flex-1">
                  <Text className="text-[15px] font-bold leading-[21px] text-content">{expense.expenseType}</Text>
                  <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{expense.tripCode} · {expense.licensePlate}</Text>
                </View>
                <Text className="text-sm font-bold text-primary-dark">{formatMoney(expense.amount)}</Text>
              </View>
              <View className="mt-2.5">
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
          <Text className="mt-[5px] text-base font-bold text-content">Chuyến hoàn thành</Text>
          {!query.data.trips.some(trip => trip.vehicleId === selectedVehicle.vehicleId) ? <EmptyState text="Không có chuyến hoàn thành." /> : null}
          {query.data.trips.filter(trip => trip.vehicleId === selectedVehicle.vehicleId).map(trip => (
            <Card key={trip.tripId}>
              <Text className="text-[15px] font-bold leading-[21px] text-content">{trip.tripCode}</Text>
              <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{trip.driverFullName} · {trip.routeSnapshot}</Text>
              <View className="mt-2.5">
                <InfoRow label="Doanh thu" value={formatMoney(trip.revenue)} />
                <InfoRow label="Lương & phụ cấp" value={formatMoney(trip.driverCompensation)} />
                <InfoRow label="Chi phí khác" value={formatMoney(trip.tripExpenses)} />
                <InfoRow label="Cân đối" value={formatMoney(trip.balanceBeforeFuel)} emphasize />
              </View>
            </Card>
          ))}
          <Text className="mt-[5px] text-base font-bold text-content">Vật tư sửa chữa</Text>
          {!query.data.materials.some(material => material.vehicleId === selectedVehicle.vehicleId) ? <EmptyState text="Không có vật tư sửa chữa." /> : null}
          {query.data.materials.filter(material => material.vehicleId === selectedVehicle.vehicleId).map(material => (
            <Card key={material.id}>
              <View className="flex-row items-start justify-between gap-2.5">
                <View className="flex-1">
                  <Text className="text-[15px] font-bold leading-[21px] text-content">{material.materialName}</Text>
                  <Text className="mt-1 text-xs font-bold leading-[18px] text-primary-dark">{material.repairCode} · {material.materialCode}</Text>
                </View>
                <Text className="text-sm font-bold text-primary-dark">{formatMoney(material.amount)}</Text>
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
    <View className="w-[48.7%] rounded-compact bg-surface-subtle p-2.5">
      <Text className="text-caption font-semibold text-content-muted">{label}</Text>
      <Text className="mt-[5px] text-sm font-bold text-primary-dark">{value}</Text>
    </View>
  );
}
