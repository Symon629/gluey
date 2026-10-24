import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AgendaItem } from '@/components/calendar/agenda-item';
import { MonthGrid, gridStart, type DayMarker } from '@/components/calendar/month-grid';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, IconButton } from '@/components/ui/buttons';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { addDays, addMonths, dateKey, formatMonth, occurrencesBetween, startOfDay } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { Reminder } from '@/lib/types';

type Occurrence = { reminder: Reminder; date: Date };

export default function CalendarScreen() {
  const router = useRouter();
  const reminders = useStore((s) => s.reminders);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  const byDay = useMemo(() => {
    const from = gridStart(month);
    const to = addDays(from, 42);
    const map = new Map<string, Occurrence[]>();
    for (const reminder of reminders) {
      for (const date of occurrencesBetween(reminder, from, to)) {
        const key = dateKey(date);
        const list = map.get(key) ?? [];
        list.push({ reminder, date });
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(b.reminder.allDay) - Number(a.reminder.allDay) || a.date.getTime() - b.date.getTime());
    }
    return map;
  }, [reminders, month]);

  const markers = useMemo(() => {
    const map = new Map<string, DayMarker[]>();
    for (const [key, list] of byDay) map.set(key, list.map((o) => o.reminder.kind));
    return map;
  }, [byDay]);

  const selectedItems = byDay.get(dateKey(selected)) ?? [];

  const goToday = () => {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(startOfDay(today));
  };

  const selectDay = (day: Date) => {
    setSelected(day);
    if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  return (
    <Screen>
      <ScreenHeader
        title="Calendar"
        subtitle={formatMonth(month)}
        right={
          <>
            <IconButton icon="chevronLeft" label="Previous month" onPress={() => setMonth(addMonths(month, -1))} />
            <Chip label="Today" onPress={goToday} />
            <IconButton icon="chevronRight" label="Next month" onPress={() => setMonth(addMonths(month, 1))} />
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <MonthGrid month={month} selected={selected} markers={markers} onSelect={selectDay} />
        <View style={styles.dayHeader}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dayTitle}>
            {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </ThemedText>
        </View>
        {selectedItems.length ? (
          <View style={styles.list}>
            {selectedItems.map(({ reminder, date }) => (
              <AgendaItem key={`${reminder.id}-${date.getTime()}`} reminder={reminder} occurrence={date} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyDay}>
            <ThemedText themeColor="textSecondary">Nothing planned.</ThemedText>
            <Button label="Add something in Chat" variant="secondary" icon="sparkles" onPress={() => router.navigate('/')} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  dayHeader: {
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  dayTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    gap: Spacing.two,
  },
  emptyDay: {
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
