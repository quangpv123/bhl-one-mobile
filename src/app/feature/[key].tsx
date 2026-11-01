import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/screen';
import { EmptyState } from '@/components/ui';
import { canOpenFeature, mobileFeatures } from '@/navigation/moduleRegistry';
import { permissions } from '@/features/auth/permissions';
import { useAuth } from '@/features/auth/auth-context';
import { AdministrativeUnitsScreen, CatalogCrudScreen, type CatalogCrudDescriptor, VehiclesScreen } from '@/features/catalog';
import {
  MaterialInventoryScreen,
  MaterialIssuesScreen,
  MaterialQrScreen,
  MaterialReceiptsScreen,
  MaterialsScreen,
  MaterialWarehousesScreen,
  MeasurementUnitsScreen,
} from '@/features/material-warehouse';
import { PurchaseOverviewScreen } from '@/features/purchase-monitoring';
import { PurchaseWarehouseListScreen } from '@/features/purchase-warehouse';
import { ExecutivePurchaseWarehouseDashboardScreen } from '@/features/overview';
import { RolesScreen } from '@/features/roles';
import { LicensePlateAiScreen } from '@/features/tools';
import { TransportRatesScreen } from '@/features/transport-catalog';
import { TransportSettlementsScreen } from '@/features/transport-settlement';
import { UsersScreen } from '@/features/users';

const catalogDescriptors: Record<string, CatalogCrudDescriptor> = {
  'catalog-products': {
    key: 'products',
    title: 'Danh mục hàng hóa',
    subtitle: 'Hàng hóa sử dụng trong hoạt động thu mua và cân hàng',
    singular: 'hàng hóa',
    endpoint: '/catalog/products',
    codeField: 'productCode',
    codeLabel: 'Mã hàng hóa',
    nameField: 'productName',
    nameLabel: 'Tên hàng hóa',
    viewPermission: permissions.catalogProductsView,
    createPermission: permissions.catalogProductsCreate,
    updatePermission: permissions.catalogProductsUpdate,
    deletePermission: permissions.catalogProductsDelete,
  },
  'catalog-cassava-varieties': {
    key: 'cassava-varieties',
    title: 'Danh mục giống sắn',
    subtitle: 'Giống sắn sử dụng trên phiếu cân',
    singular: 'giống sắn',
    endpoint: '/catalog/cassava-varieties',
    codeField: 'cassavaVarietyCode',
    codeLabel: 'Mã giống sắn',
    nameField: 'cassavaVarietyName',
    nameLabel: 'Tên giống sắn',
    viewPermission: permissions.catalogCassavaVarietiesView,
    createPermission: permissions.catalogCassavaVarietiesCreate,
    updatePermission: permissions.catalogCassavaVarietiesUpdate,
    deletePermission: permissions.catalogCassavaVarietiesDelete,
  },
  'catalog-banks': {
    key: 'banks',
    title: 'Danh mục ngân hàng',
    subtitle: 'Ngân hàng sử dụng trong thông tin thanh toán',
    singular: 'ngân hàng',
    endpoint: '/catalog/banks',
    codeField: 'bankCode',
    codeLabel: 'Mã ngân hàng',
    nameField: 'bankName',
    nameLabel: 'Tên ngân hàng',
    viewPermission: permissions.catalogBanksView,
    createPermission: permissions.catalogBanksCreate,
    updatePermission: permissions.catalogBanksUpdate,
    deletePermission: permissions.catalogBanksDelete,
  },
  'vehicle-types': {
    key: 'vehicle-types',
    title: 'Danh mục loại xe',
    subtitle: 'Loại phương tiện sử dụng trong vận tải',
    singular: 'loại xe',
    endpoint: '/catalog/vehicle-types',
    codeField: 'vehicleTypeCode',
    codeLabel: 'Mã loại xe',
    nameField: 'vehicleTypeName',
    nameLabel: 'Tên loại xe',
    viewPermission: permissions.catalogVehicleTypesView,
    createPermission: permissions.catalogVehicleTypesCreate,
    updatePermission: permissions.catalogVehicleTypesUpdate,
    deletePermission: permissions.catalogVehicleTypesDelete,
  },
};

export default function FeatureRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { user } = useAuth();
  const feature = mobileFeatures.find(item => item.key === key);

  if (!feature || !canOpenFeature(feature, user?.permissions ?? [])) {
    return (
      <Screen title="Không có quyền truy cập">
        <EmptyState text="Tài khoản không có quyền sử dụng chức năng này." />
      </Screen>
    );
  }

  const catalogDescriptor = catalogDescriptors[key];
  if (catalogDescriptor) return <CatalogCrudScreen descriptor={catalogDescriptor} />;

  switch (key) {
    case 'executive-purchase-warehouses': return <ExecutivePurchaseWarehouseDashboardScreen />;
    case 'users': return <UsersScreen />;
    case 'roles': return <RolesScreen />;
    case 'catalog-materials': return <MaterialsScreen />;
    case 'measurement-units': return <MeasurementUnitsScreen />;
    case 'administrative-units': return <AdministrativeUnitsScreen />;
    case 'vehicles': return <VehiclesScreen />;
    case 'purchase-overview': return <PurchaseOverviewScreen />;
    case 'purchase-monitoring': return <PurchaseOverviewScreen assignedOnly />;
    case 'purchase-warehouses': return <PurchaseWarehouseListScreen />;
    case 'material-inventory': return <MaterialInventoryScreen />;
    case 'material-receipts': return <MaterialReceiptsScreen />;
    case 'material-issues': return <MaterialIssuesScreen />;
    case 'material-qr': return <MaterialQrScreen />;
    case 'material-warehouses': return <MaterialWarehousesScreen />;
    case 'transport-rates': return <TransportRatesScreen />;
    case 'transport-settlements': return <TransportSettlementsScreen />;
    case 'license-plate-ai': return <LicensePlateAiScreen />;
    default:
      return (
        <Screen title={feature.title} subtitle={feature.subtitle}>
          <EmptyState text="Chức năng đang được đồng bộ với hệ thống ERP." />
        </Screen>
      );
  }
}

