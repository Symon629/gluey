import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CHANNEL_META } from '@/components/chat/chat-cards';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteReminder, updateReminder } from '@/lib/actions';
import { confirmAction } from '@/lib/confirm';
import { REPEAT_LABELS, formatTime, leadLabel } from '@/lib/dates';
import { composeSms, smsSupported } from '@/lib/messaging';
import type { Reminder } from '@/lib/types';

export function AgendaItem({ reminder, occurrence }: { reminder: Reminder; occurrence: Date }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const channel = CHANNEL_META[reminder.channel];
  const accent = reminder.kind === 'event' ? theme.accent : reminder.kind === 'message' ? theme.success : theme.warning;
  const repeating = reminder.repeat !== 'none';
  const meta = [
    repeating ? REPEAT_LABELS[reminder.repeat] : null,
    channel.label,
    !repeating && reminder.kind === 'event' ? reminder.leadMinutes.map(leadLabel).join(', ') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const onDelete = async () => {
    const ok = await confirmAction(
      repeating ? 'Delete this series?' : 'Delete reminder?',
      repeating ? `Every occurrence of "${reminder.title}" will be removed.` : `"${reminder.title}" will be removed.`
    );
    if (ok) deleteReminder(reminder.id);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.row}>
        <View style={[styles.bar, { backgroundColor: accent }]} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
          {reminder.allDay ? 'All day' : formatTime(occurrence)}
        </ThemedText>
        <View style={styles.body}>
          <ThemedText style={[styles.title, reminder.done && styles.done]} numberOfLines={2}>
            {reminder.title}
          </ThemedText>
          <View style={styles.metaRow}>
            <Icon name={repeating ? 'repeat' : channel.icon} size={12} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
              {meta}
            </ThemedText>
          </View>
        </View>
        <Icon name={open ? 'collapse' : 'expand'} size={14} color={theme.textSecondary} />
      </Pressable>
      {open ? (
        <View style={styles.actions}>
          {reminder.kind === 'message' && reminder.message && smsSupported ? (
            <Button
              label="Send now"
              icon="sms"
              variant="secondary"
              onPress={() => void composeSms(reminder.message!.phones, reminder.message!.body)}
              style={styles.action}
            />
          ) : null}
          {!repeating ? (
            <Button
              label={reminder.done ? 'Mark not done' : 'Mark done'}
              icon="check"
              variant="secondary"
              onPress={() => updateReminder(reminder.id, { done: !reminder.done })}
              style={styles.action}
            />
          ) : null}
          <Button label="Delete" icon="trash" variant="danger" onPress={onDelete} style={styles.action} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: Spacing.three,
    gap: Spacing.three,
  },
  bar: {
    width: 4,
    alignSelf: 'stretch',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  time: {
    width: 70,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 600,
  },
  done: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: 12,
  },
  action: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
  },
});
