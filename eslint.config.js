// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Bản chép từ server: zod dùng `const X` và `type X` cùng tên, TypeScript đã kiểm tra trùng tên.
    files: ['src/payroll/**', 'src/schemas/**'],
    rules: { '@typescript-eslint/no-redeclare': 'off' },
  },
]);
