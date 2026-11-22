import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { queryClient } from '@/api/queries';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { DaySheet } from '@/components/day-sheet';
import { Toast } from '@/components/toast';
import { AppProvider } from '@/data/app-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BackgroundTasks } from '@/sync/background';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppProvider>
          <BackgroundTasks />
          <AnimatedSplashOverlay />
          <AppTabs />
          <DaySheet />
          <Toast />
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
