import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { KeyboardAwareScrollView } from '@/components/keyboard';
import { ThemedText } from '@/components/themed-text';
import { Button, IconButton } from '@/components/ui/buttons';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createNote, deleteNote, updateNote } from '@/lib/actions';
import { confirmAction } from '@/lib/confirm';
import { ancestors, childrenOf, descendantIds, preview } from '@/lib/notes';
import { useStore } from '@/lib/store';

export default function NoteScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useStore((s) => s.notes.find((n) => n.id === id));
  const notes = useStore((s) => s.notes);

  if (!note) {
    return (
      <Screen edges={{ bottom: true }}>
        <Stack.Screen options={{ title: 'Note' }} />
        <View style={styles.missing}>
          <ThemedText themeColor="textSecondary">This note no longer exists.</ThemedText>
          <Button label="Back to notes" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const path = ancestors(notes, note.id);
  const children = childrenOf(notes, note.id);

  const onDelete = async () => {
    const nested = descendantIds(notes, note.id).length;
    const message = nested
      ? `"${note.title}" and the ${nested} note${nested === 1 ? '' : 's'} inside it will be deleted.`
      : `"${note.title}" will be deleted.`;
    if (await confirmAction('Delete note?', message)) {
      router.back();
      deleteNote(note.id);
    }
  };

  const addSubNote = () => {
    const child = createNote({ title: 'Untitled', parentId: note.id });
    router.push(`/notes/${child.id}`);
  };

  return (
    <Screen edges={{ bottom: true, left: true, right: true }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => <IconButton icon="trash" label="Delete note" tone="danger" onPress={onDelete} />,
        }}
      />
      {/* Scrolls the note so the line being typed stays above the keyboard. */}
      <KeyboardAwareScrollView
        bottomOffset={Spacing.four}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {path.length ? (
          <View style={styles.breadcrumbs}>
            {path.map((ancestor) => (
              <Link key={ancestor.id} href={`/notes/${ancestor.id}`} asChild>
                <Pressable accessibilityRole="link">
                  <ThemedText type="small" style={{ color: theme.accent }}>
                    {ancestor.title} /
                  </ThemedText>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : null}
        <TextInput
          key={`title-${note.id}`}
          defaultValue={note.title}
          onChangeText={(title) => updateNote(note.id, { title })}
          placeholder="Title"
          placeholderTextColor={theme.textSecondary}
          style={[styles.title, { color: theme.text }]}
          multiline
          submitBehavior="blurAndSubmit"
          accessibilityLabel="Note title"
        />
        <TextInput
          key={`content-${note.id}`}
          defaultValue={note.content}
          onChangeText={(content) => updateNote(note.id, { content })}
          placeholder="Start writing…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.body, { color: theme.text }]}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          accessibilityLabel="Note text"
        />

        <View style={[styles.section, { borderTopColor: theme.border }]}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            Inside this note
          </ThemedText>
          {children.map((child) => (
            <Link key={child.id} href={`/notes/${child.id}`} asChild>
              <Pressable
                accessibilityRole="link"
                style={({ pressed }) => [
                  styles.child,
                  { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement, borderColor: theme.border },
                ]}>
                <Icon name="subnote" size={14} color={theme.textSecondary} />
                <View style={styles.flex}>
                  <ThemedText style={styles.childTitle} numberOfLines={1}>
                    {child.title}
                  </ThemedText>
                  {child.content ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {preview(child)}
                    </ThemedText>
                  ) : null}
                </View>
                <Icon name="chevronRight" size={14} color={theme.textSecondary} />
              </Pressable>
            </Link>
          ))}
          <Button label="Add a note inside" icon="plus" variant="secondary" onPress={addSubNote} style={styles.addChild} />
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  breadcrumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
    paddingVertical: Spacing.one,
  },
  body: {
    fontSize: 17,
    lineHeight: 25,
    minHeight: 200,
    paddingVertical: Spacing.one,
  },
  section: {
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  child: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 12,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  childTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
  addChild: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
  },
});
