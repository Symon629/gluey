import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { SignInScreen } from '@/components/auth/sign-in';
import { KeyboardProvider } from '@/components/keyboard';
import { Colors } from '@/constants/theme';
import { startAuth } from '@/lib/auth';
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
  const authReady = useStore((s) => s.authReady);
  const signedIn = useStore((s) => s.user !== null);

  useEffect(() => {
    // Load saved data, then make sure scheduled notifications match it.
    // After that, restore the signed-in session (which loads notes and chats).
    void hydrate().then(() => {
      void syncNotifications();
      startAuth();
    });
  }, []);

  // Keep the splash screen up until saved data and the session have loaded.
  if (!hydrated || !authReady) return null;

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
        {signedIn ? <AppTabs /> : <SignInScreen />}
        <NotificationBridge />
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </KeyboardProvider>
  );
}
