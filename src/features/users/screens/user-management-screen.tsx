import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  AppButton,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorState,
  InfoRow,
  LoadingBlock,
  SearchField,
  StatusBadge,
} from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { PaginatedResponse, RoleOption, UserRecord } from '@/types/business';
import { formatDateTime } from '@/utils/format';
import { FormField, ManagementSheet, OptionPicker } from '@/components/forms/management-form';

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

function validatePassword(password: string) {
  if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Mật khẩu phải gồm chữ hoa, chữ thường và chữ số.';
  }
  return null;
}

function validateDraft(draft: UserDraft, creating: boolean) {
  if (draft.fullName.trim().length < 2) return 'Họ tên phải có ít nhất 2 ký tự.';
  if (creating && !/^[a-zA-Z0-9._-]{3,}$/.test(draft.username.trim())) {
    return 'Tên đăng nhập tối thiểu 3 ký tự và chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.';
  }
  if (!/^\+?[0-9\s.-]{8,20}$/.test(draft.phone.trim())) return 'Số điện thoại không hợp lệ.';
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return 'Email không hợp lệ.';
  if (!draft.role) return 'Vui lòng chọn vai trò.';
  if (creating) return validatePassword(draft.password);
  return null;
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
    const error = validateDraft(draft, editing === null);
    if (error) {
      Alert.alert('Thông tin chưa hợp lệ', error);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, {
          fullName: draft.fullName.trim(),
          email: draft.email.trim() || null,
          phone: draft.phone.trim(),
          role: draft.role,
        });
      } else {
        await api.post('/users', {
          username: draft.username.trim(),
          fullName: draft.fullName.trim(),
          email: draft.email.trim() || undefined,
          phone: draft.phone.trim(),
          role: draft.role,
          password: draft.password,
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
    const error = validatePassword(newPassword);
    if (error) {
      Alert.alert('Mật khẩu chưa hợp lệ', error);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu chưa khớp', 'Hai lần nhập mật khẩu mới phải giống nhau.');
      return;
    }
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
        subtitle="Tài khoản, vai trò và trạng thái truy cập"
        action={can(permissions.usersCreate) ? <AppButton compact label="Thêm" onPress={openCreate} /> : undefined}
        refreshing={usersQuery.isRefetching}
        onRefresh={() => void usersQuery.refetch()}
      >
        <SearchField
          placeholder="Tìm tên, SĐT, email hoặc tài khoản..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
        <ChoiceChips
          value={status}
          options={[
            { value: 'ACTIVE', label: 'Hoạt động' },
            { value: 'INACTIVE', label: 'Đã khóa' },
            { value: 'ALL', label: 'Tất cả' },
          ]}
          onChange={setStatus}
        />
        <OptionPicker
          label="Lọc theo vai trò"
          value={role}
          options={[{ value: 'ALL', label: 'Tất cả vai trò' }, ...roleOptions]}
          onChange={setRole}
        />

        {usersQuery.isLoading ? <LoadingBlock /> : null}
        {usersQuery.isError ? (
          <ErrorState text={getApiErrorMessage(usersQuery.error)} onRetry={() => void usersQuery.refetch()} />
        ) : null}
        {!usersQuery.isLoading && !usersQuery.isError && !usersQuery.data?.data.length ? (
          <EmptyState text="Không có người dùng phù hợp." />
        ) : null}
        {usersQuery.data?.data.map(target => {
          const isSelf = target.id === currentUser?.id;
          const protectedUser = Boolean(target.isPrivileged && !can(permissions.rolesUpdate));
          const canChangeStatus = target.status === 'ACTIVE'
            ? can(permissions.usersDelete)
            : can(permissions.usersUpdate);
          const canEdit = can(permissions.usersUpdate) && !isSelf && !protectedUser;

          return (
            <Card key={target.id}>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{target.fullName}</Text>
                  <Text style={styles.code}>@{target.username}</Text>
                </View>
                <View style={styles.badges}>
                  {isSelf ? <StatusBadge label="Bạn" tone="info" /> : null}
                  <StatusBadge
                    label={target.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                    tone={target.status === 'ACTIVE' ? 'success' : 'danger'}
                  />
                </View>
              </View>
              <View style={styles.rows}>
                <InfoRow label="Vai trò" value={roleNames.get(target.role) ?? target.role} />
                <InfoRow label="Điện thoại" value={target.phone || '—'} />
                <InfoRow label="Email" value={target.email || '—'} />
                <InfoRow label="Đăng nhập gần nhất" value={formatDateTime(target.lastLoginAt)} />
              </View>
              {!isSelf && !protectedUser && (canEdit || canChangeStatus) ? (
                <View style={styles.actions}>
                  {canEdit ? <AppButton compact tone="secondary" label="Sửa" onPress={() => openEdit(target)} /> : null}
                  {canEdit ? <AppButton compact tone="ghost" label="Mật khẩu" onPress={() => openResetPassword(target)} /> : null}
                  {canChangeStatus ? (
                    <AppButton
                      compact
                      tone={target.status === 'ACTIVE' ? 'danger' : 'primary'}
                      label={target.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                      onPress={() => toggleStatus(target)}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
        {usersQuery.data?.pagination ? (
          <Text style={styles.total}>Tổng {usersQuery.data.pagination.total.toLocaleString('vi-VN')} người dùng</Text>
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
          <FormField
            label="Họ và tên *"
            value={draft.fullName}
            editable={!saving}
            autoCapitalize="words"
            onChangeText={fullName => setDraft(current => ({ ...current, fullName }))}
          />
          <FormField
            label="Tên đăng nhập *"
            value={draft.username}
            editable={!editing && !saving}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={username => setDraft(current => ({ ...current, username }))}
          />
          <FormField
            label="Email"
            value={draft.email}
            editable={!saving}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={email => setDraft(current => ({ ...current, email }))}
          />
          <FormField
            label="Số điện thoại *"
            value={draft.phone}
            editable={!saving}
            keyboardType="phone-pad"
            maxLength={20}
            onChangeText={phone => setDraft(current => ({ ...current, phone }))}
          />
          <OptionPicker
            label="Vai trò *"
            value={draft.role}
            options={roleOptions}
            disabled={saving}
            onChange={nextRole => setDraft(current => ({ ...current, role: nextRole }))}
          />
          {!editing ? (
            <FormField
              label="Mật khẩu ban đầu *"
              hint="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số."
              value={draft.password}
              editable={!saving}
              secureTextEntry
              autoCapitalize="none"
              onChangeText={password => setDraft(current => ({ ...current, password }))}
            />
          ) : null}
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
            hint="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số."
            value={newPassword}
            editable={!saving}
            secureTextEntry
            autoCapitalize="none"
            onChangeText={setNewPassword}
          />
          <FormField
            label="Nhập lại mật khẩu mới *"
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

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: ui.gap },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  code: { color: colors.primaryDark, fontSize: 13, fontWeight: '800', marginTop: 4 },
  badges: { alignItems: 'flex-end', gap: 5 },
  rows: { marginTop: 10 },
  actions: { marginTop: 13, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  total: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
});
