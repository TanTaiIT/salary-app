/**
 * Biến môi trường của app. Expo chỉ nhúng các biến có tiền tố EXPO_PUBLIC_ vào bundle,
 * nên không bao giờ đặt bí mật ở đây.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
