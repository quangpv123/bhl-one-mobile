import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

export type AppIconName =
  | 'home'
  | 'apps'
  | 'messages'
  | 'transport'
  | 'profile'
  | 'menu'
  | 'back'
  | 'warehouse'
  | 'monitoring'
  | 'inventory'
  | 'receipt-in'
  | 'receipt-out'
  | 'qr'
  | 'rates'
  | 'settlement'
  | 'users'
  | 'roles'
  | 'products'
  | 'materials'
  | 'measurement'
  | 'agriculture'
  | 'bank'
  | 'location'
  | 'vehicle-type'
  | 'vehicles'
  | 'scan'
  | 'settings'
  | 'logout'
  | 'download'
  | 'search';

const symbolNames: Record<AppIconName, SymbolViewProps['name']> = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  apps: { ios: 'square.grid.2x2.fill', android: 'grid_view', web: 'grid_view' },
  messages: { ios: 'message.fill', android: 'chat', web: 'chat' },
  transport: { ios: 'truck.box.fill', android: 'local_shipping', web: 'local_shipping' },
  profile: { ios: 'person.crop.circle.fill', android: 'person', web: 'person' },
  menu: { ios: 'line.3.horizontal', android: 'menu', web: 'menu' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  warehouse: { ios: 'building.2.fill', android: 'warehouse', web: 'warehouse' },
  monitoring: { ios: 'chart.xyaxis.line', android: 'monitoring', web: 'monitoring' },
  inventory: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' },
  'receipt-in': { ios: 'tray.and.arrow.down.fill', android: 'move_to_inbox', web: 'move_to_inbox' },
  'receipt-out': { ios: 'tray.and.arrow.up.fill', android: 'outbox', web: 'outbox' },
  qr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
  rates: { ios: 'road.lanes', android: 'directions_car', web: 'directions_car' },
  settlement: { ios: 'banknote.fill', android: 'payments', web: 'payments' },
  users: { ios: 'person.2.fill', android: 'groups', web: 'groups' },
  roles: { ios: 'checkmark.shield.fill', android: 'shield_person', web: 'shield_person' },
  products: { ios: 'square.grid.3x3.fill', android: 'category', web: 'category' },
  materials: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' },
  measurement: { ios: 'ruler.fill', android: 'straighten', web: 'straighten' },
  agriculture: { ios: 'leaf.fill', android: 'agriculture', web: 'agriculture' },
  bank: { ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' },
  location: { ios: 'map.fill', android: 'map', web: 'map' },
  'vehicle-type': { ios: 'car.fill', android: 'directions_car', web: 'directions_car' },
  vehicles: { ios: 'truck.box.fill', android: 'airport_shuttle', web: 'airport_shuttle' },
  scan: { ios: 'viewfinder', android: 'document_scanner', web: 'document_scanner' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  download: { ios: 'arrow.down.doc.fill', android: 'file_download', web: 'download' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
};

const fallbackGlyphs: Record<AppIconName, string> = {
  home: '⌂',
  apps: '▦',
  messages: '✉',
  transport: '◆',
  profile: '●',
  menu: '☰',
  back: '‹',
  warehouse: '▣',
  monitoring: '◉',
  inventory: '▦',
  'receipt-in': '↓',
  'receipt-out': '↑',
  qr: '⌗',
  rates: '₫',
  settlement: '∑',
  users: '♟',
  roles: '◇',
  products: '□',
  materials: '▧',
  measurement: '≡',
  agriculture: '✣',
  bank: '▥',
  location: '⌖',
  'vehicle-type': '▱',
  vehicles: '▰',
  scan: '◎',
  settings: '⚙',
  logout: '↪',
  download: '↓',
  search: '⌕',
};

export function AppIcon({
  name,
  size = 20,
  color,
  style,
}: {
  name: AppIconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={symbolNames[name]}
      size={size}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
      fallback={<Text style={[styles.fallback, { color, fontSize: size, lineHeight: size }]}>{fallbackGlyphs[name]}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { fontWeight: '700', textAlign: 'center' },
});
