import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { z } from "zod";

import {
  FormField,
  ManagementSheet,
  OptionPicker,
} from "@/components/forms/management-form";
import { Screen } from "@/components/screen";
import { ManagerContact } from "@/components/manager-contact";
import {
  AppButton,
  Card,
  EmptyState,
  ErrorState,
  InfoRow,
  LoadingBlock,
  SearchField,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { permissions } from "@/features/auth/permissions";
import { api, getApiErrorMessage } from "@/services/api";
import { phoneSchema, requiredTextSchema } from "@/lib/validation";
import type { PaginatedResponse } from "@/types/business";

type ActiveStatus = "ACTIVE" | "INACTIVE";

interface MaterialWarehouseRecord {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  managerName: string;
  phone: string;
  address: string;
  status: ActiveStatus;
}

interface MaterialWarehouseDraft {
  warehouseCode: string;
  warehouseName: string;
  managerName: string;
  phone: string;
  address: string;
  status: ActiveStatus;
}

const emptyDraft: MaterialWarehouseDraft = {
  warehouseCode: "",
  warehouseName: "",
  managerName: "",
  phone: "",
  address: "",
  status: "ACTIVE",
};

const materialWarehouseSchema = z.object({
  warehouseCode: requiredTextSchema,
  warehouseName: requiredTextSchema,
  managerName: requiredTextSchema,
  phone: phoneSchema,
  address: requiredTextSchema,
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const statusOptions = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "INACTIVE", label: "Tạm dừng" },
];

export function MaterialWarehousesScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<
    MaterialWarehouseRecord | null | undefined
  >();
  const [draft, setDraft] = useState<MaterialWarehouseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["mobile-material-warehouse-management", search],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<MaterialWarehouseRecord>>(
          "/material-warehouses",
          { params: { page: 1, limit: 100, search: search || undefined } },
        )
      ).data,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["mobile-material-warehouse-management"],
    });
  };

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditing(null);
  };

  const openEdit = (warehouse: MaterialWarehouseRecord) => {
    setDraft({
      warehouseCode: warehouse.warehouseCode,
      warehouseName: warehouse.warehouseName,
      managerName: warehouse.managerName,
      phone: warehouse.phone,
      address: warehouse.address,
      status: warehouse.status,
    });
    setEditing(warehouse);
  };

  const save = async () => {
    const validation = materialWarehouseSchema.safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    setSaving(true);
    try {
      const payload = {
        warehouseName: values.warehouseName,
        managerName: values.managerName,
        phone: values.phone,
        address: values.address,
        status: values.status,
      };
      if (editing) {
        await api.patch(`/material-warehouses/${editing.id}`, payload);
      } else {
        await api.post("/material-warehouses", {
          warehouseCode: values.warehouseCode,
          ...payload,
        });
      }
      setEditing(undefined);
      await refresh();
      Alert.alert(
        "Thành công",
        editing ? "Đã cập nhật thông tin kho." : "Đã thêm kho mới.",
      );
    } catch (error) {
      Alert.alert("Không thể lưu kho", getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (warehouse: MaterialWarehouseRecord) => {
    const nextStatus: ActiveStatus =
      warehouse.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    Alert.alert(
      nextStatus === "ACTIVE" ? "Cho kho hoạt động lại?" : "Tạm dừng kho?",
      warehouse.warehouseName,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          onPress: () => {
            void api
              .patch(`/material-warehouses/${warehouse.id}/status`, {
                status: nextStatus,
              })
              .then(refresh)
              .catch((error) =>
                Alert.alert(
                  "Không thể cập nhật trạng thái",
                  getApiErrorMessage(error),
                ),
              );
          },
        },
      ],
    );
  };

  const remove = (warehouse: MaterialWarehouseRecord) => {
    Alert.alert("Xóa kho?", `Xóa “${warehouse.warehouseName}”?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          void api
            .delete(`/material-warehouses/${warehouse.id}`)
            .then(refresh)
            .catch((error) =>
              Alert.alert("Không thể xóa kho", getApiErrorMessage(error)),
            );
        },
      },
    ]);
  };

  return (
    <>
      <Screen
        title="Kho vật tư"
        action={
          can(permissions.materialWarehousesCreate) ? (
            <AppButton compact label="Thêm kho" onPress={openCreate} />
          ) : undefined
        }
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
        {query.isError ? (
          <ErrorState
            text={getApiErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? (
          <EmptyState text="Chưa có kho phù hợp." />
        ) : null}
        {query.data?.data.map((warehouse) => (
          <Card key={warehouse.id}>
            <View className="flex-row items-start justify-between gap-2.5">
              <View className="flex-1">
                <Text className="text-[15px] leading-[21px] font-bold text-content">{warehouse.warehouseName}</Text>
                <Text className="mt-1 text-body font-bold text-primary-dark">{warehouse.warehouseCode}</Text>
              </View>
              <StatusBadge
                label={warehouse.status === "ACTIVE" ? "Hoạt động" : "Tạm dừng"}
                tone={warehouse.status === "ACTIVE" ? "success" : "neutral"}
              />
            </View>
            <View className="mt-2.5">
              <ManagerContact layout="rows" name={warehouse.managerName} phone={warehouse.phone} />
              <InfoRow label="Địa chỉ" value={warehouse.address || "—"} />
            </View>
            <View className="mt-[13px] flex-row flex-wrap justify-end gap-2">
              {can(permissions.materialWarehousesUpdate) ? (
                <AppButton
                  compact
                  tone="secondary"
                  label="Sửa"
                  onPress={() => openEdit(warehouse)}
                />
              ) : null}
              {can(permissions.materialWarehousesUpdate) ? (
                <AppButton
                  compact
                  tone="ghost"
                  label={
                    warehouse.status === "ACTIVE" ? "Tạm dừng" : "Kích hoạt"
                  }
                  onPress={() => toggleStatus(warehouse)}
                />
              ) : null}
              {can(permissions.materialWarehousesDelete) ? (
                <AppButton
                  compact
                  tone="danger-outline"
                  label="Xóa"
                  onPress={() => remove(warehouse)}
                />
              ) : null}
            </View>
          </Card>
        ))}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={
            editing ? `Cập nhật ${editing.warehouseCode}` : "Thêm kho vật tư"
          }
          saveLabel={editing ? "Lưu thay đổi" : "Thêm kho"}
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
            onChangeText={(warehouseCode) =>
              setDraft((current) => ({ ...current, warehouseCode }))
            }
          />
          <FormField
            label="Tên kho *"
            value={draft.warehouseName}
            editable={!saving}
            maxLength={200}
            onChangeText={(warehouseName) =>
              setDraft((current) => ({ ...current, warehouseName }))
            }
          />
          <FormField
            label="Nhân viên phụ trách *"
            value={draft.managerName}
            editable={!saving}
            maxLength={150}
            onChangeText={(managerName) =>
              setDraft((current) => ({ ...current, managerName }))
            }
          />
          <FormField
            label="Số điện thoại *"
            value={draft.phone}
            editable={!saving}
            keyboardType="phone-pad"
            maxLength={20}
            onChangeText={(phone) =>
              setDraft((current) => ({ ...current, phone }))
            }
          />
          <FormField
            label="Địa chỉ kho *"
            value={draft.address}
            editable={!saving}
            multiline
            maxLength={500}
            onChangeText={(address) =>
              setDraft((current) => ({ ...current, address }))
            }
          />
          <OptionPicker
            label="Trạng thái"
            value={draft.status}
            options={statusOptions}
            disabled={saving}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                status: value as ActiveStatus,
              }))
            }
          />
        </ManagementSheet>
      ) : null}
    </>
  );
}
