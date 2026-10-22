import { io, type Socket } from 'socket.io-client';

import type { DirectMessage } from '@/types/models';
import { apiBaseUrl } from './api';

interface ServerToClientEvents {
  'messaging:conversation-updated': (event: { conversationId: string }) => void;
  'messaging:message-new': (message: DirectMessage) => void;
  'messaging:conversation-read': (event: { conversationId: string; readerUserId: string }) => void;
}

function socketServerUrl() {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) return process.env.EXPO_PUBLIC_SOCKET_URL;
  return apiBaseUrl.replace(/\/api\/v1\/?$/, '');
}

export function createMessagingSocket(token: string): Socket<ServerToClientEvents> {
  return io(socketServerUrl(), {
    autoConnect: true,
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    extraHeaders: { Authorization: `Bearer ${token}` },
  });
}
