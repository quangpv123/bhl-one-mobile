import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const purchaseWarehouseModule: AppModule = {
  key: 'purchase-warehouse',
  label: 'Kho thu mua',
  navigationGroup: 'warehouse',
  features: [
    { key: 'purchase-overview', title: 'Tổng quan kho thu mua', subtitle: 'Nhập, xuất, tồn kho và công nợ', icon: 'monitoring', group: 'warehouse', permission: permissions.purchaseWarehousesView, excludedPermission: permissions.purchaseWarehousesOperateAssigned },
    { key: 'purchase-warehouses', title: 'Danh sách kho thu mua', subtitle: 'Thông tin và trạng thái các kho', icon: 'warehouse', group: 'warehouse', permission: permissions.purchaseWarehousesView, excludedPermission: permissions.purchaseWarehousesOperateAssigned },
  ],
};
