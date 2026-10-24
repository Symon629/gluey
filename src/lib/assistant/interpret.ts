import { addDays, describeWhen, formatDay, formatTime, occurrencesBetween, toLocalDateTime, weekdayName } from '@/lib/dates';
import { getState } from '@/lib/store';

import { localInterpret } from './local-parser';
import { sanitizeInterpretation } from './schema';
import type { AssistantRequest, Interpretation } from './types';

export type InterpretResult = Interpretation & { source: 'ai' | 'local' };

const REQUEST_TIMEOUT_MS = 40_000;
/** After the server says Claude isn't configured, skip it for a while instead of waiting on every message. */
const NOT_CONFIGURED_BACKOFF_MS = 5 * 60_000;
const NETWORK_BACKOFF_MS = 60_000;

let skipAiUntil = 0;

function buildRequest(message: string): AssistantRequest {
  const { notes, reminders, messages } = getState();
  const now = new Date();
  const weekAhead = addDays(now, 7);
  const upcoming = reminders
    .filter((r) => !r.done)
    .flatMap((r) => occurrencesBetween(r, now, weekAhead).map((date) => ({ r, date })))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 20)
    .map(({ r, date }) => {
      const time = r.allDay ? 'all day' : formatTime(date);
      const repeat = r.repeat === 'none' ? '' : ` (${describeWhen(r, now)})`;
      return `${formatDay(date, now)} ${time}: ${r.title}${repeat}`;
    });
  return {
    message,
    now: toLocalDateTime(now),
    weekday: weekdayName(now),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    noteTitles: notes.map((n) => n.title).slice(0, 100),
    upcoming,
    // The latest user message is sent separately, so leave it out of the history.
    history: messages
      .slice(-11, -1)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 500) }))
      .filter((m) => m.text.length > 0),
  };
}

async function askClaude(message: string): Promise<Interpretation | null> {
  if (Date.now() < skipAiUntil) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Relative URLs resolve to the Expo dev server in development, and to the
    // expo-router "origin" in production builds.
    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequest(message)),
      signal: controller.signal,
    });
    if (response.ok) return sanitizeInterpretation(await response.json());
    if (response.status === 503 || response.status === 404) {
      skipAiUntil = Date.now() + NOT_CONFIGURED_BACKOFF_MS;
    }
    return null;
  } catch {
    skipAiUntil = Date.now() + NETWORK_BACKOFF_MS;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Understand a chat message with Claude when available, otherwise on the device. */
export async function interpret(message: string): Promise<InterpretResult> {
  const ai = await askClaude(message);
  if (ai) return { ...ai, source: 'ai' };
  return { ...localInterpret(message, new Date()), source: 'local' };
}
