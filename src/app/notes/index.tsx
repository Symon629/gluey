import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { NoteRow } from '@/components/notes/note-row';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/buttons';
import { Icon } from '@/components/ui/icon';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createNote } from '@/lib/actions';
import { childrenOf } from '@/lib/notes';
import { useStore } from '@/lib/store';
import type { Note } from '@/lib/types';

type Row = { note: Note; depth: number; childCount: number };

export default function NotesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const notes = useStore((s) => s.notes);
  const syncError = useStore((s) => s.syncError);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const countChildren = (id: string) => notes.filter((n) => n.parentId === id).length;
    if (q) {
      return notes
        .filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((note) => ({ note, depth: 0, childCount: countChildren(note.id) }));
    }
    const ids = new Set(notes.map((n) => n.id));
    const result: Row[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const level =
        parentId === null
          ? notes.filter((n) => n.parentId === null || !ids.has(n.parentId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          : childrenOf(notes, parentId);
      for (const note of level) {
        const childCount = countChildren(note.id);
        result.push({ note, depth, childCount });
        if (childCount && expanded[note.id]) walk(note.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }, [notes, query, expanded]);

  const addNote = () => {
    const note = createNote({ title: 'Untitled' });
    router.push(`/notes/${note.id}`);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Notes"
        subtitle={
          syncError ?? (notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : undefined)
        }
        right={<IconButton icon="plus" label="New note" tone="accent" size={22} onPress={addNote} />}
      />
      {notes.length ? (
        <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Icon name="search" size={16} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            clearButtonMode="while-editing"
            accessibilityLabel="Search notes"
          />
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.note.id}
        renderItem={({ item }) => (
          <NoteRow
            note={item.note}
            depth={item.depth}
            childCount={item.childCount}
            expanded={!!expanded[item.note.id]}
            onToggle={() => setExpanded((e) => ({ ...e, [item.note.id]: !e[item.note.id] }))}
          />
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {query
                ? 'No notes match your search.'
                : 'No notes yet. Tap + to write one, or ask in Chat: "Create a note called Ideas under Work".'}
            </ThemedText>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: 12,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.five,
  },
  empty: {
    paddingVertical: Spacing.five,
  },
  emptyText: {
    textAlign: 'center',
  },
});
