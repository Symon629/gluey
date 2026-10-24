/**
 * On-device fallback for when the Claude route is not configured or unreachable.
 * Handles the common phrasings for reminders, notes and text messages.
 */
import * as chrono from 'chrono-node';

import type { Channel, Intent, Interpretation, Repeat } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Fix common fast-typing slips before parsing. */
export function normalizeInput(text: string): string {
  return text
    .replace(/\b(?:tom+o+r+o*w*|tmrw?|tmr|tmrrw|2moro|2morrow)\b/gi, 'tomorrow')
    .replace(/\br\w{0,2}m\w{0,2}nd\b/gi, 'remind')
    .replace(/\b(\d{1,2})\s*[,.]\s*(am|pm)\b/gi, '$1 $2')
    .replace(/\b(\d{1,2})(am|pm)\b/gi, '$1 $2')
    .replace(/\bappoint(?:ment)?s?\b|\bappt\b/gi, 'appointment')
    .replace(/\btonite\b/gi, 'tonight')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ParsedWhen = { date: Date; dateOnly: boolean; text: string; index: number };

/** Find the first date/time expression in text. */
export function parseWhen(text: string, ref: Date = new Date()): ParsedWhen | null {
  const results = chrono.parse(normalizeInput(text), ref, { forwardDate: true });
  const first = results[0];
  if (!first) return null;
  const date = first.start.date();
  const dateOnly = !first.start.isCertain('hour');
  if (dateOnly) date.setHours(0, 0, 0, 0);
  return { date, dateOnly, text: first.text, index: first.index };
}

export function matchChannel(text: string): Channel | null {
  const t = text.toLowerCase();
  if (/\balarm\b|\bwake me\b|\bring\b/.test(t)) return 'alarm';
  if (/\bcall\b|\bphone call\b/.test(t)) return 'call';
  if (/\btext\b|\bsms\b|\bmessage\b/.test(t)) return 'sms';
  if (/\bnotif|\bpush\b|\bbanner\b/.test(t)) return 'notification';
  return null;
}

export function matchRepeat(text: string): Repeat | null {
  const t = text.toLowerCase();
  if (/\bweekdays?\b|\bevery weekday\b|\bmon(day)?\s*(-|to|through)\s*fri(day)?\b/.test(t)) return 'weekdays';
  if (/\bevery\s*(day|morning|night|evening|afternoon)\b|\bdaily\b|\beach day\b|\beveryday\b/.test(t)) return 'daily';
  if (/\bevery\s*(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bweekly\b/.test(t)) return 'weekly';
  if (/\bevery\s*month\b|\bmonthly\b/.test(t)) return 'monthly';
  if (/\bevery\s*year\b|\byearly\b|\bannual(ly)?\b/.test(t)) return 'yearly';
  if (/\bjust once\b|\bonce\b|\bone[- ]time\b|\bno repeat\b|\bdon'?t repeat\b|^no$|\bnever\b/.test(t)) return 'none';
  return null;
}

/** Minutes-before choices typed as text, e.g. "an hour before" or "a day and an hour before". */
export function matchLead(text: string): number[] | null {
  const t = text.toLowerCase();
  const leads: number[] = [];
  if (/\bweek\b/.test(t)) leads.push(10080);
  if (/\bday\b/.test(t)) leads.push(1440);
  if (/\bhour\b/.test(t)) leads.push(60);
  const mins = /(\d+)\s*min/.exec(t);
  if (mins) leads.push(Number(mins[1]));
  if (leads.length) return leads;
  if (/\bat the time\b|\bon time\b|\bwhen it starts\b|\bno(ne)?\b|\bjust then\b/.test(t)) return [0];
  return null;
}

const FILLER = /^(?:hey|hi|hello|ok|okay|yo|please|pls|plz|so|um|uh|can you|could you|would you|will you|i want you to|i need you to|i'd like you to)[\s,!.]+/i;

function stripFiller(text: string): string {
  let current = text.trim();
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(FILLER, '').trim();
  }
  return current;
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:;-]+|[\s,.:;!?-]+$/g, '')
    .replace(/\s+(?:at|on|for|by|in|from|starting|every|each)$/i, '')
    .trim();
}

function parseMessage(text: string, now: Date): Intent | null {
  const t = stripFiller(text);
  const patterns: RegExp[] = [
    /^(?:send|shoot|write)\s+(?:a\s+)?(?:text|message|sms|msg)\s+to\s+(.+?)\s*(?:saying|that says|telling (?:him|her|them)|that|:|,)\s*(.+)$/i,
    /^(?:text|message|sms)\s+(.+?)\s*(?:saying|that says|that|:|,)\s*(.+)$/i,
    /^tell\s+(.+?)\s+(?:that|to say)\s+(.+)$/i,
  ];
  let recipient: string | null = null;
  let body: string | null = null;
  for (const pattern of patterns) {
    const match = pattern.exec(t);
    if (match) {
      recipient = match[1];
      body = match[2];
      break;
    }
  }
  if (!recipient) {
    const loose = /^(?:send|shoot)\s+(?:a\s+)?(?:text|message|sms|msg)(?:\s+to\s+(.+))?$|^(?:text|message)\s+(\S+(?:\s+\S+)?)$/i.exec(t);
    if (!loose) return null;
    recipient = loose[1] ?? loose[2] ?? null;
  }
  let datetime: string | null = null;
  if (body) {
    const when = /\s+(?:at|on|tomorrow|tonight|in\s+\d)\b.*$/i.exec(body);
    const parsed = when ? parseWhen(when[0], now) : null;
    if (when && parsed) {
      datetime = toLocal(parsed.date);
      body = body.slice(0, when.index);
    }
  }
  recipient = recipient ? recipient.replace(/^(?:my)\s+/i, '').trim() : null;
  return {
    type: 'message',
    recipient: recipient || null,
    body: body ? capitalize(tidy(body)) : null,
    datetime,
  };
}

function parseNote(text: string): Intent | null {
  const t = stripFiller(text);
  // "add milk to my groceries note"
  const append = /^(?:add|put|append|write|include)\s+(.+?)\s+(?:to|in|into|on|under)\s+(?:my\s+|the\s+)?(.+?)\s+(?:note|notes|list)$/i.exec(t);
  if (append) {
    return { type: 'note', action: 'append', title: tidy(append[2]), content: tidy(append[1]), parentTitle: null };
  }

  // Split "create a note called X under Y: the content" into the command and the content.
  const separator = /\s*(?::|—|\s-\s|\bsaying\b|\bthat says\b)\s*/i.exec(t);
  let head = separator ? t.slice(0, separator.index) : t;
  let content = separator ? tidy(t.slice(separator.index + separator[0].length)) : '';
  if (!/\bnote\b|\bjot\b|\bwrite (?:this|that|it) down\b/i.test(head)) return null;

  let parentTitle: string | null = null;
  const parent =
    /\s+(?:under|inside|within|in(?=\s+(?:my|the)\s))\s+(?:my\s+|the\s+)?["“]?(.+?)["”]?(?:\s+note)?(?=\s+(?:called|titled|named)\b|$)/i.exec(head);
  if (parent && !/^(?:it|this|that)$/i.test(parent[1])) {
    parentTitle = tidy(parent[1]);
    head = head.slice(0, parent.index) + head.slice(parent.index + parent[0].length);
  }

  let title: string | null = null;
  const named = /\b(?:called|titled|named)\s+["“]?(.+?)["”]?$/i.exec(head);
  if (named) {
    title = tidy(named[1]);
  } else if (!content) {
    content = tidy(
      head.replace(
        /^.*?\b(?:create|make|start|take|add|new|jot(?: down)?|write(?: down)?)?\s*(?:a\s+)?(?:new\s+)?(?:quick\s+)?note\s*(?:about|that|to)?\s*/i,
        ''
      )
    );
  }
  if (!title && !content) return null;
  return { type: 'note', action: 'create', title, content, parentTitle };
}

/** Like matchRepeat, but only treats explicit phrasing as "none" so words like "once" in a title don't count. */
function reminderRepeat(text: string): Repeat | null {
  const repeat = matchRepeat(text);
  if (repeat !== 'none') return repeat;
  return /\bjust once\b|\bone[- ]time\b|\bdon'?t repeat\b/i.test(text) ? 'none' : null;
}

const REMINDER_TRIGGER =
  /\b(remind|reminder|alarm|wake me|appointment|meeting|schedule|calendar|deadline|due|every\s+\w+|daily|weekly|monthly|yearly)\b/i;
const EVENT_WORDS =
  /\b(appointment|meeting|interview|class|lecture|flight|party|dinner|lunch|breakfast|wedding|concert|game|match|call with|session|exam|test|checkup|check-up|doctor|dentist|birthday)\b/i;

function parseReminder(text: string, now: Date): Intent | null {
  const normalized = normalizeInput(text);
  const when = parseWhen(normalized, now);
  if (!when && !REMINDER_TRIGGER.test(normalized)) return null;

  let title = normalized;
  if (when) title = title.slice(0, when.index) + ' ' + title.slice(when.index + when.text.length);
  title = stripFiller(title)
    .replace(/\b(?:set|create|add|make|put)\s+(?:up\s+)?(?:an?\s+)?(?:reminder|alarm|event)s?\s*(?:for|to|about|that)?\s*/gi, ' ')
    .replace(/\bremind me\s*(?:to|about|of|that)?\s*/gi, ' ')
    .replace(/\b(?:i have|i've got|i got|there's|there is)\s+(?:an?\s+)?/gi, ' ')
    .replace(/^\s*(?:have|got)\s+(?:an?\s+)?/i, ' ')
    .replace(/\b(?:every\s*(?:day|morning|night|evening|afternoon|weekday|week|month|year)|daily|weekly|monthly|yearly|annually|on weekdays|weekdays)\b/gi, ' ')
    .replace(/\b(?:with|using|as|by|via)\s+(?:an?\s+)?(?:alarm|text|sms|call|phone call|notification)\b/gi, ' ')
    .replace(/\b(?:text|call|notify|wake)\s+me\b/gi, ' ')
    .replace(/\b(?:on|to|in)\s+my\s+calendar\b/gi, ' ')
    .replace(/\bschedule\s+(?:an?\s+)?/gi, ' ');
  title = capitalize(tidy(stripFiller(tidy(title))));
  if (!title) title = 'Reminder';

  return {
    type: 'reminder',
    title,
    kind: EVENT_WORDS.test(normalized) ? 'event' : 'task',
    datetime: when ? toLocal(when.date) : null,
    dateOnly: when?.dateOnly ?? false,
    repeat: reminderRepeat(normalized),
    channel: /\balarm\b|\bwake me\b/i.test(normalized)
      ? 'alarm'
      : /\btext me\b|\bby text\b|\bvia (?:text|sms)\b/i.test(normalized)
        ? 'sms'
        : /\bcall me\b|\bphone call\b/i.test(normalized)
          ? 'call'
          : /\bnotif/i.test(normalized)
            ? 'notification'
            : null,
  };
}

export const HELP_TEXT =
  'I can set reminders, add events to your calendar, take notes and draft texts. Try "Remind me to shop for groceries at 10am tomorrow", "Doctor\'s appointment on 26 Nov 2026", "Add milk to my Groceries note" or "Text Mom that I\'m on my way".';

export function localInterpret(text: string, now: Date = new Date()): Interpretation {
  const intent = parseMessage(text, now) ?? parseNote(text) ?? parseReminder(text, now);
  if (intent) return { reply: '', intents: [intent] };
  if (/^\s*(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i.test(text)) {
    return { reply: `Hi! ${HELP_TEXT}`, intents: [] };
  }
  return { reply: `I'm running in offline mode, so I only understand a few kinds of requests. ${HELP_TEXT}`, intents: [] };
}
