import type { AppIconName } from '@/components/app-icon';

// Route-independent module metadata; keep outside src/app for Expo Router.

export type FeatureGroupKey = 'overview' | 'warehouse' | 'transport' | 'catalog' | 'system' | 'tools';

export interface AppFeature {
  key: string;
  title: string;
  subtitle: string;
  icon: AppIconName;
  group: FeatureGroupKey;
  permission?: string;
  excludedPermission?: string;
  href?: string;
}

export interface AppModule {
  key: string;
  label: string;
  navigationGroup: FeatureGroupKey;
  features: AppFeature[];
}
