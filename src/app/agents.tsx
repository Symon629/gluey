import { StyleSheet, View } from 'react-native';

import { AgentWebView } from '@/components/agents/agent-webview';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Set EXPO_PUBLIC_AGENTS_URL (for example in .env.local) to load the agents web app here. */
const AGENTS_URL = process.env.EXPO_PUBLIC_AGENTS_URL?.trim() ?? '';

export default function AgentsScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <ScreenHeader title="Agents" />
      {AGENTS_URL ? (
        <AgentWebView url={AGENTS_URL} />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="sparkles" size={40} color={theme.accent} />
          <ThemedText type="subtitle" style={styles.title}>
            Agents are coming soon
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.text}>
            This tab will show your agents web app. Set EXPO_PUBLIC_AGENTS_URL to its address and restart the dev
            server to load it here.
          </ThemedText>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  text: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
});
