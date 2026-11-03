import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const purchaseWarehouseModule: AppModule = {
  key: 'purchase-warehouse',
  label: 'Kho thu mua',
  navigationGroup: 'warehouse',
  features: [
    { key: 'purchase-warehouses', title: 'Quản lý kho thu mua', subtitle: 'Thêm, sửa và quản lý trạng thái các kho', icon: 'warehouse', group: 'warehouse', permission: permissions.purchaseWarehousesView, excludedPermission: permissions.purchaseWarehousesOperateAssigned },
  ],
};
