/**
 * Intent types shared by the app and the /api/assistant server route.
 * Keep this file free of React Native imports so the server can use it.
 */

export const REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'] as const;
export type Repeat = (typeof REPEATS)[number];

export const CHANNELS = ['notification', 'alarm', 'sms', 'call'] as const;
export type Channel = (typeof CHANNELS)[number];

/** A local wall-clock time, formatted "YYYY-MM-DDTHH:mm" (no timezone). */
export type LocalDateTime = string;

export type ReminderIntent = {
  type: 'reminder';
  title: string;
  /** "event" is something you attend (appointment, meeting); "task" is something you do. */
  kind: 'task' | 'event';
  datetime: LocalDateTime | null;
  /** True when the user gave a date but no time of day. */
  dateOnly: boolean;
  repeat: Repeat | null;
  channel: Channel | null;
};

export type NoteIntent = {
  type: 'note';
  /** "create" makes a new note. "append" adds content to an existing note. */
  action: 'create' | 'append';
  /** For create: the new note's title. For append: the title of the note to add to. */
  title: string | null;
  content: string;
  /** For create only: put the new note inside this existing note. */
  parentTitle: string | null;
};

export type MessageIntent = {
  type: 'message';
  /** A contact name ("Mom") or a phone number. */
  recipient: string | null;
  body: string | null;
  /** Set when the user wants the message sent later. */
  datetime: LocalDateTime | null;
};

export type Intent = ReminderIntent | NoteIntent | MessageIntent;

export type Interpretation = {
  reply: string;
  intents: Intent[];
};

/** What the app sends to /api/assistant. */
export type AssistantRequest = {
  message: string;
  /** Current local time on the device, "YYYY-MM-DDTHH:mm". */
  now: LocalDateTime;
  /** e.g. "Saturday" */
  weekday: string;
  timezone: string;
  noteTitles: string[];
  /** Short plain-text lines describing upcoming items, for questions like "what's on tomorrow?" */
  upcoming: string[];
  history: { role: 'user' | 'assistant'; text: string }[];
};
