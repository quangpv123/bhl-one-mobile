import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
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
  SearchField,
  StatusBadge,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { api, getApiErrorMessage } from '@/services/api';
import { colors, ui } from '@/theme/colors';
import type { CatalogRecord, PaginatedResponse } from '@/types/business';

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

export function CatalogCrudScreen({ descriptor }: { descriptor: CatalogCrudDescriptor }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
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
    const code = draft.code.trim();
    const name = draft.name.trim();
    if ((!editing && !code) || !name) {
      Alert.alert('Thiếu thông tin', `Nhập đủ ${descriptor.codeLabel.toLocaleLowerCase('vi-VN')} và ${descriptor.nameLabel.toLocaleLowerCase('vi-VN')}.`);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        [descriptor.nameField]: name,
        status: draft.status,
      };
      if (!editing) payload[descriptor.codeField] = code;
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
        action={can(descriptor.createPermission) ? <AppButton compact label="Thêm" onPress={openCreate} /> : undefined}
      >
        <SearchField
          placeholder={`Tìm ${descriptor.singular}...`}
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={() => setSearch(searchInput.trim())}
        />
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? <ErrorState text={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError && !query.data?.data.length ? (
          <EmptyState text={`Chưa có ${descriptor.singular} nào.`} />
        ) : null}
        {query.data?.data.map(record => (
          <Card key={record.id}>
            <View style={styles.cardHeading}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>{String(record[descriptor.nameField] ?? '—')}</Text>
                <Text style={styles.cardCode}>{String(record[descriptor.codeField] ?? '—')}</Text>
              </View>
              <StatusBadge
                label={record.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                tone={record.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
            </View>
            {(can(descriptor.updatePermission) || can(descriptor.deletePermission)) && (
              <View style={styles.actions}>
                {can(descriptor.updatePermission) ? (
                  <AppButton compact tone="secondary" label="Chỉnh sửa" onPress={() => openEdit(record)} />
                ) : null}
                {can(descriptor.deletePermission) ? (
                  <AppButton compact tone="ghost" label="Xóa" onPress={() => remove(record)} />
                ) : null}
              </View>
            )}
          </Card>
        ))}
        {query.data?.pagination ? (
          <Text style={styles.total}>Tổng {query.data.pagination.total.toLocaleString('vi-VN')} bản ghi</Text>
        ) : null}
      </Screen>

      <Modal visible={editing !== undefined} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEditor}>
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView style={styles.modalPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <Pressable onPress={closeEditor}><Text style={styles.cancel}>Hủy</Text></Pressable>
              <Text style={styles.modalTitle}>{editing ? `Sửa ${descriptor.singular}` : `Thêm ${descriptor.singular}`}</Text>
              <Pressable disabled={saving} onPress={() => void save()}><Text style={styles.save}>Lưu</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>{descriptor.codeLabel}</Text>
              <TextInput
                autoCapitalize="characters"
                editable={!editing && !saving}
                placeholder={descriptor.codeLabel}
                placeholderTextColor={colors.textPlaceholder}
                value={draft.code}
                onChangeText={code => setDraft(current => ({ ...current, code }))}
                style={[styles.input, Boolean(editing) && styles.inputDisabled]}
              />
              <Text style={styles.label}>{descriptor.nameLabel}</Text>
              <TextInput
                editable={!saving}
                placeholder={descriptor.nameLabel}
                placeholderTextColor={colors.textPlaceholder}
                value={draft.name}
                onChangeText={name => setDraft(current => ({ ...current, name }))}
                style={styles.input}
              />
              <Text style={styles.label}>Trạng thái</Text>
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
              <AppButton label="Lưu thay đổi" loading={saving} onPress={() => void save()} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardTitleWrap: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  cardCode: { color: colors.primaryDark, fontSize: 13, fontWeight: '800', marginTop: 5 },
  actions: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  total: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  modalSafeArea: { flex: 1, backgroundColor: colors.background },
  modalPage: { flex: 1 },
  modalHeader: { minHeight: ui.headerHeight, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cancel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  save: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  form: { padding: 12, gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: { minHeight: ui.controlHeight, borderRadius: ui.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, color: colors.text },
  inputDisabled: { backgroundColor: colors.surfaceMuted, color: colors.textMuted },
});

