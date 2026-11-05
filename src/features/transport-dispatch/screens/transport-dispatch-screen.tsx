import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImagePickerAsset } from "expo-image-picker";
import { useState, type ComponentProps } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import {
  OptionPicker as FilterOptionPicker,
  FormLabel,
  FormValidationProvider,
  ManagementSheet,
  useFormFieldError,
} from "@/components/forms/management-form";
import { ManagerContact } from "@/components/manager-contact";
import { Screen } from "@/components/screen";
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
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { permissions } from "@/features/auth/permissions";
import {
  appendMaterialImages,
  MaterialEvidencePicker,
} from "@/features/material-warehouse/components/material-document-create";
import { decimalStringSchema, requiredTextSchema } from "@/lib/validation";
import {
  api,
  apiBaseUrl,
  getApiErrorMessage,
  getProtectedApiHeaders,
  hasProtectedApiSession,
} from "@/services/api";
import { colors } from "@/theme/colors";
import type { ApiResponse } from "@/types/api";
import type {
  TransportTrip,
  TransportTripEvent,
  TransportTripOptions,
  TransportTripsResponse,
  TransportTripStatus,
  TransportVehicleStatus,
  VehicleOperatingStatus,
  VehicleRepair,
  VehicleRepairMaterialOption,
} from "@/types/models";
import { formatDateTime, formatMoney, formatWeight } from "@/utils/format";

const positiveDecimalSchema = decimalStringSchema({
  minimum: 0.000001,
  message: "Giá trị phải lớn hơn 0.",
});
const contentSchema = z
  .string()
  .trim()
  .min(2, "Nội dung phải có ít nhất 2 ký tự.");
const cancellationReasonSchema = z
  .string()
  .trim()
  .min(3, "Lý do hủy phải có ít nhất 3 ký tự.");
const repairLineSchema = z.object({
  key: z.string(),
  materialId: requiredTextSchema,
  quantity: positiveDecimalSchema,
});
const repairDraftSchema = z
  .object({
    content: requiredTextSchema,
    lines: z.array(repairLineSchema),
  })
  .superRefine((value, context) => {
    const ids = value.lines.map((line) => line.materialId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Mỗi vật tư chỉ được thêm một lần.",
      });
    }
  });

const statusLabels: Record<TransportTripStatus, string> = {
  ASSIGNED: "Đã phân công",
  IN_PROGRESS: "Đang di chuyển",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const vehicleStatusLabels: Record<VehicleOperatingStatus, string> = {
  IDLE: "Đang rảnh",
  ASSIGNED: "Đã phân công",
  IN_PROGRESS: "Đang vận chuyển",
  MAINTENANCE: "Đang sửa chữa",
};

const tripEventLabels: Record<string, string> = {
  CREATED: "Đã tạo và phân công chuyến",
  ASSIGNED: "Đã phân công chuyến",
  STARTED: "Đã bắt đầu chuyến",
  COMPLETED: "Đã hoàn thành chuyến",
  CANCELLED: "Đã hủy chuyến",
  INCIDENT_REPORTED: "Đã báo sự cố",
  INCIDENT_RESOLVED: "Đã xử lý sự cố",
  EXPENSE_ADDED: "Đã thêm chi phí",
};

function tripEventLabel(eventType: string) {
  return tripEventLabels[eventType] ?? "Đã cập nhật chuyến xe";
}

type TripEventImage = NonNullable<TransportTripEvent["images"]>[number];

function TripEventCard({
  event,
  token,
  resolving = false,
  onPreviewImage,
  onResolve,
}: {
  event: TransportTripEvent;
  token: string | null;
  resolving?: boolean;
  onPreviewImage: (image: TripEventImage) => void;
  onResolve?: (event: TransportTripEvent) => void;
}) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <Text className="text-[15px] font-bold text-content">
          {tripEventLabel(event.eventType)}
        </Text>
        <Text className="text-caption text-content-muted">
          {formatDateTime(event.occurredAt)}
        </Text>
      </View>
      <InfoRow label="Thực hiện bởi" value={event.actorName} />
      {event.expenseType ? (
        <>
          <InfoRow label="Loại chi phí" value={event.expenseType} />
          <InfoRow
            label="Số tiền"
            value={formatMoney(event.amount)}
            emphasize
          />
        </>
      ) : null}
      {event.images?.length && hasProtectedApiSession(token) ? (
        <View className="mt-2.5 gap-2">
          <Text className="text-xs font-bold text-content">
            Ảnh sự cố ({event.images.length})
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {event.images.map((image) => (
              <Pressable key={image.id} onPress={() => onPreviewImage(image)}>
                <Image
                  source={{
                    uri: `${apiBaseUrl}/transport/trips/incident-images/${image.id}`,
                    headers: getProtectedApiHeaders(token),
                  }}
                  className="h-[70px] w-[70px] rounded-[10px] bg-[#E4E7EC]"
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {event.note ? (
        <View className="mt-2 gap-1">
          <Text className="text-caption font-semibold text-content-muted">
            {event.eventType === "INCIDENT_REPORTED"
              ? "Nội dung sự cố"
              : "Ghi chú"}
          </Text>
          <Text className="leading-5 text-content">{event.note}</Text>
        </View>
      ) : null}
      {event.eventType === "INCIDENT_REPORTED" ? (
        <>
          {event.resolvedAt ? (
            <View className="mt-1">
              {event.resolvedByName ? (
                <InfoRow label="Xử lý bởi" value={event.resolvedByName} />
              ) : null}
              <InfoRow
                label="Xử lý lúc"
                value={formatDateTime(event.resolvedAt)}
              />
            </View>
          ) : null}
          <View className="mt-2.5 flex-row flex-wrap items-center justify-between gap-2">
            <StatusBadge
              label={event.resolvedAt ? "Đã xử lý" : "Chưa xử lý"}
              tone={event.resolvedAt ? "success" : "danger"}
            />
            {!event.resolvedAt && onResolve ? (
              <AppButton
                compact
                label="Đánh dấu đã xử lý"
                loading={resolving}
                onPress={() => onResolve(event)}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </Card>
  );
}

function TripImagePreview({
  image,
  token,
  onClose,
}: {
  image?: TripEventImage;
  token: string | null;
  onClose: () => void;
}) {
  if (!image || !hasProtectedApiSession(token)) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-[rgba(4,12,24,0.94)] px-[18px] pb-[30px] pt-[54px]">
        <Pressable
          className="self-end rounded-full bg-[rgba(255,255,255,0.14)] px-4 py-[9px]"
          onPress={onClose}
        >
          <Text className="font-bold text-white">Đóng</Text>
        </Pressable>
        <Image
          source={{
            uri: `${apiBaseUrl}/transport/trips/incident-images/${image.id}`,
            headers: getProtectedApiHeaders(token),
          }}
          resizeMode="contain"
          className="w-full flex-1"
        />
        <Text className="mt-2.5 text-center text-xs text-white">
          {image.fileName}
        </Text>
      </View>
    </Modal>
  );
}

type TripStatusFilter = "ALL" | TransportTripStatus;
type ActionKind = "START" | "COMPLETE" | "CANCEL";
type OccurrenceKind = "INCIDENT" | "EXPENSE";
type TripActionTarget = Pick<TransportTrip, "id" | "tripCode" | "licensePlate">;

function tripStatusTone(status: TransportTripStatus) {
  if (status === "IN_PROGRESS" || status === "COMPLETED")
    return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "warning" as const;
}
function TripTableRow({
  trip,
  isLast,
  canOperate,
  canCancel,
  canDelete,
  onAction,
  onDelete,
  onHistory,
  onOccurrence,
}: {
  trip: TransportTrip;
  isLast: boolean;
  canOperate: boolean;
  canCancel: boolean;
  canDelete: boolean;
  onAction: (kind: ActionKind, trip: TransportTrip) => void;
  onDelete: (trip: TripActionTarget) => void;
  onHistory: (trip: TransportTrip) => void;
  onOccurrence: (kind: OccurrenceKind, trip: TransportTrip) => void;
}) {
  const actions = [
    { label: "Lịch sử", onPress: () => onHistory(trip) },
    ...(trip.status === "ASSIGNED" && canOperate
      ? [{ label: "Bắt đầu", onPress: () => onAction("START" as const, trip) }]
      : []),
    ...(trip.status === "IN_PROGRESS" && canOperate
      ? [
          {
            label: "Sự cố",
            onPress: () => onOccurrence("INCIDENT" as const, trip),
          },
          {
            label: "Chi phí",
            onPress: () => onOccurrence("EXPENSE" as const, trip),
          },
          {
            label: "Hoàn thành",
            onPress: () => onAction("COMPLETE" as const, trip),
          },
        ]
      : []),
    ...((trip.status === "ASSIGNED" || trip.status === "IN_PROGRESS") &&
    canCancel
      ? [
          {
            label: "Hủy chuyến",
            tone: "danger" as const,
            onPress: () => onAction("CANCEL" as const, trip),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: "Xóa chuyến",
            tone: "danger" as const,
            onPress: () => onDelete(trip),
          },
        ]
      : []),
  ];
  return (
    <View
      className={`min-h-[82px] flex-row items-center gap-2 px-2.5 py-2 ${isLast ? "" : "border-b border-border"}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem lịch sử chuyến ${trip.tripCode}`}
        onPress={() => onHistory(trip)}
        className="min-w-0 flex-1 flex-row items-center gap-2 self-stretch"
        style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      >
        <View className="min-w-0 flex-[1.05] justify-center">
          <Text numberOfLines={1} className="text-body font-bold text-content">
            {trip.tripCode}
          </Text>
          <Text
            numberOfLines={1}
            className="mt-0.5 text-body font-bold text-primary-dark"
          >
            {trip.licensePlate}
          </Text>
          <View className="mt-1">
            <StatusBadge
              label={statusLabels[trip.status]}
              tone={tripStatusTone(trip.status)}
            />
          </View>
          {trip.status === "CANCELLED" && trip.cancellationReason ? (
            <Text numberOfLines={2} className="mt-1 text-caption text-danger">
              Lý do: {trip.cancellationReason}
            </Text>
          ) : null}
        </View>
        <View className="min-w-0 flex-1 justify-center">
          <Text
            numberOfLines={2}
            className="text-body font-semibold text-content"
          >
            {trip.routeSnapshot}
          </Text>
          <View className="mt-0.5">
            <ManagerContact
              name={trip.driverFullName}
              phone={trip.driverPhone}
            />
          </View>
        </View>
      </Pressable>
      <View className="w-[34px] shrink-0 items-end">
        <ActionMenu
          label={`Thao tác chuyến ${trip.tripCode}`}
          items={actions}
        />
      </View>
    </View>
  );
}
type RepairMode = "START" | "UPDATE" | "COMPLETE";

function VehicleTableRow({
  vehicle,
  isLast,
  canCreate,
  canOperate,
  canDelete,
  canStartAssigned,
  canViewTripHistory,
  onAssign,
  onStartTrip,
  onTripDetail,
  onTripHistory,
  onDeleteTrip,
  onRepair,
  onRepairHistory,
}: {
  vehicle: TransportVehicleStatus;
  isLast: boolean;
  canCreate: boolean;
  canOperate: boolean;
  canDelete: boolean;
  canStartAssigned: boolean;
  canViewTripHistory: boolean;
  onAssign: (vehicle: TransportVehicleStatus) => void;
  onStartTrip: (vehicle: TransportVehicleStatus) => void;
  onTripDetail: (vehicle: TransportVehicleStatus) => void;
  onTripHistory: (vehicle: TransportVehicleStatus) => void;
  onDeleteTrip: (trip: TripActionTarget) => void;
  onRepair: (mode: RepairMode, vehicle: TransportVehicleStatus) => void;
  onRepairHistory: (vehicle: TransportVehicleStatus) => void;
}) {
  const tone =
    vehicle.operatingStatus === "IDLE"
      ? "success"
      : vehicle.operatingStatus === "MAINTENANCE"
        ? "danger"
        : "warning";
  const actions = [
    ...(canCreate && vehicle.operatingStatus === "IDLE"
      ? [{ label: "Phân công", onPress: () => onAssign(vehicle) }]
      : []),
    ...(canOperate &&
    (vehicle.operatingStatus === "IDLE" ||
      (vehicle.operatingStatus === "ASSIGNED" && canStartAssigned))
      ? [{ label: "Bắt đầu chuyến", onPress: () => onStartTrip(vehicle) }]
      : []),
    ...(canViewTripHistory
      ? [{ label: "Lịch sử chuyến", onPress: () => onTripHistory(vehicle) }]
      : []),
    ...(canDelete && vehicle.tripId && vehicle.tripCode
      ? [
          {
            label: "Xóa chuyến",
            tone: "danger" as const,
            onPress: () =>
              onDeleteTrip({
                id: vehicle.tripId!,
                tripCode: vehicle.tripCode!,
                licensePlate: vehicle.licensePlate,
              }),
          },
        ]
      : []),
    ...(canOperate && vehicle.operatingStatus === "IDLE"
      ? [
          {
            label: "Sửa chữa",
            onPress: () => onRepair("START" as const, vehicle),
          },
        ]
      : []),
    ...(canOperate &&
    vehicle.operatingStatus === "MAINTENANCE" &&
    vehicle.repairId
      ? [
          {
            label: "Cập nhật sửa chữa",
            onPress: () => onRepair("UPDATE" as const, vehicle),
          },
          {
            label: "Hoàn tất sửa chữa",
            onPress: () => onRepair("COMPLETE" as const, vehicle),
          },
        ]
      : []),
    { label: "Lịch sử sửa chữa", onPress: () => onRepairHistory(vehicle) },
  ];
  const hasTrip = Boolean(vehicle.tripId);
  const contactName = hasTrip
    ? vehicle.driverFullName
    : vehicle.managerFullName;
  const contactPhone = hasTrip ? vehicle.driverPhone : vehicle.managerPhone;
  return (
    <View
      className={`min-h-[82px] flex-row items-center gap-2 px-2.5 py-2 ${isLast ? "" : "border-b border-border"}`}
    >
      <View className="min-w-0 flex-[1.05]">
        <Text numberOfLines={1} className="text-body font-bold text-content">
          {vehicle.licensePlate}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-0.5 text-xs font-semibold text-primary-dark"
        >
          {vehicle.vehicleTypeName}
        </Text>
        <View className="mt-1">
          <StatusBadge
            label={vehicleStatusLabels[vehicle.operatingStatus]}
            tone={tone}
          />
        </View>
      </View>
      <View className="min-w-0 flex-1">
        <ManagerContact name={contactName} phone={contactPhone} />
        {vehicle.tripCode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem chi tiết chuyến ${vehicle.tripCode}`}
            hitSlop={4}
            onPress={() => onTripDetail(vehicle)}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
          >
            <Text
              numberOfLines={1}
              className="mt-0.5 text-body font-semibold text-primary-dark underline"
            >
              {vehicle.tripCode}
            </Text>
          </Pressable>
        ) : vehicle.repairCode ? (
          <Text
            numberOfLines={1}
            className="mt-0.5 text-xs font-bold text-primary-dark"
          >
            {vehicle.repairCode}
          </Text>
        ) : null}
        {vehicle.unresolvedIncidentCount > 0 ? (
          <Text
            numberOfLines={1}
            className="mt-0.5 text-caption font-semibold text-danger"
          >
            {vehicle.unresolvedIncidentCount} sự cố chưa xử lý
          </Text>
        ) : null}
      </View>
      <View className="w-[34px] shrink-0 items-end">
        <ActionMenu
          label={`Thao tác phương tiện ${vehicle.licensePlate}`}
          items={actions}
        />
      </View>
    </View>
  );
}
export default function TransportScreen() {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const allowed = can(permissions.transportTripsView);
  const canCreate = can(permissions.transportTripsCreate);
  const canOperate = can(permissions.transportTripsOperate);
  const canCancel = can(permissions.transportTripsCancel);
  const canDelete = can(permissions.transportTripsDelete);
  const [view, setView] = useState<"vehicles" | "trips">("vehicles");
  const [status, setStatus] = useState<TripStatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"CREATE" | "SELF_START">();
  const [formVehicleId, setFormVehicleId] = useState<string>();
  const [action, setAction] = useState<{
    kind: ActionKind;
    trip: TripActionTarget;
  }>();
  const [tripDetailVehicle, setTripDetailVehicle] =
    useState<TransportVehicleStatus>();
  const [historyTrip, setHistoryTrip] = useState<TransportTrip>();
  const [tripHistoryVehicle, setTripHistoryVehicle] =
    useState<TransportVehicleStatus>();
  const [occurrence, setOccurrence] = useState<{
    kind: OccurrenceKind;
    trip: TransportTrip;
  }>();
  const [repairAction, setRepairAction] = useState<{
    mode: RepairMode;
    vehicle: TransportVehicleStatus;
  }>();
  const [repairHistoryVehicle, setRepairHistoryVehicle] =
    useState<TransportVehicleStatus>();
  const trips = useQuery({
    queryKey: ["transport-trips-mobile", status],
    enabled: allowed && view === "trips",
    queryFn: async () =>
      (
        await api.get<TransportTripsResponse>("/transport/trips", {
          params: {
            page: 1,
            limit: 100,
            status: status === "ALL" ? undefined : status,
          },
        })
      ).data.data,
    refetchInterval:
      status === "ALL" || status === "ASSIGNED" || status === "IN_PROGRESS"
        ? 15_000
        : false,
  });
  const vehicles = useQuery({
    queryKey: ["transport-vehicles-mobile"],
    enabled: allowed && view === "vehicles",
    queryFn: async () =>
      (
        await api.get<ApiResponse<TransportVehicleStatus[]>>(
          "/transport/trips/vehicles",
        )
      ).data.data,
    refetchInterval: 15_000,
  });
  const normalizedSearch = search.trim().toLocaleLowerCase("vi-VN");
  const matchesSearch = (...values: (string | null | undefined)[]) =>
    !normalizedSearch ||
    values.some((value) =>
      value?.toLocaleLowerCase("vi-VN").includes(normalizedSearch),
    );
  const filteredVehicles = (vehicles.data ?? []).filter((vehicle) =>
    matchesSearch(
      vehicle.licensePlate,
      vehicle.vehicleTypeName,
      vehicle.managerFullName,
      vehicle.managerPhone,
      vehicle.tripCode,
      vehicle.driverFullName,
      vehicle.driverPhone,
      vehicle.routeSnapshot,
    ),
  );
  const filteredTrips = (trips.data ?? []).filter((trip) =>
    matchesSearch(
      trip.tripCode,
      trip.licensePlate,
      trip.vehicleTypeName,
      trip.driverFullName,
      trip.driverPhone,
      trip.routeSnapshot,
      trip.content,
    ),
  );

  const activeQuery = view === "vehicles" ? vehicles : trips;
  const refreshAll = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["transport-trips-mobile"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["transport-vehicles-mobile"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["transport-vehicle-trip-history"],
    });
  };
  const deleteTrip = (trip: TripActionTarget) => {
    Alert.alert(
      "Xóa chuyến xe?",
      `Xóa ${trip.tripCode} · ${trip.licensePlate}? Toàn bộ lịch sử, sự cố, hình ảnh và chi phí của chuyến cũng sẽ bị xóa.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            void api
              .delete(`/transport/trips/${trip.id}`)
              .then(async () => {
                await refreshAll();
                Alert.alert("Đã xóa", `Đã xóa chuyến ${trip.tripCode}.`);
              })
              .catch((error) =>
                Alert.alert("Không thể xóa chuyến", getApiErrorMessage(error)),
              );
          },
        },
      ],
    );
  };

  const headerAction = (
    <View className="flex-row gap-1.5">
      {canCreate ? (
        <AppButton
          compact
          label="Phân công"
          onPress={() => {
            setFormVehicleId(undefined);
            setFormMode("CREATE");
          }}
        />
      ) : null}
      {!canCreate && canOperate ? (
        <AppButton
          compact
          label="Bắt đầu"
          onPress={() => {
            setFormVehicleId(undefined);
            setFormMode("SELF_START");
          }}
        />
      ) : null}
    </View>
  );

  return (
    <>
      <Screen
        title="Điều phối xe"
        subtitle={
          <SearchField
            showIcon={false}
            placeholder={
              view === "vehicles" ? "Tìm phương tiện..." : "Tìm chuyến xe..."
            }
            value={search}
            onChangeText={setSearch}
          />
        }
        action={headerAction}
        refreshing={activeQuery.isRefetching}
        onRefresh={allowed ? () => void activeQuery.refetch() : undefined}
      >
        {!allowed ? (
          <EmptyState text="Tài khoản chưa có quyền xem danh sách chuyến xe." />
        ) : null}
        {allowed ? (
          <View className="flex-row items-center justify-between gap-2">
            <ChoiceChips
              value={view}
              options={[
                { value: "vehicles", label: "Phương tiện" },
                { value: "trips", label: "Chuyến xe" },
              ]}
              onChange={setView}
            />
            {view === "trips" ? (
              <View className="min-w-0 flex-1">
                <FilterOptionPicker
                  hideLabel
                  label="Trạng thái chuyến"
                  value={status}
                  options={[
                    { value: "ALL", label: "Tất cả trạng thái" },
                    { value: "ASSIGNED", label: statusLabels.ASSIGNED },
                    { value: "IN_PROGRESS", label: statusLabels.IN_PROGRESS },
                    { value: "COMPLETED", label: statusLabels.COMPLETED },
                    { value: "CANCELLED", label: statusLabels.CANCELLED },
                  ]}
                  onChange={(value) => setStatus(value as TripStatusFilter)}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {activeQuery.isLoading ? <LoadingBlock /> : null}
        {activeQuery.isError ? (
          <ErrorState
            text={getApiErrorMessage(activeQuery.error)}
            onRetry={() => void activeQuery.refetch()}
          />
        ) : null}
        {view === "vehicles" &&
        !vehicles.isLoading &&
        !vehicles.isError &&
        !filteredVehicles.length ? (
          <EmptyState
            text={
              normalizedSearch
                ? "Không tìm thấy phương tiện phù hợp."
                : "Chưa có phương tiện nào."
            }
          />
        ) : null}
        {view === "vehicles" && filteredVehicles.length ? (
          <Card padded={false} className="-mx-page-x overflow-hidden">
            <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-[1.05] text-caption font-semibold text-content-muted">
                Phương tiện
              </Text>
              <Text className="min-w-0 flex-1 text-caption font-semibold text-content-muted">
                Liên hệ / chuyến
              </Text>
              <View className="w-[34px] shrink-0" />
            </View>
            {filteredVehicles.map((vehicle, index) => (
              <VehicleTableRow
                key={vehicle.vehicleId}
                vehicle={vehicle}
                isLast={index === filteredVehicles.length - 1}
                canCreate={canCreate}
                canOperate={canOperate}
                canDelete={canDelete}
                canStartAssigned={
                  vehicle.driverUserId === user?.id || canCreate || canCancel
                }
                canViewTripHistory={allowed}
                onAssign={(selectedVehicle) => {
                  setFormVehicleId(selectedVehicle.vehicleId);
                  setFormMode("CREATE");
                }}
                onStartTrip={(selectedVehicle) => {
                  if (
                    selectedVehicle.operatingStatus === "ASSIGNED" &&
                    selectedVehicle.tripId &&
                    selectedVehicle.tripCode
                  ) {
                    setAction({
                      kind: "START",
                      trip: {
                        id: selectedVehicle.tripId,
                        tripCode: selectedVehicle.tripCode,
                        licensePlate: selectedVehicle.licensePlate,
                      },
                    });
                    return;
                  }
                  setFormVehicleId(selectedVehicle.vehicleId);
                  setFormMode("SELF_START");
                }}
                onTripDetail={setTripDetailVehicle}
                onTripHistory={setTripHistoryVehicle}
                onDeleteTrip={deleteTrip}
                onRepair={(mode, selectedVehicle) =>
                  setRepairAction({ mode, vehicle: selectedVehicle })
                }
                onRepairHistory={setRepairHistoryVehicle}
              />
            ))}
          </Card>
        ) : null}
        {view === "trips" &&
        !trips.isLoading &&
        !trips.isError &&
        !filteredTrips.length ? (
          <EmptyState
            text={
              normalizedSearch
                ? "Không tìm thấy chuyến xe phù hợp."
                : "Chưa có chuyến xe phù hợp."
            }
          />
        ) : null}
        {view === "trips" && filteredTrips.length ? (
          <Card padded={false} className="-mx-page-x overflow-hidden">
            <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-[1.05] text-caption font-semibold text-content-muted">
                Chuyến xe
              </Text>
              <Text className="min-w-0 flex-1 text-caption font-semibold text-content-muted">
                Lộ trình / tài xế
              </Text>
              <View className="w-[34px] shrink-0" />
            </View>
            {filteredTrips.map((trip, index) => (
              <TripTableRow
                key={trip.id}
                trip={trip}
                isLast={index === filteredTrips.length - 1}
                canOperate={canOperate}
                canCancel={canCancel}
                canDelete={canDelete}
                onAction={(kind, selectedTrip) =>
                  setAction({ kind, trip: selectedTrip })
                }
                onDelete={deleteTrip}
                onHistory={setHistoryTrip}
                onOccurrence={(kind, selectedTrip) =>
                  setOccurrence({ kind, trip: selectedTrip })
                }
              />
            ))}
          </Card>
        ) : null}
      </Screen>

      {formMode ? (
        <TripFormModal
          mode={formMode}
          initialVehicleId={formVehicleId}
          onClose={() => {
            setFormMode(undefined);
            setFormVehicleId(undefined);
          }}
          onSaved={async () => {
            setFormMode(undefined);
            setFormVehicleId(undefined);
            setView("trips");
            setStatus("ALL");
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
      {historyTrip ? (
        <TripHistoryModal
          trip={historyTrip}
          onClose={() => setHistoryTrip(undefined)}
        />
      ) : null}
      {tripDetailVehicle ? (
        <VehicleTripDetailModal
          vehicle={tripDetailVehicle}
          onClose={() => setTripDetailVehicle(undefined)}
        />
      ) : null}
      {tripHistoryVehicle ? (
        <VehicleTripHistoryModal
          vehicle={tripHistoryVehicle}
          onClose={() => setTripHistoryVehicle(undefined)}
          onSelectTrip={(selectedTrip) => {
            setTripHistoryVehicle(undefined);
            setHistoryTrip(selectedTrip);
          }}
        />
      ) : null}
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
        <VehicleRepairHistoryModal
          vehicle={repairHistoryVehicle}
          onClose={() => setRepairHistoryVehicle(undefined)}
        />
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
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState("");
  const [images, setImages] = useState<ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const incident = occurrence.kind === "INCIDENT";

  const save = async () => {
    const validation = z
      .object({
        content: contentSchema,
        amount: incident ? z.string() : positiveDecimalSchema,
      })
      .safeParse({
        content,
        amount: incident ? "" : amount.replace(/\D/g, ""),
      });
    if (!validation.success) return;
    const numericAmount = incident
      ? 0
      : Number(validation.data.amount.replace(",", "."));
    setSaving(true);
    try {
      if (incident) {
        const formData = new FormData();
        formData.append("content", content.trim());
        appendMaterialImages(formData, images);
        await api.post(
          `/transport/trips/${occurrence.trip.id}/incidents`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
      } else {
        await api.post(`/transport/trips/${occurrence.trip.id}/expenses`, {
          expenseType: content.trim(),
          amount: numericAmount,
        });
      }
      await onSaved();
      Alert.alert(
        "Thành công",
        incident
          ? "Đã ghi nhận sự cố chuyến xe."
          : "Đã ghi nhận chi phí phát sinh.",
      );
    } catch (error) {
      Alert.alert(
        incident ? "Không thể báo sự cố" : "Không thể thêm chi phí",
        getApiErrorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet
      title={`${incident ? "Báo sự cố" : "Chi phí phát sinh"} · ${occurrence.trip.tripCode}`}
      saveLabel={incident ? "Ghi nhận sự cố" : "Ghi nhận chi phí"}
      saving={saving}
      onClose={onClose}
      onSave={() => void save()}
    >
      <Card tone="soft">
        <InfoRow
          label="Phương tiện"
          value={occurrence.trip.licensePlate}
          emphasize
        />
        <InfoRow label="Lộ trình" value={occurrence.trip.routeSnapshot} />
      </Card>
      <FormInput
        label={incident ? "Nội dung sự cố *" : "Loại chi phí *"}
        schema={contentSchema}
        value={content}
        onChangeText={setContent}
        multiline={incident}
        maxLength={incident ? 2000 : 100}
      />
      {incident ? (
        <MaterialEvidencePicker
          label="Ảnh sự cố"
          images={images}
          disabled={saving}
          onChange={setImages}
        />
      ) : (
        <FormInput
          label="Số tiền (đ) *"
          schema={positiveDecimalSchema}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
        />
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
    queryKey: ["vehicle-repair-editor", mode, vehicle.repairId],
    queryFn: async () => {
      const [optionsResponse, repairResponse] = await Promise.all([
        api.get<ApiResponse<VehicleRepairMaterialOption[]>>(
          "/transport/vehicle-repairs/material-options",
        ),
        mode !== "START" && vehicle.repairId
          ? api.get<ApiResponse<VehicleRepair>>(
              `/transport/vehicle-repairs/${vehicle.repairId}`,
            )
          : Promise.resolve(undefined),
      ]);
      return {
        options: optionsResponse.data.data,
        repair: repairResponse?.data.data,
      };
    },
  });

  if (!query.data) {
    return (
      <ManagementSheet
        title="Sửa chữa phương tiện"
        saveLabel={query.isLoading ? "Đang tải dữ liệu" : "Thử lại"}
        saving={query.isLoading}
        onClose={onClose}
        onSave={() => void query.refetch()}
      >
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? (
          <ErrorState
            text={getApiErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : null}
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
  const [content, setContent] = useState(repair?.content ?? "");
  const [lines, setLines] = useState<RepairLineDraft[]>(
    () =>
      repair?.materials.map((material) => ({
        key: material.id,
        materialId: material.materialId,
        quantity: String(material.quantity),
      })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const optionsById = new Map(options.map((option) => [option.id, option]));
  const totalCost = lines.reduce((total, line) => {
    const material = optionsById.get(line.materialId);
    const quantity = Number(line.quantity.replace(",", "."));
    return (
      total +
      (material?.price ?? 0) * (Number.isFinite(quantity) ? quantity : 0)
    );
  }, 0);

  const save = async () => {
    const validation = repairDraftSchema.safeParse({ content, lines });
    if (!validation.success) return;
    const materials = validation.data.lines.map((line) => ({
      materialId: line.materialId,
      quantity: Number(line.quantity.replace(",", ".")),
    }));
    setSaving(true);
    try {
      const payload = { content: validation.data.content, materials };
      if (mode === "START") {
        await api.post("/transport/vehicle-repairs", {
          vehicleId: vehicle.vehicleId,
          ...payload,
        });
      } else if (mode === "UPDATE") {
        await api.patch(
          `/transport/vehicle-repairs/${vehicle.repairId}`,
          payload,
        );
      } else {
        await api.patch(
          `/transport/vehicle-repairs/${vehicle.repairId}/complete`,
          payload,
        );
      }
      await onSaved();
      Alert.alert(
        "Thành công",
        mode === "START"
          ? "Đã đưa xe vào sửa chữa."
          : mode === "UPDATE"
            ? "Đã cập nhật sửa chữa."
            : "Đã hoàn tất sửa chữa.",
      );
    } catch (error) {
      Alert.alert("Không thể lưu sửa chữa", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "START"
      ? "Đưa xe vào sửa chữa"
      : mode === "UPDATE"
        ? "Cập nhật sửa chữa"
        : "Hoàn tất sửa chữa";
  return (
    <ManagementSheet
      title={`${title} · ${vehicle.licensePlate}`}
      saveLabel={
        mode === "START"
          ? "Bắt đầu sửa chữa"
          : mode === "UPDATE"
            ? "Lưu thay đổi"
            : "Hoàn tất sửa chữa"
      }
      saving={saving}
      onClose={onClose}
      onSave={() => void save()}
    >
      <FormInput
        label="Nội dung sửa chữa *"
        schema={requiredTextSchema}
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={2000}
      />
      <View className="mt-[3px] flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-content">
            Vật tư thay thế
          </Text>
          <Text className="mt-[3px] text-xs leading-[18px] text-content-muted">
            Không bắt buộc nếu sửa chữa không dùng vật tư
          </Text>
        </View>
        <AppButton
          compact
          tone="secondary"
          label="Thêm vật tư"
          onPress={() =>
            setLines((current) => [
              {
                key: `${Date.now()}-${Math.random()}`,
                materialId: "",
                quantity: "",
              },
              ...current,
            ])
          }
        />
      </View>
      {lines.map((line, index) => {
        const material = optionsById.get(line.materialId);
        const quantity = Number(line.quantity.replace(",", "."));
        return (
          <Card key={line.key} tone="soft">
            <View className="flex-row items-center justify-between gap-2.5">
              <Text className="text-sm font-bold text-content">
                Vật tư {index + 1}
              </Text>
              <AppButton
                compact
                tone="ghost"
                label="Bỏ"
                onPress={() =>
                  setLines((current) =>
                    current.filter((item) => item.key !== line.key),
                  )
                }
              />
            </View>
            <View className="mt-[7px] gap-[11px]">
              <OptionPicker
                label="Vật tư *"
                schema={requiredTextSchema}
                value={line.materialId}
                placeholder="Chọn vật tư"
                options={options.map((option) => ({
                  value: option.id,
                  label: `${option.materialCode} — ${option.materialName}`,
                }))}
                onChange={(materialId) =>
                  setLines((current) =>
                    current.map((item) =>
                      item.key === line.key ? { ...item, materialId } : item,
                    ),
                  )
                }
              />
              <FormInput
                label={`Số lượng${material ? ` (${material.unitSymbol})` : ""} *`}
                schema={positiveDecimalSchema}
                value={line.quantity}
                onChangeText={(nextQuantity) =>
                  setLines((current) =>
                    current.map((item) =>
                      item.key === line.key
                        ? { ...item, quantity: nextQuantity }
                        : item,
                    ),
                  )
                }
                keyboardType="decimal-pad"
              />
              <InfoRow
                label="Đơn giá"
                value={material ? formatMoney(material.price) : "—"}
              />
              <InfoRow
                label="Thành tiền"
                value={
                  material && Number.isFinite(quantity)
                    ? formatMoney(material.price * quantity)
                    : "—"
                }
                emphasize
              />
            </View>
          </Card>
        );
      })}
      <Card>
        <InfoRow
          label="Chi phí vật tư tạm tính"
          value={formatMoney(totalCost)}
          emphasize
        />
      </Card>
    </ManagementSheet>
  );
}

function VehicleRepairHistoryModal({
  vehicle,
  onClose,
}: {
  vehicle: TransportVehicleStatus;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["vehicle-repair-history", vehicle.vehicleId],
    queryFn: async () =>
      (
        await api.get<ApiResponse<VehicleRepair[]>>(
          `/transport/vehicle-repairs/vehicle/${vehicle.vehicleId}`,
        )
      ).data.data,
  });
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <ModalHeader
          title={`Lịch sử sửa chữa · ${vehicle.licensePlate}`}
          onClose={onClose}
        />
        <ScrollView contentContainerClassName="gap-3 p-3">
          {query.isLoading ? <LoadingBlock /> : null}
          {query.isError ? (
            <ErrorState
              text={getApiErrorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          ) : null}
          {!query.isLoading && !query.isError && !query.data?.length ? (
            <EmptyState text="Xe chưa có lịch sử sửa chữa." />
          ) : null}
          {query.data?.map((repair) => (
            <Card key={repair.id}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[15px] font-bold text-content">
                    {repair.repairCode}
                  </Text>
                  <Text className="mt-[9px] leading-5 text-content-muted">
                    {repair.content}
                  </Text>
                </View>
                <StatusBadge
                  label={
                    repair.status === "COMPLETED"
                      ? "Đã hoàn tất"
                      : "Đang sửa chữa"
                  }
                  tone={repair.status === "COMPLETED" ? "success" : "warning"}
                />
              </View>
              <View className="mt-2">
                <InfoRow label="Bắt đầu bởi" value={repair.startedByName} />
                <InfoRow
                  label="Bắt đầu"
                  value={formatDateTime(repair.startedAt)}
                />
                {repair.completedAt ? (
                  <InfoRow
                    label="Hoàn tất bởi"
                    value={repair.completedByName || "—"}
                  />
                ) : null}
                {repair.completedAt ? (
                  <InfoRow
                    label="Hoàn tất"
                    value={formatDateTime(repair.completedAt)}
                  />
                ) : null}
              </View>
              {repair.materials.map((material) => (
                <View
                  key={material.id}
                  className="flex-row items-center gap-3 border-t border-border py-2.5"
                >
                  <View className="flex-1">
                    <Text className="font-bold text-content">
                      {material.materialName}
                    </Text>
                    <Text className="mt-[3px] text-xs leading-[18px] text-content-muted">
                      {material.materialCode} · {material.quantity}{" "}
                      {material.unitSymbol}
                    </Text>
                  </View>
                  <Text className="font-bold text-primary-dark">
                    {formatMoney(material.amount)}
                  </Text>
                </View>
              ))}
              <InfoRow
                label="Tổng vật tư"
                value={formatMoney(repair.totalMaterialCost)}
                emphasize
              />
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function VehicleTripDetailModal({
  vehicle,
  onClose,
}: {
  vehicle: TransportVehicleStatus;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const tripStatus: TransportTripStatus =
    vehicle.operatingStatus === "ASSIGNED" ? "ASSIGNED" : "IN_PROGRESS";
  const [previewImage, setPreviewImage] = useState<TripEventImage>();
  const events = useQuery({
    queryKey: ["transport-trip-events-mobile", vehicle.tripId],
    enabled: Boolean(vehicle.tripId),
    queryFn: async () =>
      (
        await api.get<ApiResponse<TransportTripEvent[]>>(
          `/transport/trips/${vehicle.tripId!}/events`,
        )
      ).data.data,
  });

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <ModalHeader
          title={`Chi tiết ${vehicle.tripCode ?? "chuyến xe"}`}
          onClose={onClose}
        />
        <ScrollView contentContainerClassName="gap-3 p-3">
          <Card>
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-lg font-bold text-content">
                  {vehicle.tripCode ?? "—"}
                </Text>
                <Text className="mt-1 text-body font-bold text-primary-dark">
                  {vehicle.licensePlate}
                </Text>
                <Text className="mt-0.5 text-xs text-content-muted">
                  {vehicle.vehicleTypeName}
                </Text>
              </View>
              <StatusBadge
                label={statusLabels[tripStatus]}
                tone={tripStatusTone(tripStatus)}
              />
            </View>
          </Card>
          <Card>
            <ManagerContact
              layout="rows"
              label="Tài xế"
              phoneLabel="Số điện thoại"
              name={vehicle.driverFullName}
              phone={vehicle.driverPhone}
            />
            <InfoRow label="Lộ trình" value={vehicle.routeSnapshot || "—"} />
            <InfoRow label="Nội dung" value={vehicle.content || "—"} />
            {vehicle.cargoWeightKg != null ? (
              <InfoRow
                label="Tải trọng"
                value={formatWeight(vehicle.cargoWeightKg)}
                emphasize
              />
            ) : null}
            <InfoRow
              label="Thời gian dự kiến"
              value={formatDateTime(vehicle.plannedStartAt)}
            />
            {vehicle.startedAt ? (
              <InfoRow
                label="Bắt đầu"
                value={formatDateTime(vehicle.startedAt)}
              />
            ) : null}
            {vehicle.unresolvedIncidentCount > 0 ? (
              <InfoRow
                label="Sự cố chưa xử lý"
                value={vehicle.unresolvedIncidentCount}
              />
            ) : null}
          </Card>
          <Text className="mt-1 text-card font-bold text-content">
            Lịch sử chuyến
          </Text>
          {events.isLoading ? <LoadingBlock /> : null}
          {events.isError ? (
            <ErrorState
              text={getApiErrorMessage(events.error)}
              onRetry={() => void events.refetch()}
            />
          ) : null}
          {!events.isLoading && !events.isError && !events.data?.length ? (
            <EmptyState text="Chưa có sự kiện nào trong chuyến." />
          ) : null}
          {events.data?.map((event) => (
            <TripEventCard
              key={event.id}
              event={event}
              token={token}
              onPreviewImage={setPreviewImage}
            />
          ))}
        </ScrollView>
        <TripImagePreview
          image={previewImage}
          token={token}
          onClose={() => setPreviewImage(undefined)}
        />
      </SafeAreaView>
    </Modal>
  );
}

function VehicleTripHistoryModal({
  vehicle,
  onClose,
  onSelectTrip,
}: {
  vehicle: TransportVehicleStatus;
  onClose: () => void;
  onSelectTrip: (trip: TransportTrip) => void;
}) {
  const query = useQuery({
    queryKey: ["transport-vehicle-trip-history", vehicle.vehicleId],
    queryFn: async () =>
      (
        await api.get<TransportTripsResponse>("/transport/trips", {
          params: { page: 1, limit: 100, vehicleId: vehicle.vehicleId },
        })
      ).data.data,
  });

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <ModalHeader
          title={`Lịch sử chuyến · ${vehicle.licensePlate}`}
          onClose={onClose}
        />
        <ScrollView contentContainerClassName="p-3">
          {query.isLoading ? <LoadingBlock /> : null}
          {query.isError ? (
            <ErrorState
              text={getApiErrorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          ) : null}
          {!query.isLoading && !query.isError && !query.data?.length ? (
            <EmptyState text="Xe chưa có lịch sử chuyến." />
          ) : null}
          {query.data?.length ? (
            <Card padded={false} className="overflow-hidden">
              <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
                <Text className="min-w-0 flex-[0.9] text-caption font-semibold text-content-muted">
                  Chuyến xe
                </Text>
                <Text className="min-w-0 flex-1 text-caption font-semibold text-content-muted">
                  Lộ trình / tài xế
                </Text>
              </View>
              {query.data.map((trip, index) => (
                <Pressable
                  key={trip.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Xem lịch sử chuyến ${trip.tripCode}`}
                  onPress={() => onSelectTrip(trip)}
                  className={`min-h-[76px] flex-row items-center gap-2 px-2.5 py-2 ${index < query.data.length - 1 ? "border-b border-border" : ""}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                >
                  <View className="min-w-0 flex-[0.9]">
                    <Text
                      numberOfLines={1}
                      className="text-body font-bold text-content"
                    >
                      {trip.tripCode}
                    </Text>
                    <View className="mt-1">
                      <StatusBadge
                        label={statusLabels[trip.status]}
                        tone={tripStatusTone(trip.status)}
                      />
                    </View>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      numberOfLines={2}
                      className="text-body font-semibold text-content"
                    >
                      {trip.routeSnapshot}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="mt-0.5 text-xs text-content-secondary"
                    >
                      {trip.driverFullName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="mt-0.5 text-caption text-content-muted"
                    >
                      {formatDateTime(trip.startedAt || trip.plannedStartAt)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TripFormModal({
  mode,
  initialVehicleId,
  onClose,
  onSaved,
}: {
  mode: "CREATE" | "SELF_START";
  initialVehicleId?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [driverUserId, setDriverUserId] = useState("");
  const [rateId, setRateId] = useState("");
  const [content, setContent] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const options = useQuery({
    queryKey: ["transport-trip-options-mobile", mode],
    queryFn: async () =>
      (
        await api.get<ApiResponse<TransportTripOptions>>(
          mode === "CREATE"
            ? "/transport/trips/options"
            : "/transport/trips/self-start-options",
        )
      ).data.data,
  });

  const selectedVehicle = options.data?.vehicles.find(
    (item) => item.id === vehicleId,
  );
  const defaultDriverUserId =
    mode === "CREATE"
      ? (options.data?.drivers?.find(
          (item) =>
            item.id === selectedVehicle?.managerUserId &&
            item.operatingStatus === "IDLE",
        )?.id ?? "")
      : "";
  const selectedDriverUserId = driverUserId || defaultDriverUserId;

  const save = async () => {
    if (saving) return;
    setValidationAttempt((current) => current + 1);
    const schema = z.object({
      vehicleId: requiredTextSchema,
      driverUserId: mode === "CREATE" ? requiredTextSchema : z.string(),
      rateId: requiredTextSchema,
      content: requiredTextSchema,
      cargoWeight: mode === "SELF_START" ? positiveDecimalSchema : z.string(),
      note: z.string(),
    });
    const validation = schema.safeParse({
      vehicleId,
      driverUserId: selectedDriverUserId,
      rateId,
      content,
      cargoWeight,
      note,
    });
    if (!validation.success) return;
    const values = validation.data;
    const weight =
      mode === "SELF_START" ? Number(values.cargoWeight.replace(",", ".")) : 0;
    setSaving(true);
    try {
      if (mode === "CREATE") {
        await api.post("/transport/trips", {
          vehicleId: values.vehicleId,
          driverUserId: values.driverUserId,
          compensationRateId: values.rateId,
          content: values.content,
          plannedStartAt: null,
          note: values.note.trim(),
        });
      } else {
        await api.post("/transport/trips/self-start", {
          vehicleId: values.vehicleId,
          compensationRateId: values.rateId,
          content: values.content,
          cargoWeightKg: weight,
          note: values.note.trim(),
        });
      }
      await onSaved();
    } catch (error) {
      Alert.alert("Không thể tạo chuyến xe", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <FormValidationProvider attempt={validationAttempt}>
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ModalHeader
              title={
                mode === "CREATE" ? "Phân công chuyến xe" : "Bắt đầu chuyến xe"
              }
              onClose={onClose}
              onSave={() => void save()}
            />
            <ScrollView
              contentContainerClassName="gap-3 p-3"
              keyboardShouldPersistTaps="handled"
            >
              {options.isLoading ? <LoadingBlock /> : null}
              {options.isError ? (
                <ErrorState
                  text={getApiErrorMessage(options.error)}
                  onRetry={() => void options.refetch()}
                />
              ) : null}
              {options.data ? (
                <>
                  <OptionPicker
                    label="Phương tiện *"
                    schema={requiredTextSchema}
                    value={vehicleId}
                    placeholder="Chọn xe đang rảnh"
                    options={options.data.vehicles
                      .filter((item) => item.operatingStatus === "IDLE")
                      .map((item) => ({
                        value: item.id,
                        label: `${item.licensePlate} — ${item.vehicleTypeName}`,
                      }))}
                    onChange={(value) => {
                      setVehicleId(value);
                      if (mode === "CREATE") {
                        const vehicle = options.data?.vehicles.find(
                          (item) => item.id === value,
                        );
                        const manager = options.data?.drivers?.find(
                          (item) =>
                            item.id === vehicle?.managerUserId &&
                            item.operatingStatus === "IDLE",
                        );
                        setDriverUserId(manager?.id ?? "");
                      }
                    }}
                  />
                  {mode === "CREATE" ? (
                    <OptionPicker
                      label="Tài xế *"
                      schema={requiredTextSchema}
                      value={selectedDriverUserId}
                      placeholder="Chọn tài xế đang rảnh"
                      options={(options.data.drivers || [])
                        .filter((item) => item.operatingStatus === "IDLE")
                        .map((item) => ({
                          value: item.id,
                          label: `${item.fullName} (@${item.username})`,
                        }))}
                      onChange={setDriverUserId}
                    />
                  ) : null}
                  <OptionPicker
                    label="Lộ trình *"
                    schema={requiredTextSchema}
                    value={rateId}
                    placeholder="Chọn từ bảng khoán"
                    options={options.data.rates.map((item) => ({
                      value: item.id,
                      label: `${item.transportPoint} — ${item.content}`,
                    }))}
                    onChange={(value) => {
                      setRateId(value);
                      const rate = options.data?.rates.find(
                        (item) => item.id === value,
                      );
                      if (rate && !content.trim()) setContent(rate.content);
                    }}
                  />
                  <FormInput
                    label="Nội dung vận chuyển *"
                    schema={requiredTextSchema}
                    value={content}
                    onChangeText={setContent}
                  />
                  {mode === "SELF_START" ? (
                    <FormInput
                      label="Tải trọng hàng (kg) *"
                      schema={positiveDecimalSchema}
                      value={cargoWeight}
                      onChangeText={setCargoWeight}
                      keyboardType="decimal-pad"
                    />
                  ) : null}
                  <FormInput
                    label="Ghi chú"
                    value={note}
                    onChangeText={setNote}
                    multiline
                  />
                </>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </FormValidationProvider>
      </SafeAreaView>
    </Modal>
  );
}

function TripActionModal({
  action,
  onClose,
  onSaved,
}: {
  action: { kind: ActionKind; trip: TripActionTarget };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const label =
    action.kind === "START"
      ? "Tải trọng hàng (kg)"
      : action.kind === "CANCEL"
        ? "Lý do hủy chuyến"
        : "Ghi chú hoàn thành";
  const title =
    action.kind === "START"
      ? "Bắt đầu chuyến"
      : action.kind === "COMPLETE"
        ? "Hoàn thành chuyến"
        : "Hủy chuyến";

  const save = async () => {
    const input = text.trim();
    setValidationAttempt((current) => current + 1);
    const inputSchema =
      action.kind === "START"
        ? positiveDecimalSchema
        : action.kind === "CANCEL"
          ? cancellationReasonSchema
          : z.string();
    if (!inputSchema.safeParse(input).success) return;
    setSaving(true);
    try {
      if (action.kind === "START") {
        await api.post(`/transport/trips/${action.trip.id}/start`, {
          cargoWeightKg: Number(input.replace(",", ".")),
        });
      } else if (action.kind === "COMPLETE") {
        await api.post(`/transport/trips/${action.trip.id}/complete`, {
          note: input,
        });
      } else {
        await api.post(`/transport/trips/${action.trip.id}/cancel`, {
          reason: input,
        });
      }
      await onSaved();
    } catch (error) {
      Alert.alert(
        `Không thể ${title.toLocaleLowerCase("vi-VN")}`,
        getApiErrorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 justify-center bg-[rgba(15,23,42,0.48)] p-4"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FormValidationProvider attempt={validationAttempt}>
          <View className="gap-3 rounded-card bg-surface p-4">
            <Text className="text-[17px] font-bold text-content">{title}</Text>
            <Text className="text-body text-content-muted">
              {action.trip.tripCode} · {action.trip.licensePlate}
            </Text>
            <FormInput
              autoFocus
              label={label}
              schema={
                action.kind === "START"
                  ? positiveDecimalSchema
                  : action.kind === "CANCEL"
                    ? cancellationReasonSchema
                    : undefined
              }
              value={text}
              onChangeText={setText}
              multiline={action.kind !== "START"}
              keyboardType={action.kind === "START" ? "decimal-pad" : "default"}
            />
            <View className="mt-1 flex-row gap-[9px]">
              <View className="flex-1">
                <AppButton tone="secondary" label="Đóng" onPress={onClose} />
              </View>
              <View className="flex-1">
                <AppButton
                  tone={action.kind === "CANCEL" ? "danger" : "primary"}
                  label="Xác nhận"
                  loading={saving}
                  onPress={() => void save()}
                />
              </View>
            </View>
          </View>
        </FormValidationProvider>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TripHistoryModal({
  trip,
  onClose,
}: {
  trip: TransportTrip;
  onClose: () => void;
}) {
  const { can, token } = useAuth();
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string>();
  const [previewImage, setPreviewImage] =
    useState<NonNullable<TransportTripEvent["images"]>[number]>();
  const events = useQuery({
    queryKey: ["transport-trip-events-mobile", trip.id],
    queryFn: async () =>
      (
        await api.get<ApiResponse<TransportTripEvent[]>>(
          `/transport/trips/${trip.id}/events`,
        )
      ).data.data,
  });
  const resolveIncident = (event: TransportTripEvent) => {
    Alert.alert(
      "Đánh dấu đã xử lý?",
      "Sự cố sẽ được chuyển sang trạng thái đã xử lý.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          onPress: () => {
            setResolvingId(event.id);
            void api
              .patch(`/transport/trips/${trip.id}/incidents/resolve`, {
                incidentId: event.id,
              })
              .then(async () => {
                await events.refetch();
                await queryClient.invalidateQueries({
                  queryKey: ["transport-vehicles-mobile"],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["transport-trips-mobile"],
                });
              })
              .catch((error) =>
                Alert.alert("Không thể xử lý sự cố", getApiErrorMessage(error)),
              )
              .finally(() => setResolvingId(undefined));
          },
        },
      ],
    );
  };
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <ModalHeader title={`Lịch sử ${trip.tripCode}`} onClose={onClose} />
        <ScrollView contentContainerClassName="gap-3 p-3">
          {events.isLoading ? <LoadingBlock /> : null}
          {events.isError ? (
            <ErrorState
              text={getApiErrorMessage(events.error)}
              onRetry={() => void events.refetch()}
            />
          ) : null}
          {!events.isLoading && !events.data?.length ? (
            <EmptyState text="Chưa có sự kiện." />
          ) : null}
          {events.data?.map((event) => (
            <TripEventCard
              key={event.id}
              event={event}
              token={token}
              resolving={resolvingId === event.id}
              onPreviewImage={setPreviewImage}
              onResolve={
                can(permissions.transportTripsOperate)
                  ? resolveIncident
                  : undefined
              }
            />
          ))}
        </ScrollView>
        <TripImagePreview
          image={previewImage}
          token={token}
          onClose={() => setPreviewImage(undefined)}
        />
      </SafeAreaView>
    </Modal>
  );
}

function ModalHeader({
  title,
  onClose,
  onSave,
}: {
  title: string;
  onClose: () => void;
  onSave?: () => void;
}) {
  return (
    <View className="min-h-header flex-row items-center justify-between border-b border-border bg-surface px-3">
      <Pressable onPress={onClose}>
        <Text className="text-sm font-semibold text-content-muted">Hủy</Text>
      </Pressable>
      <Text className="text-base font-bold text-content">{title}</Text>
      {onSave ? (
        <Pressable onPress={onSave}>
          <Text className="text-sm font-semibold text-primary">Lưu</Text>
        </Pressable>
      ) : (
        <View className="w-8" />
      )}
    </View>
  );
}

function FormInput({
  label,
  schema,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; schema?: z.ZodType }) {
  const errorMessage = useFormFieldError(
    label,
    props.value,
    undefined,
    props.keyboardType,
    schema,
  );
  return (
    <View className="gap-[7px]">
      <FormLabel label={label} />
      <TextInput
        {...props}
        placeholderTextColor={colors.textPlaceholder}
        className={`${props.multiline ? "h-[90px] py-[9px]" : "h-control py-0"} rounded-control border bg-surface px-3 text-content ${errorMessage ? "border-danger bg-danger-soft" : "border-border"}`}
        style={{
          textAlignVertical: props.multiline ? "top" : "center",
          includeFontPadding: false,
        }}
      />
      {errorMessage ? (
        <Text className="text-caption font-medium leading-[15px] text-danger">
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

function OptionPicker({
  label,
  value,
  placeholder,
  options,
  onChange,
  schema,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  schema?: z.ZodType;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const errorMessage = useFormFieldError(
    label,
    value,
    undefined,
    undefined,
    schema,
  );
  return (
    <View className="gap-[7px]">
      <FormLabel label={label} />
      <Pressable
        onPress={() => setOpen(true)}
        className={`h-control flex-row items-center justify-between gap-2.5 rounded-control border bg-surface px-3 ${errorMessage ? "border-danger bg-danger-soft" : "border-border"}`}
      >
        <Text
          className={`flex-1 text-sm ${selected ? "text-content" : "text-content-placeholder"}`}
        >
          {selected?.label || placeholder}
        </Text>
        <Text className="text-lg text-content-muted">⌄</Text>
      </Pressable>
      {errorMessage ? (
        <Text className="text-caption font-medium leading-[15px] text-danger">
          {errorMessage}
        </Text>
      ) : null}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-end bg-[rgba(15,23,42,0.48)]">
          <View className="max-h-[72%] rounded-t-card bg-surface pb-6">
            <View className="flex-row items-center justify-between border-b border-border p-3.5">
              <Text className="text-[17px] font-bold text-content">
                {label}
              </Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text className="text-sm font-semibold text-content-muted">
                  Đóng
                </Text>
              </Pressable>
            </View>
            <ScrollView className="max-h-[430px]">
              {!options.length ? (
                <EmptyState text="Không có lựa chọn phù hợp." />
              ) : null}
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`min-h-[46px] justify-center border-b border-border px-3.5 py-[11px] ${option.value === value ? "bg-primary-soft" : ""}`}
                >
                  <Text
                    className={`leading-5 ${option.value === value ? "font-bold text-primary-dark" : "text-content"}`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
