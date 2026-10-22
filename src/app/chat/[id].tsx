import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/services/api';
import { createMessagingSocket } from '@/services/messaging-socket';
import { colors } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { DirectMessage, DirectMessagesResponse } from '@/types/models';

export default function ChatScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const messages = useQuery({
    queryKey: ['messages', id],
    enabled: Boolean(id),
    queryFn: async () =>
      (await api.get<DirectMessagesResponse>(`/messages/conversations/${id}/messages`, { params: { limit: 50 } })).data.data,
  });
  const send = useMutation({
    mutationFn: async (content: string) =>
      (await api.post<ApiResponse<DirectMessage>>(`/messages/conversations/${id}/messages`, { content })).data.data,
    onSuccess: message => {
      queryClient.setQueryData<DirectMessage[]>(['messages', id], current => [...(current || []), message]);
      setText('');
    },
  });

  useEffect(() => {
    if (!token) return;
    const socket = createMessagingSocket(token);
    socket.on('messaging:message-new', message => {
      if (message.conversationId !== id || message.senderUserId === user?.id) return;
      queryClient.setQueryData<DirectMessage[]>(['messages', id], current => {
        if (current?.some(item => item.id === message.id)) return current;
        return [...(current || []), message];
      });
      void api.post(`/messages/conversations/${id}/read`);
    });
    return () => {
      socket.close();
    };
  }, [id, queryClient, token, user?.id]);

  useEffect(() => {
    if (id) void api.post(`/messages/conversations/${id}/read`);
  }, [id]);

  const submit = () => {
    const content = text.trim();
    if (content && !send.isPending) send.mutate(content);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: title || 'Tin nhắn' }} />
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={92}>
        <FlatList
          ref={listRef}
          data={messages.data || []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.senderUserId === user?.id;
            return (
              <View style={[styles.messageRow, mine && styles.messageRowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  {!mine ? <Text style={styles.sender}>{item.senderFullName}</Text> : null}
                  <Text style={[styles.messageText, mine && styles.messageTextMine]}>{item.content || 'Thông báo hệ thống'}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput
            multiline
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#98A2B3"
            style={styles.input}
            value={text}
            onChangeText={setText}
          />
          <Pressable onPress={submit} style={styles.sendButton}>
            <Text style={styles.sendText}>Gửi</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  list: { padding: 14, gap: 8, flexGrow: 1, justifyContent: 'flex-end' },
  messageRow: { alignItems: 'flex-start' },
  messageRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 5 },
  sender: { color: colors.primaryDark, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  messageTextMine: { color: '#FFFFFF' },
  composer: { padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18, backgroundColor: colors.background, color: colors.text },
  sendButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '800' },
});
