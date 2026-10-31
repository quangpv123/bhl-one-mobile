import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const catalogModule: AppModule = {
  key: 'catalog',
  label: 'Danh mục',
  navigationGroup: 'system',
  features: [
    { key: 'catalog-products', title: 'Hàng hóa', subtitle: 'Danh mục hàng hóa cân', icon: 'products', group: 'system', permission: permissions.catalogProductsView },
    { key: 'catalog-materials', title: 'Vật tư', subtitle: 'Mã, đơn vị tính và giá vật tư', icon: 'materials', group: 'system', permission: permissions.materialsView },
    { key: 'measurement-units', title: 'Đơn vị tính', subtitle: 'Đơn vị và độ chính xác số lượng', icon: 'measurement', group: 'system', permission: permissions.measurementUnitsView },
    { key: 'catalog-cassava-varieties', title: 'Giống sắn', subtitle: 'Danh mục giống dùng trên phiếu cân', icon: 'agriculture', group: 'system', permission: permissions.catalogCassavaVarietiesView },
    { key: 'catalog-banks', title: 'Ngân hàng', subtitle: 'Danh mục ngân hàng thanh toán', icon: 'bank', group: 'system', permission: permissions.catalogBanksView },
    { key: 'administrative-units', title: 'Tỉnh / Xã', subtitle: 'Đơn vị hành chính dùng chung', icon: 'location', group: 'system', permission: permissions.catalogAdministrativeUnitsView },
    { key: 'vehicle-types', title: 'Loại xe', subtitle: 'Danh mục loại phương tiện', icon: 'vehicle-type', group: 'system', permission: permissions.catalogVehicleTypesView },
    { key: 'vehicles', title: 'Phương tiện', subtitle: 'Thông tin xe và người phụ trách', icon: 'vehicles', group: 'system', permission: permissions.catalogVehiclesView },
  ],
};
