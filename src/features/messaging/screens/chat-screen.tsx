import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { api, apiBaseUrl, getApiErrorMessage } from '@/services/api';
import { createMessagingSocket } from '@/services/messaging-socket';
import { colors, ui } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { DirectMessage, DirectMessagesResponse } from '@/types/models';

export default function ChatScreen() {
  const { id, title, type } = useLocalSearchParams<{ id: string; title?: string; type?: string }>();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [sendingImages, setSendingImages] = useState(false);
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

  const sendImages = async () => {
    if (sendingImages) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets.length) return;
    if (picked.assets.some(asset => (asset.fileSize ?? 0) > 10 * 1024 * 1024)) {
      Alert.alert('Ảnh quá lớn', 'Mỗi ảnh gửi trong tin nhắn không được vượt quá 10 MB.');
      return;
    }
    setSendingImages(true);
    try {
      const formData = new FormData();
      picked.assets.forEach((asset, index) => {
        formData.append(
          'images',
          {
            uri: asset.uri,
            name: asset.fileName || `message-${index + 1}.jpg`,
            type: asset.mimeType || 'image/jpeg',
          } as unknown as Blob,
        );
      });
      const response = await api.post<ApiResponse<DirectMessage>>(
        `/messages/conversations/${id}/images`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      queryClient.setQueryData<DirectMessage[]>(['messages', id], current => [...(current || []), response.data.data]);
    } catch (error) {
      Alert.alert('Không thể gửi ảnh', getApiErrorMessage(error));
    } finally {
      setSendingImages(false);
    }
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
                  {item.content ? <Text style={[styles.messageText, mine && styles.messageTextMine]}>{item.content}</Text> : null}
                  {item.attachments?.map(attachment => (
                    <Image
                      key={attachment.id}
                      source={{
                        uri: `${apiBaseUrl.replace(/\/$/, '')}/messages/attachments/${attachment.id}`,
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                      }}
                      resizeMode="cover"
                      style={styles.attachment}
                    />
                  ))}
                  {!item.content && !item.attachments?.length ? (
                    <Text style={[styles.messageText, mine && styles.messageTextMine]}>Thông báo hệ thống</Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
        {type === 'SYSTEM' ? (
          <View style={styles.readOnly}><Text style={styles.readOnlyText}>Kênh thông báo hệ thống chỉ cho phép đọc.</Text></View>
        ) : (
          <View style={styles.composer}>
            <Pressable disabled={sendingImages} onPress={() => void sendImages()} style={styles.imageButton}>
              <Text style={styles.imageButtonText}>{sendingImages ? '…' : '＋'}</Text>
            </Pressable>
            <TextInput
              multiline
              placeholder="Nhập tin nhắn..."
              placeholderTextColor={colors.textPlaceholder}
              style={styles.input}
              value={text}
              onChangeText={setText}
            />
            <Pressable onPress={submit} style={styles.sendButton}>
              <Text style={styles.sendText}>Gửi</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  list: { padding: 12, gap: 8, flexGrow: 1, justifyContent: 'flex-end' },
  messageRow: { alignItems: 'flex-start' },
  messageRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: ui.cardRadius },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 5 },
  sender: { color: colors.primaryDark, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  messageTextMine: { color: '#FFFFFF' },
  attachment: { width: 210, height: 170, borderRadius: 11, marginTop: 5, backgroundColor: '#E4E7EC' },
  composer: { padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  imageButton: { width: 40, height: 40, borderRadius: ui.radius, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  imageButtonText: { color: colors.primaryDark, fontSize: 25, fontWeight: '700' },
  input: { flex: 1, maxHeight: 120, minHeight: ui.controlHeight, paddingHorizontal: 12, paddingVertical: 9, borderRadius: ui.radius, backgroundColor: colors.background, color: colors.text },
  sendButton: { minHeight: ui.controlHeight, paddingHorizontal: 14, borderRadius: ui.radius, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '800' },
  readOnly: { minHeight: 52, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  readOnlyText: { color: colors.textMuted, fontSize: 13 },
});
