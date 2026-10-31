import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useState, type ComponentProps } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import {
  AppButton,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorState,
  InfoRow,
  LoadingBlock,
  StatusBadge,
} from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { appendMaterialImages, MaterialEvidencePicker } from '@/features/material-warehouse/components/material-document-create';
import { ManagementSheet } from '@/components/forms/management-form';
import { api, apiBaseUrl, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type {
  TransportTrip,
  TransportTripEvent,
  TransportTripOptions,
  TransportTripsResponse,
  TransportTripStatus,
  TransportVehicleStatus,
  VehicleRepair,
  VehicleRepairMaterialOption,
  VehicleOperatingStatus,
} from '@/types/models';
import { formatDateTime, formatMoney, formatWeight } from '@/utils/format';

const statusLabels: Record<TransportTripStatus, string> = {
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang di chuyển',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const vehicleStatusLabels: Record<VehicleOperatingStatus, string> = {
  IDLE: 'Đang rảnh',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang vận chuyển',
  MAINTENANCE: 'Đang sửa chữa',
};

type TripStatusFilter = 'OPEN' | 'COMPLETED' | 'CANCELLED';
type ActionKind = 'START' | 'COMPLETE' | 'CANCEL';
type OccurrenceKind = 'INCIDENT' | 'EXPENSE';

function tripStatusTone(status: TransportTripStatus) {
  if (status === 'IN_PROGRESS' || status === 'COMPLETED') return 'success' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'warning' as const;
}

function TripCard({
  trip,
  canOperate,
  canCancel,
  onAction,
  onHistory,
  onOccurrence,
}: {
  trip: TransportTrip;
  canOperate: boolean;
  canCancel: boolean;
  onAction: (kind: ActionKind, trip: TransportTrip) => void;
  onHistory: (trip: TransportTrip) => void;
  onOccurrence: (kind: OccurrenceKind, trip: TransportTrip) => void;
}) {
  return (
    <Card>
      <View style={styles.heading}>
        <View style={styles.titleWrap}>
          <Text style={styles.code}>{trip.tripCode}</Text>
          <Text style={styles.plate}>{trip.licensePlate}</Text>
        </View>
        <StatusBadge label={statusLabels[trip.status]} tone={tripStatusTone(trip.status)} />
      </View>
      <Text style={styles.route}>{trip.routeSnapshot}</Text>
      <View style={styles.rows}>
        <InfoRow label="Tài xế" value={trip.driverFullName} />
        <InfoRow label="Loại xe" value={trip.vehicleTypeName} />
        {trip.cargoWeightKg != null ? <InfoRow label="Tải trọng" value={formatWeight(trip.cargoWeightKg)} emphasize /> : null}
        <InfoRow label="Bắt đầu" value={formatDateTime(trip.startedAt || trip.plannedStartAt)} />
      </View>
      {trip.content ? <Text style={styles.content}>{trip.content}</Text> : null}
      {trip.cancellationReason ? <Text style={styles.cancelReason}>Lý do hủy: {trip.cancellationReason}</Text> : null}
      <View style={styles.actions}>
        <AppButton compact tone="ghost" label="Lịch sử" onPress={() => onHistory(trip)} />
        {trip.status === 'ASSIGNED' && canOperate ? (
          <AppButton compact label="Bắt đầu" onPress={() => onAction('START', trip)} />
        ) : null}
        {trip.status === 'IN_PROGRESS' && canOperate ? (
          <>
            <AppButton compact tone="secondary" label="Sự cố" onPress={() => onOccurrence('INCIDENT', trip)} />
            <AppButton compact tone="secondary" label="Chi phí" onPress={() => onOccurrence('EXPENSE', trip)} />
            <AppButton compact label="Hoàn thành" onPress={() => onAction('COMPLETE', trip)} />
          </>
        ) : null}
        {(trip.status === 'ASSIGNED' || trip.status === 'IN_PROGRESS') && canCancel ? (
          <AppButton compact tone="danger" label="Hủy chuyến" onPress={() => onAction('CANCEL', trip)} />
        ) : null}
      </View>
    </Card>
  );
}

type RepairMode = 'START' | 'UPDATE' | 'COMPLETE';

function VehicleCard({
  vehicle,
  canOperate,
  onRepair,
  onRepairHistory,
}: {
  vehicle: TransportVehicleStatus;
  canOperate: boolean;
  onRepair: (mode: RepairMode, vehicle: TransportVehicleStatus) => void;
  onRepairHistory: (vehicle: TransportVehicleStatus) => void;
}) {
  const tone = vehicle.operatingStatus === 'IDLE' ? 'success' : vehicle.operatingStatus === 'MAINTENANCE' ? 'danger' : 'warning';
  return (
    <Card>
      <View style={styles.heading}>
        <View style={styles.titleWrap}>
          <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text>
          <Text style={styles.vehicleType}>{vehicle.vehicleTypeName}</Text>
        </View>
        <StatusBadge label={vehicleStatusLabels[vehicle.operatingStatus]} tone={tone} />
      </View>
      <View style={styles.rows}>
        <InfoRow label="Phụ trách" value={vehicle.managerFullName || '—'} />
        <InfoRow label="Điện thoại" value={vehicle.managerPhone || '—'} />
        {vehicle.tripCode ? <InfoRow label="Chuyến" value={vehicle.tripCode} emphasize /> : null}
        {vehicle.driverFullName ? <InfoRow label="Tài xế" value={vehicle.driverFullName} /> : null}
        {vehicle.routeSnapshot ? <InfoRow label="Lộ trình" value={vehicle.routeSnapshot} /> : null}
        {vehicle.cargoWeightKg != null ? <InfoRow label="Tải trọng" value={formatWeight(vehicle.cargoWeightKg)} /> : null}
        {vehicle.repairCode ? <InfoRow label="Phiếu sửa chữa" value={vehicle.repairCode} /> : null}
      </View>
      {vehicle.repairContent ? <Text style={styles.content}>{vehicle.repairContent}</Text> : null}
      {vehicle.unresolvedIncidentCount > 0 ? (
        <Text style={styles.incident}>{vehicle.unresolvedIncidentCount} sự cố chưa xử lý</Text>
      ) : null}
      <View style={styles.actions}>
        {canOperate && vehicle.operatingStatus === 'IDLE' ? (
          <AppButton compact tone="secondary" label="Sửa chữa" onPress={() => onRepair('START', vehicle)} />
        ) : null}
        {canOperate && vehicle.operatingStatus === 'MAINTENANCE' && vehicle.repairId ? (
          <>
            <AppButton compact tone="secondary" label="Cập nhật sửa chữa" onPress={() => onRepair('UPDATE', vehicle)} />
            <AppButton compact label="Hoàn tất sửa chữa" onPress={() => onRepair('COMPLETE', vehicle)} />
          </>
        ) : null}
        <AppButton compact tone="ghost" label="Lịch sử sửa chữa" onPress={() => onRepairHistory(vehicle)} />
      </View>
    </Card>
  );
}

export default function TransportScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const allowed = can(permissions.transportTripsView);
  const canCreate = can(permissions.transportTripsCreate);
  const canOperate = can(permissions.transportTripsOperate);
  const canCancel = can(permissions.transportTripsCancel);
  const [view, setView] = useState<'vehicles' | 'trips'>('vehicles');
  const [status, setStatus] = useState<TripStatusFilter>('OPEN');
  const [formMode, setFormMode] = useState<'CREATE' | 'SELF_START'>();
  const [action, setAction] = useState<{ kind: ActionKind; trip: TransportTrip }>();
  const [historyTrip, setHistoryTrip] = useState<TransportTrip>();
  const [occurrence, setOccurrence] = useState<{ kind: OccurrenceKind; trip: TransportTrip }>();
  const [repairAction, setRepairAction] = useState<{ mode: RepairMode; vehicle: TransportVehicleStatus }>();
  const [repairHistoryVehicle, setRepairHistoryVehicle] = useState<TransportVehicleStatus>();
  const trips = useQuery({
    queryKey: ['transport-trips-mobile', status],
    enabled: allowed && view === 'trips',
    queryFn: async () =>
      (
        await api.get<TransportTripsResponse>('/transport/trips', {
          params: { page: 1, limit: 100, status },
        })
      ).data.data,
    refetchInterval: status === 'OPEN' ? 15_000 : false,
  });
  const vehicles = useQuery({
    queryKey: ['transport-vehicles-mobile'],
    enabled: allowed && view === 'vehicles',
    queryFn: async () => (await api.get<ApiResponse<TransportVehicleStatus[]>>('/transport/trips/vehicles')).data.data,
    refetchInterval: 15_000,
  });

  const activeQuery = view === 'vehicles' ? vehicles : trips;
  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['transport-trips-mobile'] });
    await queryClient.invalidateQueries({ queryKey: ['transport-vehicles-mobile'] });
  };

  const headerAction = (
    <View style={styles.headerActions}>
      {canCreate ? <AppButton compact label="Phân công" onPress={() => setFormMode('CREATE')} /> : null}
      {!canCreate && canOperate ? <AppButton compact label="Bắt đầu" onPress={() => setFormMode('SELF_START')} /> : null}
    </View>
  );

  return (
    <>
      <Screen
        title="Điều phối xe"
        subtitle="Trạng thái phương tiện và chuyến vận chuyển"
        action={headerAction}
        refreshing={activeQuery.isRefetching}
        onRefresh={allowed ? () => void activeQuery.refetch() : undefined}
      >
        {!allowed ? <EmptyState text="Tài khoản chưa có quyền xem danh sách chuyến xe." /> : null}
        {allowed ? (
          <ChoiceChips
            value={view}
            options={[
              { value: 'vehicles', label: 'Phương tiện' },
              { value: 'trips', label: 'Chuyến xe' },
            ]}
            onChange={setView}
          />
        ) : null}
        {allowed && view === 'trips' ? (
          <ChoiceChips
            value={status}
            options={[
              { value: 'OPEN', label: 'Đang mở' },
              { value: 'COMPLETED', label: 'Hoàn thành' },
              { value: 'CANCELLED', label: 'Đã hủy' },
            ]}
            onChange={setStatus}
          />
        ) : null}
        {activeQuery.isLoading ? <LoadingBlock /> : null}
        {activeQuery.isError ? <ErrorState text={getApiErrorMessage(activeQuery.error)} onRetry={() => void activeQuery.refetch()} /> : null}
        {view === 'vehicles' && !vehicles.isLoading && !vehicles.data?.length ? <EmptyState text="Chưa có phương tiện nào." /> : null}
        {view === 'vehicles' ? vehicles.data?.map(vehicle => (
          <VehicleCard
            key={vehicle.vehicleId}
            vehicle={vehicle}
            canOperate={canOperate}
            onRepair={(mode, selectedVehicle) => setRepairAction({ mode, vehicle: selectedVehicle })}
            onRepairHistory={setRepairHistoryVehicle}
          />
        )) : null}
        {view === 'trips' && !trips.isLoading && !trips.data?.length ? <EmptyState text="Chưa có chuyến xe phù hợp." /> : null}
        {view === 'trips' ? trips.data?.map(trip => (
          <TripCard
            key={trip.id}
            trip={trip}
            canOperate={canOperate}
            canCancel={canCancel}
            onAction={(kind, selectedTrip) => setAction({ kind, trip: selectedTrip })}
            onHistory={setHistoryTrip}
            onOccurrence={(kind, selectedTrip) => setOccurrence({ kind, trip: selectedTrip })}
          />
        )) : null}
      </Screen>

      {formMode ? (
        <TripFormModal
          mode={formMode}
          onClose={() => setFormMode(undefined)}
          onSaved={async () => {
            setFormMode(undefined);
            setView('trips');
            setStatus('OPEN');
            await refreshAll();
          }}
        />
      ) : null}
      {action ? (
        <TripActionModal
          action={action}
          onClose={() => setAction(undefined)}
          onSaved={async () => {
            setAction(undefined);
            await refreshAll();
          }}
        />
      ) : null}
      {historyTrip ? <TripHistoryModal trip={historyTrip} onClose={() => setHistoryTrip(undefined)} /> : null}
      {occurrence ? (
        <TripOccurrenceSheet
          occurrence={occurrence}
          onClose={() => setOccurrence(undefined)}
          onSaved={async () => {
            setOccurrence(undefined);
            await refreshAll();
          }}
        />
      ) : null}
      {repairAction ? (
        <VehicleRepairSheet
          mode={repairAction.mode}
          vehicle={repairAction.vehicle}
          onClose={() => setRepairAction(undefined)}
          onSaved={async () => {
            setRepairAction(undefined);
            await refreshAll();
          }}
        />
      ) : null}
      {repairHistoryVehicle ? (
        <VehicleRepairHistoryModal vehicle={repairHistoryVehicle} onClose={() => setRepairHistoryVehicle(undefined)} />
      ) : null}
    </>
  );
}

function TripOccurrenceSheet({
  occurrence,
  onClose,
  onSaved,
}: {
  occurrence: { kind: OccurrenceKind; trip: TransportTrip };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [amount, setAmount] = useState('');
  const [images, setImages] = useState<ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const incident = occurrence.kind === 'INCIDENT';

  const save = async () => {
    if (content.trim().length < 2) {
      Alert.alert('Thiếu nội dung', incident ? 'Mô tả sự cố đang gặp.' : 'Nhập loại chi phí phát sinh.');
      return;
    }
    const numericAmount = Number(amount.replace(/\D/g, ''));
    if (!incident && (!Number.isFinite(numericAmount) || numericAmount <= 0)) {
      Alert.alert('Số tiền chưa hợp lệ', 'Số tiền phải lớn hơn 0.');
      return;
    }
    setSaving(true);
    try {
      if (incident) {
        const formData = new FormData();
        formData.append('content', content.trim());
        appendMaterialImages(formData, images);
        await api.post(`/transport/trips/${occurrence.trip.id}/incidents`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post(`/transport/trips/${occurrence.trip.id}/expenses`, {
          expenseType: content.trim(),
          amount: numericAmount,
        });
      }
      await onSaved();
      Alert.alert('Thành công', incident ? 'Đã ghi nhận sự cố chuyến xe.' : 'Đã ghi nhận chi phí phát sinh.');
    } catch (error) {
      Alert.alert(incident ? 'Không thể báo sự cố' : 'Không thể thêm chi phí', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet
      title={`${incident ? 'Báo sự cố' : 'Chi phí phát sinh'} · ${occurrence.trip.tripCode}`}
      saveLabel={incident ? 'Ghi nhận sự cố' : 'Ghi nhận chi phí'}
      saving={saving}
      onClose={onClose}
      onSave={() => void save()}
    >
      <Card tone="soft">
        <InfoRow label="Phương tiện" value={occurrence.trip.licensePlate} emphasize />
        <InfoRow label="Lộ trình" value={occurrence.trip.routeSnapshot} />
      </Card>
      <FormInput
        label={incident ? 'Nội dung sự cố *' : 'Loại chi phí *'}
        value={content}
        onChangeText={setContent}
        multiline={incident}
        maxLength={incident ? 2000 : 100}
      />
      {incident ? (
        <MaterialEvidencePicker label="Ảnh sự cố" images={images} disabled={saving} onChange={setImages} />
      ) : (
        <FormInput label="Số tiền (đ) *" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      )}
    </ManagementSheet>
  );
}

interface RepairLineDraft {
  key: string;
  materialId: string;
  quantity: string;
}

function VehicleRepairSheet({
  vehicle,
  mode,
  onClose,
  onSaved,
}: {
  vehicle: TransportVehicleStatus;
  mode: RepairMode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const query = useQuery({
    queryKey: ['vehicle-repair-editor', mode, vehicle.repairId],
    queryFn: async () => {
      const [optionsResponse, repairResponse] = await Promise.all([
        api.get<ApiResponse<VehicleRepairMaterialOption[]>>('/transport/vehicle-repairs/material-options'),
        mode !== 'START' && vehicle.repairId
          ? api.get<ApiResponse<VehicleRepair>>(`/transport/vehicle-repairs/${vehicle.repairId}`)
          : Promise.resolve(undefined),
      ]);
      return { options: optionsResponse.data.data, repair: repairResponse?.data.data };
    },
  });

  if (!query.data) {
    return (
      <ManagementSheet
        title="Sửa chữa phương tiện"
        saveLabel={query.isLoading ? 'Đang tải dữ liệu' : 'Thử lại'}
        saving={query.isLoading}
        onClose={onClose}
        onSave={() => void query.refetch()}
      >
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      </ManagementSheet>
    );
  }

  return (
    <VehicleRepairEditor
      key={`${mode}-${query.data.repair?.id ?? vehicle.vehicleId}`}
      vehicle={vehicle}
      mode={mode}
      options={query.data.options}
      repair={query.data.repair}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function VehicleRepairEditor({
  vehicle,
  mode,
  options,
  repair,
  onClose,
  onSaved,
}: {
  vehicle: TransportVehicleStatus;
  mode: RepairMode;
  options: VehicleRepairMaterialOption[];
  repair?: VehicleRepair;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [content, setContent] = useState(repair?.content ?? '');
  const [lines, setLines] = useState<RepairLineDraft[]>(() =>
    repair?.materials.map(material => ({
      key: material.id,
      materialId: material.materialId,
      quantity: String(material.quantity),
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const optionsById = new Map(options.map(option => [option.id, option]));
  const totalCost = lines.reduce((total, line) => {
    const material = optionsById.get(line.materialId);
    const quantity = Number(line.quantity.replace(',', '.'));
    return total + (material?.price ?? 0) * (Number.isFinite(quantity) ? quantity : 0);
  }, 0);

  const save = async () => {
    if (!content.trim()) {
      Alert.alert('Thiếu nội dung', 'Nhập nội dung sửa chữa phương tiện.');
      return;
    }
    if (lines.some(line => !line.materialId)) {
      Alert.alert('Thiếu vật tư', 'Chọn vật tư cho tất cả các dòng đã thêm.');
      return;
    }
    if (new Set(lines.map(line => line.materialId)).size !== lines.length) {
      Alert.alert('Vật tư bị trùng', 'Mỗi vật tư chỉ được thêm một lần.');
      return;
    }
    const materials = lines.map(line => ({
      materialId: line.materialId,
      quantity: Number(line.quantity.replace(',', '.')),
    }));
    if (materials.some(material => !Number.isFinite(material.quantity) || material.quantity <= 0)) {
      Alert.alert('Số lượng chưa hợp lệ', 'Số lượng vật tư phải lớn hơn 0.');
      return;
    }
    setSaving(true);
    try {
      const payload = { content: content.trim(), materials };
      if (mode === 'START') {
        await api.post('/transport/vehicle-repairs', { vehicleId: vehicle.vehicleId, ...payload });
      } else if (mode === 'UPDATE') {
        await api.patch(`/transport/vehicle-repairs/${vehicle.repairId}`, payload);
      } else {
        await api.patch(`/transport/vehicle-repairs/${vehicle.repairId}/complete`, payload);
      }
      await onSaved();
      Alert.alert('Thành công', mode === 'START' ? 'Đã đưa xe vào sửa chữa.' : mode === 'UPDATE' ? 'Đã cập nhật sửa chữa.' : 'Đã hoàn tất sửa chữa.');
    } catch (error) {
      Alert.alert('Không thể lưu sửa chữa', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'START' ? 'Đưa xe vào sửa chữa' : mode === 'UPDATE' ? 'Cập nhật sửa chữa' : 'Hoàn tất sửa chữa';
  return (
    <ManagementSheet
      title={`${title} · ${vehicle.licensePlate}`}
      saveLabel={mode === 'START' ? 'Bắt đầu sửa chữa' : mode === 'UPDATE' ? 'Lưu thay đổi' : 'Hoàn tất sửa chữa'}
      saving={saving}
      onClose={onClose}
      onSave={() => void save()}
    >
      <FormInput label="Nội dung sửa chữa *" value={content} onChangeText={setContent} multiline maxLength={2000} />
      <View style={styles.repairHeading}>
        <View style={styles.titleWrap}>
          <Text style={styles.repairTitle}>Vật tư thay thế</Text>
          <Text style={styles.repairHint}>Không bắt buộc nếu sửa chữa không dùng vật tư</Text>
        </View>
        <AppButton
          compact
          tone="secondary"
          label="Thêm vật tư"
          onPress={() => setLines(current => [{ key: `${Date.now()}-${Math.random()}`, materialId: '', quantity: '' }, ...current])}
        />
      </View>
      {lines.map((line, index) => {
        const material = optionsById.get(line.materialId);
        const quantity = Number(line.quantity.replace(',', '.'));
        return (
          <Card key={line.key} tone="soft">
            <View style={styles.lineHeading}>
              <Text style={styles.repairLineTitle}>Vật tư {index + 1}</Text>
              <AppButton compact tone="ghost" label="Bỏ" onPress={() => setLines(current => current.filter(item => item.key !== line.key))} />
            </View>
            <View style={styles.repairFields}>
              <OptionPicker
                label="Vật tư *"
                value={line.materialId}
                placeholder="Chọn vật tư"
                options={options.map(option => ({ value: option.id, label: `${option.materialCode} — ${option.materialName}` }))}
                onChange={materialId => setLines(current => current.map(item => item.key === line.key ? { ...item, materialId } : item))}
              />
              <FormInput
                label={`Số lượng${material ? ` (${material.unitSymbol})` : ''} *`}
                value={line.quantity}
                onChangeText={nextQuantity => setLines(current => current.map(item => item.key === line.key ? { ...item, quantity: nextQuantity } : item))}
                keyboardType="decimal-pad"
              />
              <InfoRow label="Đơn giá" value={material ? formatMoney(material.price) : '—'} />
              <InfoRow label="Thành tiền" value={material && Number.isFinite(quantity) ? formatMoney(material.price * quantity) : '—'} emphasize />
            </View>
          </Card>
        );
      })}
      <Card>
        <InfoRow label="Chi phí vật tư tạm tính" value={formatMoney(totalCost)} emphasize />
      </Card>
    </ManagementSheet>
  );
}

function VehicleRepairHistoryModal({ vehicle, onClose }: { vehicle: TransportVehicleStatus; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['vehicle-repair-history', vehicle.vehicleId],
    queryFn: async () => (
      await api.get<ApiResponse<VehicleRepair[]>>(`/transport/vehicle-repairs/vehicle/${vehicle.vehicleId}`)
    ).data.data,
  });
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <ModalHeader title={`Lịch sử sửa chữa · ${vehicle.licensePlate}`} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.form}>
          {query.isLoading ? <LoadingBlock /> : null}
          {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
          {!query.isLoading && !query.isError && !query.data?.length ? <EmptyState text="Xe chưa có lịch sử sửa chữa." /> : null}
          {query.data?.map(repair => (
            <Card key={repair.id}>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  <Text style={styles.historyType}>{repair.repairCode}</Text>
                  <Text style={styles.content}>{repair.content}</Text>
                </View>
                <StatusBadge label={repair.status === 'COMPLETED' ? 'Đã hoàn tất' : 'Đang sửa chữa'} tone={repair.status === 'COMPLETED' ? 'success' : 'warning'} />
              </View>
              <View style={styles.rows}>
                <InfoRow label="Bắt đầu bởi" value={repair.startedByName} />
                <InfoRow label="Bắt đầu" value={formatDateTime(repair.startedAt)} />
                {repair.completedAt ? <InfoRow label="Hoàn tất bởi" value={repair.completedByName || '—'} /> : null}
                {repair.completedAt ? <InfoRow label="Hoàn tất" value={formatDateTime(repair.completedAt)} /> : null}
              </View>
              {repair.materials.map(material => (
                <View key={material.id} style={styles.repairHistoryMaterial}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.repairMaterialName}>{material.materialName}</Text>
                    <Text style={styles.repairHint}>{material.materialCode} · {material.quantity} {material.unitSymbol}</Text>
                  </View>
                  <Text style={styles.repairMaterialAmount}>{formatMoney(material.amount)}</Text>
                </View>
              ))}
              <InfoRow label="Tổng vật tư" value={formatMoney(repair.totalMaterialCost)} emphasize />
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TripFormModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: 'CREATE' | 'SELF_START';
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [driverUserId, setDriverUserId] = useState('');
  const [rateId, setRateId] = useState('');
  const [content, setContent] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const options = useQuery({
    queryKey: ['transport-trip-options-mobile', mode],
    queryFn: async () =>
      (
        await api.get<ApiResponse<TransportTripOptions>>(
          mode === 'CREATE' ? '/transport/trips/options' : '/transport/trips/self-start-options',
        )
      ).data.data,
  });

  const save = async () => {
    if (!vehicleId || !rateId || (mode === 'CREATE' && !driverUserId) || !content.trim()) {
      Alert.alert('Thiếu thông tin', 'Chọn xe, lộ trình, tài xế và nhập nội dung vận chuyển.');
      return;
    }
    const weight = Number(cargoWeight.replace(',', '.'));
    if (mode === 'SELF_START' && (!Number.isFinite(weight) || weight <= 0)) {
      Alert.alert('Tải trọng chưa hợp lệ', 'Nhập tải trọng hàng lớn hơn 0 kg.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'CREATE') {
        await api.post('/transport/trips', {
          vehicleId,
          driverUserId,
          compensationRateId: rateId,
          content: content.trim(),
          plannedStartAt: null,
          note: note.trim(),
        });
      } else {
        await api.post('/transport/trips/self-start', {
          vehicleId,
          compensationRateId: rateId,
          content: content.trim(),
          cargoWeightKg: weight,
          note: note.trim(),
        });
      }
      await onSaved();
    } catch (error) {
      Alert.alert('Không thể tạo chuyến xe', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ModalHeader title={mode === 'CREATE' ? 'Phân công chuyến xe' : 'Bắt đầu chuyến xe'} onClose={onClose} onSave={() => void save()} />
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {options.isLoading ? <LoadingBlock /> : null}
            {options.isError ? <ErrorState text={getApiErrorMessage(options.error)} onRetry={() => void options.refetch()} /> : null}
            {options.data ? (
              <>
                <OptionPicker
                  label="Phương tiện"
                  value={vehicleId}
                  placeholder="Chọn xe đang rảnh"
                  options={options.data.vehicles.filter(item => item.operatingStatus === 'IDLE').map(item => ({ value: item.id, label: `${item.licensePlate} — ${item.vehicleTypeName}` }))}
                  onChange={value => {
                    setVehicleId(value);
                    if (mode === 'CREATE') {
                      const vehicle = options.data?.vehicles.find(item => item.id === value);
                      const manager = options.data?.drivers?.find(item => item.id === vehicle?.managerUserId && item.operatingStatus === 'IDLE');
                      if (manager) setDriverUserId(manager.id);
                    }
                  }}
                />
                {mode === 'CREATE' ? (
                  <OptionPicker
                    label="Tài xế"
                    value={driverUserId}
                    placeholder="Chọn tài xế đang rảnh"
                    options={(options.data.drivers || []).filter(item => item.operatingStatus === 'IDLE').map(item => ({ value: item.id, label: `${item.fullName} (@${item.username})` }))}
                    onChange={setDriverUserId}
                  />
                ) : null}
                <OptionPicker
                  label="Lộ trình"
                  value={rateId}
                  placeholder="Chọn từ bảng khoán"
                  options={options.data.rates.map(item => ({ value: item.id, label: `${item.transportPoint} — ${item.content}` }))}
                  onChange={value => {
                    setRateId(value);
                    const rate = options.data?.rates.find(item => item.id === value);
                    if (rate && !content.trim()) setContent(rate.content);
                  }}
                />
                <FormInput label="Nội dung vận chuyển" value={content} onChangeText={setContent} />
                {mode === 'SELF_START' ? <FormInput label="Tải trọng hàng (kg)" value={cargoWeight} onChangeText={setCargoWeight} keyboardType="decimal-pad" /> : null}
                <FormInput label="Ghi chú" value={note} onChangeText={setNote} multiline />
                <AppButton label={mode === 'CREATE' ? 'Phân công chuyến' : 'Bắt đầu chuyến'} loading={saving} onPress={() => void save()} />
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function TripActionModal({
  action,
  onClose,
  onSaved,
}: {
  action: { kind: ActionKind; trip: TransportTrip };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const label = action.kind === 'START' ? 'Tải trọng hàng (kg)' : action.kind === 'CANCEL' ? 'Lý do hủy chuyến' : 'Ghi chú hoàn thành';
  const title = action.kind === 'START' ? 'Bắt đầu chuyến' : action.kind === 'COMPLETE' ? 'Hoàn thành chuyến' : 'Hủy chuyến';

  const save = async () => {
    const input = text.trim();
    if (action.kind === 'START') {
      const weight = Number(input.replace(',', '.'));
      if (!Number.isFinite(weight) || weight <= 0) {
        Alert.alert('Tải trọng chưa hợp lệ', 'Nhập tải trọng hàng lớn hơn 0 kg.');
        return;
      }
    }
    if (action.kind === 'CANCEL' && input.length < 3) {
      Alert.alert('Thiếu lý do', 'Lý do hủy phải có ít nhất 3 ký tự.');
      return;
    }
    setSaving(true);
    try {
      if (action.kind === 'START') {
        await api.post(`/transport/trips/${action.trip.id}/start`, { cargoWeightKg: Number(input.replace(',', '.')) });
      } else if (action.kind === 'COMPLETE') {
        await api.post(`/transport/trips/${action.trip.id}/complete`, { note: input });
      } else {
        await api.post(`/transport/trips/${action.trip.id}/cancel`, { reason: input });
      }
      await onSaved();
    } catch (error) {
      Alert.alert(`Không thể ${title.toLocaleLowerCase('vi-VN')}`, getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.dialogBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogSubtitle}>{action.trip.tripCode} · {action.trip.licensePlate}</Text>
          <FormInput
            autoFocus
            label={label}
            value={text}
            onChangeText={setText}
            multiline={action.kind !== 'START'}
            keyboardType={action.kind === 'START' ? 'decimal-pad' : 'default'}
          />
          <View style={styles.dialogActions}>
            <View style={{ flex: 1 }}><AppButton tone="secondary" label="Đóng" onPress={onClose} /></View>
            <View style={{ flex: 1 }}><AppButton tone={action.kind === 'CANCEL' ? 'danger' : 'primary'} label="Xác nhận" loading={saving} onPress={() => void save()} /></View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TripHistoryModal({ trip, onClose }: { trip: TransportTrip; onClose: () => void }) {
  const { can, token } = useAuth();
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string>();
  const [previewImage, setPreviewImage] = useState<NonNullable<TransportTripEvent['images']>[number]>();
  const events = useQuery({
    queryKey: ['transport-trip-events-mobile', trip.id],
    queryFn: async () => (await api.get<ApiResponse<TransportTripEvent[]>>(`/transport/trips/${trip.id}/events`)).data.data,
  });
  const resolveIncident = (event: TransportTripEvent) => {
    Alert.alert('Đánh dấu đã xử lý?', 'Sự cố sẽ được chuyển sang trạng thái đã xử lý.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: () => {
          setResolvingId(event.id);
          void api.patch(`/transport/trips/${trip.id}/incidents/resolve`, { incidentId: event.id })
            .then(async () => {
              await events.refetch();
              await queryClient.invalidateQueries({ queryKey: ['transport-vehicles-mobile'] });
              await queryClient.invalidateQueries({ queryKey: ['transport-trips-mobile'] });
            })
            .catch(error => Alert.alert('Không thể xử lý sự cố', getApiErrorMessage(error)))
            .finally(() => setResolvingId(undefined));
        },
      },
    ]);
  };
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <ModalHeader title={`Lịch sử ${trip.tripCode}`} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.form}>
          {events.isLoading ? <LoadingBlock /> : null}
          {events.isError ? <ErrorState text={getApiErrorMessage(events.error)} onRetry={() => void events.refetch()} /> : null}
          {!events.isLoading && !events.data?.length ? <EmptyState text="Chưa có sự kiện." /> : null}
          {events.data?.map(event => (
            <Card key={event.id}>
              <View style={styles.heading}>
                <Text style={styles.historyType}>{event.eventType}</Text>
                <Text style={styles.historyTime}>{formatDateTime(event.occurredAt)}</Text>
              </View>
              <InfoRow label="Thực hiện bởi" value={event.actorName} />
              {event.expenseType ? <InfoRow label={event.expenseType} value={formatMoney(event.amount)} /> : null}
              {event.images?.length && token ? (
                <View style={styles.incidentGallery}>
                  <Text style={styles.incidentGalleryTitle}>Ảnh sự cố ({event.images.length})</Text>
                  <View style={styles.incidentImages}>
                    {event.images.map(image => (
                      <Pressable key={image.id} onPress={() => setPreviewImage(image)}>
                        <Image
                          source={{
                            uri: `${apiBaseUrl}/transport/trips/incident-images/${image.id}`,
                            headers: { Authorization: `Bearer ${token}` },
                          }}
                          style={styles.incidentImage}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {event.note ? <Text style={styles.content}>{event.note}</Text> : null}
              {event.eventType === 'INCIDENT_REPORTED' ? (
                <View style={styles.historyStatus}>
                  <StatusBadge label={event.resolvedAt ? 'Đã xử lý' : 'Chưa xử lý'} tone={event.resolvedAt ? 'success' : 'danger'} />
                  {!event.resolvedAt && can(permissions.transportTripsOperate) ? (
                    <AppButton compact label="Đánh dấu đã xử lý" loading={resolvingId === event.id} onPress={() => resolveIncident(event)} />
                  ) : null}
                </View>
              ) : null}
            </Card>
          ))}
        </ScrollView>
        {previewImage && token ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewImage(undefined)}>
            <View style={styles.imagePreviewBackdrop}>
              <Pressable style={styles.imagePreviewClose} onPress={() => setPreviewImage(undefined)}>
                <Text style={styles.imagePreviewCloseText}>Đóng</Text>
              </Pressable>
              <Image
                source={{
                  uri: `${apiBaseUrl}/transport/trips/incident-images/${previewImage.id}`,
                  headers: { Authorization: `Bearer ${token}` },
                }}
                resizeMode="contain"
                style={styles.imagePreview}
              />
              <Text style={styles.imagePreviewCaption}>{previewImage.fileName}</Text>
            </View>
          </Modal>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function ModalHeader({ title, onClose, onSave }: { title: string; onClose: () => void; onSave?: () => void }) {
  return (
    <View style={styles.modalHeader}>
      <Pressable onPress={onClose}><Text style={styles.cancel}>Hủy</Text></Pressable>
      <Text style={styles.modalTitle}>{title}</Text>
      {onSave ? <Pressable onPress={onSave}><Text style={styles.save}>Lưu</Text></Pressable> : <View style={{ width: 32 }} />}
    </View>
  );
}

function FormInput({ label, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.textPlaceholder} style={[styles.input, props.multiline && styles.textArea]} />
    </View>
  );
}

function OptionPicker({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.select}>
        <Text style={selected ? styles.selectText : styles.selectPlaceholder}>{selected?.label || placeholder}</Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.optionBackdrop}>
          <View style={styles.optionSheet}>
            <View style={styles.optionHeader}>
              <Text style={styles.dialogTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)}><Text style={styles.cancel}>Đóng</Text></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 430 }}>
              {!options.length ? <EmptyState text="Không có lựa chọn phù hợp." /> : null}
              {options.map(option => (
                <Pressable
                  key={option.value}
                  onPress={() => { onChange(option.value); setOpen(false); }}
                  style={[styles.option, option.value === value && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, option.value === value && styles.optionTextSelected]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  titleWrap: { flex: 1 },
  code: { color: colors.text, fontWeight: '700', fontSize: 16 },
  plate: { color: colors.primary, fontWeight: '700', marginTop: 4, fontSize: 16 },
  vehiclePlate: { color: colors.text, fontWeight: '700', fontSize: 20, letterSpacing: 0.5 },
  vehicleType: { color: colors.primaryDark, marginTop: 4, fontWeight: '800' },
  route: { color: colors.text, marginTop: 14, fontWeight: '700', lineHeight: 20 },
  rows: { marginTop: 8 },
  content: { color: colors.textMuted, marginTop: 9, lineHeight: 20 },
  cancelReason: { color: colors.danger, marginTop: 9, lineHeight: 19, fontSize: 12 },
  incident: { color: colors.danger, fontWeight: '800', marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end', marginTop: 13 },
  repairHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 3 },
  repairTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  repairHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  lineHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  repairLineTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  repairFields: { gap: 11, marginTop: 7 },
  repairHistoryMaterial: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  repairMaterialName: { color: colors.text, fontWeight: '800' },
  repairMaterialAmount: { color: colors.primaryDark, fontWeight: '900' },
  headerActions: { flexDirection: 'row', gap: 6 },
  modalSafeArea: { flex: 1, backgroundColor: colors.background },
  modalHeader: { minHeight: ui.headerHeight, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cancel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  save: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  form: { padding: 12, gap: 12 },
  field: { gap: 7 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  input: { minHeight: ui.controlHeight, borderRadius: ui.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 9, color: colors.text },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  select: { minHeight: ui.controlHeight, borderRadius: ui.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  selectText: { flex: 1, color: colors.text, fontSize: 14 },
  selectPlaceholder: { flex: 1, color: colors.textPlaceholder, fontSize: 14 },
  chevron: { color: colors.textMuted, fontSize: 18 },
  dialogBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.48)' },
  dialog: { padding: 16, borderRadius: ui.cardRadius, backgroundColor: colors.surface, gap: 12 },
  dialogTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  dialogSubtitle: { color: colors.textMuted, fontSize: 13 },
  dialogActions: { flexDirection: 'row', gap: 9, marginTop: 4 },
  historyType: { color: colors.text, fontSize: 15, fontWeight: '900' },
  historyTime: { color: colors.textMuted, fontSize: 11 },
  historyStatus: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  incidentGallery: { gap: 8, marginTop: 10 },
  incidentGalleryTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  incidentImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  incidentImage: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#E4E7EC' },
  imagePreviewBackdrop: { flex: 1, padding: 18, paddingTop: 54, paddingBottom: 30, backgroundColor: 'rgba(4, 12, 24, 0.94)' },
  imagePreviewClose: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  imagePreviewCloseText: { color: '#FFFFFF', fontWeight: '900' },
  imagePreview: { flex: 1, width: '100%' },
  imagePreviewCaption: { color: '#FFFFFF', textAlign: 'center', fontSize: 12, marginTop: 10 },
  optionBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.48)' },
  optionSheet: { maxHeight: '72%', paddingBottom: 24, borderTopLeftRadius: ui.cardRadius, borderTopRightRadius: ui.cardRadius, backgroundColor: colors.surface },
  optionHeader: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  option: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 11, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optionSelected: { backgroundColor: colors.primarySoft },
  optionText: { color: colors.text, lineHeight: 20 },
  optionTextSelected: { color: colors.primaryDark, fontWeight: '800' },
});
