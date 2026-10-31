import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const materialWarehouseModule: AppModule = {
  key: 'material-warehouse',
  label: 'Kho vật tư',
  navigationGroup: 'warehouse',
  features: [
    { key: 'material-inventory', title: 'Tồn kho vật tư', subtitle: 'Số lượng vật tư theo từng kho', icon: 'inventory', group: 'warehouse', permission: permissions.materialInventoryView },
    { key: 'material-receipts', title: 'Phiếu nhập vật tư', subtitle: 'Danh sách nhập kho và phát hành QR', icon: 'receipt-in', group: 'warehouse', permission: permissions.materialReceiptsView },
    { key: 'material-issues', title: 'Xuất & hoàn trả', subtitle: 'Bàn giao và tiếp nhận vật tư', icon: 'receipt-out', group: 'warehouse', permission: permissions.materialIssuesView },
    { key: 'material-qr', title: 'Tra cứu vật tư QR', subtitle: 'Theo dõi trạng thái và lịch sử lắp đặt', icon: 'qr', group: 'warehouse', permission: permissions.materialInventoryView },
    { key: 'material-warehouses', title: 'Kho vật tư', subtitle: 'Danh sách kho vật tư', icon: 'warehouse', group: 'warehouse', permission: permissions.materialWarehousesView },
  ],
};
