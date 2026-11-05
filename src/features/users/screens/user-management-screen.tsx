import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import {
  ActionMenu,
  AppButton,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorState,
  LoadingBlock,
  SearchField,
} from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { PaginatedResponse, RoleOption, UserRecord } from '@/types/business';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';
import { optionalEmailSchema, passwordSchema, requiredTextSchema } from '@/lib/validation';

type UserStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface UserDraft {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  password: string;
}

const emptyDraft: UserDraft = {
  username: '',
  fullName: '',
  email: '',
  phone: '',
  role: '',
  password: '',
};

const fullNameSchema = z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự.');
const usernameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z0-9._-]{3,}$/,
    'Tên đăng nhập tối thiểu 3 ký tự và chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.',
  );
const userPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s.-]{8,20}$/, 'Số điện thoại không hợp lệ.');
const userDraftSchema = z.object({
  username: usernameSchema,
  fullName: fullNameSchema,
  email: optionalEmailSchema,
  phone: userPhoneSchema,
  role: requiredTextSchema,
  password: passwordSchema,
});
const editUserDraftSchema = userDraftSchema.extend({
  username: requiredTextSchema,
  password: z.string(),
});

function resetPasswordSchema(password: string) {
  return z.object({
    newPassword: passwordSchema,
    confirmPassword: z.string().refine(value => value === password, 'Hai lần nhập mật khẩu mới phải giống nhau.'),
  });
}

export function UsersScreen() {
  const { user: currentUser, can } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatusFilter>('ACTIVE');
  const [role, setRole] = useState('ALL');
  const [editing, setEditing] = useState<UserRecord | null | undefined>();
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [resetTarget, setResetTarget] = useState<UserRecord>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ['mobile-role-options'],
    queryFn: async () => (await api.get<ApiResponse<RoleOption[]>>('/roles/options')).data.data,
  });
  const usersQuery = useQuery({
    queryKey: ['mobile-users', search, status, role],
    queryFn: async () => (
      await api.get<PaginatedResponse<UserRecord>>('/users', {
        params: {
          page: 1,
          limit: 100,
          search: search || undefined,
          status: status === 'ALL' ? undefined : status,
          role: role === 'ALL' ? undefined : role,
        },
      })
    ).data,
  });
  const roleNames = useMemo(
    () => new Map((rolesQuery.data ?? []).map(item => [item.code, item.name])),
    [rolesQuery.data],
  );
  const roleOptions = useMemo(
    () => (rolesQuery.data ?? []).map(item => ({ value: item.code, label: item.name, description: item.code })),
    [rolesQuery.data],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mobile-users'] });
  };

  const openCreate = () => {
    setDraft({ ...emptyDraft, role: rolesQuery.data?.[0]?.code ?? '' });
    setEditing(null);
  };

  const openEdit = (target: UserRecord) => {
    setDraft({
      username: target.username,
      fullName: target.fullName,
      email: target.email ?? '',
      phone: target.phone ?? '',
      role: target.role,
      password: '',
    });
    setEditing(target);
  };

  const saveUser = async () => {
    const validation = (editing === null ? userDraftSchema : editUserDraftSchema).safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, {
          fullName: values.fullName,
          email: values.email || null,
          phone: values.phone,
          role: values.role,
        });
      } else {
        await api.post('/users', {
          username: values.username,
          fullName: values.fullName,
          email: values.email || undefined,
          phone: values.phone,
          role: values.role,
          password: values.password,
        });
      }
      setEditing(undefined);
      await refresh();
      Alert.alert('Thành công', editing ? 'Đã cập nhật người dùng.' : 'Đã tạo tài khoản mới.');
    } catch (requestError) {
      Alert.alert('Không thể lưu người dùng', getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const openResetPassword = (target: UserRecord) => {
    setNewPassword('');
    setConfirmPassword('');
    setResetTarget(target);
  };

  const resetPassword = async () => {
    if (!resetTarget) return;
    if (!resetPasswordSchema(newPassword).safeParse({ newPassword, confirmPassword }).success) return;
    setSaving(true);
    try {
      await api.patch(`/users/${resetTarget.id}/reset-password`, { password: newPassword });
      setResetTarget(undefined);
      Alert.alert('Thành công', `Đã đặt lại mật khẩu cho @${resetTarget.username}.`);
    } catch (requestError) {
      Alert.alert('Không thể đặt lại mật khẩu', getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (target: UserRecord) => {
    const nextStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = nextStatus === 'ACTIVE' ? 'Mở khóa' : 'Khóa';
    Alert.alert(
      `${action} tài khoản?`,
      nextStatus === 'ACTIVE'
        ? `${target.fullName} sẽ được phép đăng nhập lại.`
        : `${target.fullName} sẽ không thể đăng nhập.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: action,
          style: nextStatus === 'INACTIVE' ? 'destructive' : 'default',
          onPress: () => {
            void api
              .patch(`/users/${target.id}/status`, { status: nextStatus })
              .then(refresh)
              .catch(requestError => Alert.alert('Không thể cập nhật tài khoản', getApiErrorMessage(requestError)));
          },
        },
      ],
    );
  };

  return (
    <>
      <Screen
        title="Người dùng"
        refreshing={usersQuery.isRefetching}
        onRefresh={() => void usersQuery.refetch()}
      >
        <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <SearchField
              placeholder="Tìm tên, SĐT, email hoặc tài khoản..."
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmit={() => setSearch(searchInput.trim())}
            />
          </View>
          {can(permissions.usersCreate) ? <AppButton compact label="Thêm" onPress={openCreate} /> : null}
        </View>
        <View className="flex-row items-center gap-2">
          <ChoiceChips
            value={status}
            options={[
              { value: 'ACTIVE', label: 'Hoạt động' },
              { value: 'INACTIVE', label: 'Đã khóa' },
              { value: 'ALL', label: 'Tất cả' },
            ]}
            onChange={setStatus}
          />
          <View className="min-w-0 flex-1">
            <OptionPicker
              label="Vai trò"
              hideLabel
              value={role}
              options={[{ value: 'ALL', label: 'Tất cả vai trò' }, ...roleOptions]}
              onChange={setRole}
            />
          </View>
        </View>

        {usersQuery.isLoading ? <LoadingBlock /> : null}
        {usersQuery.isError ? (
          <ErrorState text={getApiErrorMessage(usersQuery.error)} onRetry={() => void usersQuery.refetch()} />
        ) : null}
        {!usersQuery.isLoading && !usersQuery.isError && !usersQuery.data?.data.length ? (
          <EmptyState text="Không có người dùng phù hợp." />
        ) : null}
        {usersQuery.data?.data.length ? (
          <Card padded={false} className="-mx-page-x overflow-hidden">
            <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-[1.25] text-caption font-semibold text-content-muted">Họ tên</Text>
              <Text className="min-w-0 flex-1 text-caption font-semibold text-content-muted">Số điện thoại</Text>
              <Text className="min-w-0 flex-[0.9] text-caption font-semibold text-content-muted">Vai trò</Text>
              <View className="w-[34px] shrink-0 items-end" />
            </View>
            {usersQuery.data.data.map((target, index) => {
              const isSelf = target.id === currentUser?.id;
              const protectedUser = Boolean(target.isPrivileged && !can(permissions.rolesUpdate));
              const canChangeStatus = !isSelf && !protectedUser && (target.status === 'ACTIVE'
                ? can(permissions.usersDelete)
                : can(permissions.usersUpdate));
              const canEdit = can(permissions.usersUpdate) && !isSelf && !protectedUser;
              return (
                <View
                  key={target.id}
                  className={`min-h-[58px] flex-row items-center gap-2 px-2.5 ${index < usersQuery.data.data.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <Text numberOfLines={2} className="min-w-0 flex-[1.25] text-body font-semibold text-content">{target.fullName}</Text>
                  <Text numberOfLines={2} className="min-w-0 flex-1 text-xs text-content-secondary">{target.phone || '—'}</Text>
                  <Text numberOfLines={2} className="min-w-0 flex-[0.9] text-xs text-content-secondary">
                    {roleNames.get(target.role) ?? target.role}
                  </Text>
                  <View className="w-[34px] shrink-0 items-end">
                    {canEdit || canChangeStatus ? (
                      <ActionMenu
                        label={`Thao tác với ${target.fullName}`}
                        items={[
                          ...(canEdit ? [{ label: 'Chỉnh sửa', onPress: () => openEdit(target) }] : []),
                          ...(canEdit ? [{ label: 'Đặt lại mật khẩu', onPress: () => openResetPassword(target) }] : []),
                          ...(canChangeStatus ? [{
                            label: target.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
                            tone: target.status === 'ACTIVE' ? 'danger' as const : 'default' as const,
                            onPress: () => toggleStatus(target),
                          }] : []),
                        ]}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}
        {usersQuery.data?.pagination ? (
          <Text className="py-2 text-center text-xs text-content-muted">Tổng {usersQuery.data.pagination.total.toLocaleString('vi-VN')} người dùng</Text>
        ) : null}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={editing ? `Cập nhật @${editing.username}` : 'Thêm người dùng'}
          saveLabel={editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={() => void saveUser()}
        >
          <View className="flex-row items-start gap-2.5">
            <View className="min-w-0 flex-[3]">
              <FormField
                label="Họ tên *"
                schema={fullNameSchema}
                value={draft.fullName}
                editable={!saving}
                autoCapitalize="words"
                onChangeText={fullName => setDraft(current => ({ ...current, fullName }))}
              />
            </View>
            <View className="min-w-0 flex-[2]">
              <FormField
                label="Tên đăng nhập *"
                schema={editing ? requiredTextSchema : usernameSchema}
                value={draft.username}
                editable={!editing && !saving}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={username => setDraft(current => ({ ...current, username }))}
              />
            </View>
          </View>
          <View className="flex-row items-start gap-2.5">
            <View className="min-w-0 flex-[3]">
              <FormField
                label="Email"
                schema={optionalEmailSchema}
                value={draft.email}
                editable={!saving}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={email => setDraft(current => ({ ...current, email }))}
              />
            </View>
            <View className="min-w-0 flex-[2]">
              <FormField
                label="Số điện thoại *"
                schema={userPhoneSchema}
                value={draft.phone}
                editable={!saving}
                keyboardType="phone-pad"
                maxLength={20}
                onChangeText={phone => setDraft(current => ({ ...current, phone }))}
              />
            </View>
          </View>
          {!editing ? (
            <View className="flex-row items-start gap-2.5">
              <View className="min-w-0 flex-[3]">
                <FormField
                  label="Mật khẩu *"
                  schema={passwordSchema}
                  hint="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số."
                  value={draft.password}
                  editable={!saving}
                  secureTextEntry
                  autoCapitalize="none"
                  onChangeText={password => setDraft(current => ({ ...current, password }))}
                />
              </View>
              <View className="min-w-0 flex-[2]">
                <OptionPicker
                  label="Vai trò *"
                  value={draft.role}
                  options={roleOptions}
                  disabled={saving}
                  onChange={nextRole => setDraft(current => ({ ...current, role: nextRole }))}
                />
              </View>
            </View>
          ) : (
            <OptionPicker
              label="Vai trò *"
              value={draft.role}
              options={roleOptions}
              disabled={saving}
              onChange={nextRole => setDraft(current => ({ ...current, role: nextRole }))}
            />
          )}
        </ManagementSheet>
      ) : null}

      {resetTarget ? (
        <ManagementSheet
          title={`Đặt lại mật khẩu @${resetTarget.username}`}
          saveLabel="Đặt lại mật khẩu"
          saving={saving}
          onClose={() => setResetTarget(undefined)}
          onSave={() => void resetPassword()}
        >
          <FormField
            label="Mật khẩu mới *"
            schema={passwordSchema}
            hint="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số."
            value={newPassword}
            editable={!saving}
            secureTextEntry
            autoCapitalize="none"
            onChangeText={setNewPassword}
          />
          <FormField
            label="Nhập lại mật khẩu mới *"
            schema={z.string().refine(value => value === newPassword, 'Hai lần nhập mật khẩu mới phải giống nhau.')}
            value={confirmPassword}
            editable={!saving}
            secureTextEntry
            autoCapitalize="none"
            onChangeText={setConfirmPassword}
          />
        </ManagementSheet>
      ) : null}
    </>
  );
}
