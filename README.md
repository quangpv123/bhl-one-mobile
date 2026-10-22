# BHL One Mobile

Ứng dụng mobile nội bộ của BHL, xây dựng bằng Expo SDK 57, React Native và TypeScript.

## Chức năng nền tảng

- Đăng nhập bằng tài khoản ERP và lưu JWT bằng SecureStore.
- Điều hướng được bảo vệ theo phiên đăng nhập.
- Tổng quan tin chưa đọc và chuyến xe đang chạy.
- Danh sách hội thoại, chat văn bản và nhận tin realtime bằng Socket.IO.
- Danh sách chuyến xe theo đúng quyền của tài khoản.
- Nền tảng điều hướng từ push notification vào màn hình tương ứng.

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
