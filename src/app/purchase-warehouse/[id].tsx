import { useLocalSearchParams } from 'expo-router';

import { PurchaseWarehouseDetailScreen } from '@/features/purchase-warehouse';

export default function PurchaseWarehouseRoute() {
  const { id, code, name } = useLocalSearchParams<{ id: string; code?: string; name?: string }>();
  return <PurchaseWarehouseDetailScreen warehouseId={id} warehouseCode={code} warehouseName={name} />;
}

