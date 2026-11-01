# BHL One Mobile

Ứng dụng mobile nội bộ của BHL, xây dựng bằng Expo SDK 57, React Native và TypeScript.

## Chức năng nền tảng

- Đăng nhập bằng tài khoản ERP và lưu JWT bằng SecureStore.
- Điều hướng được bảo vệ theo phiên đăng nhập.
- Tổng quan điều hành kho thu mua theo quyền lãnh đạo, gồm nhập hôm nay, lũy kế, thanh toán và xuất báo cáo.
- Danh sách hội thoại, chat văn bản và nhận tin realtime bằng Socket.IO.
- Tìm kiếm hợp nhất người dùng, tin nhắn và nhóm mà không gọi lại API khi đổi bộ lọc.
- Danh sách chuyến xe theo đúng quyền của tài khoản.
- Quản lý phiếu cân đầy đủ: thêm thủ công, sửa toàn bộ thông tin, lịch sử chỉnh sửa, hủy theo quyền và import Excel.
- Import danh mục xe từ mẫu Excel; người quản lý xe dùng chung danh sách người dùng ERP.
- Nền tảng điều hướng từ push notification vào màn hình tương ứng.

## Cấu trúc dự án

Cấu trúc source bám theo `erp-frontend` để một nghiệp vụ có thể được đối chiếu giữa web và mobile theo cùng tên miền:

```text
src/
├── app/                    # Chỉ chứa route Expo Router và layout
├── components/             # App shell, form và UI dùng chung
├── features/
│   ├── auth/
│   ├── catalog/
│   ├── dashboard/
│   ├── material-warehouse/
│   ├── messaging/
│   ├── navigation/
│   ├── overview/
│   ├── purchase-monitoring/
│   ├── purchase-warehouse/
│   ├── roles/
│   ├── tools/
│   ├── transport-catalog/
│   ├── transport-dispatch/
│   ├── transport-settlement/
│   └── users/
├── navigation/             # Module registry, quyền hiển thị và metadata menu
├── services/               # API, session, socket và notification
├── theme/                  # Token giao diện đồng bộ với erp-frontend
├── types/
└── utils/
```

Các miền tham gia menu có `module.ts` mô tả quyền và metadata điều hướng; `screens/`, `components/` giữ phần triển khai. Các file trong `src/app` chỉ kết nối URL tới screen tương ứng để không tạo route ngoài ý muốn.

## Cấu hình môi trường

Sao chép `.env.example` thành `.env.local` và sửa địa chỉ khi cần:

```env
EXPO_PUBLIC_API_URL=https://bhl.io.vn/api/v1
EXPO_PUBLIC_SOCKET_URL=https://bhl.io.vn
```

Khi chạy backend trong máy tính và app trên điện thoại thật, không dùng `localhost`; hãy dùng IP LAN của máy tính.

## Chạy dự án

Yêu cầu Node.js 22.13 trở lên.

```bash
npm install
npm run check
npm start
```

Push notification trên Android cần development build, không chạy qua Expo Go:

```bash
npx eas-cli@latest build --profile development --platform android
```

## Build

```bash
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform android
```

Thông tin ứng dụng:

- Tên: `BHL One`
- Android application ID: `vn.io.bhl.one`
- iOS bundle identifier: `vn.io.bhl.one`
- Deep-link scheme: `bhl-one`
