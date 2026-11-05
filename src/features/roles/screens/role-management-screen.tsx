import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { z } from "zod";

import { FormField, ManagementSheet } from "@/components/forms/management-form";
import { Screen } from "@/components/screen";
import {
  ActionMenu,
  AppButton,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { permissions as permissionCodes } from "@/features/auth/permissions";
import { api, getApiErrorMessage } from "@/services/api";
import type { ApiResponse } from "@/types/api";
import type { PermissionRecord, RoleRecord } from "@/types/business";
import { formatNumber } from "@/utils/format";

const roleCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z][A-Z0-9_-]*$/,
        "Mã phải bắt đầu bằng chữ và chỉ gồm chữ, số, dấu _ hoặc -.",
      ),
  );
const roleNameSchema = z
  .string()
  .trim()
  .min(2, "Tên vai trò phải có ít nhất 2 ký tự.");
const roleDraftSchema = z.object({
  code: roleCodeSchema,
  name: roleNameSchema,
  description: z.string().trim(),
  permissionCodes: z.array(z.string()),
});

interface RoleDraft {
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
}

const emptyDraft: RoleDraft = {
  code: "",
  name: "",
  description: "",
  permissionCodes: [],
};

export function RolesScreen() {
  const { user, can, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RoleRecord | null | undefined>();
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ["mobile-role-management"],
    queryFn: async () => {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        api.get<ApiResponse<RoleRecord[]>>("/roles"),
        api.get<ApiResponse<PermissionRecord[]>>("/roles/permissions"),
      ]);
      return {
        roles: rolesResponse.data.data,
        permissions: permissionsResponse.data.data,
      };
    },
  });

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionRecord[]>();
    for (const permission of query.data?.permissions ?? []) {
      const items = groups.get(permission.module) ?? [];
      items.push(permission);
      groups.set(permission.module, items);
    }
    return [...groups.entries()];
  }, [query.data?.permissions]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditing(null);
  };

  const openEdit = (role: RoleRecord) => {
    setDraft({
      code: role.code,
      name: role.name,
      description: role.description ?? "",
      permissionCodes: [...role.permissionCodes],
    });
    setEditing(role);
  };

  const togglePermission = (code: string) => {
    if (editing?.code === "ADMIN" && code === permissionCodes.rolesUpdate)
      return;
    setDraft((current) => ({
      ...current,
      permissionCodes: current.permissionCodes.includes(code)
        ? current.permissionCodes.filter((item) => item !== code)
        : [...current.permissionCodes, code],
    }));
  };

  const toggleGroup = (items: PermissionRecord[]) => {
    setDraft((current) => {
      const requiredCode =
        editing?.code === "ADMIN" ? permissionCodes.rolesUpdate : null;
      const selected = new Set(current.permissionCodes);
      const allSelected = items.every((item) => selected.has(item.code));
      for (const item of items) {
        if (allSelected && item.code !== requiredCode)
          selected.delete(item.code);
        else selected.add(item.code);
      }
      return { ...current, permissionCodes: [...selected] };
    });
  };

  const saveRole = async () => {
    const validation = roleDraftSchema.safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || null,
        permissionCodes: values.permissionCodes,
      };
      if (editing)
        await api.patch(`/roles/${encodeURIComponent(editing.code)}`, payload);
      else await api.post("/roles", { code: values.code, ...payload });
      const changedCurrentRole = editing?.code === user?.role;
      setEditing(undefined);
      await queryClient.invalidateQueries({
        queryKey: ["mobile-role-management"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["mobile-role-options"],
      });
      if (changedCurrentRole) await refreshUser();
      Alert.alert("Thành công", "Đã lưu vai trò và tập quyền.");
    } catch (requestError) {
      Alert.alert("Không thể lưu vai trò", getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const removeRole = (role: RoleRecord) => {
    if (role.userCount > 0) {
      Alert.alert(
        "Không thể xóa vai trò",
        "Hãy chuyển người dùng sang vai trò khác trước.",
      );
      return;
    }
    Alert.alert("Xóa vai trò?", `Xóa vai trò “${role.name}”?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          void api
            .delete(`/roles/${encodeURIComponent(role.code)}`)
            .then(async () => {
              await queryClient.invalidateQueries({
                queryKey: ["mobile-role-management"],
              });
              await queryClient.invalidateQueries({
                queryKey: ["mobile-role-options"],
              });
            })
            .catch((requestError) =>
              Alert.alert(
                "Không thể xóa vai trò",
                getApiErrorMessage(requestError),
              ),
            );
        },
      },
    ]);
  };

  return (
    <>
      <Screen
        title="Vai trò & quyền"
        subtitle="Thiết lập vai trò và quyền truy cập hệ thống"
        action={
          can(permissionCodes.rolesCreate) ? (
            <AppButton compact label="Thêm" onPress={openCreate} />
          ) : undefined
        }
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? (
          <ErrorState
            text={getApiErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {!query.isLoading && !query.isError && !query.data?.roles.length ? (
          <EmptyState text="Chưa có vai trò." />
        ) : null}
        {query.data?.roles.length ? (
          <Card padded={false} className="-mx-page-x overflow-hidden">
            <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-1 text-caption font-semibold text-content-muted">
                Vai trò
              </Text>
              <Text className="w-[42px] shrink-0 text-right text-caption font-semibold text-content-muted">
                Quyền
              </Text>
              <View className="w-[34px] shrink-0" />
            </View>
            {query.data.roles.map((role, index) => {
              const canEdit = can(permissionCodes.rolesUpdate);
              const canDelete =
                !role.isSystem && can(permissionCodes.rolesDelete);
              return (
                <View
                  key={role.code}
                  className={`min-h-[62px] flex-row items-center gap-2 px-2.5 py-2 ${index < query.data.roles.length - 1 ? "border-b border-border" : ""}`}
                >
                  <Pressable
                    accessibilityRole={canEdit ? "button" : undefined}
                    accessibilityLabel={canEdit ? `Sửa vai trò ${role.name}` : undefined}
                    disabled={!canEdit}
                    onPress={() => openEdit(role)}
                    className="min-w-0 flex-1 flex-row items-center gap-2 self-stretch"
                    style={({ pressed }) => ({ opacity: pressed && canEdit ? 0.68 : 1 })}
                  >
                    <View className="min-w-0 flex-1 justify-center">
                      <Text
                        numberOfLines={2}
                        className="text-body font-semibold text-content"
                      >
                        {role.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        className={`mt-0.5 text-caption font-bold ${role.code === user?.role ? "text-success" : "text-primary-dark"}`}
                      >
                        {role.code}
                        {role.code === user?.role ? " · Của bạn" : ""}
                      </Text>
                    </View>
                    <Text className="w-[42px] shrink-0 text-right text-body font-bold text-primary-dark">
                      {formatNumber(role.permissionCodes.length, 0)}
                    </Text>
                  </Pressable>
                  <View className="w-[34px] shrink-0 items-end">
                    {canEdit || canDelete ? (
                      <ActionMenu
                        label={`Thao tác với vai trò ${role.name}`}
                        items={[
                          ...(canEdit
                            ? [{ label: "Sửa", onPress: () => openEdit(role) }]
                            : []),
                          ...(canDelete
                            ? [
                                {
                                  label: "Xóa",
                                  tone: "danger" as const,
                                  disabled: role.userCount > 0,
                                  onPress: () => removeRole(role),
                                },
                              ]
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
          title={editing ? `Cập nhật ${editing.name}` : "Thêm vai trò"}
          saveLabel="Lưu vai trò"
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void saveRole()}
        >
          <View className="flex-row items-start gap-2.5">
            <View className="min-w-0 flex-[2]">
              <FormField
                label="Mã vai trò *"
                schema={roleCodeSchema}
                placeholder="KE_TOAN"
                value={draft.code}
                editable={!editing && !saving}
                autoCapitalize="characters"
                maxLength={50}
                onChangeText={(code) =>
                  setDraft((current) => ({ ...current, code }))
                }
              />
            </View>
            <View className="min-w-0 flex-[3]">
              <FormField
                label="Tên vai trò *"
                schema={roleNameSchema}
                placeholder="Kế toán"
                value={draft.name}
                editable={!saving}
                maxLength={100}
                onChangeText={(name) =>
                  setDraft((current) => ({ ...current, name }))
                }
              />
            </View>
          </View>
          <FormField
            label="Mô tả"
            value={draft.description}
            editable={!saving}
            multiline
            maxLength={500}
            onChangeText={(description) =>
              setDraft((current) => ({ ...current, description }))
            }
          />
          <View className="mt-[5px] flex-row justify-between gap-3">
            <Text className="text-card font-bold text-content">
              Quyền của vai trò
            </Text>
            <Text className="text-xs font-bold text-primary-dark">
              {draft.permissionCodes.length} quyền đã chọn
            </Text>
          </View>
          {permissionGroups.map(([module, items]) => {
            const selectedCount = items.filter((item) =>
              draft.permissionCodes.includes(item.code),
            ).length;
            return (
              <View
                key={module}
                className="gap-2 rounded-control bg-surface-subtle p-3"
              >
                <Pressable
                  onPress={() => toggleGroup(items)}
                  className="mb-0.5 flex-row items-center gap-3"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-content">
                      {module}
                    </Text>
                    <Text className="mt-0.5 text-caption text-content-muted">
                      {selectedCount}/{items.length} quyền
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-primary">
                    {selectedCount === items.length ? "Bỏ chọn" : "Chọn nhóm"}
                  </Text>
                </Pressable>
                <View className="flex-row flex-wrap gap-2">
                  {items.map((permission) => {
                    const selected = draft.permissionCodes.includes(
                      permission.code,
                    );
                    const locked =
                      editing?.code === "ADMIN" &&
                      permission.code === permissionCodes.rolesUpdate;
                    return (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{
                          checked: selected,
                          disabled: locked || saving,
                        }}
                        disabled={locked || saving}
                        key={permission.code}
                        onPress={() => togglePermission(permission.code)}
                        className={`min-h-12 basis-[48%] flex-row items-center gap-2.5 rounded-control border p-[11px] ${
                          selected
                            ? "border-primary-border bg-primary-soft"
                            : "border-border bg-surface"
                        } ${locked ? "opacity-70" : ""}`}
                      >
                        <View
                          className={`h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary" : "border-content-placeholder"}`}
                        >
                          {selected ? (
                            <Text className="text-body font-bold text-white">
                              ✓
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          className={`min-w-0 flex-1 text-body font-normal ${selected ? "text-primary-dark" : "text-content"}`}
                        >
                          {permission.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ManagementSheet>
      ) : null}
    </>
  );
}
