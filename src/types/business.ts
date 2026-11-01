import type { Pagination } from './api';

export type ActiveStatus = 'ACTIVE' | 'INACTIVE';

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

export interface CatalogRecord {
  id: string;
  status: ActiveStatus;
  [key: string]: unknown;
}

export interface RoleRecord {
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCodes: string[];
}

export interface RoleOption {
  code: string;
  name: string;
}

export interface PermissionRecord {
  code: string;
  name: string;
  module: string;
  description: string | null;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  role: string;
  isPrivileged?: boolean;
  status: ActiveStatus;
  lastLoginAt: string | null;
}

export interface PurchaseWarehouse {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  managerUserId: string | null;
  managerName: string;
  phone: string;
  address: string;
  materialArea: string;
  status: ActiveStatus;
}

export interface PurchaseWarehouseOverview extends PurchaseWarehouse {
  inventory: number;
  totalImport: number;
  totalExport: number;
  totalLoss: number;
  currentDayImport: number;
  currentDayExport: number;
  totalPurchaseAmount: number;
  totalPaidAmount: number;
  outstandingAmount: number;
  advanceBalance: number;
  hasMissingTicketPrices: boolean;
}

export interface PurchaseWarehouseOverviewResponse {
  success: boolean;
  reportDate: string;
  previousDate: string;
  data: PurchaseWarehouseOverview[];
}

export interface PurchaseWarehouseTicket {
  id: string;
  purchaseWarehouseId?: string;
  warehouseCode?: string;
  warehouseAddress?: string;
  ticketType: 'IMPORT' | 'EXPORT';
  closesLot: boolean;
  lossWeight: number;
  lossPercent?: number | null;
  printTitle: string;
  ticketNumber: string;
  grossWeighedDate: string;
  grossWeighedTime: string;
  tareWeighedDate: string;
  tareWeighedTime: string;
  licensePlate: string;
  driverPhone?: string | null;
  driverCitizenId?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankName?: string | null;
  productName: string;
  cassavaVarietyName?: string | null;
  sellerName: string;
  buyerName: string;
  driverName?: string | null;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  inventoryAfter: number;
  price: number | null;
  impurityPercent: number;
  starchPercent: number;
  status: 'ACTIVE' | 'VOID';
  lockedByLotClosure?: boolean;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedByName?: string | null;
  createdAt: string;
}

export interface PurchaseWarehouseTicketMutationPayload {
  ticketType: 'IMPORT' | 'EXPORT';
  closesLot: boolean;
  printTitle: string;
  grossWeighedDate: string;
  grossWeighedTime: string;
  tareWeighedDate: string;
  tareWeighedTime: string;
  licensePlate: string;
  driverName: string;
  driverPhone: string;
  driverCitizenId: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  bankName?: string;
  productName: string;
  cassavaVarietyName?: string;
  sellerName: string;
  buyerName: string;
  grossWeight: number;
  tareWeight: number;
  price: number;
  impurityPercent: number;
  starchPercent: number;
  reason: string;
}

export interface PurchaseWarehouseTicketRevision {
  id: string;
  ticketId: string;
  action: 'CREATE' | 'UPDATE';
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown>;
  reason: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
}

export interface PurchaseWarehouseTicketSummary {
  totalImportGrossWeight: number;
  totalExportGrossWeight: number;
  totalImportTareWeight: number;
  totalExportTareWeight: number;
  totalImportNetWeight: number;
  totalExportNetWeight: number;
  totalAmount: number;
  totalLossWeight: number;
  currentInventory: number;
}

export interface PurchaseWarehouseTicketsResponse extends PaginatedResponse<PurchaseWarehouseTicket> {
  summary: PurchaseWarehouseTicketSummary;
}

export interface MaterialStock {
  materialId: string;
  materialCode: string;
  materialName: string;
  unitSymbol: string;
  unitDecimalScale: number;
  trackingMode: 'QR' | 'QUANTITY';
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  availableQrUnits: number | null;
}

export interface MaterialReceiptSummary {
  id: string;
  receiptNumber: string;
  receivedAt: string;
  supplierName: string;
  status: 'DRAFT' | 'COMPLETED';
  createdAt: string;
  warehouseCode: string;
  warehouseName: string;
  lineCount: number;
  totalQuantity: number;
}

export interface MaterialIssueSummary {
  id: string;
  issueNumber: string;
  issuedAt: string;
  jobCode: string;
  jobAddress: string;
  assigneeName: string;
  status: 'DRAFT' | 'ISSUED' | 'COMPLETED';
  createdAt: string;
  warehouseCode: string;
  warehouseName: string;
  lineCount: number;
  totalQuantity: number;
}

export interface MaterialInventoryUnit {
  id: string;
  qrPublicId: string;
  manufacturerSerial: string | null;
  status: string;
  materialId?: string;
  materialCode: string;
  materialName: string;
  warehouseCode?: string;
  warehouseName?: string;
  currentHolderId?: string | null;
  currentHolderName?: string | null;
  currentIssueId?: string | null;
  currentIssueNumber?: string | null;
  assignedJobCode?: string | null;
  assignedJobAddress?: string | null;
  issuedAt?: string | null;
  installedAt?: string | null;
  pendingReturnId?: string | null;
  events?: {
    eventType: string;
    occurredAt: string;
    employeeName: string;
    notes: string | null;
    evidence?: {
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      uploadedByName: string;
      createdAt: string;
    }[];
  }[];
}

export interface TransportCompensationRate {
  id: string;
  provinceCode: string;
  communeCode: string;
  transportPointCode: string;
  transportPoint: string;
  province: string;
  commune: string;
  detail: string;
  content: string;
  tripSalary: number;
  mealAllowance: number;
  canopyWaterAllowance: number;
  loaderAllowance: number;
  freightRatePerKg: number;
  note: string;
  status: ActiveStatus;
}

export interface TransportSettlement {
  period: { from: string; to: string };
  summary: {
    tripCount: number;
    vehicleCount: number;
    driverCount: number;
    cargoWeightKg: number;
    revenue: number;
    driverCompensation: number;
    tripExpenses: number;
    materialCost: number;
    fuelCost: number | null;
    knownCost: number;
    balanceBeforeFuel: number;
  };
  vehicles: {
    vehicleId: string;
    licensePlate: string;
    vehicleTypeName: string;
    tripCount: number;
    cargoWeightKg: number;
    revenue: number;
    driverCompensation: number;
    tripExpenses: number;
    materialCost: number;
    knownCost: number;
    balanceBeforeFuel: number;
  }[];
  drivers: {
    driverUserId: string;
    driverFullName: string;
    driverPhone: string | null;
    tripCount: number;
    vehicleCount: number;
    cargoWeightKg: number;
    revenue: number;
    tripSalary: number;
    mealAllowance: number;
    canopyWaterAllowance: number;
    loaderAllowance: number;
    totalPay: number;
    tripExpenses: number;
  }[];
  trips: {
    tripId: string;
    tripCode: string;
    vehicleId: string;
    driverUserId: string;
    startedAt: string;
    endedAt: string;
    routeSnapshot: string;
    licensePlate: string;
    driverFullName: string;
    cargoWeightKg: number;
    tripSalary: number;
    mealAllowance: number;
    canopyWaterAllowance: number;
    loaderAllowance: number;
    revenue: number;
    driverCompensation: number;
    tripExpenses: number;
    knownCost: number;
    balanceBeforeFuel: number;
  }[];
  materials: {
    id: string;
    repairId: string;
    repairCode: string;
    completedAt: string;
    repairContent: string;
    vehicleId: string;
    licensePlate: string;
    vehicleTypeName: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unitName: string;
    unitSymbol: string;
    unitDecimalScale: number;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  expenses: {
    id: string;
    expenseType: string;
    amount: number;
    occurredAt: string;
    tripId: string;
    tripCode: string;
    vehicleId: string;
    licensePlate: string;
    driverUserId: string;
    driverFullName: string;
  }[];
}

export interface LicensePlateHealth {
  status: string;
  detectorClasses?: number;
  ocrClasses?: number;
}

