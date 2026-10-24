import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo, type Article } from '@/lib/news';

export function ArticleCard({
  article,
  liked,
  onMore,
  onLess,
}: {
  article: Article;
  liked: boolean;
  onMore: () => void;
  onLess: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(article.link)}
        accessibilityRole="link"
        accessibilityHint="Opens the story"
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={[styles.topic, { color: theme.accent }]}>
          {article.topic}
        </ThemedText>
        <ThemedText style={styles.title} numberOfLines={4}>
          {article.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {article.source} · {timeAgo(article.publishedAt)}
        </ThemedText>
      </Pressable>
      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {liked ? `Got it, more ${article.topic}` : 'Want more like this?'}
        </ThemedText>
        <IconButton
          icon="thumbUp"
          label={`More ${article.topic}`}
          size={18}
          tone={liked ? 'accent' : 'default'}
          onPress={onMore}
          disabled={liked}
        />
        <IconButton icon="thumbDown" label={`Less ${article.topic}`} size={18} onPress={onLess} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  main: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  topic: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  title: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: 600,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flex: {
    flex: 1,
  },
});
