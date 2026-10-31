import { catalogModule } from '@/features/catalog/module';
import { materialWarehouseModule } from '@/features/material-warehouse/module';
import { purchaseMonitoringModule } from '@/features/purchase-monitoring/module';
import { purchaseWarehouseModule } from '@/features/purchase-warehouse/module';
import { toolsModule } from '@/features/tools/module';
import { transportCatalogModule } from '@/features/transport-catalog/module';
import { transportDispatchModule } from '@/features/transport-dispatch/module';
import { transportSettlementModule } from '@/features/transport-settlement/module';
import { userModule } from '@/features/users/module';
import type { AppFeature, AppModule, FeatureGroupKey } from './moduleTypes';

export type { AppFeature, AppModule, FeatureGroupKey } from './moduleTypes';

// Mirrors erp-frontend's module registry without becoming an Expo route.

export const featureGroups: { key: FeatureGroupKey; title: string; subtitle: string }[] = [
  { key: 'warehouse', title: 'Kho & thu mua', subtitle: 'Theo dõi hàng hóa, vật tư và các giao dịch kho' },
  { key: 'transport', title: 'Vận tải', subtitle: 'Điều phối, danh mục và quyết toán vận chuyển' },
  { key: 'system', title: 'Quản trị hệ thống', subtitle: 'Người dùng, vai trò và danh mục dùng chung' },
  { key: 'tools', title: 'Công cụ', subtitle: 'Tiện ích hỗ trợ công việc' },
];

export const appModules: readonly AppModule[] = [
  purchaseMonitoringModule,
  purchaseWarehouseModule,
  materialWarehouseModule,
  transportDispatchModule,
  transportSettlementModule,
  transportCatalogModule,
  toolsModule,
  userModule,
  catalogModule,
];

export const mobileFeatures = appModules.flatMap(module => module.features);

export function canOpenFeature(feature: AppFeature, permissionCodes: string[]) {
  if (feature.permission && !permissionCodes.includes(feature.permission)) return false;
  if (feature.excludedPermission && permissionCodes.includes(feature.excludedPermission)) return false;
  return true;
}

export function featureHref(feature: AppFeature) {
  return feature.href || `/feature/${feature.key}`;
}
