import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AppIcon } from '@/components/app-icon';
import { ChoiceChips, EmptyState, ErrorState, LoadingBlock, SearchField, StatusBadge } from '@/components/ui';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { ManagementSheet, OptionPicker } from '@/components/forms/management-form';
import { api, getApiErrorMessage } from '@/services/api';
import { createMessagingSocket } from '@/services/messaging-socket';
import { colors } from '@/theme/colors';
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
import { formatDateTime, formatTime } from '@/utils/format';

function conversationName(item: MessageConversation) {
  return item.groupName || item.otherFullName || 'Cuộc trò chuyện';
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'BHL';
}

function ConversationAvatar({ name, type = 'DIRECT', size = 48 }: { name: string; type?: MessageConversation['conversationType']; size?: number }) {
  const backgroundColor = type === 'SYSTEM' ? '#7C3AED' : type === 'GROUP' ? colors.primaryDark : colors.primary;
  return (
    <View
      className="shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor }}
    >
      <Text className="font-bold text-white" style={{ fontSize: Math.max(13, Math.round(size * 0.31)) }}>
        {type === 'SYSTEM' ? 'BHL' : initials(name)}
      </Text>
    </View>
  );
}

function conversationTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (elapsedMinutes < 1) return 'Vừa xong';
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút`;
  if (elapsedMinutes < 24 * 60) return `${Math.floor(elapsedMinutes / 60)} giờ`;
  return formatDateTime(value).slice(0, 10);
}
const groupNameSchema = z.string().trim().min(2, 'Tên nhóm phải có ít nhất 2 ký tự.');
const recipientSelectionSchema = z.array(z.string()).min(1, 'Chọn ít nhất một người nhận.');

export default function MessagesScreen() {
  const { token, user, can } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<MessageSearchScope>('ALL');
  const [openingSearchResultId, setOpeningSearchResultId] = useState<string>();
  const [deletingConversationId, setDeletingConversationId] = useState<string>();
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
        unreadCount: String(conversation?.unreadCount ?? 0),
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

  const confirmDeleteConversation = (conversation: MessageConversation) => {
    if (user?.role !== 'ADMIN' || deletingConversationId) return;
    Alert.alert(
      'Xóa cuộc trò chuyện?',
      `Toàn bộ tin nhắn và ảnh trong “${conversationName(conversation)}” sẽ bị xóa vĩnh viễn.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setDeletingConversationId(conversation.id);
            void api
              .delete(`/messages/conversations/${conversation.id}`)
              .then(async () => {
                queryClient.setQueryData<MessageConversation[]>(['conversations'], current =>
                  current?.filter(item => item.id !== conversation.id),
                );
                await queryClient.invalidateQueries({ queryKey: ['message-global-search-mobile'] });
              })
              .catch(error => Alert.alert('Không thể xóa cuộc trò chuyện', getApiErrorMessage(error)))
              .finally(() => setDeletingConversationId(undefined));
          },
        },
      ],
    );
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
      <StatusBar style="light" />
      <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
        <View className="h-[58px] flex-row items-center gap-2 bg-primary px-2.5">
          <Pressable
            accessibilityLabel="Mở menu chức năng"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/(app)/work')}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'transparent' })}
          >
            <AppIcon name="apps" color="#FFFFFF" size={23} />
          </Pressable>
          <View className="h-10 min-w-0 flex-1 flex-row items-center rounded-full bg-[rgba(255,255,255,0.16)] px-3">
            <AppIcon name="search" color="rgba(255,255,255,0.88)" size={20} />
            <TextInput
              accessibilityLabel="Tìm kiếm tin nhắn"
              placeholder="Tìm kiếm"
              placeholderTextColor="rgba(255,255,255,0.72)"
              className="h-10 min-w-0 flex-1 px-2.5 py-0 text-[15px] text-white"
              style={{ textAlignVertical: 'center', includeFontPadding: false }}
              value={searchInput}
              onChangeText={value => {
                setSearchInput(value);
                if (!value.trim()) setSearchScope('ALL');
              }}
            />
          </View>
          {can(permissions.systemBotsConfigure) ? (
            <Pressable
              accessibilityLabel="Cấu hình bot"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setSettingsOpen(true)}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'transparent' })}
            >
              <AppIcon name="settings" color="#FFFFFF" size={23} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="Tạo nhóm trò chuyện"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setCreateOpen(true)}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'transparent' })}
          >
            <Text className="text-[30px] font-light leading-[34px] text-white">＋</Text>
          </Pressable>
        </View>

        <SafeAreaView className="flex-1 bg-surface" edges={['right', 'bottom', 'left']}>
          <ScrollView
            className="flex-1 bg-surface"
            contentContainerClassName="pb-3"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                colors={[colors.primary]}
                tintColor={colors.primary}
                refreshing={conversations.isRefetching}
                onRefresh={() => void conversations.refetch()}
              />
            }
          >
        {isSearching ? (
          <View className="border-b border-border-subtle px-3 py-2">
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
          </View>
        ) : null}

        {isSearching && (searchResults.isLoading || !searchReady) ? <LoadingBlock /> : null}
        {isSearching && searchReady && searchResults.isError ? (
          <ErrorState text={getApiErrorMessage(searchResults.error)} onRetry={() => void searchResults.refetch()} />
        ) : null}
        {isSearching && !searchResults.isLoading && searchReady && !searchResults.isError && !hasSearchResults ? (
          <EmptyState text="Không tìm thấy kết quả." />
        ) : null}
        {isSearching && searchReady && showPeople && searchResults.data?.people.length ? (
          <View>
            <Text className="bg-surface-muted px-3 py-2 text-xs font-bold uppercase text-content-muted">Mọi người</Text>
            {searchResults.data.people.map(person => (
              <Pressable
                key={person.id}
                disabled={Boolean(openingSearchResultId)}
                onPress={() => void openPerson(person)}
                className="min-h-[72px] flex-row items-center gap-3 bg-surface px-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              >
                <ConversationAvatar name={person.fullName} size={48} />
                <View className="min-w-0 flex-1 self-stretch justify-center border-b border-border-subtle py-2.5">
                  <Text className="text-[16px] font-semibold text-content">{person.fullName}</Text>
                  <Text className="mt-0.5 text-body text-content-muted">@{person.username}{person.phone ? ` · ${person.phone}` : ''}</Text>
                </View>
                {openingSearchResultId === person.id ? <Text className="text-caption font-bold text-primary">Đang mở…</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        {isSearching && searchReady && showMessages && searchResults.data?.messages.length ? (
          <View>
            <Text className="bg-surface-muted px-3 py-2 text-xs font-bold uppercase text-content-muted">Tin nhắn</Text>
            {searchResults.data.messages.map(message => (
              <Pressable
                key={message.id}
                onPress={() => openConversation(message.conversationId, message.conversationName)}
                className="min-h-[72px] flex-row items-center gap-3 bg-surface px-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              >
                <ConversationAvatar name={message.conversationName} size={48} />
                <View className="min-w-0 flex-1 self-stretch justify-center border-b border-border-subtle py-2.5">
                  <View className="flex-row items-center gap-2">
                    <Text numberOfLines={1} className="flex-1 text-[16px] font-semibold text-content">{message.conversationName}</Text>
                    <Text className="text-caption text-content-muted">{formatTime(message.createdAt)}</Text>
                  </View>
                  <Text numberOfLines={1} className="mt-0.5 text-body text-content-muted">{message.senderFullName}: {message.content}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        {isSearching && searchReady && showGroups && searchResults.data?.groups.length ? (
          <View>
            <Text className="bg-surface-muted px-3 py-2 text-xs font-bold uppercase text-content-muted">Nhóm</Text>
            {searchResults.data.groups.map(group => (
              <Pressable
                key={group.conversationId}
                onPress={() => openConversation(group.conversationId, group.name, 'GROUP')}
                className="min-h-[72px] flex-row items-center gap-3 bg-surface px-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              >
                <ConversationAvatar name={group.name} type="GROUP" size={48} />
                <View className="min-w-0 flex-1 self-stretch justify-center border-b border-border-subtle py-2.5">
                  <View className="flex-row items-center gap-2">
                    <Text numberOfLines={1} className="flex-1 text-[16px] font-semibold text-content">{group.name}</Text>
                    {group.lastMessageAt ? <Text className="text-caption text-content-muted">{formatTime(group.lastMessageAt)}</Text> : null}
                  </View>
                  <Text numberOfLines={1} className="mt-0.5 text-body text-content-muted">{group.lastMessageContent || `${group.memberCount} thành viên`}</Text>
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
            delayLongPress={450}
            onPress={() => router.push({
              pathname: '/chat/[id]',
              params: {
                id: item.id,
                title: conversationName(item),
                type: item.conversationType,
                unreadCount: String(item.unreadCount),
              },
            })}
            onLongPress={user?.role === 'ADMIN' ? () => confirmDeleteConversation(item) : undefined}
            className="min-h-[80px] flex-row items-center gap-3 bg-surface px-3"
            style={({ pressed }) => ({ backgroundColor: pressed ? '#F1F5F9' : '#FFFFFF' })}
          >
            <ConversationAvatar name={conversationName(item)} type={item.conversationType} size={52} />
            <View className="min-w-0 flex-1 self-stretch justify-center border-b border-border-subtle py-3">
              <View className="flex-row items-center gap-2">
                <Text
                  numberOfLines={1}
                  className={`flex-1 text-[16px] text-content ${item.unreadCount ? 'font-bold' : 'font-semibold'}`}
                >
                  {conversationName(item)}
                </Text>
                {item.lastMessageAt ? (
                  <Text className={`text-label ${item.unreadCount ? 'font-semibold text-primary' : 'text-content-muted'}`}>
                    {conversationTime(item.lastMessageAt)}
                  </Text>
                ) : null}
              </View>
              <View className="mt-1 flex-row items-center gap-2">
                <Text
                  numberOfLines={1}
                  className={`min-w-0 flex-1 text-body ${item.unreadCount ? 'font-semibold text-content-secondary' : 'text-content-muted'}`}
                >
                  {item.lastMessageContent || (item.conversationType === 'GROUP' ? `${item.memberCount ?? 0} thành viên` : 'Chưa có tin nhắn')}
                </Text>
                {item.unreadCount ? (
                  <View className="h-5 min-w-5 items-center justify-center rounded-full bg-[#E94B55] px-1.5">
                    <Text className="text-[10px] font-bold text-white">{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )) : null}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaView>
      {createOpen ? (
        <CreateConversationModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (id, title, conversationType) => {
            setCreateOpen(false);
            await queryClient.invalidateQueries({ queryKey: ['conversations'] });
            router.push({ pathname: '/chat/[id]', params: { id, title, type: conversationType, unreadCount: '0' } });
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
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const recipients = useQuery({
    queryKey: ['message-recipients-mobile', search],
    queryFn: async () =>
      (
        await api.get<ApiResponse<MessageRecipient[]>>('/messages/recipients', {
          params: { search: search.trim() || undefined },
        })
      ).data.data,
  });

  const toggleRecipient = (id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const create = async () => {
    setValidationAttempted(true);
    if (!recipientSelectionSchema.safeParse(selectedIds).success) return;
    if (!groupNameSchema.safeParse(groupName).success) return;
    setSaving(true);
    try {
      const response = await api.post<ApiResponse<{ id: string }>>('/messages/conversations/group', {
        name: groupName.trim(),
        memberUserIds: selectedIds,
      });
      await onCreated(response.data.data.id, groupName.trim(), 'GROUP');
    } catch (error) {
      Alert.alert('Không thể tạo nhóm trò chuyện', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const groupNameInvalid = validationAttempted && !groupNameSchema.safeParse(groupName).success;
  const recipientsInvalid = validationAttempted && !recipientSelectionSchema.safeParse(selectedIds).success;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="min-h-header flex-row items-center justify-between border-b border-border bg-surface px-3">
            <Pressable onPress={onClose}><Text className="text-sm font-semibold text-content-muted">Hủy</Text></Pressable>
            <Text className="text-base font-bold text-content">Tạo nhóm mới</Text>
            <Pressable disabled={saving} onPress={() => void create()}><Text className="text-sm font-semibold text-primary">Tạo</Text></Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-3 p-3" keyboardShouldPersistTaps="handled">
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Tên nhóm trò chuyện"
              placeholderTextColor={colors.textPlaceholder}
              className={`h-control rounded-control border bg-surface px-3 py-0 text-content ${groupNameInvalid ? 'border-danger bg-danger-soft' : 'border-border'}`}
              style={{ textAlignVertical: 'center', includeFontPadding: false }}
            />
            {groupNameInvalid ? (
              <Text className="text-caption font-medium leading-[15px] text-danger">Tên nhóm phải có ít nhất 2 ký tự.</Text>
            ) : null}
            <SearchField placeholder="Tìm thành viên theo tên, tài khoản..." value={search} onChangeText={setSearch} />
            {recipientsInvalid ? (
              <Text className="text-caption font-medium leading-[15px] text-danger">Chọn ít nhất một thành viên.</Text>
            ) : null}
            {recipients.isLoading ? <LoadingBlock /> : null}
            {recipients.isError ? <ErrorState text={getApiErrorMessage(recipients.error)} onRetry={() => void recipients.refetch()} /> : null}
            {recipients.data?.map(recipient => {
              const selected = selectedIds.includes(recipient.id);
              return (
                <Pressable
                  key={recipient.id}
                  onPress={() => toggleRecipient(recipient.id)}
                  className={`min-h-[62px] flex-row items-center gap-2.5 rounded-control border p-2.5 ${selected ? 'border-primary-border bg-primary-soft' : 'border-border bg-surface'}`}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-primary-soft"><Text className="font-bold text-primary-dark">{recipient.fullName.charAt(0)}</Text></View>
                  <View className="flex-1">
                    <Text className="font-bold text-content">{recipient.fullName}</Text>
                    <Text className="mt-1 text-xs text-content-muted">@{recipient.username} · {recipient.role}</Text>
                  </View>
                  {selected ? <StatusBadge label="Đã chọn" tone="info" /> : null}
                </Pressable>
              );
            })}
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
          <View className="gap-[5px] rounded-control bg-primary-soft p-3">
            <Text className="text-[15px] font-bold text-primary-dark">{settings.data.botName}</Text>
            <Text className="text-body leading-[18px] text-content-muted">{settings.data.description}</Text>
            <Text className="text-xs font-bold text-primary-dark">{recipientIds.length} tài khoản nhận thông báo</Text>
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
                className={`min-h-[62px] flex-row items-center gap-2.5 rounded-control border p-2.5 ${selected ? 'border-primary-border bg-primary-soft' : 'border-border bg-surface'}`}
              >
                <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-primary-soft"><Text className="font-bold text-primary-dark">{account.fullName.charAt(0)}</Text></View>
                <View className="flex-1">
                  <Text className="font-bold text-content">{account.fullName}</Text>
                  <Text className="mt-1 text-xs text-content-muted">@{account.username}{account.phone ? ` · ${account.phone}` : ''}</Text>
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
