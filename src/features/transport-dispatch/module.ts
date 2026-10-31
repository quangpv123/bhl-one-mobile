import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const transportDispatchModule: AppModule = {
  key: 'transport-dispatch',
  label: 'Điều phối xe',
  navigationGroup: 'transport',
  features: [
    { key: 'transport-dispatch', title: 'Điều phối xe', subtitle: 'Trạng thái xe và chuyến vận chuyển', icon: 'transport', group: 'transport', permission: permissions.transportTripsView, href: '/(app)/transport' },
  ],
};
