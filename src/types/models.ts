import type { Pagination } from './api';

export interface User {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  role: string;
  permissions: string[];
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: string | null;
}

export interface MessageConversation {
  id: string;
  conversationType: 'DIRECT' | 'GROUP' | 'SYSTEM';
  groupName: string | null;
  systemCode: string | null;
  otherFullName: string;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  senderFullName: string;
  messageType: 'USER' | 'SYSTEM_NOTIFICATION';
  content: string | null;
  createdAt: string;
}

export interface DirectMessagesResponse {
  success: boolean;
  data: DirectMessage[];
  hasMore: boolean;
}

export type TransportTripStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TransportTrip {
  id: string;
  tripCode: string;
  licensePlate: string;
  vehicleTypeName: string;
  driverFullName: string;
  routeSnapshot: string;
  content: string;
  startedAt: string | null;
  endedAt: string | null;
  status: TransportTripStatus;
}

export interface TransportTripsResponse {
  success: boolean;
  data: TransportTrip[];
  pagination: Pagination;
}
