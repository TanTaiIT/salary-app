import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { DaySheet } from '@/components/day-sheet';
import { Toast } from '@/components/toast';
import { AppProvider } from '@/data/app-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
        <DaySheet />
        <Toast />
      </AppProvider>
    </ThemeProvider>
  );
}
