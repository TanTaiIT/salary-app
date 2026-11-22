// Sinh kiểu TypeScript của API từ tài liệu OpenAPI của server (repo ../salary, file openapi.json).
// Chạy lại sau mỗi lần server đổi API: pnpm gen:api [đường-dẫn-hoặc-URL]
//   pnpm gen:api                                   đọc ../salary/openapi.json
//   pnpm gen:api http://localhost:3000/openapi.json đọc từ server đang chạy
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const input = process.argv[2] ?? process.env.OPENAPI_SOURCE ?? resolve(root, '../salary/openapi.json');
const output = resolve(root, 'src/api/schema.d.ts');

if (!/^https?:\/\//.test(input) && !existsSync(input)) {
  console.error(`Không thấy ${input}. Chạy "pnpm openapi" ở repo server, hoặc truyền đường dẫn/URL: pnpm gen:api <nguồn>`);
  process.exit(1);
}

const cli = resolve(root, 'node_modules/openapi-typescript/bin/cli.js');
execFileSync(process.execPath, [cli, input, '-o', output], { stdio: 'inherit' });
console.log(`${input} -> ${output}`);
