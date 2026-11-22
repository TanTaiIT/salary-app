// Cho phép chạy code của app (src/) bằng `node --test`, không cần Metro hay máy ảo:
// - alias "@/..." → src/..., import không ghi đuôi → thử .web.ts, .ts (ưu tiên bản web như khi bundle web:
//   lưu trữ dùng storage.web.ts, token-storage.web.ts nên không cần SQLite hay SecureStore)
// - module native → bản giả trong test/stubs
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src');

const STUBS = {
  'expo-crypto': 'test/stubs/expo-crypto.mjs',
  'react-native': 'test/stubs/react-native.mjs',
};

function findFile(base) {
  for (const candidate of [base, `${base}.web.ts`, `${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      if (candidate === base && !/\.[cm]?[jt]sx?$/.test(base)) continue;
      return candidate;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    if (STUBS[specifier]) return { url: pathToFileURL(resolve(root, STUBS[specifier])).href, shortCircuit: true };
    let base = null;
    if (specifier.startsWith('@/')) base = resolve(src, specifier.slice(2));
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      base = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (base) {
      const file = findFile(base);
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
