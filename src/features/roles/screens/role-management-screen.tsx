import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AppButton, Card, EmptyState, ErrorState, InfoRow, LoadingBlock, StatusBadge } from '@/components/ui';
import { permissions as permissionCodes } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { PermissionRecord, RoleRecord } from '@/types/business';
import { formatNumber } from '@/utils/format';
import { FormField, ManagementSheet } from '@/components/forms/management-form';

interface RoleDraft {
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
}

const emptyDraft: RoleDraft = { code: '', name: '', description: '', permissionCodes: [] };

export function RolesScreen() {
  const { user, can, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RoleRecord | null | undefined>();
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ['mobile-role-management'],
    queryFn: async () => {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        api.get<ApiResponse<RoleRecord[]>>('/roles'),
        api.get<ApiResponse<PermissionRecord[]>>('/roles/permissions'),
      ]);
      return { roles: rolesResponse.data.data, permissions: permissionsResponse.data.data };
    },
  });

  const permissionNames = useMemo(
    () => new Map((query.data?.permissions ?? []).map(permission => [permission.code, permission.name])),
    [query.data?.permissions],
  );
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
      description: role.description ?? '',
      permissionCodes: [...role.permissionCodes],
    });
    setEditing(role);
  };

  const togglePermission = (code: string) => {
    if (editing?.code === 'ADMIN' && code === permissionCodes.rolesUpdate) return;
    setDraft(current => ({
      ...current,
      permissionCodes: current.permissionCodes.includes(code)
        ? current.permissionCodes.filter(item => item !== code)
        : [...current.permissionCodes, code],
    }));
  };

  const toggleGroup = (items: PermissionRecord[]) => {
    setDraft(current => {
      const requiredCode = editing?.code === 'ADMIN' ? permissionCodes.rolesUpdate : null;
      const selected = new Set(current.permissionCodes);
      const allSelected = items.every(item => selected.has(item.code));
      for (const item of items) {
        if (allSelected && item.code !== requiredCode) selected.delete(item.code);
        else selected.add(item.code);
      }
      return { ...current, permissionCodes: [...selected] };
    });
  };

  const saveRole = async () => {
    const code = draft.code.trim().toUpperCase();
    const name = draft.name.trim();
    if (!editing && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(code)) {
      Alert.alert('Mã vai trò chưa hợp lệ', 'Mã phải bắt đầu bằng chữ và chỉ gồm chữ, số, dấu _ hoặc -.');
      return;
    }
    if (name.length < 2) {
      Alert.alert('Tên vai trò chưa hợp lệ', 'Tên vai trò phải có ít nhất 2 ký tự.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description: draft.description.trim() || null,
        permissionCodes: draft.permissionCodes,
      };
      if (editing) await api.patch(`/roles/${encodeURIComponent(editing.code)}`, payload);
      else await api.post('/roles', { code, ...payload });
      const changedCurrentRole = editing?.code === user?.role;
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ['mobile-role-management'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-role-options'] });
      if (changedCurrentRole) await refreshUser();
      Alert.alert('Thành công', 'Đã lưu vai trò và tập quyền.');
    } catch (requestError) {
      Alert.alert('Không thể lưu vai trò', getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const removeRole = (role: RoleRecord) => {
    if (role.userCount > 0) {
      Alert.alert('Không thể xóa vai trò', 'Hãy chuyển người dùng sang vai trò khác trước.');
      return;
    }
    Alert.alert('Xóa vai trò?', `Xóa vai trò “${role.name}”?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void api
            .delete(`/roles/${encodeURIComponent(role.code)}`)
            .then(async () => {
              await queryClient.invalidateQueries({ queryKey: ['mobile-role-management'] });
              await queryClient.invalidateQueries({ queryKey: ['mobile-role-options'] });
            })
            .catch(requestError => Alert.alert('Không thể xóa vai trò', getApiErrorMessage(requestError)));
        },
      },
    ]);
  };

  return (
    <>
      <Screen
        title="Vai trò & quyền"
        subtitle="Thiết lập vai trò và quyền truy cập hệ thống"
        action={can(permissionCodes.rolesCreate) ? <AppButton compact label="Thêm" onPress={openCreate} /> : undefined}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.roles.length ? <EmptyState text="Chưa có vai trò." /> : null}
        {query.data?.roles.map(role => {
          const visiblePermissions = role.permissionCodes.slice(0, 5);
          return (
            <Card key={role.code}>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{role.name}</Text>
                  <Text style={styles.code}>{role.code}</Text>
                </View>
                <View style={styles.badges}>
                  {role.code === user?.role ? <StatusBadge label="Vai trò của bạn" tone="success" /> : null}
                  <StatusBadge label={role.isSystem ? 'Hệ thống' : 'Tùy chỉnh'} tone={role.isSystem ? 'info' : 'neutral'} />
                </View>
              </View>
              <Text style={styles.description}>{role.description || 'Chưa có mô tả cho vai trò này.'}</Text>
              <View style={styles.rows}>
                <InfoRow label="Người dùng" value={formatNumber(role.userCount, 0)} />
                <InfoRow label="Quyền được cấp" value={formatNumber(role.permissionCodes.length, 0)} emphasize />
              </View>
              {visiblePermissions.length ? (
                <View style={styles.tags}>
                  {visiblePermissions.map(code => <StatusBadge key={code} label={permissionNames.get(code) ?? code} />)}
                  {role.permissionCodes.length > visiblePermissions.length ? (
                    <StatusBadge label={`+${role.permissionCodes.length - visiblePermissions.length} quyền`} tone="info" />
                  ) : null}
                </View>
              ) : <Text style={styles.noPermissions}>Chưa được cấp quyền</Text>}
              {(can(permissionCodes.rolesUpdate) || (!role.isSystem && can(permissionCodes.rolesDelete))) ? (
                <View style={styles.actions}>
                  {can(permissionCodes.rolesUpdate) ? (
                    <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(role)} />
                  ) : null}
                  {!role.isSystem && can(permissionCodes.rolesDelete) ? (
                    <AppButton
                      compact
                      tone="danger-outline"
                      label="Xóa"
                      disabled={role.userCount > 0}
                      onPress={() => removeRole(role)}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={editing ? `Cập nhật ${editing.name}` : 'Thêm vai trò'}
          saveLabel="Lưu vai trò"
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void saveRole()}
        >
          <FormField
            label="Mã vai trò *"
            placeholder="KE_TOAN"
            value={draft.code}
            editable={!editing && !saving}
            autoCapitalize="characters"
            maxLength={50}
            onChangeText={code => setDraft(current => ({ ...current, code }))}
          />
          <FormField
            label="Tên vai trò *"
            placeholder="Kế toán"
            value={draft.name}
            editable={!saving}
            maxLength={100}
            onChangeText={name => setDraft(current => ({ ...current, name }))}
          />
          <FormField
            label="Mô tả"
            value={draft.description}
            editable={!saving}
            multiline
            maxLength={500}
            onChangeText={description => setDraft(current => ({ ...current, description }))}
          />
          <View style={styles.permissionHeader}>
            <Text style={styles.permissionHeading}>Quyền của vai trò</Text>
            <Text style={styles.permissionCount}>{draft.permissionCodes.length} quyền đã chọn</Text>
          </View>
          {permissionGroups.map(([module, items]) => {
            const selectedCount = items.filter(item => draft.permissionCodes.includes(item.code)).length;
            return (
              <View key={module} style={styles.permissionGroup}>
                <Pressable onPress={() => toggleGroup(items)} style={styles.groupHeading}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.groupTitle}>{module}</Text>
                    <Text style={styles.groupCount}>{selectedCount}/{items.length} quyền</Text>
                  </View>
                  <Text style={styles.selectGroup}>{selectedCount === items.length ? 'Bỏ chọn' : 'Chọn nhóm'}</Text>
                </Pressable>
                {items.map(permission => {
                  const selected = draft.permissionCodes.includes(permission.code);
                  const locked = editing?.code === 'ADMIN' && permission.code === permissionCodes.rolesUpdate;
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: locked || saving }}
                      disabled={locked || saving}
                      key={permission.code}
                      onPress={() => togglePermission(permission.code)}
                      style={[styles.permissionOption, selected && styles.permissionSelected, locked && styles.permissionLocked]}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <View style={styles.titleWrap}>
                        <Text style={[styles.permissionName, selected && styles.permissionNameSelected]}>{permission.name}</Text>
                        <Text style={styles.permissionCode}>{permission.code}</Text>
                        {permission.description ? <Text style={styles.permissionDescription}>{permission.description}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ManagementSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: ui.gap },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  code: { color: colors.primaryDark, fontSize: 13, fontWeight: '700', marginTop: 4 },
  badges: { alignItems: 'flex-end', gap: 5 },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  rows: { marginTop: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  noPermissions: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 12 },
  actions: { marginTop: 13, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  permissionHeader: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  permissionHeading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  permissionCount: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  permissionGroup: { gap: 8, padding: 12, borderRadius: ui.radius, backgroundColor: colors.surfaceSubtle },
  groupHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  groupTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  groupCount: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  selectGroup: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  permissionOption: {
    padding: 11,
    borderRadius: ui.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  permissionSelected: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  permissionLocked: { opacity: 0.72 },
  checkbox: { width: 21, height: 21, marginTop: 1, borderRadius: 6, borderWidth: 1, borderColor: '#98A2B3', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  permissionName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  permissionNameSelected: { color: colors.primaryDark },
  permissionCode: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  permissionDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
