import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetch as expoFetch } from 'expo/fetch';
import { File as ExpoFile } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ViewInstance } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { useAuth } from '@/features/auth/auth-context';
import { api, apiBaseUrl, getApiErrorMessage } from '@/services/api';
import { createMessagingSocket } from '@/services/messaging-socket';
import { colors } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { DirectMessage, DirectMessagesResponse } from '@/types/models';
import { formatTime } from '@/utils/format';

type MessageAttachment = NonNullable<DirectMessage['attachments']>[number];
type MessageImagePreview = {
  attachments: MessageAttachment[];
  index: number;
};

const MAX_MESSAGE_IMAGES = 5;
const MAX_MESSAGE_IMAGE_SIZE = 5 * 1024 * 1024;
const MESSAGE_IMAGE_UPLOAD_TIMEOUT = 60_000;
const CHAT_HEADER_HEIGHT = 56;
const messageImageCache = new Map<string, string>();
const messageImageDownloads = new Map<string, Promise<string>>();

function getMessageImageMimeType(asset: ImagePicker.ImagePickerAsset) {
  const mimeType = asset.mimeType?.toLowerCase();
  if (mimeType === 'image/jpg') return 'image/jpeg';
  if (mimeType && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) return mimeType;
  if (mimeType) return undefined;

  const extension = asset.fileName?.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function messageImageExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

function messageAttachmentUrl(attachmentId: string) {
  return `${apiBaseUrl.replace(/\/$/, '')}/messages/attachments/${attachmentId}`;
}

async function downloadMessageImage(attachment: MessageAttachment, token: string) {
  const cachedUri = messageImageCache.get(attachment.id);
  if (cachedUri) return cachedUri;

  const currentDownload = messageImageDownloads.get(attachment.id);
  if (currentDownload) return currentDownload;

  const download = (async () => {
    if (!FileSystem.cacheDirectory) throw new Error('Không xác định được bộ nhớ đệm của thiết bị.');

    const cacheDirectory = `${FileSystem.cacheDirectory}message-images/`;
    const localUri = `${cacheDirectory}${attachment.id}.${messageImageExtension(attachment.mimeType)}`;
    await FileSystem.makeDirectoryAsync(cacheDirectory, { intermediates: true });

    const currentFile = await FileSystem.getInfoAsync(localUri);
    if (currentFile.exists && currentFile.size === attachment.fileSize) {
      messageImageCache.set(attachment.id, localUri);
      return localUri;
    }
    if (currentFile.exists) await FileSystem.deleteAsync(localUri, { idempotent: true });

    const result = await FileSystem.downloadAsync(messageAttachmentUrl(attachment.id), localUri, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
      throw new Error(`Không thể tải ảnh (${result.status}).`);
    }

    messageImageCache.set(attachment.id, result.uri);
    return result.uri;
  })().finally(() => messageImageDownloads.delete(attachment.id));

  messageImageDownloads.set(attachment.id, download);
  return download;
}

function ProtectedMessageImage({
  attachment,
  token,
  className,
  resizeMode,
  dimensions,
}: {
  attachment: MessageAttachment;
  token: string | null;
  className: string;
  resizeMode: 'cover' | 'contain';
  dimensions?: { width: number; height: number };
}) {
  const [imageUri, setImageUri] = useState(() => messageImageCache.get(attachment.id));
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let webObjectUrl: string | undefined;

    const load = async () => {
      try {
        let nextUri: string;
        if (Platform.OS === 'web') {
          const response = await api.get<Blob>(`/messages/attachments/${attachment.id}`, { responseType: 'blob' });
          webObjectUrl = URL.createObjectURL(response.data);
          nextUri = webObjectUrl;
        } else {
          if (!token) throw new Error('Phiên đăng nhập chưa sẵn sàng.');
          nextUri = await downloadMessageImage(attachment, token);
        }
        if (active) setImageUri(nextUri);
      } catch {
        if (active) setLoadFailed(true);
      }
    };

    void load();
    return () => {
      active = false;
      if (webObjectUrl) URL.revokeObjectURL(webObjectUrl);
    };
  }, [attachment, token]);

  if (!imageUri) {
    return (
      <View style={dimensions} className={`${className} items-center justify-center bg-gray-200`}>
        {loadFailed ? (
          <Text className="px-2 text-center text-caption font-medium text-content-muted">Không tải được ảnh</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUri }}
      resizeMode={resizeMode}
      style={dimensions}
      className={className}
      accessibilityLabel={attachment.fileName}
      onError={() => {
        messageImageCache.delete(attachment.id);
        setImageUri(undefined);
        setLoadFailed(true);
      }}
    />
  );
}

function initials(value?: string) {
  return (value || 'BHL')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

export default function ChatScreen() {
  const { id, title, type, unreadCount } = useLocalSearchParams<{
    id: string;
    title?: string;
    type?: string;
    unreadCount?: string;
  }>();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const initialUnreadCount = Math.max(0, Number.parseInt(unreadCount || '0', 10) || 0);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [sendingImages, setSendingImages] = useState(false);
  const [imagePreview, setImagePreview] = useState<MessageImagePreview>();
  const [previewViewportHeight, setPreviewViewportHeight] = useState(0);
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);
  const [composerHeight, setComposerHeight] = useState(56);
  const chatBodyRef = useRef<ViewInstance>(null);
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const initialScrollDoneRef = useRef(false);
  const stickToBottomRef = useRef(initialUnreadCount === 0);
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
      stickToBottomRef.current = true;
      queryClient.setQueryData<DirectMessage[]>(['messages', id], current => [...(current || []), message]);
      setText('');
    },
  });

  useEffect(() => {
    initialScrollDoneRef.current = false;
    stickToBottomRef.current = initialUnreadCount === 0;
  }, [id, initialUnreadCount]);

  useEffect(() => {
    const keyboardEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSubscription = Keyboard.addListener(keyboardEvent, event => {
      const scrollToBottom = () => {
        if (!stickToBottomRef.current) return;
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
      };

      if (Platform.OS !== 'android') {
        scrollToBottom();
        return;
      }

      requestAnimationFrame(() => {
        chatBodyRef.current?.measureInWindow((_x, y, _width, height) => {
          const keyboardInset = Math.max(0, Math.round(y + height - event.endCoordinates.screenY));
          setAndroidKeyboardInset(keyboardInset);
          requestAnimationFrame(scrollToBottom);
        });
      });
    });

    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setAndroidKeyboardInset(0),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || androidKeyboardInset <= 0 || !stickToBottomRef.current) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [androidKeyboardInset, composerHeight]);

  useEffect(() => {
    const socket = createMessagingSocket(token);
    if (!socket) return;
    socket.on('messaging:conversation-updated', event => {
      if (event.conversationId !== id || !event.deleted) return;
      queryClient.removeQueries({ queryKey: ['messages', id] });
      router.replace('/(app)/messages');
      Alert.alert('Cuộc trò chuyện đã bị xóa', 'Toàn bộ tin nhắn trong cuộc trò chuyện này đã bị xóa.');
    });
    socket.on('messaging:message-new', message => {
      if (message.conversationId !== id || message.senderUserId === user?.id) return;
      queryClient.setQueryData<DirectMessage[]>(['messages', id], current => {
        if (current?.some(item => item.id === message.id)) return current;
        return [...(current || []), message];
      });
      void api
        .post(`/messages/conversations/${id}/read`)
        .then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }))
        .catch(() => undefined);
    });
    return () => {
      socket.close();
    };
  }, [id, queryClient, token, user?.id]);

  useEffect(() => {
    if (id) {
      void api
        .post(`/messages/conversations/${id}/read`)
        .then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }))
        .catch(() => undefined);
    }
  }, [id, queryClient]);

  const pickImages = async () => {
    if (sendingImages || selectedImages.length >= MAX_MESSAGE_IMAGES) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      allowsEditing: false,
      selectionLimit: MAX_MESSAGE_IMAGES - selectedImages.length,
      orderedSelection: true,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets.length) return;
    if (picked.assets.some(asset => (asset.fileSize ?? 0) > MAX_MESSAGE_IMAGE_SIZE)) {
      Alert.alert('Ảnh quá lớn', 'Mỗi ảnh gửi trong tin nhắn không được vượt quá 5 MB.');
      return;
    }
    if (picked.assets.some(asset => !getMessageImageMimeType(asset))) {
      Alert.alert('Định dạng ảnh chưa hỗ trợ', 'Vui lòng chọn ảnh JPEG, PNG, WebP hoặc GIF.');
      return;
    }

    setSelectedImages(current => {
      const known = new Set(current.map(asset => asset.assetId || asset.uri));
      const additions = picked.assets.filter(asset => !known.has(asset.assetId || asset.uri));
      return [...current, ...additions].slice(0, MAX_MESSAGE_IMAGES);
    });
  };

  const sendImages = async (content: string) => {
    if (sendingImages || !selectedImages.length) return false;
    setSendingImages(true);
    try {
      const formData = new FormData();
      if (content) formData.append('content', content);
      selectedImages.forEach((asset, index) => {
        const fileName = asset.fileName || `message-${index + 1}.jpg`;
        if (Platform.OS === 'web' && asset.file) {
          formData.append('images', asset.file, fileName);
          return;
        }
        const file = new ExpoFile(asset.uri);
        if (!file.exists) throw new Error(`Không thể đọc ảnh số ${index + 1} trên thiết bị.`);
        formData.append('images', file, fileName);
      });

      let message: DirectMessage;
      if (Platform.OS === 'web') {
        const response = await api.post<ApiResponse<DirectMessage>>(
          `/messages/conversations/${id}/images`,
          formData,
          { timeout: MESSAGE_IMAGE_UPLOAD_TIMEOUT },
        );
        message = response.data.data;
      } else {
        if (!token) throw new Error('Phiên đăng nhập chưa sẵn sàng.');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), MESSAGE_IMAGE_UPLOAD_TIMEOUT);
        try {
          const response = await expoFetch(
            `${apiBaseUrl.replace(/\/$/, '')}/messages/conversations/${id}/images`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
                'X-ERP-Client': 'mobile',
              },
              body: formData,
              signal: controller.signal,
            },
          );
          const responseText = await response.text();
          let payload: (ApiResponse<DirectMessage> & { errors?: Record<string, string[]> }) | undefined;
          if (responseText) {
            try {
              payload = JSON.parse(responseText) as ApiResponse<DirectMessage> & { errors?: Record<string, string[]> };
            } catch {
              throw new Error(
                response.ok
                  ? 'Máy chủ trả về dữ liệu không hợp lệ sau khi gửi ảnh.'
                  : `Máy chủ từ chối yêu cầu gửi ảnh (${response.status}).`,
              );
            }
          }
          if (!response.ok || !payload?.success || !payload.data) {
            const fieldError = payload?.errors
              ? Object.values(payload.errors).flat().find(Boolean)
              : undefined;
            throw new Error(fieldError || payload?.message || `Không thể gửi ảnh (${response.status}).`);
          }
          message = payload.data;
        } catch (error) {
          if (controller.signal.aborted) throw new Error('Gửi ảnh quá thời gian. Vui lòng thử lại.');
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      stickToBottomRef.current = true;
      queryClient.setQueryData<DirectMessage[]>(['messages', id], current => [...(current || []), message]);
      setSelectedImages([]);
      setText('');
      return true;
    } catch (error) {
      Alert.alert('Không thể gửi ảnh', getApiErrorMessage(error));
      return false;
    } finally {
      setSendingImages(false);
    }
  };

  const submit = async () => {
    const content = text.trim();
    if (sendingImages || send.isPending || (!content && !selectedImages.length)) return;
    if (selectedImages.length) {
      await sendImages(content);
      return;
    }
    send.mutate(content);
  };

  const scrollToInitialMessage = () => {
    const messageItems = messages.data || [];
    if (initialScrollDoneRef.current || !messageItems.length) return;

    initialScrollDoneRef.current = true;
    if (!initialUnreadCount) {
      stickToBottomRef.current = true;
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
      return;
    }

    stickToBottomRef.current = false;
    const firstUnreadIndex = Math.max(0, messageItems.length - initialUnreadCount);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: firstUnreadIndex, animated: false, viewPosition: 0 });
    });
  };

  const handleMessageContentSizeChange = () => {
    if (!initialScrollDoneRef.current) {
      scrollToInitialMessage();
      return;
    }
    if (stickToBottomRef.current) listRef.current?.scrollToEnd({ animated: false });
  };

  const openImagePreview = async (selectedAttachment: MessageAttachment) => {
    const loadedAttachments = (messages.data || []).flatMap(message => message.attachments || []);
    const loadedIndex = loadedAttachments.findIndex(attachment => attachment.id === selectedAttachment.id);
    const initialAttachments = loadedIndex >= 0 ? loadedAttachments : [selectedAttachment];
    setImagePreview({
      attachments: initialAttachments,
      index: Math.max(0, loadedIndex),
    });

    try {
      const response = await api.get<ApiResponse<MessageAttachment[]>>(`/messages/conversations/${id}/images`);
      const allAttachments = response.data.data;
      const selectedIndex = allAttachments.findIndex(attachment => attachment.id === selectedAttachment.id);
      if (selectedIndex < 0) return;
      setImagePreview(current => current ? { attachments: allAttachments, index: selectedIndex } : current);
    } catch {
      // Keep the already loaded conversation images available when the history request fails.
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View className="h-[56px] flex-row items-center gap-2 bg-primary px-2">
        <Pressable
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'transparent' })}
        >
          <AppIcon name="back" color="#FFFFFF" size={24} />
        </Pressable>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/20">
          <Text className="text-label font-bold text-white">{initials(title)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[17px] font-bold text-white">{title || 'Tin nhắn'}</Text>
          <Text className="text-caption font-normal text-white/75">
            {type === 'SYSTEM' ? 'Thông báo hệ thống' : type === 'GROUP' ? 'Nhóm trò chuyện' : 'Cuộc trò chuyện'}
          </Text>
        </View>
      </View>
      <SafeAreaView className="flex-1 bg-white" edges={['right', 'bottom', 'left']}>
      <View
        ref={chatBodyRef}
        collapsable={false}
        className="flex-1 bg-primary-soft"
      >
        <KeyboardAvoidingView
          className="flex-1 bg-primary-soft"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
          keyboardVerticalOffset={insets.top + CHAT_HEADER_HEIGHT}
        >
        <FlatList
          ref={listRef}
          data={messages.data || []}
          keyExtractor={item => item.id}
          contentContainerClassName="flex-grow justify-end px-2.5 pt-3"
          contentContainerStyle={
            Platform.OS === 'android' && type !== 'SYSTEM'
              ? { paddingBottom: androidKeyboardInset + composerHeight + 12 }
              : { paddingBottom: 12 }
          }
          initialNumToRender={50}
          maxToRenderPerBatch={50}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onContentSizeChange={handleMessageContentSizeChange}
          onLayout={() => {
            if (initialScrollDoneRef.current && stickToBottomRef.current) {
              requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
            }
          }}
          onScroll={event => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            stickToBottomRef.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
          }}
          onScrollToIndexFailed={info => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: false,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
            }, 80);
          }}
          renderItem={({ item }) => {
            const mine = item.senderUserId === user?.id;
            return (
              <View className={`mb-1.5 flex-row items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine ? (
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
                    <Text className="text-[9px] font-bold text-white">{initials(item.senderFullName)}</Text>
                  </View>
                ) : null}
                <View className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && type === 'GROUP' ? (
                    <Text className="mb-1 ml-1 text-caption font-semibold text-content-muted">{item.senderFullName}</Text>
                  ) : null}
                  <View
                    className={`min-w-[74px] px-3 py-2 ${mine ? 'rounded-[16px] rounded-br-[5px] bg-[#DBEAFE]' : 'rounded-[16px] rounded-bl-[5px] bg-white'}`}
                    style={{
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.07,
                      shadowRadius: 2,
                      elevation: 1,
                    }}
                  >
                    {item.content ? <Text className="text-[15px] leading-[21px] text-[#172033]">{item.content}</Text> : null}
                    {item.attachments?.length ? (
                      <View className={`mt-1 flex-row flex-wrap gap-1 ${item.attachments.length > 1 ? 'w-[220px]' : ''}`}>
                        {item.attachments.map(attachment => (
                          <Pressable
                            key={attachment.id}
                            accessibilityLabel={`Xem ảnh ${attachment.fileName}`}
                            accessibilityRole="imagebutton"
                            onPress={() => void openImagePreview(attachment)}
                          >
                            <ProtectedMessageImage
                              attachment={attachment}
                              token={token}
                              resizeMode="cover"
                              className={`${item.attachments!.length > 1 ? 'h-[108px] w-[108px]' : 'h-[180px] w-[220px]'} rounded-[12px] bg-gray-200`}
                            />
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    {!item.content && !item.attachments?.length ? (
                      <Text className="text-[15px] leading-[21px] text-content">Thông báo hệ thống</Text>
                    ) : null}
                    <Text className="mt-1 self-end text-[10px] leading-3 text-[#84909B]">{formatTime(item.createdAt)}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
        {type === 'SYSTEM' ? (
          <View className="min-h-[52px] items-center justify-center border-t border-border-subtle bg-white px-3 py-2">
            <Text className="text-body text-content-muted">Kênh thông báo hệ thống chỉ cho phép đọc.</Text>
          </View>
        ) : (
          <View
            className="border-t border-border-subtle bg-white"
            onLayout={event => {
              const nextHeight = Math.ceil(event.nativeEvent.layout.height);
              setComposerHeight(current => current === nextHeight ? current : nextHeight);
            }}
            style={
              Platform.OS === 'android'
                ? {
                    position: 'absolute',
                    right: 0,
                    bottom: androidKeyboardInset,
                    left: 0,
                    zIndex: 10,
                    elevation: 10,
                  }
                : undefined
            }
          >
            {selectedImages.length ? (
              <View className="flex-row items-center border-b border-border-subtle px-2 py-2">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
                  {selectedImages.map((asset, index) => (
                    <View key={asset.assetId || asset.uri} className="relative">
                      <Image source={{ uri: asset.uri }} resizeMode="cover" className="h-16 w-16 rounded-xl bg-gray-200" />
                      <Pressable
                        accessibilityLabel={`Bỏ ảnh ${index + 1}`}
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => setSelectedImages(current => current.filter((_, imageIndex) => imageIndex !== index))}
                        className="absolute -right-1 top-0.5 h-7 w-7 items-center justify-center rounded-full bg-[#E5484D]"
                      >
                        <Text className="text-[21px] font-bold leading-6 text-white">×</Text>
                      </Pressable>
                    </View>
                  ))}
                  {selectedImages.length < MAX_MESSAGE_IMAGES ? (
                    <Pressable
                      accessibilityLabel="Chọn thêm ảnh"
                      accessibilityRole="button"
                      onPress={() => void pickImages()}
                      className="h-16 w-16 items-center justify-center rounded-xl border border-dashed border-primary bg-primary-soft"
                    >
                      <Text className="text-[28px] font-normal leading-8 text-primary">+</Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
                <Text className="ml-2 text-caption font-semibold text-content-muted">
                  {selectedImages.length}/{MAX_MESSAGE_IMAGES}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-end gap-2 px-2 py-2">
            <Pressable
              accessibilityLabel="Chọn ảnh"
              accessibilityRole="button"
              disabled={sendingImages || selectedImages.length >= MAX_MESSAGE_IMAGES}
              onPress={() => void pickImages()}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.primarySoft : 'transparent',
                opacity: sendingImages || selectedImages.length >= MAX_MESSAGE_IMAGES ? 0.5 : 1,
              })}
            >
              {sendingImages ? <Text className="text-xl font-bold text-primary">…</Text> : <AppIcon name="image" color={colors.primary} size={25} />}
            </Pressable>
            <TextInput
              multiline
              placeholder="Tin nhắn"
              placeholderTextColor={colors.textPlaceholder}
              className="min-h-[40px] max-h-[120px] flex-1 rounded-[20px] bg-[#F1F4F6] px-3.5 py-[9px] text-[15px] text-content"
              value={text}
              onChangeText={setText}
              onFocus={() => {
                stickToBottomRef.current = true;
                requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
              }}
            />
            {!text.trim() && !selectedImages.length ? (
              <Pressable
                accessibilityLabel="Gửi lượt thích"
                accessibilityRole="button"
                disabled={send.isPending || sendingImages}
                onPress={() => send.mutate('👍')}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.primarySoft : 'transparent',
                  opacity: send.isPending || sendingImages ? 0.38 : 1,
                })}
              >
                <AppIcon name="like" color={colors.primary} size={25} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityLabel="Gửi tin nhắn"
                accessibilityRole="button"
                disabled={send.isPending || sendingImages}
                onPress={() => void submit()}
                className="h-10 w-10 items-center justify-center rounded-full bg-primary"
                style={{ opacity: send.isPending || sendingImages ? 0.38 : 1 }}
              >
                <AppIcon name="send" color="#FFFFFF" size={21} />
              </Pressable>
            )}
            </View>
          </View>
        )}
        </KeyboardAvoidingView>
      </View>
      </SafeAreaView>
      <Modal
        animationType="fade"
        presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : 'overFullScreen'}
        transparent={false}
        visible={Boolean(imagePreview)}
        onRequestClose={() => setImagePreview(undefined)}
      >
        <View
          className="flex-1 bg-black"
          style={{
            paddingTop: insets.top,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
          }}
        >
          <View className="z-20 h-14 flex-row items-center bg-black px-2" style={{ elevation: 20 }}>
            <Pressable
              accessibilityLabel="Đóng ảnh"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setImagePreview(undefined)}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
            >
              <Text className="text-[28px] font-light leading-8 text-white">×</Text>
            </Pressable>
            <Text numberOfLines={1} className="ml-2 flex-1 text-body font-medium text-white">
              {imagePreview?.attachments[imagePreview.index]?.fileName || 'Ảnh tin nhắn'}
            </Text>
            {imagePreview && imagePreview.attachments.length > 1 ? (
              <Text className="ml-2 min-w-12 text-right text-body font-semibold text-white/80">
                {imagePreview.index + 1}/{imagePreview.attachments.length}
              </Text>
            ) : null}
          </View>
          {imagePreview ? (
            <View
              className="flex-1 bg-black"
              onLayout={event => {
                const nextHeight = Math.round(event.nativeEvent.layout.height);
                setPreviewViewportHeight(current => current === nextHeight ? current : nextHeight);
              }}
            >
              {previewViewportHeight > 0 ? (
                <FlatList
                  key={imagePreview.attachments.map(attachment => attachment.id).join(':')}
                  data={imagePreview.attachments}
                  horizontal
                  pagingEnabled
                  initialScrollIndex={imagePreview.index}
                  keyExtractor={attachment => attachment.id}
                  showsHorizontalScrollIndicator={false}
                  removeClippedSubviews={false}
                  initialNumToRender={1}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  className="flex-1 bg-black"
                  getItemLayout={(_, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
                  onMomentumScrollEnd={event => {
                    const nextIndex = Math.min(
                      imagePreview.attachments.length - 1,
                      Math.max(0, Math.round(event.nativeEvent.contentOffset.x / windowWidth)),
                    );
                    setImagePreview(current => current ? { ...current, index: nextIndex } : current);
                  }}
                  renderItem={({ item: attachment }) => (
                    <View style={{ width: windowWidth, height: previewViewportHeight }} className="bg-black">
                      <ProtectedMessageImage
                        attachment={attachment}
                        token={token}
                        resizeMode="contain"
                        dimensions={{ width: windowWidth, height: previewViewportHeight }}
                        className="bg-black"
                      />
                    </View>
                  )}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
