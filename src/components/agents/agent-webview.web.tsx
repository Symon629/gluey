import { StyleSheet, View } from 'react-native';

// react-native-webview has no web support, so the web build embeds an iframe.
export function AgentWebView({ url }: { url: string }) {
  return (
    <View style={styles.container}>
      <iframe src={url} title="Agents" style={{ border: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
