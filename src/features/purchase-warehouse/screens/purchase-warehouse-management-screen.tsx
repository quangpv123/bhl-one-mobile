import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { z } from "zod";

import {
  FormField,
  ManagementSheet,
  OptionPicker,
} from "@/components/forms/management-form";
import { Screen } from "@/components/screen";
import { ManagerContact } from "@/components/manager-contact";
import {
  ActionMenu,
  AppButton,
  EmptyState,
  ErrorState,
  LoadingBlock,
  SearchField,
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { permissions } from "@/features/auth/permissions";
import { phoneSchema, requiredTextSchema } from "@/lib/validation";
import { api, getApiErrorMessage } from "@/services/api";
import type { ApiResponse } from "@/types/api";
import type { PaginatedResponse } from "@/types/business";

type ActiveStatus = "ACTIVE" | "INACTIVE";

interface PurchaseWarehouseRecord {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  managerUserId: string;
  managerName: string;
  phone: string;
  address: string;
  materialArea: string;
  status: ActiveStatus;
}

interface ActiveUserOption {
  id: string;
  fullName: string;
  phone: string | null;
}

interface PurchaseWarehouseDraft {
  warehouseCode: string;
  warehouseName: string;
  managerUserId: string;
  phone: string;
  address: string;
  materialArea: string;
}

const emptyDraft: PurchaseWarehouseDraft = {
  warehouseCode: "",
  warehouseName: "",
  managerUserId: "",
  phone: "",
  address: "",
  materialArea: "",
};

const purchaseWarehouseSchema = z.object({
  warehouseCode: requiredTextSchema,
  warehouseName: requiredTextSchema,
  managerUserId: requiredTextSchema,
  phone: phoneSchema,
  address: requiredTextSchema,
  materialArea: requiredTextSchema,
});

export function PurchaseWarehouseListScreen() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<
    PurchaseWarehouseRecord | null | undefined
  >();
  const [draft, setDraft] = useState<PurchaseWarehouseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["mobile-purchase-warehouse-management", search],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<PurchaseWarehouseRecord>>(
          "/purchase-warehouses",
          { params: { page: 1, limit: 100, search: search || undefined } },
        )
      ).data,
  });
  const usersQuery = useQuery({
    queryKey: ["mobile-active-user-options"],
    queryFn: async () =>
      (await api.get<ApiResponse<ActiveUserOption[]>>("/users/active-options"))
        .data.data,
  });
  const userOptions = useMemo(
    () =>
      (usersQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.fullName,
        description: item.phone || undefined,
      })),
    [usersQuery.data],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["mobile-purchase-warehouse-management"],
    });
  };

  const openCreate = () => {
    setDraft({
      ...emptyDraft,
      managerUserId: usersQuery.data?.[0]?.id ?? "",
    });
    setEditing(null);
  };

  const openEdit = (warehouse: PurchaseWarehouseRecord) => {
    setDraft({
      warehouseCode: warehouse.warehouseCode,
      warehouseName: warehouse.warehouseName,
      managerUserId: warehouse.managerUserId,
      phone: warehouse.phone,
      address: warehouse.address,
      materialArea: warehouse.materialArea,
    });
    setEditing(warehouse);
  };

  const changeManager = (managerUserId: string) => {
    const manager = usersQuery.data?.find((item) => item.id === managerUserId);
    setDraft((current) => ({
      ...current,
      managerUserId,
      phone: manager?.phone ?? current.phone,
    }));
  };

  const save = async () => {
    const validation = purchaseWarehouseSchema.safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    const manager = usersQuery.data?.find(
      (item) => item.id === values.managerUserId,
    );
    if (!manager) return;
    setSaving(true);
    try {
      const payload = {
        warehouseName: values.warehouseName,
        managerUserId: values.managerUserId,
        managerName: manager.fullName,
        phone: values.phone,
        address: values.address,
        materialArea: values.materialArea,
      };
      if (editing) {
        await api.patch(`/purchase-warehouses/${editing.id}`, payload);
      } else {
        await api.post("/purchase-warehouses", {
          warehouseCode: values.warehouseCode,
          status: "ACTIVE",
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

  const toggleStatus = (warehouse: PurchaseWarehouseRecord) => {
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
              .patch(`/purchase-warehouses/${warehouse.id}/status`, {
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

  const remove = (warehouse: PurchaseWarehouseRecord) => {
    Alert.alert("Xóa kho?", `Xóa “${warehouse.warehouseName}”?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          void api
            .delete(`/purchase-warehouses/${warehouse.id}`)
            .then(refresh)
            .catch((error) =>
              Alert.alert("Không thể xóa kho", getApiErrorMessage(error)),
            );
        },
      },
    ]);
  };

  const canOpenWarehouse =
    can(permissions.scaleTicketsView) || can(permissions.purchasePaymentsView);
  const canUpdateWarehouse = can(permissions.purchaseWarehousesUpdate);
  const canDeleteWarehouse = can(permissions.purchaseWarehousesDelete);

  return (
    <>
      <Screen
        title="Kho thu mua"
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <View className="w-full flex-row items-center gap-[7px]">
          <View className="h-control min-w-0 flex-1">
            <SearchField
              placeholder="Tìm mã hoặc tên kho..."
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmit={() => setSearch(searchInput.trim())}
            />
          </View>
          {can(permissions.purchaseWarehousesCreate) ? (
            <AppButton compact label="Thêm kho" onPress={openCreate} />
          ) : null}
        </View>
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
        {query.data?.data.length ? (
          <View className="-mx-page-x border-t border-border">
            <View className="min-h-[34px] flex-row items-center gap-[5px] border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-[1.45] text-caption font-semibold uppercase text-content-muted">
                Kho
              </Text>
              <Text className="min-w-0 flex-1 text-caption font-semibold uppercase text-content-muted">
                Phụ trách
              </Text>
              <View className="w-[34px] items-center justify-center" />
            </View>
            {query.data.data.map((warehouse) => (
              <View
                key={warehouse.id}
                className="min-h-16 flex-row items-center gap-[5px] border-b border-border-subtle bg-surface px-2.5 py-[7px]"
              >
                <View
                  className={`min-w-0 flex-1 self-stretch flex-row items-center gap-[5px] ${warehouse.status === "INACTIVE" ? "opacity-40" : ""}`}
                >
                  <Pressable
                    accessibilityRole={canOpenWarehouse ? "button" : undefined}
                    accessibilityLabel={
                      canOpenWarehouse
                        ? `Mở kho ${warehouse.warehouseName}`
                        : undefined
                    }
                    disabled={!canOpenWarehouse}
                    onPress={() =>
                      router.push(`/purchase-warehouse/${warehouse.id}`)
                    }
                    className="min-w-0 flex-[1.45] self-stretch justify-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                  >
                    <Text
                      numberOfLines={1}
                      className="text-body font-semibold text-content"
                    >
                      {warehouse.warehouseCode}: {warehouse.warehouseName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="mt-0.5 text-xs text-content-muted"
                    >
                      {warehouse.address || "—"}
                    </Text>
                  </Pressable>
                  <View className="min-w-0 flex-1">
                    <ManagerContact name={warehouse.managerName} phone={warehouse.phone} />
                  </View>
                </View>
                <View className="w-[34px] items-center justify-center">
                  {canOpenWarehouse ||
                  canUpdateWarehouse ||
                  canDeleteWarehouse ? (
                    <ActionMenu
                      label={`Thao tác kho ${warehouse.warehouseName}`}
                      items={[
                        ...(canOpenWarehouse
                          ? [
                              {
                                label: "Mở kho",
                                onPress: () =>
                                  router.push(
                                    `/purchase-warehouse/${warehouse.id}`,
                                  ),
                              },
                            ]
                          : []),
                        ...(canUpdateWarehouse
                          ? [
                              {
                                label: "Sửa",
                                onPress: () => openEdit(warehouse),
                              },
                              {
                                label:
                                  warehouse.status === "ACTIVE"
                                    ? "Tạm dừng"
                                    : "Kích hoạt",
                                onPress: () => toggleStatus(warehouse),
                              },
                            ]
                          : []),
                        ...(canDeleteWarehouse
                          ? [
                              {
                                label: "Xóa",
                                tone: "danger" as const,
                                onPress: () => remove(warehouse),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={
            editing ? `Cập nhật ${editing.warehouseCode}` : "Thêm kho thu mua"
          }
          saveLabel={editing ? "Lưu thay đổi" : "Thêm kho"}
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void save()}
        >
          <View className="flex-row items-start gap-2.5">
            <View className="min-w-0 flex-1">
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
            </View>
            <View className="min-w-0 flex-1">
              <FormField
                label="Tên kho *"
                value={draft.warehouseName}
                editable={!saving}
                maxLength={200}
                onChangeText={(warehouseName) =>
                  setDraft((current) => ({ ...current, warehouseName }))
                }
              />
            </View>
          </View>
          <View className="flex-row items-start gap-2.5">
            <View className="min-w-0 flex-1">
              <OptionPicker
                label="Nhân viên phụ trách *"
                value={draft.managerUserId}
                options={userOptions}
                disabled={saving || usersQuery.isLoading}
                onChange={changeManager}
              />
            </View>
            <View className="min-w-0 flex-1">
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
            </View>
          </View>
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
          <FormField
            label="Vùng nguyên liệu *"
            value={draft.materialArea}
            editable={!saving}
            multiline
            maxLength={500}
            onChangeText={(materialArea) =>
              setDraft((current) => ({ ...current, materialArea }))
            }
          />
        </ManagementSheet>
      ) : null}
    </>
  );
}
