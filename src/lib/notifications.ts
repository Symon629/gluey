import * as Notifications from 'expo-notifications';
// Imported by name: the lint import plugin can't see these through the namespace import
// with expo-notifications 58's build output, though TypeScript and the runtime can.
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { addDays, formatDay, formatTime, withTime, ALL_DAY_HOUR } from '@/lib/dates';
import { composeSms } from '@/lib/messaging';
import { getState } from '@/lib/store';
import type { Reminder } from '@/lib/types';

export const notificationsSupported = true;

const CHANNEL_REMINDERS = 'reminders';
const CHANNEL_ALARMS = 'alarms';
const DAY_MS = 86_400_000;

/** How long a repeating trigger's period is. A start date further out than this gets a one-off trigger first. */
const REPEAT_PERIOD_MS = {
  daily: DAY_MS,
  weekdays: 7 * DAY_MS,
  weekly: 7 * DAY_MS,
  monthly: 28 * DAY_MS,
  yearly: 365 * DAY_MS,
} as const;

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: 'Reminders',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    void Notifications.setNotificationChannelAsync(CHANNEL_ALARMS, {
      name: 'Alarms',
      description: 'Loud, persistent reminders',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800],
      bypassDnd: true,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function effectiveDate(r: Reminder): Date {
  const date = new Date(r.date);
  return r.allDay ? withTime(date, ALL_DAY_HOUR, 0) : date;
}

function content(r: Reminder, occurrence: Date, leadMinutes: number): Notifications.NotificationContentInput {
  const isAlarm = r.channel === 'alarm';
  let title = r.title;
  let body: string;
  if (r.kind === 'message' && r.message) {
    title = `Time to text ${r.message.recipientName ?? r.message.phones[0] ?? 'someone'}`;
    body = `Tap to send: "${r.message.body}"`;
  } else if (leadMinutes > 0) {
    body = `${r.kind === 'event' ? 'Starts' : 'Due'} ${formatDay(occurrence).toLowerCase()} at ${formatTime(occurrence)}`;
  } else {
    body = r.kind === 'event' ? 'Starting now' : 'Reminder';
  }
  return {
    title,
    body,
    sound: 'default',
    data: { reminderId: r.id, type: r.kind },
    interruptionLevel: isAlarm ? 'timeSensitive' : 'active',
    priority: isAlarm ? 'max' : 'high',
    ...(isAlarm ? { sticky: true, autoDismiss: false } : {}),
  };
}

function channelFor(r: Reminder) {
  return r.channel === 'alarm' ? CHANNEL_ALARMS : CHANNEL_REMINDERS;
}

type ScheduleRequest = Notifications.NotificationRequestInput;

/** Build the OS notification requests for one reminder. */
export function buildRequests(r: Reminder, now = new Date()): ScheduleRequest[] {
  if (r.done) return [];
  const start = effectiveDate(r);
  const channelId = channelFor(r);
  const T = Notifications.SchedulableTriggerInputTypes;

  if (r.repeat === 'none') {
    const leads = r.leadMinutes.length ? r.leadMinutes : [0];
    return leads
      .map((lead) => ({ lead, at: new Date(start.getTime() - lead * 60_000) }))
      .filter(({ at }) => at > now)
      .map(({ lead, at }) => ({
        content: content(r, start, lead),
        trigger: { type: T.DATE, date: at, channelId },
      }));
  }

  // A repeating trigger fires at the next matching time after now. If the series
  // starts more than one period from now, schedule only the first occurrence; the
  // next sync (on app launch) sets up the repeating trigger once it has started.
  if (start.getTime() - now.getTime() > REPEAT_PERIOD_MS[r.repeat]) {
    return [{ content: content(r, start, 0), trigger: { type: T.DATE, date: start, channelId } }];
  }

  const hour = start.getHours();
  const minute = start.getMinutes();
  const base = content(r, start, 0);
  switch (r.repeat) {
    case 'daily':
      return [{ content: base, trigger: { type: T.DAILY, hour, minute, channelId } }];
    case 'weekdays':
      // expo-notifications weekdays run 1 (Sunday) to 7 (Saturday).
      return [2, 3, 4, 5, 6].map((weekday) => ({
        content: base,
        trigger: { type: T.WEEKLY, weekday, hour, minute, channelId },
      }));
    case 'weekly':
      return [{ content: base, trigger: { type: T.WEEKLY, weekday: start.getDay() + 1, hour, minute, channelId } }];
    case 'monthly':
      return [{ content: base, trigger: { type: T.MONTHLY, day: start.getDate(), hour, minute, channelId } }];
    case 'yearly':
      return [
        {
          content: base,
          trigger: { type: T.YEARLY, month: start.getMonth(), day: start.getDate(), hour, minute, channelId },
        },
      ];
  }
}

let syncChain: Promise<void> = Promise.resolve();
let syncQueued = false;

/**
 * Cancel and reschedule every notification from the saved reminders.
 * Calls made while a sync is running collapse into one follow-up sync.
 */
export function syncNotifications(): Promise<void> {
  if (syncQueued) return syncChain;
  syncQueued = true;
  syncChain = syncChain.then(async () => {
    syncQueued = false;
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return;
      await Notifications.cancelAllScheduledNotificationsAsync();
      const now = new Date();
      // iOS keeps at most 64 pending local notifications; schedule the soonest first.
      const requests = getState()
        .reminders.flatMap((r) => buildRequests(r, now))
        .sort((a, b) => triggerTime(a, now) - triggerTime(b, now))
        .slice(0, 60);
      for (const request of requests) {
        await Notifications.scheduleNotificationAsync(request);
      }
    } catch (error) {
      console.warn('Failed to schedule notifications', error);
    }
  });
  return syncChain;
}

function triggerTime(request: ScheduleRequest, now: Date): number {
  const trigger = request.trigger as { type?: string; date?: Date };
  if (trigger?.date instanceof Date) return trigger.date.getTime();
  // Repeating triggers fire within their period; put them near the front.
  return addDays(now, 1).getTime();
}

type AppRouter = ReturnType<typeof useRouter>;

function handleResponse(router: AppRouter, response: Notifications.NotificationResponse | null) {
  if (!response) return;
  const data = response.notification.request.content.data as { reminderId?: string; type?: string } | undefined;
  if (!data?.reminderId) return;
  const reminder = getState().reminders.find((r) => r.id === data.reminderId);
  if (reminder?.kind === 'message' && reminder.message) {
    void composeSms(reminder.message.phones, reminder.message.body);
    return;
  }
  router.navigate('/calendar');
}

/** Open the right screen when the user taps one of our notifications. */
export function useNotificationResponses() {
  const router = useRouter();
  useEffect(() => {
    handleResponse(router, Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      handleResponse(router, response)
    );
    return () => subscription.remove();
  }, [router]);
}
