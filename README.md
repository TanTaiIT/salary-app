# Lịch Lương Hàn Quốc: app React Native

App Expo (React Native) cho người lao động tại Hàn Quốc chấm công và xem trước lương tháng.
Server nằm ở repo riêng (`../salary`); đặc tả đầy đủ ở `docs/spec.md` của repo đó.

| Thành phần | Phiên bản |
|---|---|
| Expo SDK | 58 |
| React Native | 0.88 |
| React | 19.3 |
| Điều hướng | expo-router (tab gốc) |
| Lưu trên máy | expo-sqlite; token trong expo-secure-store |
| Kiểm tra dữ liệu | zod 4.6 (cùng bản với server) |
| Quản lý gói | pnpm 12.21, Node.js 26 |

## Cấu trúc

```
src/
  app/            màn hình (mỗi file là một route): index (Trang chủ), stats, history, settings
  components/     component dùng chung: screen (header + nút Thêm ngày công), month-calendar,
                  day-sheet (bảng chấm công), app-tabs.tsx là thanh tab
  config/env.ts   biến môi trường EXPO_PUBLIC_*
  constants/      màu (sáng/tối, màu từng loại giờ), khoảng cách
  data/           dữ liệu trên máy: app-store (state + thao tác), storage (SQLite; bản web dùng localStorage),
                  rules (quy định năm từ GET /v1/rules/:year), month (tổng tháng, gợi ý 주휴수당)
  hooks/          chế độ màu, useMonth
  lib/            hàm tiện ích (định dạng tiền, hỏi xác nhận...)
  payroll/        BẢN CHÉP từ server, không sửa ở đây
  schemas/        BẢN CHÉP từ server, không sửa ở đây
scripts/
  sync-shared.mjs chép lại payroll/ và schemas/ từ repo server
```

## Chạy lần đầu

```bash
corepack enable                 # hoặc: npm i -g pnpm
pnpm install
cp .env.example .env            # sửa EXPO_PUBLIC_API_URL nếu cần
pnpm start                      # rồi bấm a (Android), i (iOS) hoặc w (web)
```

Server chạy theo README của repo `../salary` (`pnpm dev`, cổng 3000).
Trên Android Emulator, `localhost` là máy ảo; dùng `http://10.0.2.2:3000`. Trên điện thoại thật, dùng IP LAN của máy tính.

`expo-sqlite` và `expo-secure-store` có sẵn trong Expo Go. Khi thêm thư viện có code native ngoài Expo Go
(ví dụ AdMob, đăng nhập Apple/Google), cần development build: `npx expo run:android` hoặc `eas build --profile development`.

Kiểm tra: `pnpm typecheck` và `pnpm lint`.

## Code dùng chung với server

`src/payroll/` và `src/schemas/` là bản chép nguyên từ `src/` của repo server, để app tính lương và kiểm tra dữ liệu
giống hệt server. Muốn sửa thì sửa ở server (kèm test), rồi chép sang:

```bash
pnpm sync-shared                # mặc định đọc ../salary; hoặc: pnpm sync-shared <đường-dẫn-repo-server>
```

## Quy ước

- Thêm thư viện bằng `npx expo install <gói>` để lấy đúng phiên bản hợp với SDK.
- Không tạo hay sửa tay `ios/`, `android/` (Expo sinh ra từ `app.json` và config plugin).
- Ngày công là chuỗi `"YYYY-MM-DD"` theo giờ Hàn Quốc, không dùng `Date`; tiền là số nguyên won, hiển thị `3.245.000 ₩`.
- Token lưu bằng SecureStore, không dùng AsyncStorage.
- Chuỗi giao diện tiếng Việt; sẽ tách ra file dịch khi thêm tiếng Hàn.
