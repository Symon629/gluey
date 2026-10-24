/**
 * The chat state machine. A message is interpreted into intents, then each intent
 * runs in turn. When details are missing, the assistant asks one question with
 * quick-reply choices and waits (state.pending) until the user answers.
 */
import { Platform } from 'react-native';

import {
  addChatMessage,
  addReminder,
  appendToNote,
  createNote,
  setPending,
} from '@/lib/actions';
import {
  ALL_DAY_HOUR,
  REPEAT_LABELS,
  addDays,
  describeWhen,
  formatDay,
  parseLocalDateTime,
  withTime,
} from '@/lib/dates';
import { composeSms, findContacts, looksLikePhone, pickContact, smsSupported } from '@/lib/messaging';
import { findNoteByTitle, titleFromContent } from '@/lib/notes';
import { ensureNotificationPermission, notificationsSupported } from '@/lib/notifications';
import { getState, setState } from '@/lib/store';
import type { ChatCard, Choice, Flow, MessageDraft, Pending, ReminderDraft } from '@/lib/types';

import { interpret } from './interpret';
import { matchChannel, matchLead, matchRepeat, parseWhen } from './local-parser';
import type { Channel, Intent, MessageIntent, NoteIntent, Repeat, ReminderIntent } from './types';

const CANCEL: Choice = { id: 'cancel', label: 'Cancel' };

const CHANNEL_CHOICES: Choice[] = [
  { id: 'channel:notification', label: 'Notification' },
  { id: 'channel:alarm', label: 'Alarm' },
  { id: 'channel:sms', label: 'Text message' },
  { id: 'channel:call', label: 'Phone call' },
];

const REPEAT_CHOICES: Choice[] = (['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'] as Repeat[]).map(
  (repeat) => ({ id: `repeat:${repeat}`, label: REPEAT_LABELS[repeat] })
);

const LEAD_CHOICES: Choice[] = [
  { id: 'lead:0', label: 'At the time' },
  { id: 'lead:15', label: '15 min before' },
  { id: 'lead:60', label: '1 hour before' },
  { id: 'lead:1440', label: '1 day before' },
  { id: 'lead:1440,60', label: '1 day and 1 hour before' },
  { id: 'lead:10080,1440', label: '1 week and 1 day before' },
];

const TIME_CHOICES: Choice[] = [
  { id: 'time:09:00', label: '9:00 AM' },
  { id: 'time:12:00', label: '12:00 PM' },
  { id: 'time:15:00', label: '3:00 PM' },
  { id: 'time:18:00', label: '6:00 PM' },
  { id: 'time:allday', label: 'All day' },
];

const DATE_CHOICES: Choice[] = [
  { id: 'date:tonight', label: 'Tonight 8 PM' },
  { id: 'date:tomorrow', label: 'Tomorrow 9 AM' },
  { id: 'date:next-week', label: 'Next week' },
];

const PICK_CONTACT: Choice = { id: 'contact:pick', label: 'Choose from contacts' };

type Answer = { text?: string; choiceId?: string };

function say(text: string, card?: ChatCard) {
  addChatMessage({ role: 'assistant', text, card });
}

function ask(flow: Flow, text: string, choices: Choice[], queue: Intent[]): true {
  const message = addChatMessage({ role: 'assistant', text, choices: [...choices, CANCEL] });
  setPending({ flow, promptId: message.id, queue });
  return true;
}

function isCancel(text: string) {
  return /^\s*(cancel|stop|never ?mind|nvm|forget it|no thanks)\b/i.test(text);
}

function choiceValue(answer: Answer, prefix: string): string | null {
  return answer.choiceId?.startsWith(prefix) ? answer.choiceId.slice(prefix.length) : null;
}

// Entry points ---------------------------------------------------------------

/** Handle text the user typed into the chat box. */
export async function sendUserText(raw: string) {
  const text = raw.trim();
  if (!text || getState().assistantBusy) return;
  addChatMessage({ role: 'user', text });
  await withBusy(async () => {
    const pending = getState().pending;
    if (pending) {
      if (isCancel(text)) {
        setPending(null);
        say('Okay, cancelled.');
        return;
      }
      if (await answerPending(pending, { text })) return;
      // Not an answer to the open question: treat it as a new request.
      setPending(null);
    }
    const result = await interpret(text);
    setState({ assistantMode: result.source });
    const showReply = result.reply && (result.intents.length === 0 || result.source === 'ai');
    if (showReply) say(result.reply);
    await runIntents(result.intents);
  });
}

/** Handle a tap on one of the quick-reply chips. */
export async function chooseOption(choice: Choice) {
  const pending = getState().pending;
  if (!pending || getState().assistantBusy) return;
  addChatMessage({ role: 'user', text: choice.label });
  await withBusy(async () => {
    if (choice.id === 'cancel') {
      setPending(null);
      say('Okay, cancelled.');
      return;
    }
    await answerPending(pending, { choiceId: choice.id });
  });
}

async function withBusy(task: () => Promise<void>) {
  setState({ assistantBusy: true });
  try {
    await task();
  } catch (error) {
    console.warn('Assistant error', error);
    setPending(null);
    say('Something went wrong on my side. Please try that again.');
  } finally {
    setState({ assistantBusy: false });
  }
}

async function runIntents(intents: Intent[]) {
  const queue = [...intents];
  while (queue.length) {
    const intent = queue.shift()!;
    const asked = await runIntent(intent, queue);
    if (asked) return;
  }
  setPending(null);
}

function runIntent(intent: Intent, queue: Intent[]): Promise<boolean> {
  switch (intent.type) {
    case 'reminder':
      return advanceReminder(draftFromIntent(intent), queue);
    case 'note':
      return Promise.resolve(runNote(intent, queue));
    case 'message':
      return runMessage(intent, queue);
  }
}

async function answerPending(pending: Pending, answer: Answer): Promise<boolean> {
  const { flow, queue } = pending;
  switch (flow.type) {
    case 'reminder':
      return answerReminder(flow.draft, flow.step, answer, queue);
    case 'note-parent-missing':
      return answerNoteParent(flow.intent, answer, queue);
    case 'note-target-missing':
      return answerNoteTarget(flow.intent, answer, queue);
    case 'message-recipient':
      return answerRecipient(flow.draft, answer, queue);
    case 'message-pick':
      return answerPick(flow.draft, flow.candidates, answer, queue);
    case 'message-body': {
      if (!answer.text) return false;
      const asked = await continueMessage({ ...flow.draft, body: answer.text }, queue);
      if (!asked) await finishAndContinue(queue);
      return true;
    }
  }
}

async function finishAndContinue(queue: Intent[]) {
  setPending(null);
  await runIntents(queue);
}

// Reminders -----------------------------------------------------------------

function draftFromIntent(intent: ReminderIntent): ReminderDraft {
  const date = parseLocalDateTime(intent.datetime);
  return {
    title: intent.title,
    kind: intent.kind,
    date: date ? date.toISOString() : null,
    dateOnly: !!date && intent.dateOnly,
    allDay: false,
    repeat: intent.repeat,
    channel: intent.channel,
    leadMinutes: null,
  };
}

function effectiveDate(draft: ReminderDraft): Date | null {
  if (!draft.date) return null;
  const date = new Date(draft.date);
  return draft.allDay ? withTime(date, ALL_DAY_HOUR, 0) : date;
}

async function advanceReminder(draft: ReminderDraft, queue: Intent[]): Promise<boolean> {
  if (!draft.date) {
    const question =
      draft.kind === 'event' ? `When is "${draft.title}"?` : `When should I remind you about "${draft.title}"?`;
    return ask({ type: 'reminder', draft, step: 'date' }, `${question} You can type a day and time.`, DATE_CHOICES, queue);
  }
  if (draft.dateOnly) {
    return ask(
      { type: 'reminder', draft, step: 'time' },
      `What time on ${formatDay(new Date(draft.date))}? Pick one or type a time.`,
      TIME_CHOICES,
      queue
    );
  }
  const repeating = draft.repeat !== null && draft.repeat !== 'none';
  if (!repeating && effectiveDate(draft)!.getTime() < Date.now() - 60_000) {
    return ask(
      { type: 'reminder', draft: { ...draft, date: null, dateOnly: false, allDay: false }, step: 'date' },
      `That time has already passed. When should I remind you about "${draft.title}"?`,
      DATE_CHOICES,
      queue
    );
  }
  if (!draft.channel) {
    return ask(
      { type: 'reminder', draft, step: 'channel' },
      'How should I remind you?',
      CHANNEL_CHOICES,
      queue
    );
  }
  if (draft.repeat === null) {
    return ask(
      { type: 'reminder', draft, step: 'repeat' },
      'How often should I remind you?',
      REPEAT_CHOICES,
      queue
    );
  }
  if (draft.repeat === 'none' && draft.kind === 'event' && draft.leadMinutes === null) {
    return ask(
      { type: 'reminder', draft, step: 'lead' },
      'When do you want to be reminded?',
      LEAD_CHOICES,
      queue
    );
  }
  await commitReminder(draft);
  return false;
}

function quickDate(id: string): Date | null {
  const now = new Date();
  switch (id) {
    case 'tonight': {
      const tonight = withTime(now, 20, 0);
      return tonight > now ? tonight : withTime(addDays(now, 1), 20, 0);
    }
    case 'tomorrow':
      return withTime(addDays(now, 1), 9, 0);
    case 'next-week':
      return withTime(addDays(now, 7), 9, 0);
    default:
      return null;
  }
}

async function answerReminder(
  draft: ReminderDraft,
  step: 'date' | 'time' | 'channel' | 'repeat' | 'lead',
  answer: Answer,
  queue: Intent[]
): Promise<boolean> {
  let next: ReminderDraft | null = null;
  const text = answer.text ?? '';
  switch (step) {
    case 'date': {
      const quick = choiceValue(answer, 'date:');
      const quickResult = quick ? quickDate(quick) : null;
      if (quickResult) {
        next = { ...draft, date: quickResult.toISOString(), dateOnly: false, allDay: false };
        break;
      }
      const parsed = text ? parseWhen(text) : null;
      if (parsed) {
        const repeat = draft.repeat ?? (matchRepeat(text) === 'none' ? null : matchRepeat(text));
        next = { ...draft, date: parsed.date.toISOString(), dateOnly: parsed.dateOnly, allDay: false, repeat };
      }
      break;
    }
    case 'time': {
      const base = new Date(draft.date!);
      const value = choiceValue(answer, 'time:');
      if (value === 'allday' || /\ball[- ]?day\b/i.test(text)) {
        next = { ...draft, dateOnly: false, allDay: true };
      } else if (value) {
        const [h, m] = value.split(':').map(Number);
        next = { ...draft, date: withTime(base, h, m).toISOString(), dateOnly: false };
      } else if (text) {
        const parsed = parseWhen(text, base);
        if (parsed && !parsed.dateOnly) {
          next = { ...draft, date: withTime(base, parsed.date.getHours(), parsed.date.getMinutes()).toISOString(), dateOnly: false };
        }
      }
      break;
    }
    case 'channel': {
      const value = (choiceValue(answer, 'channel:') as Channel | null) ?? (text ? matchChannel(text) : null);
      if (value) next = { ...draft, channel: value };
      break;
    }
    case 'repeat': {
      const value = (choiceValue(answer, 'repeat:') as Repeat | null) ?? (text ? matchRepeat(text) : null);
      if (value) next = { ...draft, repeat: value };
      break;
    }
    case 'lead': {
      const value = choiceValue(answer, 'lead:');
      const leads = value ? value.split(',').map(Number) : text ? matchLead(text) : null;
      if (leads) next = { ...draft, leadMinutes: leads };
      break;
    }
  }
  if (!next) return false;
  const asked = await advanceReminder(next, queue);
  if (!asked) await finishAndContinue(queue);
  return true;
}

async function commitReminder(draft: ReminderDraft) {
  // Ask for notification permission before saving, so the save's notification sync can schedule it.
  const granted = notificationsSupported ? await ensureNotificationPermission() : false;
  const reminder = addReminder({
    title: draft.title,
    kind: draft.kind,
    date: new Date(draft.date!).toISOString(),
    allDay: draft.allDay,
    repeat: draft.repeat ?? 'none',
    channel: draft.channel ?? 'notification',
    leadMinutes: draft.repeat === 'none' || draft.repeat === null ? (draft.leadMinutes ?? [0]) : [0],
    message: draft.message,
  });
  const notes: string[] = [];
  if (!notificationsSupported) {
    notes.push('Reminders only alert you in the iOS and Android app.');
  } else if (!granted) {
    notes.push('Notifications are off for Gluey. Turn them on in Settings so this can alert you.');
  } else if (reminder.channel === 'sms' || reminder.channel === 'call') {
    notes.push(
      `${reminder.channel === 'sms' ? 'Text' : 'Call'} reminders need a server that isn't set up yet, so you'll get a notification for now.`
    );
  } else if (reminder.channel === 'alarm' && Platform.OS === 'ios') {
    notes.push('On iPhone this rings as a time-sensitive alert.');
  }
  const verb = reminder.kind === 'message' ? "I'll remind you to send it" : 'Saved';
  const subject = reminder.kind === 'message' ? '' : ` "${reminder.title}"`;
  say([`${verb}${subject}: ${describeWhen(reminder)}.`, ...notes].join(' '), {
    kind: 'reminder',
    reminderId: reminder.id,
  });
}

// Notes ---------------------------------------------------------------------

function runNote(intent: NoteIntent, queue: Intent[]): boolean {
  const { notes } = getState();
  if (intent.action === 'append' && intent.title) {
    const target = findNoteByTitle(notes, intent.title);
    if (target) {
      appendToNote(target.id, intent.content);
      say(`Added to "${target.title}".`, { kind: 'note', noteId: target.id, appended: true });
      return false;
    }
    return ask(
      { type: 'note-target-missing', intent },
      `I couldn't find a note called "${intent.title}". Should I create it?`,
      [{ id: 'note:create-target', label: `Create "${intent.title}"` }],
      queue
    );
  }
  let parent = null;
  if (intent.parentTitle) {
    parent = findNoteByTitle(notes, intent.parentTitle);
    if (!parent) {
      return ask(
        { type: 'note-parent-missing', intent },
        `There's no "${intent.parentTitle}" note yet. Should I create it and put this inside?`,
        [
          { id: 'note:create-parent', label: `Create "${intent.parentTitle}"` },
          { id: 'note:top-level', label: 'Save it on its own' },
        ],
        queue
      );
    }
  }
  saveNewNote(intent, parent?.id ?? null, parent?.title ?? null);
  return false;
}

function saveNewNote(intent: NoteIntent, parentId: string | null, parentTitle: string | null) {
  const title = intent.title?.trim() || titleFromContent(intent.content);
  const note = createNote({ title, content: intent.content, parentId });
  say(`Saved the note "${note.title}"${parentTitle ? ` inside "${parentTitle}"` : ''}.`, {
    kind: 'note',
    noteId: note.id,
    appended: false,
  });
}

async function answerNoteParent(intent: NoteIntent, answer: Answer, queue: Intent[]): Promise<boolean> {
  const yes = answer.choiceId === 'note:create-parent' || /^\s*(yes|yeah|yep|sure|ok|create)/i.test(answer.text ?? '');
  const no = answer.choiceId === 'note:top-level' || /^\s*(no|nope|on its own|top)/i.test(answer.text ?? '');
  if (!yes && !no) return false;
  if (yes && intent.parentTitle) {
    const parent = createNote({ title: intent.parentTitle });
    saveNewNote(intent, parent.id, parent.title);
  } else {
    saveNewNote(intent, null, null);
  }
  await finishAndContinue(queue);
  return true;
}

async function answerNoteTarget(intent: NoteIntent, answer: Answer, queue: Intent[]): Promise<boolean> {
  const yes = answer.choiceId === 'note:create-target' || /^\s*(yes|yeah|yep|sure|ok|create)/i.test(answer.text ?? '');
  if (!yes) return false;
  saveNewNote({ ...intent, action: 'create' }, null, null);
  await finishAndContinue(queue);
  return true;
}

// Messages ------------------------------------------------------------------

async function runMessage(intent: MessageIntent, queue: Intent[]): Promise<boolean> {
  if (!smsSupported) {
    say('Sending texts only works in the iOS and Android app.');
    return false;
  }
  const date = parseLocalDateTime(intent.datetime);
  const draft: MessageDraft = {
    recipientName: null,
    phones: [],
    body: intent.body,
    date: date && date.getTime() > Date.now() ? date.toISOString() : null,
  };
  if (!intent.recipient) {
    return ask(
      { type: 'message-recipient', draft, query: null },
      'Who should I send it to? Type a name or number.',
      [PICK_CONTACT],
      queue
    );
  }
  return resolveRecipient(draft, intent.recipient, queue);
}

async function resolveRecipient(draft: MessageDraft, query: string, queue: Intent[]): Promise<boolean> {
  if (looksLikePhone(query)) {
    return continueMessage({ ...draft, recipientName: query.trim(), phones: [query.trim()] }, queue);
  }
  const { status, matches } = await findContacts(query);
  if (status !== 'ok') {
    const reason =
      status === 'denied'
        ? `I need access to your contacts to find "${query}".`
        : `I couldn't search your contacts for "${query}".`;
    return ask(
      { type: 'message-recipient', draft, query },
      `${reason} You can type their number instead.`,
      [PICK_CONTACT],
      queue
    );
  }
  if (matches.length === 0) {
    return ask(
      { type: 'message-recipient', draft, query },
      `I couldn't find "${query}" in your contacts. Type their number or pick someone.`,
      [PICK_CONTACT],
      queue
    );
  }
  if (matches.length === 1) {
    return continueMessage({ ...draft, recipientName: matches[0].name, phones: [matches[0].phone] }, queue);
  }
  return ask(
    { type: 'message-pick', draft, candidates: matches },
    `Which ${query}?`,
    [...matches.map((m, i) => ({ id: `contact:${i}`, label: `${m.name} · ${m.phone}` })), PICK_CONTACT],
    queue
  );
}

async function pickFromContacts(draft: MessageDraft, queue: Intent[]): Promise<void> {
  const picked = await pickContact();
  if (!picked) {
    ask({ type: 'message-recipient', draft, query: null }, 'No contact picked. Who should I send it to?', [PICK_CONTACT], queue);
    return;
  }
  const asked = await continueMessage({ ...draft, recipientName: picked.name, phones: [picked.phone] }, queue);
  if (!asked) await finishAndContinue(queue);
}

async function answerRecipient(draft: MessageDraft, answer: Answer, queue: Intent[]): Promise<boolean> {
  if (answer.choiceId === PICK_CONTACT.id) {
    await pickFromContacts(draft, queue);
    return true;
  }
  if (!answer.text) return false;
  const asked = await resolveRecipient(draft, answer.text, queue);
  if (!asked) await finishAndContinue(queue);
  return true;
}

async function answerPick(
  draft: MessageDraft,
  candidates: { name: string; phone: string }[],
  answer: Answer,
  queue: Intent[]
): Promise<boolean> {
  if (answer.choiceId === PICK_CONTACT.id) {
    await pickFromContacts(draft, queue);
    return true;
  }
  const index = Number(choiceValue(answer, 'contact:'));
  const chosen = Number.isInteger(index) ? candidates[index] : undefined;
  if (!chosen) return false;
  const asked = await continueMessage({ ...draft, recipientName: chosen.name, phones: [chosen.phone] }, queue);
  if (!asked) await finishAndContinue(queue);
  return true;
}

async function continueMessage(draft: MessageDraft, queue: Intent[]): Promise<boolean> {
  const name = draft.recipientName ?? draft.phones[0] ?? 'them';
  if (!draft.body) {
    return ask({ type: 'message-body', draft }, `What should the message to ${name} say?`, [], queue);
  }
  if (draft.date) {
    await commitReminder({
      title: `Text ${name}: ${draft.body}`,
      kind: 'message',
      date: draft.date,
      dateOnly: false,
      allDay: false,
      repeat: 'none',
      channel: 'notification',
      leadMinutes: [0],
      message: { recipientName: draft.recipientName, phones: draft.phones, body: draft.body },
    });
    say('When the notification arrives, tap it to open the message ready to send.');
    return false;
  }
  say(`Opening Messages with "${draft.body}" for ${name}. Tap send when it looks right.`);
  const result = await composeSms(draft.phones, draft.body);
  if (result === 'sent') say(`Sent to ${name}.`);
  else if (result === 'cancelled') say('Okay, the message was not sent.');
  else if (result === 'unavailable') say("This device can't send text messages.");
  return false;
}
