// Bản giả react-native: chỉ những gì code đồng bộ chạm tới
export const Platform = { OS: 'web', select: (o) => o.web ?? o.default };
export const Appearance = { setColorScheme() {} };
export const AppState = { addEventListener: () => ({ remove() {} }) };
