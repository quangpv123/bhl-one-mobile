import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { AppButton, ChoiceChips, EmptyState, ErrorState, LoadingBlock, SearchField, StatusBadge } from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { ManagementSheet, OptionPicker } from '@/components/forms/management-form';
import { api, getApiErrorMessage } from '@/services/api';
import { createMessagingSocket } from '@/services/messaging-socket';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type {
  MessageConversation,
  MessageRecipient,
  MessageSearchPerson,
  MessageSearchResults,
  MessageSearchScope,
  SystemBotSettings,
  SystemBotSummary,
} from '@/types/models';
import { formatDateTime } from '@/utils/format';

function conversationName(item: MessageConversation) {
  return item.groupName || item.otherFullName || 'Cuộc trò chuyện';
}

export default function MessagesScreen() {
  const { token, can } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<MessageSearchScope>('ALL');
  const [openingSearchResultId, setOpeningSearchResultId] = useState<string>();
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => (await api.get<ApiResponse<MessageConversation[]>>('/messages/conversations')).data.data,
  });
  const searchResults = useQuery({
    queryKey: ['message-global-search-mobile', searchQuery],
    enabled: Boolean(searchQuery),
    staleTime: 30_000,
    queryFn: async () => (
      await api.get<ApiResponse<MessageSearchResults>>('/messages/search', {
        params: { query: searchQuery, scope: 'ALL' },
      })
    ).data.data,
  });

  useEffect(() => {
    const value = searchInput.trim();
    const timer = setTimeout(() => setSearchQuery(value), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const socket = createMessagingSocket(token);
    if (!socket) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    socket.on('messaging:conversation-updated', refresh);
    socket.on('messaging:message-new', refresh);
    return () => {
      socket.close();
    };
  }, [queryClient, token]);

  const openConversation = (id: string, fallbackTitle: string, fallbackType: MessageConversation['conversationType'] = 'DIRECT') => {
    const conversation = conversations.data?.find(item => item.id === id);
    router.push({
      pathname: '/chat/[id]',
      params: {
        id,
        title: conversation ? conversationName(conversation) : fallbackTitle,
        type: conversation?.conversationType ?? fallbackType,
      },
    });
  };

  const openPerson = async (person: MessageSearchPerson) => {
    if (person.conversationId) {
      openConversation(person.conversationId, person.fullName);
      return;
    }
    if (openingSearchResultId) return;
    setOpeningSearchResultId(person.id);
    try {
      const response = await api.post<ApiResponse<{ id: string }>>('/messages/conversations', {
        recipientUserId: person.id,
      });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      openConversation(response.data.data.id, person.fullName);
    } catch (error) {
      Alert.alert('Không thể mở cuộc trò chuyện', getApiErrorMessage(error));
    } finally {
      setOpeningSearchResultId(undefined);
    }
  };

  const isSearching = Boolean(searchInput.trim());
  const searchReady = searchQuery === searchInput.trim();
  const showPeople = searchScope === 'ALL' || searchScope === 'PEOPLE';
  const showMessages = searchScope === 'ALL' || searchScope === 'MESSAGES';
  const showGroups = searchScope === 'ALL' || searchScope === 'GROUPS';
  const hasSearchResults = Boolean(
    (showPeople && searchResults.data?.people.length)
    || (showMessages && searchResults.data?.messages.length)
    || (showGroups && searchResults.data?.groups.length),
  );

  return (
    <>
      <Screen
        title="Tin nhắn"
        subtitle="Trao đổi và thông báo hệ thống"
        action={
          <View style={styles.headerActions}>
            {can(permissions.systemBotsConfigure) ? (
              <AppButton compact tone="secondary" label="Cấu hình bot" onPress={() => setSettingsOpen(true)} />
            ) : null}
            <AppButton compact label="Tin mới" onPress={() => setCreateOpen(true)} />
          </View>
        }
        refreshing={conversations.isRefetching}
        onRefresh={() => void conversations.refetch()}
      >
        <SearchField
          placeholder="Tìm kiếm"
          value={searchInput}
          onChangeText={value => {
            setSearchInput(value);
            if (!value.trim()) setSearchScope('ALL');
          }}
        />
        {isSearching ? (
          <ChoiceChips
            value={searchScope}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'PEOPLE', label: 'Mọi người' },
              { value: 'MESSAGES', label: 'Tin nhắn' },
              { value: 'GROUPS', label: 'Nhóm' },
            ]}
            onChange={setSearchScope}
          />
        ) : null}

        {isSearching && (searchResults.isLoading || !searchReady) ? <LoadingBlock /> : null}
        {isSearching && searchReady && searchResults.isError ? (
          <ErrorState text={getApiErrorMessage(searchResults.error)} onRetry={() => void searchResults.refetch()} />
        ) : null}
        {isSearching && !searchResults.isLoading && searchReady && !searchResults.isError && !hasSearchResults ? (
          <EmptyState text="Không tìm thấy kết quả." />
        ) : null}
        {isSearching && searchReady && showPeople && searchResults.data?.people.length ? (
          <View style={styles.searchSection}>
            <Text style={styles.searchSectionTitle}>Mọi người</Text>
            {searchResults.data.people.map(person => (
              <Pressable
                key={person.id}
                disabled={Boolean(openingSearchResultId)}
                onPress={() => void openPerson(person)}
                style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}
              >
                <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{person.fullName.charAt(0)}</Text></View>
                <View style={styles.searchResultBody}>
                  <Text style={styles.recipientName}>{person.fullName}</Text>
                  <Text style={styles.recipientMeta}>@{person.username}{person.phone ? ` · ${person.phone}` : ''}</Text>
                </View>
                {openingSearchResultId === person.id ? <Text style={styles.openingText}>Đang mở…</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        {isSearching && searchReady && showMessages && searchResults.data?.messages.length ? (
          <View style={styles.searchSection}>
            <Text style={styles.searchSectionTitle}>Tin nhắn</Text>
            {searchResults.data.messages.map(message => (
              <Pressable
                key={message.id}
                onPress={() => openConversation(message.conversationId, message.conversationName)}
                style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}
              >
                <View style={[styles.smallAvatar, styles.messageAvatar]}><Text style={styles.smallAvatarText}>✉</Text></View>
                <View style={styles.searchResultBody}>
                  <View style={styles.searchResultHeading}>
                    <Text numberOfLines={1} style={styles.recipientName}>{message.conversationName}</Text>
                    <Text style={styles.time}>{formatDateTime(message.createdAt).slice(0, 5)}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.recipientMeta}>{message.senderFullName}: {message.content}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        {isSearching && searchReady && showGroups && searchResults.data?.groups.length ? (
          <View style={styles.searchSection}>
            <Text style={styles.searchSectionTitle}>Nhóm</Text>
            {searchResults.data.groups.map(group => (
              <Pressable
                key={group.conversationId}
                onPress={() => openConversation(group.conversationId, group.name, 'GROUP')}
                style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}
              >
                <View style={[styles.smallAvatar, styles.groupAvatar]}><Text style={styles.smallAvatarText}>●●</Text></View>
                <View style={styles.searchResultBody}>
                  <View style={styles.searchResultHeading}>
                    <Text numberOfLines={1} style={styles.recipientName}>{group.name}</Text>
                    {group.lastMessageAt ? <Text style={styles.time}>{formatDateTime(group.lastMessageAt).slice(0, 5)}</Text> : null}
                  </View>
                  <Text numberOfLines={2} style={styles.recipientMeta}>{group.lastMessageContent || `${group.memberCount} thành viên`}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!isSearching && conversations.isLoading ? <LoadingBlock /> : null}
        {!isSearching && conversations.isError ? <ErrorState text={getApiErrorMessage(conversations.error)} onRetry={() => void conversations.refetch()} /> : null}
        {!isSearching && !conversations.isLoading && !conversations.data?.length ? <EmptyState text="Chưa có cuộc trò chuyện nào." /> : null}
        {!isSearching ? conversations.data?.map(item => (
          <Pressable
            key={item.id}
            onPress={() => router.push({
              pathname: '/chat/[id]',
              params: { id: item.id, title: conversationName(item), type: item.conversationType },
            })}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={[styles.avatar, item.conversationType === 'SYSTEM' && styles.avatarSystem]}>
              <Text style={styles.avatarText}>{item.conversationType === 'SYSTEM' ? '◈' : conversationName(item).charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>{conversationName(item)}</Text>
                {item.lastMessageAt ? <Text style={styles.time}>{formatDateTime(item.lastMessageAt).slice(0, 5)}</Text> : null}
              </View>
              <Text numberOfLines={1} style={styles.preview}>{item.lastMessageContent || 'Chưa có tin nhắn'}</Text>
              {item.conversationType === 'GROUP' ? <Text style={styles.meta}>{item.memberCount ?? 0} thành viên</Text> : null}
            </View>
            {item.unreadCount ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text></View>
            ) : null}
          </Pressable>
        )) : null}
      </Screen>
      {createOpen ? (
        <CreateConversationModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (id, title, conversationType) => {
            setCreateOpen(false);
            await queryClient.invalidateQueries({ queryKey: ['conversations'] });
            router.push({ pathname: '/chat/[id]', params: { id, title, type: conversationType } });
          }}
        />
      ) : null}
      {settingsOpen ? <BotSettingsModal onClose={() => setSettingsOpen(false)} /> : null}
    </>
  );
}

function CreateConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string, title: string, type: MessageConversation['conversationType']) => Promise<void>;
}) {
  const [mode, setMode] = useState<'direct' | 'group' | 'bot'>('direct');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedBotCode, setSelectedBotCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const recipients = useQuery({
    queryKey: ['message-recipients-mobile', search],
    enabled: mode !== 'bot',
    queryFn: async () =>
      (
        await api.get<ApiResponse<MessageRecipient[]>>('/messages/recipients', {
          params: { search: search.trim() || undefined },
        })
      ).data.data,
  });
  const bots = useQuery({
    queryKey: ['message-system-bots'],
    enabled: mode === 'bot',
    queryFn: async () => (await api.get<ApiResponse<SystemBotSummary[]>>('/messages/bots')).data.data,
  });

  const toggleRecipient = (id: string) => {
    if (mode === 'direct') setSelectedIds([id]);
    else setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const create = async () => {
    if (mode === 'bot') {
      if (!selectedBotCode) {
        Alert.alert('Chưa chọn bot', 'Chọn một bot hệ thống để mở kênh thông báo.');
        return;
      }
      setSaving(true);
      try {
        const response = await api.post<ApiResponse<{ id: string }>>(`/messages/bots/${encodeURIComponent(selectedBotCode)}/conversation`);
        const bot = bots.data?.find(item => item.botCode === selectedBotCode);
        await onCreated(response.data.data.id, bot?.botName || 'Thông báo hệ thống', 'SYSTEM');
      } catch (error) {
        Alert.alert('Không thể mở kênh bot', getApiErrorMessage(error));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!selectedIds.length) {
      Alert.alert('Chưa chọn người nhận', 'Chọn ít nhất một người để bắt đầu trò chuyện.');
      return;
    }
    if (mode === 'group' && groupName.trim().length < 2) {
      Alert.alert('Thiếu tên nhóm', 'Nhập tên nhóm có ít nhất 2 ký tự.');
      return;
    }
    setSaving(true);
    try {
      const response = mode === 'direct'
        ? await api.post<ApiResponse<{ id: string }>>('/messages/conversations', { recipientUserId: selectedIds[0] })
        : await api.post<ApiResponse<{ id: string }>>('/messages/conversations/group', {
            name: groupName.trim(),
            memberUserIds: selectedIds,
          });
      const recipient = recipients.data?.find(item => item.id === selectedIds[0]);
      await onCreated(
        response.data.data.id,
        mode === 'group' ? groupName.trim() : recipient?.fullName || 'Tin nhắn',
        mode === 'group' ? 'GROUP' : 'DIRECT',
      );
    } catch (error) {
      Alert.alert('Không thể tạo cuộc trò chuyện', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose}><Text style={styles.cancel}>Hủy</Text></Pressable>
            <Text style={styles.modalTitle}>Tin nhắn mới</Text>
            <Pressable disabled={saving} onPress={() => void create()}><Text style={styles.save}>Tạo</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <ChoiceChips
              value={mode}
              options={[
                { value: 'direct', label: 'Cá nhân' },
                { value: 'group', label: 'Nhóm' },
                { value: 'bot', label: 'Bot hệ thống' },
              ]}
              onChange={value => { setMode(value); setSelectedIds([]); setSelectedBotCode(''); }}
            />
            {mode === 'group' ? (
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Tên nhóm trò chuyện"
                placeholderTextColor={colors.textPlaceholder}
                style={styles.input}
              />
            ) : null}
            {mode !== 'bot' ? <SearchField placeholder="Tìm theo tên, tài khoản..." value={search} onChangeText={setSearch} /> : null}
            {mode !== 'bot' && recipients.isLoading ? <LoadingBlock /> : null}
            {mode !== 'bot' && recipients.isError ? <ErrorState text={getApiErrorMessage(recipients.error)} onRetry={() => void recipients.refetch()} /> : null}
            {mode !== 'bot' ? recipients.data?.map(recipient => {
              const selected = selectedIds.includes(recipient.id);
              return (
                <Pressable
                  key={recipient.id}
                  onPress={() => toggleRecipient(recipient.id)}
                  style={[styles.recipient, selected && styles.recipientSelected]}
                >
                  <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{recipient.fullName.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipientName}>{recipient.fullName}</Text>
                    <Text style={styles.recipientMeta}>@{recipient.username} · {recipient.role}</Text>
                  </View>
                  {selected ? <StatusBadge label="Đã chọn" tone="info" /> : null}
                </Pressable>
              );
            }) : null}
            {mode === 'bot' && bots.isLoading ? <LoadingBlock /> : null}
            {mode === 'bot' && bots.isError ? <ErrorState text={getApiErrorMessage(bots.error)} onRetry={() => void bots.refetch()} /> : null}
            {mode === 'bot' ? bots.data?.map(bot => {
              const selected = selectedBotCode === bot.botCode;
              return (
                <Pressable
                  key={bot.botCode}
                  onPress={() => setSelectedBotCode(bot.botCode)}
                  style={[styles.recipient, selected && styles.recipientSelected]}
                >
                  <View style={[styles.smallAvatar, styles.botAvatar]}><Text style={styles.smallAvatarText}>◈</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipientName}>{bot.botName}</Text>
                    <Text style={styles.recipientMeta}>{bot.description}</Text>
                  </View>
                  {selected ? <StatusBadge label="Đã chọn" tone="info" /> : null}
                </Pressable>
              );
            }) : null}
            <AppButton
              label={mode === 'direct' ? 'Bắt đầu trò chuyện' : mode === 'group' ? `Tạo nhóm (${selectedIds.length})` : 'Mở kênh bot'}
              loading={saving}
              onPress={() => void create()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function BotSettingsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedBotCode, setSelectedBotCode] = useState('');
  const [recipientOverrides, setRecipientOverrides] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const bots = useQuery({
    queryKey: ['message-system-bots'],
    queryFn: async () => (await api.get<ApiResponse<SystemBotSummary[]>>('/messages/bots')).data.data,
  });

  const effectiveBotCode = selectedBotCode || bots.data?.[0]?.botCode || '';

  const settings = useQuery({
    queryKey: ['message-system-bot-settings', effectiveBotCode],
    enabled: Boolean(effectiveBotCode),
    queryFn: async () => (
      await api.get<ApiResponse<SystemBotSettings>>(`/messages/bots/${encodeURIComponent(effectiveBotCode)}/settings`)
    ).data.data,
  });
  const recipientIds = recipientOverrides[effectiveBotCode] ?? settings.data?.recipientUserIds ?? [];

  const filteredUsers = (settings.data?.users ?? []).filter(account => {
    const normalized = search.trim().toLocaleLowerCase('vi-VN');
    if (!normalized) return true;
    return [account.fullName, account.username, account.phone]
      .filter(Boolean)
      .some(value => value!.toLocaleLowerCase('vi-VN').includes(normalized));
  });

  const save = async () => {
    if (!effectiveBotCode) return;
    setSaving(true);
    try {
      await api.put(`/messages/bots/${encodeURIComponent(effectiveBotCode)}/settings`, { recipientUserIds: recipientIds });
      await queryClient.invalidateQueries({ queryKey: ['message-system-bot-settings', effectiveBotCode] });
      onClose();
      Alert.alert('Thành công', 'Đã cập nhật người nhận thông báo của bot.');
    } catch (error) {
      Alert.alert('Không thể lưu cấu hình bot', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet title="Cấu hình bot hệ thống" saveLabel="Lưu cấu hình" saving={saving} onClose={onClose} onSave={() => void save()}>
      <OptionPicker
        label="Bot cần cấu hình"
        value={effectiveBotCode}
        options={(bots.data ?? []).map(bot => ({ value: bot.botCode, label: bot.botName, description: bot.description }))}
        disabled={saving || bots.isLoading}
        onChange={value => { setSelectedBotCode(value); setSearch(''); }}
      />
      {settings.isLoading ? <LoadingBlock /> : null}
      {settings.isError ? <ErrorState text={getApiErrorMessage(settings.error)} onRetry={() => void settings.refetch()} /> : null}
      {settings.data ? (
        <>
          <View style={styles.botSummary}>
            <Text style={styles.botSummaryTitle}>{settings.data.botName}</Text>
            <Text style={styles.botSummaryText}>{settings.data.description}</Text>
            <Text style={styles.botSummaryCount}>{recipientIds.length} tài khoản nhận thông báo</Text>
          </View>
          <SearchField placeholder="Tìm tài khoản nhận thông báo..." value={search} onChangeText={setSearch} />
          {filteredUsers.map(account => {
            const selected = recipientIds.includes(account.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={account.id}
                onPress={() => setRecipientOverrides(current => ({
                  ...current,
                  [effectiveBotCode]: selected ? recipientIds.filter(id => id !== account.id) : [...recipientIds, account.id],
                }))}
                style={[styles.recipient, selected && styles.recipientSelected]}
              >
                <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{account.fullName.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientName}>{account.fullName}</Text>
                  <Text style={styles.recipientMeta}>@{account.username}{account.phone ? ` · ${account.phone}` : ''}</Text>
                </View>
                {selected ? <StatusBadge label="Nhận tin" tone="success" /> : null}
              </Pressable>
            );
          })}
          {!filteredUsers.length ? <EmptyState text="Không tìm thấy tài khoản." /> : null}
        </>
      ) : null}
    </ManagementSheet>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7 },
  item: { minHeight: 74, padding: 12, borderRadius: ui.radius, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.72 },
  avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarSystem: { backgroundColor: '#EDE9FE' },
  avatarText: { color: colors.primaryDark, fontSize: 20, fontWeight: '700' },
  body: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  time: { color: colors.textMuted, fontSize: 10 },
  preview: { color: colors.textMuted, fontSize: 13 },
  meta: { color: colors.primaryDark, fontSize: 10, fontWeight: '700' },
  badge: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  searchSection: { gap: 7 },
  searchSectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  searchResult: { minHeight: 62, padding: 10, borderRadius: ui.radius, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchResultBody: { flex: 1, minWidth: 0 },
  searchResultHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  openingText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  messageAvatar: { backgroundColor: '#E0F2FE' },
  groupAvatar: { backgroundColor: '#EDE9FE' },
  modalSafeArea: { flex: 1, backgroundColor: colors.background },
  modalHeader: { minHeight: ui.headerHeight, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cancel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  save: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  modalContent: { padding: 12, gap: 12 },
  input: { minHeight: ui.controlHeight, borderWidth: 1, borderColor: colors.border, borderRadius: ui.radius, backgroundColor: colors.surface, paddingHorizontal: 12, color: colors.text },
  recipient: { minHeight: 62, padding: 10, borderRadius: ui.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recipientSelected: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  smallAvatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { color: colors.primaryDark, fontWeight: '700' },
  botAvatar: { backgroundColor: '#EDE9FE' },
  recipientName: { color: colors.text, fontWeight: '700' },
  recipientMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  botSummary: { padding: 12, borderRadius: ui.radius, backgroundColor: colors.primarySoft, gap: 5 },
  botSummaryTitle: { color: colors.primaryDark, fontSize: 15, fontWeight: '700' },
  botSummaryText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  botSummaryCount: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
});
