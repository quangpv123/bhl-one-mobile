import { SymbolView, type SymbolViewProps } from "expo-symbols";
import {
  Text,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";

export type AppIconName =
  | "home"
  | "apps"
  | "messages"
  | "transport"
  | "profile"
  | "menu"
  | "back"
  | "warehouse"
  | "monitoring"
  | "inventory"
  | "receipt-in"
  | "receipt-out"
  | "qr"
  | "rates"
  | "settlement"
  | "users"
  | "roles"
  | "products"
  | "materials"
  | "measurement"
  | "agriculture"
  | "bank"
  | "location"
  | "vehicle-type"
  | "vehicles"
  | "scan"
  | "settings"
  | "logout"
  | "download"
  | "image"
  | "like"
  | "send"
  | "search"
  | "more";

const symbolNames: Record<AppIconName, SymbolViewProps["name"]> = {
  home: { ios: "house.fill", android: "home", web: "home" },
  apps: { ios: "square.grid.2x2.fill", android: "grid_view", web: "grid_view" },
  messages: { ios: "message.fill", android: "chat", web: "chat" },
  transport: {
    ios: "truck.box.fill",
    android: "local_shipping",
    web: "local_shipping",
  },
  profile: { ios: "person.crop.circle.fill", android: "person", web: "person" },
  menu: { ios: "line.3.horizontal", android: "menu", web: "menu" },
  back: { ios: "chevron.left", android: "arrow_back", web: "arrow_back" },
  warehouse: { ios: "building.2.fill", android: "warehouse", web: "warehouse" },
  monitoring: {
    ios: "chart.xyaxis.line",
    android: "monitoring",
    web: "monitoring",
  },
  inventory: {
    ios: "shippingbox.fill",
    android: "inventory_2",
    web: "inventory_2",
  },
  "receipt-in": {
    ios: "tray.and.arrow.down.fill",
    android: "move_to_inbox",
    web: "move_to_inbox",
  },
  "receipt-out": {
    ios: "tray.and.arrow.up.fill",
    android: "outbox",
    web: "outbox",
  },
  qr: {
    ios: "qrcode.viewfinder",
    android: "qr_code_scanner",
    web: "qr_code_scanner",
  },
  rates: {
    ios: "road.lanes",
    android: "directions_car",
    web: "directions_car",
  },
  settlement: { ios: "banknote.fill", android: "payments", web: "payments" },
  users: { ios: "person.2.fill", android: "groups", web: "groups" },
  roles: {
    ios: "checkmark.shield.fill",
    android: "shield_person",
    web: "shield_person",
  },
  products: {
    ios: "square.grid.3x3.fill",
    android: "category",
    web: "category",
  },
  materials: {
    ios: "shippingbox.fill",
    android: "inventory_2",
    web: "inventory_2",
  },
  measurement: { ios: "ruler.fill", android: "straighten", web: "straighten" },
  agriculture: { ios: "leaf.fill", android: "agriculture", web: "agriculture" },
  bank: {
    ios: "building.columns.fill",
    android: "account_balance",
    web: "account_balance",
  },
  location: { ios: "map.fill", android: "map", web: "map" },
  "vehicle-type": {
    ios: "car.fill",
    android: "directions_car",
    web: "directions_car",
  },
  vehicles: {
    ios: "truck.box.fill",
    android: "airport_shuttle",
    web: "airport_shuttle",
  },
  scan: {
    ios: "viewfinder",
    android: "document_scanner",
    web: "document_scanner",
  },
  settings: { ios: "gearshape.fill", android: "settings", web: "settings" },
  logout: {
    ios: "rectangle.portrait.and.arrow.right",
    android: "logout",
    web: "logout",
  },
  download: {
    ios: "arrow.down.doc.fill",
    android: "file_download",
    web: "download",
  },
  image: { ios: "photo.on.rectangle.angled", android: "image", web: "image" },
  like: { ios: "hand.thumbsup.fill", android: "thumb_up", web: "thumb_up" },
  send: { ios: "paperplane.fill", android: "send", web: "send" },
  search: { ios: "magnifyingglass", android: "search", web: "search" },
  more: { ios: "ellipsis", android: "more_horiz", web: "more_horiz" },
};

const fallbackGlyphs: Record<AppIconName, string> = {
  home: "⌂",
  apps: "▦",
  messages: "✉",
  transport: "◆",
  profile: "●",
  menu: "☰",
  back: "‹",
  warehouse: "▣",
  monitoring: "◉",
  inventory: "▦",
  "receipt-in": "↓",
  "receipt-out": "↑",
  qr: "⌗",
  rates: "₫",
  settlement: "∑",
  users: "♟",
  roles: "◇",
  products: "□",
  materials: "▧",
  measurement: "≡",
  agriculture: "✣",
  bank: "▥",
  location: "⌖",
  "vehicle-type": "▱",
  vehicles: "▰",
  scan: "◎",
  settings: "⚙",
  logout: "↪",
  download: "↓",
  image: "▧",
  like: "👍",
  send: "➤",
  search: "⌕",
  more: "•••",
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
  if (name === "messages") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Path
          fill={color}
          d="M12 2C6.48 2 2 6.15 2 11.27c0 2.9 1.44 5.49 3.7 7.19V22l3.39-1.86c.92.25 1.9.39 2.91.39 5.52 0 10-4.15 10-9.26S17.52 2 12 2Z"
        />
        <Path
          fill="#fff"
          d="M6.6 13.8l4.5-4.8 2.4 2.2 4-2.2-4.5 4.8-2.4-2.2-4 2.2Z"
        />
      </Svg>
    );
  }

  return (
    <SymbolView
      name={symbolNames[name]}
      size={size}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
      fallback={
        <Text
          style={{
            color,
            fontSize: size,
            lineHeight: size,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {fallbackGlyphs[name]}
        </Text>
      }
    />
  );
}
