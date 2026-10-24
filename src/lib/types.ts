import type { Channel, Intent, MessageIntent, NoteIntent, Repeat } from '@/lib/assistant/types';

export type { Channel, Repeat };

export type ScheduledMessage = {
  recipientName: string | null;
  phones: string[];
  body: string;
};

export type Reminder = {
  id: string;
  title: string;
  kind: 'task' | 'event' | 'message';
  /** ISO timestamp of the first occurrence. */
  date: string;
  /** The user gave a date without a time. Shown as "All day", notified at 9 AM. */
  allDay: boolean;
  repeat: Repeat;
  channel: Channel;
  /** Minutes before the occurrence to notify. Only used when repeat is "none". */
  leadMinutes: number[];
  done: boolean;
  message?: ScheduledMessage;
  createdAt: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Choice = { id: string; label: string };

export type ChatCard =
  | { kind: 'reminder'; reminderId: string }
  | { kind: 'note'; noteId: string; appended: boolean };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  choices?: Choice[];
  card?: ChatCard;
};

export type ReminderDraft = {
  title: string;
  kind: 'task' | 'event' | 'message';
  date: string | null;
  /** A date without a time; the assistant still needs to ask for the time. */
  dateOnly: boolean;
  allDay: boolean;
  repeat: Repeat | null;
  channel: Channel | null;
  leadMinutes: number[] | null;
  message?: ScheduledMessage;
};

export type MessageDraft = {
  recipientName: string | null;
  phones: string[];
  body: string | null;
  date: string | null;
};

/** The question the assistant is waiting on, plus anything queued after it. */
export type Flow =
  | { type: 'reminder'; draft: ReminderDraft; step: 'date' | 'time' | 'channel' | 'repeat' | 'lead' }
  | { type: 'note-parent-missing'; intent: NoteIntent }
  | { type: 'note-target-missing'; intent: NoteIntent }
  | { type: 'message-recipient'; draft: MessageDraft; query: string | null }
  | { type: 'message-pick'; draft: MessageDraft; candidates: { name: string; phone: string }[] }
  | { type: 'message-body'; draft: MessageDraft };

export type Pending = {
  flow: Flow;
  /** The assistant message whose choices answer this flow. */
  promptId: string;
  queue: Intent[];
};

export type Topic = { name: string; weight: number };

export type FeedPrefs = {
  onboarded: boolean;
  topics: Topic[];
  dismissedSuggestions: string[];
  hiddenArticles: string[];
};

export type { MessageIntent, NoteIntent };
