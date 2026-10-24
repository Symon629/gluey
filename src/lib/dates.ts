import type { Repeat } from '@/lib/assistant/types';
import type { Reminder } from '@/lib/types';

/** Default notification time for reminders that only have a date. */
export const ALL_DAY_HOUR = 9;

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD") as local wall-clock time. */
export function parseLocalDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), h ? Number(h) : 0, mi ? Number(mi) : 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes());
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function withTime(d: Date, hours: number, minutes: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes);
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDay(d: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function weekdayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export const REPEAT_LABELS: Record<Repeat, string> = {
  none: 'Just once',
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

export function leadLabel(minutes: number): string {
  if (minutes === 0) return 'At the time';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${minutes / 60} hour${minutes === 60 ? '' : 's'} before`;
  if (minutes < 10080) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'} before`;
  return `${minutes / 10080} week${minutes === 10080 ? '' : 's'} before`;
}

export function describeWhen(r: Pick<Reminder, 'date' | 'allDay' | 'repeat'>, now = new Date()): string {
  const start = new Date(r.date);
  const time = r.allDay ? 'all day' : `at ${formatTime(start)}`;
  if (r.repeat === 'none') return `${formatDay(start, now)} ${time}`;
  const startsLater = startOfDay(start) > startOfDay(now);
  const from = startsLater ? `, starting ${formatDay(start, now)}` : '';
  switch (r.repeat) {
    case 'daily':
      return `Every day ${time}${from}`;
    case 'weekdays':
      return `Weekdays ${time}${from}`;
    case 'weekly':
      return `Every ${weekdayName(start)} ${time}${from}`;
    case 'monthly':
      return `Monthly on day ${start.getDate()} ${time}${from}`;
    case 'yearly':
      return `Every year on ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
  }
}

function matchesRepeat(day: Date, start: Date, repeat: Repeat): boolean {
  switch (repeat) {
    case 'none':
      return isSameDay(day, start);
    case 'daily':
      return true;
    case 'weekdays':
      return day.getDay() >= 1 && day.getDay() <= 5;
    case 'weekly':
      return day.getDay() === start.getDay();
    case 'monthly':
      return day.getDate() === start.getDate();
    case 'yearly':
      return day.getMonth() === start.getMonth() && day.getDate() === start.getDate();
  }
}

/** Every occurrence of a reminder in [from, to). */
export function occurrencesBetween(r: Pick<Reminder, 'date' | 'repeat'>, from: Date, to: Date): Date[] {
  const start = new Date(r.date);
  if (r.repeat === 'none') return start >= from && start < to ? [start] : [];
  const result: Date[] = [];
  let day = startOfDay(start > from ? start : from);
  while (day < to) {
    if (matchesRepeat(day, start, r.repeat)) {
      const occurrence = withTime(day, start.getHours(), start.getMinutes());
      if (occurrence >= start && occurrence >= from && occurrence < to) result.push(occurrence);
    }
    day = addDays(day, 1);
  }
  return result;
}

/** The first occurrence strictly after `after`, searching up to ~13 months ahead. */
export function nextOccurrence(r: Pick<Reminder, 'date' | 'repeat'>, after: Date): Date | null {
  const found = occurrencesBetween(r, new Date(after.getTime() + 1), addDays(after, 400));
  return found[0] ?? null;
}
