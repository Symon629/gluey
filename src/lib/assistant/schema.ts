/**
 * Prompt, JSON schema and validation for turning a chat message into intents.
 * Pure TypeScript so both the server route and the app can import it.
 */
import {
  CHANNELS,
  REPEATS,
  type AssistantRequest,
  type Channel,
  type Intent,
  type Interpretation,
  type Repeat,
} from './types';

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

const DATETIME_DESCRIPTION =
  'Local wall-clock time "YYYY-MM-DDTHH:mm", resolved against the current local time. Null if no date or time was given.';

export const INTERPRETATION_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'One short, friendly sentence shown to the user.' },
    intents: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { type: 'string', const: 'reminder' },
              title: { type: 'string', description: 'Short title without date words, e.g. "Shop for groceries".' },
              kind: { type: 'string', enum: ['task', 'event'] },
              datetime: nullable({ type: 'string', description: DATETIME_DESCRIPTION }),
              dateOnly: { type: 'boolean', description: 'True when a date was given without a time of day.' },
              repeat: nullable({ type: 'string', enum: [...REPEATS] }),
              channel: nullable({ type: 'string', enum: [...CHANNELS] }),
            },
            required: ['type', 'title', 'kind', 'datetime', 'dateOnly', 'repeat', 'channel'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', const: 'note' },
              action: { type: 'string', enum: ['create', 'append'] },
              title: nullable({ type: 'string' }),
              content: { type: 'string' },
              parentTitle: nullable({ type: 'string' }),
            },
            required: ['type', 'action', 'title', 'content', 'parentTitle'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', const: 'message' },
              recipient: nullable({ type: 'string' }),
              body: nullable({ type: 'string' }),
              datetime: nullable({ type: 'string', description: DATETIME_DESCRIPTION }),
            },
            required: ['type', 'recipient', 'body', 'datetime'],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ['reply', 'intents'],
  additionalProperties: false,
} as const;

export const SYSTEM_PROMPT = `You are the assistant inside Gluey, a personal organizer app with Chat, Feed, Calendar, Notes and Agents tabs. Turn the user's latest chat message into intents the app can carry out, plus a short reply.

Intent types:

reminder: anything the user wants to be reminded about or put on their calendar. That covers tasks ("remind me to shop for groceries"), appointments ("doctor's appointment on 26 Nov") and routines ("take vitamins every morning at 8").
- title: a short title without the date, time or "remind me to" wording, e.g. "Shop for groceries" or "Doctor's appointment".
- kind: "event" for something attended at a set time (appointment, meeting, class, flight, interview, party). Otherwise "task".
- datetime: resolve relative dates against the current local time. If a date is given without a time, use T00:00 and set dateOnly to true. If only a time is given, use its next occurrence. For repeating reminders, use the first occurrence (for "every Monday", the next Monday). Null if no date or time was given at all.
- repeat: set only when the user said how often ("every day" is daily, "every weekday" is weekdays, "every Monday" is weekly, "monthly", "every year" is yearly, "just once" is none). Otherwise null, and the app will ask.
- channel: set only when the user said how to be reminded ("alarm" or "wake me up" is alarm, "text me" is sms, "call me" is call, "notify me" is notification). Otherwise null, and the app will ask.

note: when the user wants to write something down.
- action "create": title is the note's title (invent a short one if none was given), content is the text. If they want it inside another note ("under my Work note"), set parentTitle, using the exact title from the existing notes list when one clearly matches.
- action "append": when they ask to add something to an existing note ("add milk to my groceries note"). title is that note's title (use the exact title from the list when one matches) and content is what to add.

message: when the user wants to text someone.
- recipient: the name or number as the user said it, e.g. "Mom".
- body: the text to send, written as the user would send it ("tell Mom I'll be late" gives "I'll be late").
- datetime: only if they want it sent later.

Rules:
- The user types quickly. Read through typos: "tomooor" means tomorrow and "10,am" means 10 am.
- One message can hold several intents. Return each one.
- Never invent details the user did not give.
- When intents are present, keep the reply to a brief acknowledgement and do not ask follow-up questions. The app asks for anything missing.
- Never say something was scheduled, saved or sent. The app confirms that itself.
- When there are no intents, answer conversationally in one or two sentences. Use the upcoming items and note titles for questions like "what's on tomorrow?". If the request is outside what you can do, say what you can help with: reminders, calendar events, notes and text messages.`;

export function buildUserPrompt(request: AssistantRequest): string {
  const lines = [
    `Current local time: ${request.now} (${request.weekday}), timezone ${request.timezone}.`,
    '',
    `Existing notes: ${request.noteTitles.length ? request.noteTitles.map((t) => `"${t}"`).join(', ') : 'none'}`,
    '',
    'Upcoming items:',
    ...(request.upcoming.length ? request.upcoming.map((line) => `- ${line}`) : ['- none']),
  ];
  if (request.history.length) {
    lines.push('', 'Recent conversation:');
    for (const turn of request.history) lines.push(`${turn.role}: ${turn.text}`);
  }
  lines.push('', 'Latest message:', request.message);
  return lines.join('\n');
}

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length ? value.trim() : null;

/** Validate untrusted JSON (from the model or the network) into an Interpretation. */
export function sanitizeInterpretation(raw: unknown): Interpretation {
  const input = (raw ?? {}) as { reply?: unknown; intents?: unknown };
  const intents: Intent[] = [];
  for (const item of Array.isArray(input.intents) ? input.intents : []) {
    const i = (item ?? {}) as Record<string, unknown>;
    if (i.type === 'reminder' && str(i.title)) {
      intents.push({
        type: 'reminder',
        title: str(i.title)!,
        kind: i.kind === 'event' ? 'event' : 'task',
        datetime: str(i.datetime),
        dateOnly: i.dateOnly === true,
        repeat: REPEATS.includes(i.repeat as Repeat) ? (i.repeat as Repeat) : null,
        channel: CHANNELS.includes(i.channel as Channel) ? (i.channel as Channel) : null,
      });
    } else if (i.type === 'note' && (str(i.content) || str(i.title))) {
      intents.push({
        type: 'note',
        action: i.action === 'append' ? 'append' : 'create',
        title: str(i.title),
        content: str(i.content) ?? '',
        parentTitle: str(i.parentTitle),
      });
    } else if (i.type === 'message') {
      intents.push({
        type: 'message',
        recipient: str(i.recipient),
        body: str(i.body),
        datetime: str(i.datetime),
      });
    }
  }
  return { reply: str(input.reply) ?? '', intents: intents.slice(0, 5) };
}
