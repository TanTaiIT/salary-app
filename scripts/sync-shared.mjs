// Chép src/payroll và src/schemas từ repo server sang app (xem docs/spec.md của server,
// mục "Code dùng chung giữa server và app"). Bản gốc nằm ở server; không sửa bản chép ở đây.
//
// Dùng: pnpm sync-shared [đường-dẫn-repo-server]   (mặc định ../salary)
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const server = resolve(root, process.argv[2] ?? process.env.SERVER_REPO ?? '../salary');

for (const dir of ['payroll', 'schemas']) {
  const from = join(server, 'src', dir);
  const to = join(root, 'src', dir);
  if (!existsSync(from)) {
    console.error(`Không thấy ${from}. Truyền đường dẫn repo server: pnpm sync-shared <path>`);
    process.exit(1);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`${from} -> ${to}`);
}
