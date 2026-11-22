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
| Store | Zustand 5 (dữ liệu trên máy, giao diện, phiên đăng nhập, trạng thái đồng bộ) |
| Gọi API | openapi-fetch (kiểu sinh từ OpenAPI của server bằng openapi-typescript), TanStack Query 5 |
| Kiểm tra dữ liệu | zod 4.6 (cùng bản với server) |
| Quản lý gói | pnpm 12.21, Node.js 26 |

## Cấu trúc

```
src/
  app/            màn hình (mỗi file là một route): index (Trang chủ), stats, history, settings
  api/            schema.d.ts (SINH TỰ ĐỘNG, không sửa), client (token, tự refresh), session, queries (TanStack Query)
  components/     component dùng chung: screen (header + nút Thêm ngày công), month-calendar,
                  day-sheet (bảng chấm công), settings/ (tài khoản, nơi làm), app-tabs.tsx là thanh tab
  config/env.ts   biến môi trường EXPO_PUBLIC_*
  constants/      màu (sáng/tối, màu từng loại giờ), khoảng cách
  data/           dữ liệu trên máy: store (Zustand), actions (thao tác người dùng), app-store (useApp cho màn hình),
                  ui-store, storage (SQLite; bản web dùng localStorage), rules, month (tổng tháng, gợi ý 주휴수당)
  hooks/          chế độ màu, useMonth
  lib/            hàm tiện ích (định dạng tiền, hỏi xác nhận...)
  sync/           đồng bộ với server: merge (hàm thuần), engine (POST /v1/sync), account (đăng nhập, đăng xuất),
                  background (đồng bộ khi mở app, quay lại app, sau khi sửa)
  payroll/        BẢN CHÉP từ server, không sửa ở đây
  schemas/        BẢN CHÉP từ server, không sửa ở đây
scripts/
  sync-shared.mjs chép lại payroll/ và schemas/ từ repo server
  gen-api.mjs     sinh src/api/schema.d.ts từ openapi.json của server
test/             test chạy bằng node --test (loader.mjs cho alias @/ và module native giả)
```

## Dữ liệu và đồng bộ

- Dữ liệu chấm công nằm trên máy (SQLite) và dùng được hoàn toàn khi không có mạng, không cần đăng nhập.
- Đăng nhập (Cài đặt → Tài khoản) thì app đồng bộ qua `POST /v1/sync`: khi mở app, khi quay lại app, 2 giây sau
  mỗi lần sửa, và khi bấm "Đồng bộ ngay". Xung đột giải quyết theo bản sửa mới nhất thắng.
- Lần đầu đăng nhập, mọi dữ liệu trên máy được đẩy lên và gộp với dữ liệu đã có; nếu nơi làm đang chọn còn trống,
  app chuyển sang nơi làm có dữ liệu kéo về. Bản bị server từ chối (trùng ngày, trùng tuần) hiện trong Cài đặt.
- Quy định năm, cấu hình app, thông tin tài khoản đọc qua TanStack Query; quy định năm được lưu đệm trên máy.
- Bản dev có đăng nhập bằng tên (`/v1/auth/dev-login`). Đăng nhập Apple, Google cần development build và
  client id; phía app đã có `signInWithIdToken` trong `src/sync/account.ts`, còn thiếu nút và SDK.

## Chạy lần đầu

```bash
corepack enable                 # hoặc: npm i -g pnpm
pnpm install
cp .env.example .env            # sửa EXPO_PUBLIC_API_URL nếu cần
pnpm start                      # rồi bấm a (Android), i (iOS) hoặc w (web)
```

Server chạy theo README của repo `../salary` (`pnpm dev`, cổng 3000).
Trên Android Emulator, `localhost` là máy ảo; dùng `http://10.0.2.2:3000`. Nếu app không gọi được server (một số image
Android 17 bị timeout với `10.0.2.2`), chuyển cổng bằng adb rồi dùng `127.0.0.1`:

```bash
adb reverse tcp:3000 tcp:3000   # EXPO_PUBLIC_API_URL=http://127.0.0.1:3000
```

Trên điện thoại thật, dùng IP LAN của máy tính.

`expo-sqlite` và `expo-secure-store` có sẵn trong Expo Go. Khi thêm thư viện có code native ngoài Expo Go
(ví dụ AdMob, đăng nhập Apple/Google), cần development build: `npx expo run:android` hoặc `eas build --profile development`.

Kiểm tra: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

`pnpm test:e2e` chạy code đồng bộ thật của app với server dev đang chạy (giả lập hai máy cùng tài khoản),
đặt `EXPO_PUBLIC_API_URL` nếu server không ở `http://localhost:3000`. Server cần MongoDB replica set
(`docker compose up -d` ở repo server) vì xóa tài khoản dùng transaction.

## Code dùng chung với server

`src/payroll/` và `src/schemas/` là bản chép nguyên từ `src/` của repo server, để app tính lương và kiểm tra dữ liệu
giống hệt server. Muốn sửa thì sửa ở server (kèm test), rồi chép sang:

```bash
pnpm sync-shared                # mặc định đọc ../salary; hoặc: pnpm sync-shared <đường-dẫn-repo-server>
```

Kiểu của API (`src/api/schema.d.ts`) sinh từ tài liệu OpenAPI của server. Sau khi server đổi API
(`pnpm openapi` ở repo server cập nhật `openapi.json`):

```bash
pnpm gen:api                    # mặc định đọc ../salary/openapi.json
pnpm gen:api http://localhost:3000/openapi.json
```

Swagger UI của server dev: `http://localhost:3000/docs`. Bản web của app cần server đặt `CORS_ORIGINS=http://localhost:8081`.

## Quy ước

- Thêm thư viện bằng `npx expo install <gói>` để lấy đúng phiên bản hợp với SDK.
- Không tạo hay sửa tay `ios/`, `android/` (Expo sinh ra từ `app.json` và config plugin).
- Ngày công là chuỗi `"YYYY-MM-DD"` theo giờ Hàn Quốc, không dùng `Date`; tiền là số nguyên won, hiển thị `3.245.000 ₩`.
- Token lưu bằng SecureStore, không dùng AsyncStorage.
- Chuỗi giao diện tiếng Việt; sẽ tách ra file dịch khi thêm tiếng Hàn.
