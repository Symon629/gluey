import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { ChatMessage, FeedPrefs, Note, Pending, Reminder } from '@/lib/types';

export type AppState = {
  hydrated: boolean;
  reminders: Reminder[];
  notes: Note[];
  messages: ChatMessage[];
  pending: Pending | null;
  feed: FeedPrefs;
  /** True while the assistant is working on a reply. Not persisted. */
  assistantBusy: boolean;
  /** Whether the last reply came from Claude or the on-device parser. Not persisted. */
  assistantMode: 'ai' | 'local' | null;
};

const PERSISTED_KEYS = ['reminders', 'notes', 'messages', 'pending', 'feed'] as const;
type PersistedKey = (typeof PERSISTED_KEYS)[number];

const STORAGE_PREFIX = 'gluey:v1:';

const initialState: AppState = {
  hydrated: false,
  reminders: [],
  notes: [],
  messages: [],
  pending: null,
  feed: { onboarded: false, topics: [], dismissedSuggestions: [], hiddenArticles: [] },
  assistantBusy: false,
  assistantMode: null,
};

let state: AppState = initialState;
const listeners = new Set<() => void>();
const dirty = new Set<PersistedKey>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getState(): AppState {
  return state;
}

export function setState(update: Partial<AppState> | ((current: AppState) => Partial<AppState>)) {
  const patch = typeof update === 'function' ? update(state) : update;
  state = { ...state, ...patch };
  for (const key of PERSISTED_KEYS) {
    if (key in patch) dirty.add(key);
  }
  scheduleSave();
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe to a slice of state. The selector must return a stable reference. */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state)
  );
}

function scheduleSave() {
  if (!state.hydrated || dirty.size === 0) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

async function flush() {
  saveTimer = null;
  const keys = [...dirty];
  dirty.clear();
  try {
    await AsyncStorage.multiSet(
      keys.map((key) => [STORAGE_PREFIX + key, JSON.stringify(state[key])] as [string, string])
    );
  } catch (error) {
    console.warn('Failed to save app data', error);
  }
}

export async function hydrate() {
  if (state.hydrated) return;
  const patch: Partial<AppState> = {};
  try {
    const entries = await AsyncStorage.multiGet(PERSISTED_KEYS.map((key) => STORAGE_PREFIX + key));
    for (const [storageKey, raw] of entries) {
      if (raw == null) continue;
      const key = storageKey.slice(STORAGE_PREFIX.length) as PersistedKey;
      try {
        (patch as Record<string, unknown>)[key] = JSON.parse(raw);
      } catch {
        // Ignore a corrupt entry and fall back to the default for that key.
      }
    }
  } catch (error) {
    console.warn('Failed to load app data', error);
  }
  state = { ...state, ...patch, feed: { ...initialState.feed, ...patch.feed }, hydrated: true };
  listeners.forEach((listener) => listener());
}
