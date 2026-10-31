import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const transportSettlementModule: AppModule = {
  key: 'transport-settlement',
  label: 'Quyết toán chi phí',
  navigationGroup: 'transport',
  features: [
    { key: 'transport-settlements', title: 'Quyết toán vận tải', subtitle: 'Doanh thu, chi phí và thu nhập tài xế', icon: 'settlement', group: 'transport', permission: permissions.transportSettlementsView },
  ],
};
