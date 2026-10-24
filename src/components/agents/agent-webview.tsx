import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AgentWebView({ url }: { url: string }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Couldn&apos;t load {url}.
        </ThemedText>
        <Button
          label="Try again"
          variant="secondary"
          icon="refresh"
          onPress={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }

  return (
    <WebView
      key={attempt}
      source={{ uri: url }}
      style={[styles.webview, { backgroundColor: theme.background }]}
      startInLoadingState
      renderLoading={() => (
        <View style={[styles.loading, { backgroundColor: theme.background }]}>
          <ActivityIndicator color={theme.accent} />
        </View>
      )}
      onError={() => setFailed(true)}
      allowsBackForwardNavigationGestures
      pullToRefreshEnabled
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
});
