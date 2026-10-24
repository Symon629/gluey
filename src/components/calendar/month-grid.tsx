import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, dateKey, isSameDay } from '@/lib/dates';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type DayMarker = 'event' | 'task' | 'message';

/** First cell of a 6-week grid (the Sunday on or before the 1st). */
export function gridStart(month: Date): Date {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  return addDays(first, -first.getDay());
}

export function MonthGrid({
  month,
  selected,
  markers,
  onSelect,
}: {
  month: Date;
  selected: Date;
  markers: Map<string, DayMarker[]>;
  onSelect: (day: Date) => void;
}) {
  const theme = useTheme();
  const today = new Date();
  const start = gridStart(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const markerColor = (marker: DayMarker) =>
    marker === 'event' ? theme.accent : marker === 'message' ? theme.success : theme.warning;

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map((label, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.weekday}>
            {label}
          </ThemedText>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, week) => (
        <View key={week} style={styles.row}>
          {days.slice(week * 7, week * 7 + 7).map((day) => {
            const inMonth = day.getMonth() === month.getMonth();
            const isSelected = isSameDay(day, selected);
            const isToday = isSameDay(day, today);
            const dayMarkers = markers.get(dateKey(day)) ?? [];
            return (
              <Pressable
                key={dateKey(day)}
                onPress={() => onSelect(day)}
                accessibilityRole="button"
                accessibilityLabel={`${day.toDateString()}${dayMarkers.length ? `, ${dayMarkers.length} items` : ''}`}
                accessibilityState={{ selected: isSelected }}
                style={styles.cell}>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: theme.accent },
                    !isSelected && isToday && { borderColor: theme.accent, borderWidth: 1.5 },
                  ]}>
                  <ThemedText
                    style={[
                      styles.dayNumber,
                      { color: isSelected ? theme.accentContrast : inMonth ? theme.text : theme.textSecondary },
                      !inMonth && styles.outside,
                    ]}>
                    {day.getDate()}
                  </ThemedText>
                </View>
                <View style={styles.dots}>
                  {dayMarkers.slice(0, 3).map((marker, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: markerColor(marker) }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: Spacing.one,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
    minHeight: 48,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
  },
  outside: {
    opacity: 0.45,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
