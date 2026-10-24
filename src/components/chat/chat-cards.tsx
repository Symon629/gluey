import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { describeWhen, leadLabel } from '@/lib/dates';
import { preview } from '@/lib/notes';
import { useStore } from '@/lib/store';
import type { Channel, ChatCard } from '@/lib/types';
import { useTheme } from '@/hooks/use-theme';

export const CHANNEL_META: Record<Channel, { label: string; icon: IconName }> = {
  notification: { label: 'Notification', icon: 'bell' },
  alarm: { label: 'Alarm', icon: 'alarm' },
  sms: { label: 'Text message', icon: 'sms' },
  call: { label: 'Phone call', icon: 'call' },
};

function ReminderCard({ id }: { id: string }) {
  const router = useRouter();
  const theme = useTheme();
  const reminder = useStore((s) => s.reminders.find((r) => r.id === id));
  if (!reminder) {
    return (
      <View style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          This reminder was deleted.
        </ThemedText>
      </View>
    );
  }
  const channel = CHANNEL_META[reminder.channel];
  const icon: IconName = reminder.kind === 'event' ? 'event' : reminder.kind === 'message' ? 'sms' : 'task';
  const leads =
    reminder.repeat === 'none' && reminder.kind === 'event' ? reminder.leadMinutes.map(leadLabel).join(', ') : null;
  return (
    <Pressable
      onPress={() => router.navigate('/calendar')}
      accessibilityRole="button"
      accessibilityHint="Opens the calendar"
      style={({ pressed }) => [
        styles.card,
        { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundSelected : theme.background },
      ]}>
      <View style={styles.cardTitleRow}>
        <Icon name={icon} size={16} color={theme.accent} />
        <ThemedText type="smallBold" style={styles.flex} numberOfLines={2}>
          {reminder.title}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {describeWhen(reminder)}
      </ThemedText>
      <View style={styles.metaRow}>
        <Icon name={channel.icon} size={13} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {channel.label}
          {leads ? ` · ${leads}` : ''}
        </ThemedText>
      </View>
      <ThemedText type="small" style={{ color: theme.accent }}>
        View in Calendar
      </ThemedText>
    </Pressable>
  );
}

function NoteCard({ id, appended }: { id: string; appended: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const note = useStore((s) => s.notes.find((n) => n.id === id));
  const parent = useStore((s) => (note?.parentId ? s.notes.find((n) => n.id === note.parentId) : undefined));
  if (!note) {
    return (
      <View style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          This note was deleted.
        </ThemedText>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push(`/notes/${note.id}`)}
      accessibilityRole="button"
      accessibilityHint="Opens the note"
      style={({ pressed }) => [
        styles.card,
        { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundSelected : theme.background },
      ]}>
      <View style={styles.cardTitleRow}>
        <Icon name="note" size={16} color={theme.accent} />
        <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
          {note.title}
        </ThemedText>
      </View>
      {parent ? (
        <ThemedText type="small" themeColor="textSecondary">
          Inside {parent.title}
        </ThemedText>
      ) : null}
      {note.content ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={appended ? 4 : 2}>
          {appended ? note.content.split('\n').slice(-4).join('\n') : preview(note)}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

export function ChatCardView({ card }: { card: ChatCard }) {
  return card.kind === 'reminder' ? (
    <ReminderCard id={card.reminderId} />
  ) : (
    <NoteCard id={card.noteId} appended={card.appended} />
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.two,
    padding: 12,
    gap: Spacing.one,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minWidth: 220,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  flex: {
    flex: 1,
  },
});
