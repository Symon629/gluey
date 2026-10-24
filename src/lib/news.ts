import { Platform } from 'react-native';

import type { Topic } from '@/lib/types';

export type Article = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  topic: string;
};

export const STARTER_TOPICS = [
  'Technology',
  'AI',
  'Startups',
  'Business',
  'Finance',
  'Crypto',
  'Science',
  'Space',
  'Health',
  'Climate',
  'World',
  'Politics',
  'Sports',
  'Football',
  'Cricket',
  'Basketball',
  'Movies',
  'Music',
  'Gaming',
  'Travel',
  'Food',
  'Design',
];

/** Related topics the feed can ask about, keyed by a followed topic. */
const RELATED: Record<string, string[]> = {
  technology: ['Gadgets', 'Smartphones', 'Cybersecurity'],
  ai: ['Robotics', 'Machine learning', 'AI policy'],
  startups: ['Venture capital', 'Product launches'],
  business: ['Markets', 'Economy'],
  finance: ['Personal finance', 'Stock market'],
  crypto: ['Bitcoin', 'Web3'],
  science: ['Physics', 'Biology'],
  space: ['NASA', 'SpaceX', 'Astronomy'],
  health: ['Fitness', 'Nutrition', 'Mental health'],
  climate: ['Renewable energy', 'Electric vehicles'],
  world: ['Asia', 'Europe', 'Middle East'],
  politics: ['Elections', 'Policy'],
  sports: ['Football', 'Cricket', 'Tennis', 'Formula 1'],
  football: ['Premier League', 'Champions League', 'La Liga'],
  cricket: ['IPL', 'Test cricket'],
  basketball: ['NBA'],
  movies: ['Streaming', 'Box office'],
  music: ['Album releases', 'Concerts'],
  gaming: ['Nintendo', 'PlayStation', 'Esports'],
  travel: ['Airlines', 'Travel deals'],
  food: ['Recipes', 'Restaurants'],
  design: ['UX design', 'Architecture'],
};

const DEFAULT_SUGGESTIONS = ['Technology', 'World', 'Science', 'Sports', 'Health'];

/** Topics to ask the user about next, most relevant first. */
export function suggestTopics(topics: Topic[], dismissed: string[]): string[] {
  const followed = new Set(topics.map((t) => t.name.toLowerCase()));
  const skip = new Set(dismissed.map((d) => d.toLowerCase()));
  const ranked = [...topics].sort((a, b) => b.weight - a.weight);
  const candidates = [
    ...ranked.flatMap((t) => RELATED[t.name.toLowerCase()] ?? []),
    ...DEFAULT_SUGGESTIONS,
    ...STARTER_TOPICS,
  ];
  const seen = new Set<string>();
  return candidates.filter((name) => {
    const key = name.toLowerCase();
    if (followed.has(key) || skip.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .trim();
}

function tag(item: string, name: string): string {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(item);
  return match ? decode(match[1]) : '';
}

/** Parse a Google News RSS document. */
export function parseRss(xml: string, topic: string): Article[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((item) => {
      const source = tag(item, 'source');
      let title = tag(item, 'title');
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      const link = tag(item, 'link');
      const published = Date.parse(tag(item, 'pubDate'));
      return {
        id: tag(item, 'guid') || link,
        title,
        link,
        source: source || 'News',
        publishedAt: Number.isFinite(published) ? published : Date.now(),
        topic,
      };
    })
    .filter((article) => article.title && article.link);
}

function feedUrl(topic: string): string {
  const query = encodeURIComponent(`${topic} when:3d`);
  return `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

export async function fetchTopic(topic: string): Promise<Article[]> {
  // Browsers block cross-origin RSS requests, so web goes through our API route.
  const url = Platform.OS === 'web' ? `/api/news?q=${encodeURIComponent(topic)}` : feedUrl(topic);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`News request failed (${response.status})`);
  return parseRss(await response.text(), topic);
}

/** Fetch every followed topic and blend the results, favouring topics with more weight. */
export async function fetchFeed(topics: Topic[], hidden: string[]): Promise<{ articles: Article[]; failed: string[] }> {
  const active = topics.filter((t) => t.weight > 0);
  const hiddenSet = new Set(hidden);
  const failed: string[] = [];
  const perTopic = await Promise.all(
    active.map(async (topic) => {
      try {
        const articles = await fetchTopic(topic.name);
        const count = 3 + topic.weight * 2;
        return { topic, articles: articles.filter((a) => !hiddenSet.has(a.id)).slice(0, count) };
      } catch {
        failed.push(topic.name);
        return { topic, articles: [] as Article[] };
      }
    })
  );

  // Interleave topics so one busy topic doesn't push out the rest.
  const queues = perTopic
    .map(({ topic, articles }) => ({ weight: topic.weight, items: articles.sort((a, b) => b.publishedAt - a.publishedAt) }))
    .sort((a, b) => b.weight - a.weight);
  const seenTitles = new Set<string>();
  const blended: Article[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const queue of queues) {
      const take = Math.max(1, Math.round(queue.weight / 2));
      for (let i = 0; i < take && queue.items.length; i++) {
        const article = queue.items.shift()!;
        const key = titleKey(article.title);
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);
        blended.push(article);
        added = true;
      }
    }
  }
  return { articles: blended, failed };
}

/**
 * Key for spotting the same story from different outlets. Wire copies often add
 * a section prefix ("Baseball-Former MLB stars…"), so drop that and compare the opening words.
 */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/^[a-z]+-(?=[a-z])/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
