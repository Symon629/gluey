import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function NotesLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.accent,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Notes' }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
