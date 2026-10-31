import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const transportCatalogModule: AppModule = {
  key: 'transport-catalog',
  label: 'Danh mục vận tải',
  navigationGroup: 'transport',
  features: [
    { key: 'transport-rates', title: 'Bảng khoán tổng hợp', subtitle: 'Lộ trình và đơn giá vận chuyển', icon: 'rates', group: 'transport', permission: permissions.transportCompensationRatesView },
  ],
};
