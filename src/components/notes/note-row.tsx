import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/buttons';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { preview } from '@/lib/notes';
import type { Note } from '@/lib/types';

export function NoteRow({
  note,
  depth,
  childCount,
  expanded,
  onToggle,
}: {
  note: Note;
  depth: number;
  childCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const text = preview(note);
  return (
    <View
      style={[
        styles.row,
        { marginLeft: depth * Spacing.four, backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {/* The expand button sits beside the row's main pressable, not inside it, so web gets no nested buttons. */}
      <Pressable
        onPress={() => router.push(`/notes/${note.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${note.title}${childCount ? `, ${childCount} sub-notes` : ''}`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <Icon name={depth > 0 ? 'subnote' : 'note'} size={16} color={theme.textSecondary} />
        <View style={styles.body}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {note.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {text || 'Empty note'}
            {childCount ? ` · ${childCount} inside` : ''}
          </ThemedText>
        </View>
      </Pressable>
      {childCount ? (
        <IconButton
          icon={expanded ? 'collapse' : 'expand'}
          label={expanded ? 'Hide sub-notes' : 'Show sub-notes'}
          size={16}
          onPress={onToggle}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
    paddingRight: Spacing.one,
    minHeight: 64,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingLeft: Spacing.three,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.6,
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
});
