import { io, type Socket } from 'socket.io-client';

import type { DirectMessage } from '@/types/models';
import { apiBaseUrl, getProtectedApiHeaders, hasProtectedApiSession, usesBrowserSession } from './api';

interface ServerToClientEvents {
  'messaging:conversation-updated': (event: { conversationId: string; deleted?: boolean }) => void;
  'messaging:message-new': (message: DirectMessage) => void;
  'messaging:conversation-read': (event: { conversationId: string; readerUserId: string }) => void;
}

function socketServerUrl() {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) return process.env.EXPO_PUBLIC_SOCKET_URL;
  return apiBaseUrl.replace(/\/api\/v1\/?$/, '');
}

export function createMessagingSocket(token: string | null): Socket<ServerToClientEvents> | null {
  if (!hasProtectedApiSession(token)) return null;
  return io(socketServerUrl(), {
    autoConnect: true,
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: usesBrowserSession,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    extraHeaders: getProtectedApiHeaders(token),
  });
}
