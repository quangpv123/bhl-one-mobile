import { permissions } from '@/features/auth/permissions';
import type { AppModule } from '@/navigation/moduleTypes';

export const overviewModule: AppModule = {
  key: 'overview',
  label: 'Tổng quan',
  navigationGroup: 'overview',
  features: [
    {
      key: 'executive-purchase-warehouses',
      title: 'Tổng quan',
      subtitle: 'Số liệu điều hành kho thu mua',
      icon: 'monitoring',
      group: 'overview',
      permission: permissions.executiveDashboardView,
    },
  ],
};
