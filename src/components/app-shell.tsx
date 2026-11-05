import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/services/api';
import { createMessagingSocket } from '@/services/messaging-socket';
import { colors } from '@/theme/colors';
import type { ApiResponse } from '@/types/api';
import type { MessageConversation } from '@/types/models';
import { AppIcon } from './app-icon';

function initials(value?: string) {
  return (value || 'BHL')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

export function AppHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const conversations = useQuery({
    queryKey: ['conversations'],
    enabled: Boolean(token),
    queryFn: async () => (await api.get<ApiResponse<MessageConversation[]>>('/messages/conversations')).data.data,
  });
  const unreadCount = conversations.data?.reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0;
  const isNested = pathname.startsWith('/purchase-warehouse/') || pathname.startsWith('/material-record/');

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

  const openNavigation = () => {
    if (isNested) {
      router.back();
      return;
    }
    if (pathname !== '/work') router.push('/(app)/work');
  };

  return (
    <View className="min-h-[52px] flex-row items-center gap-1.5 border-b border-border-subtle bg-surface px-2">
      <Pressable
        accessibilityLabel={isNested ? 'Quay lại' : 'Mở menu chức năng'}
        accessibilityRole="button"
        hitSlop={8}
        onPress={openNavigation}
        className={`h-9 w-9 items-center justify-center rounded-compact ${!isNested && pathname === '/work' ? 'bg-primary-soft' : ''}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
      >
        <AppIcon
          name={isNested ? 'back' : 'apps'}
          color={!isNested && pathname === '/work' ? colors.primary : colors.textSecondary}
          size={20}
        />
      </Pressable>

      <Text numberOfLines={1} className="flex-1 text-title font-bold text-content">{title}</Text>

      <View className="flex-row items-center gap-2 px-1">
        <Pressable
          accessibilityLabel={unreadCount ? `Tin nhắn, ${unreadCount} tin chưa đọc` : 'Tin nhắn'}
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => router.push('/(app)/messages')}
          className={`h-11 w-11 items-center justify-center rounded-full ${pathname === '/messages' ? 'bg-primary-soft' : ''}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
        >
          <AppIcon
            name="messages"
            color={colors.primary}
            size={27}
          />
          {unreadCount ? (
            <View
              pointerEvents="none"
              className="absolute -left-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#E94B55] px-1"
            >
              <Text className="text-[9px] font-bold leading-[11px] text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityLabel="Tài khoản"
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => router.push('/(app)/profile')}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
        >
          <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Text className="text-label font-bold text-primary-dark">{initials(user?.fullName)}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
