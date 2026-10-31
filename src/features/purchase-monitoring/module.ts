import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const purchaseMonitoringModule: AppModule = {
  key: 'purchase-monitoring',
  label: 'Theo dõi thu mua',
  navigationGroup: 'warehouse',
  features: [
    { key: 'purchase-monitoring', title: 'Theo dõi thu mua', subtitle: 'Phiếu cân tại các kho được giao', icon: 'monitoring', group: 'warehouse', permission: permissions.purchaseWarehousesOperateAssigned },
  ],
};
