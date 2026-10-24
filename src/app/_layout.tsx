import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { KeyboardProvider } from '@/components/keyboard';
import { Colors } from '@/constants/theme';
import { configureNotifications, syncNotifications, useNotificationResponses } from '@/lib/notifications';
import { hydrate, useStore } from '@/lib/store';

void SplashScreen.preventAutoHideAsync();
configureNotifications();

function NotificationBridge() {
  useNotificationResponses();
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    // Load saved data, then make sure scheduled notifications match it.
    void hydrate().then(() => syncNotifications());
  }, []);

  // Keep the splash screen up until saved data has loaded.
  if (!hydrated) return null;

  const dark = colorScheme === 'dark';
  const palette = Colors[dark ? 'dark' : 'light'];
  const base = dark ? DarkTheme : DefaultTheme;
  const theme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
    },
  };

  return (
    <KeyboardProvider>
      <ThemeProvider value={theme}>
        <AppTabs />
        <NotificationBridge />
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </KeyboardProvider>
  );
}
