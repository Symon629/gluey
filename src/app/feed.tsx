import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ArticleCard } from '@/components/feed/article-card';
import { InterestPicker } from '@/components/feed/interest-picker';
import { QuestionCard } from '@/components/feed/question-card';
import { ThemedText } from '@/components/themed-text';
import { Button, IconButton } from '@/components/ui/buttons';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { adjustTopicWeight, setTopics, updateFeed } from '@/lib/actions';
import { fetchFeed, suggestTopics, type Article } from '@/lib/news';
import { getState, useStore } from '@/lib/store';

const STALE_AFTER_MS = 30 * 60_000;
const QUESTION_EVERY = 6;

type FeedItem =
  | { type: 'article'; article: Article }
  | { type: 'suggest'; topic: string }
  | { type: 'check'; topic: string };

export default function FeedScreen() {
  const theme = useTheme();
  const feed = useStore((s) => s.feed);
  const [editing, setEditing] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState<{ key: string; at: number } | null>(null);
  const requestId = useRef(0);

  const topicKey = feed.topics
    .filter((t) => t.weight > 0)
    .map((t) => t.name)
    .sort()
    .join('|');

  const load = useCallback(async (refresh: boolean) => {
    const id = ++requestId.current;
    const { topics, hiddenArticles } = getState().feed;
    const key = topics
      .filter((t) => t.weight > 0)
      .map((t) => t.name)
      .sort()
      .join('|');
    if (refresh) setRefreshing(true);
    else setStatus('loading');
    const result = await fetchFeed(topics, hiddenArticles);
    if (id !== requestId.current) return;
    setArticles(result.articles);
    setStatus(result.articles.length === 0 && result.failed.length ? 'error' : 'ready');
    setRefreshing(false);
    setLoaded({ key, at: Date.now() });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!feed.onboarded || editing) return;
      if (!loaded || loaded.key !== topicKey || Date.now() - loaded.at > STALE_AFTER_MS) void load(false);
    }, [feed.onboarded, editing, topicKey, loaded, load])
  );

  const items = useMemo<FeedItem[]>(() => {
    const questions: FeedItem[] = [
      ...feed.topics
        .filter((t) => t.weight === 1)
        .map((t) => ({ type: 'check' as const, topic: t.name })),
      ...suggestTopics(feed.topics, feed.dismissedSuggestions)
        .slice(0, 4)
        .map((topic) => ({ type: 'suggest' as const, topic })),
    ];
    const result: FeedItem[] = [];
    articles.forEach((article, index) => {
      result.push({ type: 'article', article });
      if ((index + 1) % QUESTION_EVERY === 0 && questions.length) result.push(questions.shift()!);
    });
    if (articles.length && articles.length < QUESTION_EVERY && questions.length) result.push(questions[0]);
    return result;
  }, [articles, feed.topics, feed.dismissedSuggestions]);

  if (!feed.onboarded || editing) {
    return (
      <Screen>
        <InterestPicker
          initial={feed.topics}
          onCancel={feed.onboarded ? () => setEditing(false) : undefined}
          onDone={(topics) => {
            setTopics(topics);
            setEditing(false);
          }}
        />
      </Screen>
    );
  }

  const onLess = (article: Article) => {
    adjustTopicWeight(article.topic, -1);
    updateFeed({ hiddenArticles: [...getState().feed.hiddenArticles, article.id].slice(-500) });
    setArticles((list) => list.filter((a) => a.id !== article.id));
  };

  const renderItem = ({ item }: { item: FeedItem }) => {
    switch (item.type) {
      case 'article':
        return (
          <ArticleCard
            article={item.article}
            liked={!!liked[item.article.id]}
            onMore={() => {
              adjustTopicWeight(item.article.topic, 1);
              setLiked((l) => ({ ...l, [item.article.id]: true }));
            }}
            onLess={() => onLess(item.article)}
          />
        );
      case 'suggest':
        return (
          <QuestionCard
            question={`Do you want stories about ${item.topic}?`}
            yesLabel="Yes, add it"
            noLabel="No thanks"
            onYes={() => setTopics([...getState().feed.topics, { name: item.topic, weight: 3 }])}
            onNo={() =>
              updateFeed({ dismissedSuggestions: [...getState().feed.dismissedSuggestions, item.topic] })
            }
          />
        );
      case 'check':
        return (
          <QuestionCard
            question={`You've been skipping ${item.topic}. Keep it in your feed?`}
            yesLabel="Keep it"
            noLabel="Remove"
            onYes={() => adjustTopicWeight(item.topic, 1)}
            onNo={() => setTopics(getState().feed.topics.filter((t) => t.name !== item.topic))}
          />
        );
    }
  };

  const activeCount = feed.topics.filter((t) => t.weight > 0).length;

  return (
    <Screen>
      <ScreenHeader
        title="Feed"
        subtitle={`${activeCount} topic${activeCount === 1 ? '' : 's'}`}
        right={
          <>
            <IconButton icon="refresh" label="Refresh" onPress={() => void load(true)} disabled={refreshing} />
            <IconButton icon="tune" label="Edit interests" onPress={() => setEditing(true)} />
          </>
        }
      />
      {status === 'loading' && !articles.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText themeColor="textSecondary">Finding stories for you…</ThemedText>
        </View>
      ) : status === 'error' ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Couldn&apos;t load the news. Check your connection and try again.
          </ThemedText>
          <Button label="Try again" variant="secondary" icon="refresh" onPress={() => void load(false)} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => (item.type === 'article' ? item.article.id : `${item.type}-${item.topic}`)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.accent} />
          }
          ListEmptyComponent={
            status === 'ready' ? (
              <View style={styles.center}>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  No recent stories for your topics. Try adding a few more.
                </ThemedText>
                <Button label="Edit interests" variant="secondary" icon="tune" onPress={() => setEditing(true)} />
              </View>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
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
