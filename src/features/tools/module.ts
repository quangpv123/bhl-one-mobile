import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const toolsModule: AppModule = {
  key: 'tools',
  label: 'Công cụ',
  navigationGroup: 'tools',
  features: [
    { key: 'license-plate-ai', title: 'AI nhận dạng biển số', subtitle: 'Kiểm tra dịch vụ và nhận diện ảnh xe', icon: 'scan', group: 'tools', permission: permissions.toolsLicensePlateAiUse },
  ],
};
