import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { EmptyState, LoadingBlock } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/services/api';
import { createMessagingSocket } from '@/services/messaging-socket';
import { colors } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { MessageConversation } from '@/types/models';

function conversationName(item: MessageConversation) {
  return item.groupName || item.otherFullName || 'Cuộc trò chuyện';
}

export default function MessagesScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => (await api.get<ApiResponse<MessageConversation[]>>('/messages/conversations')).data.data,
  });

  useEffect(() => {
    if (!token) return;
    const socket = createMessagingSocket(token);
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    socket.on('messaging:conversation-updated', refresh);
    socket.on('messaging:message-new', refresh);
    return () => {
      socket.close();
    };
  }, [queryClient, token]);

  return (
    <Screen
      title="Tin nhắn"
      subtitle="Trao đổi và thông báo hệ thống"
      refreshing={conversations.isRefetching}
      onRefresh={() => void conversations.refetch()}
    >
      {conversations.isLoading ? <LoadingBlock /> : null}
      {!conversations.isLoading && !conversations.data?.length ? <EmptyState text="Chưa có cuộc trò chuyện nào." /> : null}
      {conversations.data?.map(item => (
        <Pressable
          key={item.id}
          onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id, title: conversationName(item) } })}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{conversationName(item).charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.body}>
            <Text numberOfLines={1} style={styles.name}>{conversationName(item)}</Text>
            <Text numberOfLines={1} style={styles.preview}>{item.lastMessageContent || 'Chưa có tin nhắn'}</Text>
          </View>
          {item.unreadCount ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount}</Text></View>
          ) : null}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: 76,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { opacity: 0.72 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontSize: 20, fontWeight: '900' },
  body: { flex: 1, gap: 5 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  preview: { color: colors.textMuted, fontSize: 13 },
  badge: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
