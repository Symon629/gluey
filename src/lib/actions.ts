import { newId } from '@/lib/ids';
import { descendantIds } from '@/lib/notes';
import { syncNotifications } from '@/lib/notifications';
import { getState, setState } from '@/lib/store';
import type { ChatMessage, FeedPrefs, Note, Pending, Reminder, Topic } from '@/lib/types';

const now = () => new Date().toISOString();

// Reminders

export function addReminder(input: Omit<Reminder, 'id' | 'createdAt' | 'done'>): Reminder {
  const reminder: Reminder = { ...input, id: newId('r_'), createdAt: now(), done: false };
  setState((s) => ({ reminders: [...s.reminders, reminder] }));
  void syncNotifications();
  return reminder;
}

export function updateReminder(id: string, patch: Partial<Reminder>) {
  setState((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  void syncNotifications();
}

export function deleteReminder(id: string) {
  setState((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
  void syncNotifications();
}

// Notes

export function createNote(input: { title: string; content?: string; parentId?: string | null }): Note {
  const timestamp = now();
  const note: Note = {
    id: newId('n_'),
    title: input.title.trim() || 'Untitled',
    content: input.content ?? '',
    parentId: input.parentId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  setState((s) => ({ notes: [note, ...s.notes] }));
  return note;
}

export function updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'parentId'>>) {
  setState((s) => ({
    notes: s.notes.map((note) => (note.id === id ? { ...note, ...patch, updatedAt: now() } : note)),
  }));
}

/** Add content to the end of a note, as a new line. */
export function appendToNote(id: string, content: string) {
  const note = getState().notes.find((n) => n.id === id);
  if (!note) return;
  const separator = note.content.trim().length ? '\n' : '';
  updateNote(id, { content: `${note.content.replace(/\s+$/, '')}${separator}${content.trim()}` });
}

/** Delete a note and everything nested inside it. */
export function deleteNote(id: string) {
  setState((s) => {
    const remove = new Set([id, ...descendantIds(s.notes, id)]);
    return { notes: s.notes.filter((note) => !remove.has(note.id)) };
  });
}

// Chat

export function addChatMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
  const full: ChatMessage = { ...message, id: newId('m_'), createdAt: now() };
  setState((s) => ({ messages: [...s.messages, full].slice(-300) }));
  return full;
}

export function setPending(pending: Pending | null) {
  setState({ pending });
}

export function clearChat() {
  setState({ messages: [], pending: null });
}

// Feed

export function updateFeed(patch: Partial<FeedPrefs>) {
  setState((s) => ({ feed: { ...s.feed, ...patch } }));
}

export function setTopics(topics: Topic[]) {
  updateFeed({ topics, onboarded: topics.length > 0 });
}

export function adjustTopicWeight(name: string, delta: number) {
  const topics = getState().feed.topics.map((topic) =>
    topic.name === name ? { ...topic, weight: Math.max(0, Math.min(5, topic.weight + delta)) } : topic
  );
  updateFeed({ topics });
}
