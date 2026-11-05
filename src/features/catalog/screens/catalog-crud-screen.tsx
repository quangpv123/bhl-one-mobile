import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { z } from 'zod';

import { FormField, ManagementSheet } from '@/components/forms/management-form';
import { Screen } from '@/components/screen';
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
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import type { CatalogRecord, PaginatedResponse } from '@/types/business';
import { requiredTextSchema } from '@/lib/validation';

const catalogEditorSchema = z.object({
  code: requiredTextSchema,
  name: requiredTextSchema,
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export interface CatalogCrudDescriptor {
  key: string;
  title: string;
  subtitle: string;
  singular: string;
  endpoint: string;
  codeField: string;
  codeLabel: string;
  nameField: string;
  nameLabel: string;
  viewPermission: string;
  createPermission: string;
  updatePermission: string;
  deletePermission: string;
}

interface EditorDraft {
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const compactCatalogKeys = new Set(['products', 'cassava-varieties', 'banks', 'vehicle-types']);

export function CatalogCrudScreen({ descriptor }: { descriptor: CatalogCrudDescriptor }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const isCompactCatalog = compactCatalogKeys.has(descriptor.key);
  const canCreate = can(descriptor.createPermission);
  const canUpdate = can(descriptor.updatePermission);
  const canDelete = can(descriptor.deletePermission);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CatalogRecord | null>();
  const [draft, setDraft] = useState<EditorDraft>({ code: '', name: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ['catalog-mobile', descriptor.key, search],
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<CatalogRecord>>(descriptor.endpoint, {
          params: { page: 1, limit: 100, search: search || undefined },
        })
      ).data,
  });

  const openCreate = () => {
    setDraft({ code: '', name: '', status: 'ACTIVE' });
    setEditing(null);
  };

  const openEdit = (record: CatalogRecord) => {
    setDraft({
      code: String(record[descriptor.codeField] ?? ''),
      name: String(record[descriptor.nameField] ?? ''),
      status: record.status,
    });
    setEditing(record);
  };

  const closeEditor = () => setEditing(undefined);

  const save = async () => {
    const validation = catalogEditorSchema.safeParse(draft);
    if (!validation.success) return;
    const values = validation.data;
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        [descriptor.nameField]: values.name,
        status: values.status,
      };
      if (!editing) payload[descriptor.codeField] = values.code;
      if (editing) await api.patch(`${descriptor.endpoint}/${editing.id}`, payload);
      else await api.post(descriptor.endpoint, payload);
      await queryClient.invalidateQueries({ queryKey: ['catalog-mobile', descriptor.key] });
      closeEditor();
    } catch (error) {
      Alert.alert(`Không thể lưu ${descriptor.singular}`, getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = (record: CatalogRecord) => {
    const name = String(record[descriptor.nameField] ?? descriptor.singular);
    Alert.alert(`Xóa ${descriptor.singular}`, `Bạn có chắc muốn xóa “${name}”?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void api
            .delete(`${descriptor.endpoint}/${record.id}`)
            .then(() => queryClient.invalidateQueries({ queryKey: ['catalog-mobile', descriptor.key] }))
            .catch(error => Alert.alert(`Không thể xóa ${descriptor.singular}`, getApiErrorMessage(error)));
        },
      },
    ]);
  };

  return (
    <>
      <Screen
        title={descriptor.title}
        subtitle={descriptor.subtitle}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        action={!isCompactCatalog && canCreate ? <AppButton compact label="Thêm" onPress={openCreate} /> : undefined}
      >
        {isCompactCatalog ? (
          <View className="flex-row items-center gap-2">
            <View className="min-w-0 flex-1">
              <SearchField
                placeholder={`Tìm ${descriptor.singular}...`}
                value={searchInput}
                onChangeText={setSearchInput}
                onSubmit={() => setSearch(searchInput.trim())}
              />
            </View>
            {canCreate ? <AppButton compact label="Thêm" onPress={openCreate} /> : null}
          </View>
        ) : (
          <SearchField
            placeholder={`Tìm ${descriptor.singular}...`}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmit={() => setSearch(searchInput.trim())}
          />
        )}
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? (
          <EmptyState text={`Chưa có ${descriptor.singular} nào.`} />
        ) : null}
        {isCompactCatalog && query.data?.data.length ? (
          <Card padded={false} className="-mx-page-x overflow-hidden">
            <View className="min-h-[38px] flex-row items-center gap-2 border-b border-border bg-surface-muted px-2.5">
              <Text className="min-w-0 flex-[0.8] text-caption font-semibold text-content-muted">Mã</Text>
              <Text className="min-w-0 flex-[1.35] text-caption font-semibold text-content-muted">{descriptor.nameLabel}</Text>
              <Text className="w-[82px] shrink-0 text-caption font-semibold text-content-muted">Trạng thái</Text>
              <View className="w-[34px] shrink-0 items-end" />
            </View>
            {query.data.data.map((record, index) => (
              <View
                key={record.id}
                className={`min-h-[58px] flex-row items-center gap-2 px-2.5 ${index < query.data.data.length - 1 ? 'border-b border-border' : ''}`}
              >
                <Text numberOfLines={2} className="min-w-0 flex-[0.8] text-xs font-bold text-primary-dark">
                  {String(record[descriptor.codeField] ?? '—')}
                </Text>
                <Text numberOfLines={2} className="min-w-0 flex-[1.35] text-body font-semibold text-content">
                  {String(record[descriptor.nameField] ?? '—')}
                </Text>
                <View className="w-[82px] shrink-0">
                  <StatusBadge
                    label={record.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                    tone={record.status === 'ACTIVE' ? 'success' : 'neutral'}
                  />
                </View>
                <View className="w-[34px] shrink-0 items-end">
                  {canUpdate || canDelete ? (
                    <ActionMenu
                      label={`Thao tác với ${String(record[descriptor.nameField] ?? descriptor.singular)}`}
                      items={[
                        ...(canUpdate ? [{ label: 'Chỉnh sửa', onPress: () => openEdit(record) }] : []),
                        ...(canDelete ? [{ label: 'Xóa', tone: 'danger' as const, onPress: () => remove(record) }] : []),
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}
        {!isCompactCatalog ? query.data?.data.map(record => (
          <Card key={record.id}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[15px] leading-[21px] font-bold text-content">{String(record[descriptor.nameField] ?? '—')}</Text>
                <Text className="mt-[5px] text-body font-bold text-primary-dark">{String(record[descriptor.codeField] ?? '—')}</Text>
              </View>
              <StatusBadge
                label={record.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                tone={record.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
            </View>
            {(canUpdate || canDelete) && (
              <View className="mt-3.5 flex-row justify-end gap-2">
                {canUpdate ? <AppButton compact tone="secondary" label="Chỉnh sửa" onPress={() => openEdit(record)} /> : null}
                {canDelete ? <AppButton compact tone="danger-outline" label="Xóa" onPress={() => remove(record)} /> : null}
              </View>
            )}
          </Card>
        )) : null}
        {query.data?.pagination ? (
          <Text className="py-2 text-center text-xs text-content-muted">Tổng {query.data.pagination.total.toLocaleString('vi-VN')} bản ghi</Text>
        ) : null}
      </Screen>

      {editing !== undefined ? (
        <ManagementSheet
          title={editing ? `Sửa ${descriptor.singular}` : `Thêm ${descriptor.singular}`}
          saving={saving}
          onClose={closeEditor}
          onSave={() => void save()}
        >
              <FormField
                label={`${descriptor.codeLabel} *`}
                schema={requiredTextSchema}
                autoCapitalize="characters"
                editable={!editing && !saving}
                placeholder={descriptor.codeLabel}
                value={draft.code}
                onChangeText={code => setDraft(current => ({ ...current, code }))}
              />
              <FormField
                label={`${descriptor.nameLabel} *`}
                schema={requiredTextSchema}
                editable={!saving}
                placeholder={descriptor.nameLabel}
                value={draft.name}
                onChangeText={name => setDraft(current => ({ ...current, name }))}
              />
              <Text className="mt-1 text-body font-semibold text-content">Trạng thái</Text>
              <ChoiceChips
                value={draft.status}
                options={[
                  { value: 'ACTIVE', label: 'Hoạt động' },
                  { value: 'INACTIVE', label: 'Tạm dừng' },
                ]}
                onChange={status => setDraft(current => ({ ...current, status }))}
              />
              <Card tone="soft">
                <InfoRow label="Thao tác" value={editing ? 'Cập nhật bản ghi hiện tại' : 'Tạo bản ghi mới'} />
              </Card>
        </ManagementSheet>
      ) : null}
    </>
  );
}

