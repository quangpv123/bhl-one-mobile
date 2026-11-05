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
  memberCount?: number;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface MessageRecipient {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  role: string;
}

export type MessageSearchScope = 'ALL' | 'PEOPLE' | 'MESSAGES' | 'GROUPS';

export interface MessageSearchPerson extends MessageRecipient {
  conversationId: string | null;
}

export interface MessageSearchMessage {
  id: string;
  conversationId: string;
  conversationName: string;
  senderFullName: string;
  content: string;
  createdAt: string;
}

export interface MessageSearchGroup {
  conversationId: string;
  name: string;
  memberCount: number;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
}

export interface MessageSearchResults {
  people: MessageSearchPerson[];
  messages: MessageSearchMessage[];
  groups: MessageSearchGroup[];
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  senderFullName: string;
  messageType: 'USER' | 'SYSTEM_NOTIFICATION';
  content: string | null;
  attachments?: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }[];
  createdAt: string;
}

export interface DirectMessagesResponse {
  success: boolean;
  data: DirectMessage[];
  hasMore: boolean;
}

export interface SystemBotSummary {
  botCode: string;
  botName: string;
  description: string;
  channelCode: string;
}

export interface SystemBotSettings extends SystemBotSummary {
  users: MessageRecipient[];
  recipientUserIds: string[];
  events: {
    eventCode: string;
    eventName: string;
    description: string;
  }[];
}

export type TransportTripStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TransportTrip {
  id: string;
  tripCode: string;
  vehicleId: string;
  licensePlate: string;
  vehicleTypeName: string;
  driverUserId: string;
  driverUsername?: string;
  driverFullName: string;
  driverPhone?: string | null;
  compensationRateId?: string;
  routeSnapshot: string;
  content: string;
  cargoWeightKg: number | null;
  plannedStartAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  note?: string;
  status: TransportTripStatus;
  cancellationReason?: string | null;
  unresolvedIncidentCount?: number;
  createdAt?: string;
}

export interface TransportTripsResponse {
  success: boolean;
  data: TransportTrip[];
  pagination: Pagination;
}

export type VehicleOperatingStatus = 'IDLE' | 'ASSIGNED' | 'IN_PROGRESS' | 'MAINTENANCE';

export interface TransportVehicleStatus {
  vehicleId: string;
  licensePlate: string;
  vehicleTypeName: string;
  managerUserId: string | null;
  managerFullName: string | null;
  managerPhone: string | null;
  operatingStatus: VehicleOperatingStatus;
  tripId: string | null;
  tripCode: string | null;
  driverUserId: string | null;
  driverFullName: string | null;
  driverPhone: string | null;
  routeSnapshot: string | null;
  content: string | null;
  cargoWeightKg: number | null;
  plannedStartAt: string | null;
  startedAt: string | null;
  unresolvedIncidentCount: number;
  repairId: string | null;
  repairCode: string | null;
  repairContent: string | null;
  repairStartedAt: string | null;
  repairStartedByName: string | null;
}

export interface VehicleRepairMaterialOption {
  id: string;
  materialCode: string;
  materialName: string;
  unitName: string;
  unitSymbol: string;
  unitDecimalScale: number;
  price: number;
}

export interface VehicleRepairMaterial {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitName: string;
  unitSymbol: string;
  unitDecimalScale: number;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface VehicleRepair {
  id: string;
  repairCode: string;
  vehicleId: string;
  licensePlate: string;
  vehicleTypeName: string;
  managerUserId: string | null;
  content: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startedBy: string;
  startedByName: string;
  startedAt: string;
  completedBy: string | null;
  completedByName: string | null;
  completedAt: string | null;
  materials: VehicleRepairMaterial[];
  totalMaterialCost: number;
}

export interface TransportTripOptions {
  vehicles: {
    id: string;
    licensePlate: string;
    vehicleTypeName: string;
    managerUserId: string | null;
    managerFullName: string | null;
    operatingStatus: VehicleOperatingStatus;
  }[];
  drivers: {
    id: string;
    username: string;
    fullName: string;
    phone: string | null;
    operatingStatus: VehicleOperatingStatus;
  }[];
  rates: {
    id: string;
    transportPointCode: string;
    transportPoint: string;
    content: string;
  }[];
}

export interface TransportTripEvent {
  id: string;
  eventType: string;
  actorName: string;
  note: string;
  expenseType: string | null;
  amount: number | null;
  resolvedAt: string | null;
  resolvedByName?: string | null;
  occurredAt: string;
  images?: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }[];
}
