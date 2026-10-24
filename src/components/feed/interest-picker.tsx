import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { KeyboardAwareScrollView } from '@/components/keyboard';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, IconButton } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { STARTER_TOPICS } from '@/lib/news';
import type { Topic } from '@/lib/types';

const NEW_TOPIC_WEIGHT = 3;

export function InterestPicker({
  initial,
  onDone,
  onCancel,
}: {
  initial: Topic[];
  onDone: (topics: Topic[]) => void;
  onCancel?: () => void;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<string[]>(() => initial.filter((t) => t.weight > 0).map((t) => t.name));
  const [custom, setCustom] = useState('');
  const options = [...new Set([...STARTER_TOPICS, ...initial.map((t) => t.name), ...selected])];

  const toggle = (name: string) =>
    setSelected((current) => (current.includes(name) ? current.filter((n) => n !== name) : [...current, name]));

  const addCustom = () => {
    const name = custom.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const existing = options.find((o) => o.toLowerCase() === name.toLowerCase());
    const finalName = existing ?? name;
    if (!selected.includes(finalName)) setSelected((s) => [...s, finalName]);
    setCustom('');
  };

  const save = () => {
    const previous = new Map(initial.map((t) => [t.name, t.weight]));
    onDone(selected.map((name) => ({ name, weight: previous.get(name) || NEW_TOPIC_WEIGHT })));
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={Spacing.four}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <ThemedText type="subtitle" style={styles.title}>
            What do you want to hear about?
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Pick a few topics. Tap more or less on stories and I&apos;ll learn what you like.
          </ThemedText>
        </View>
        {onCancel ? <IconButton icon="close" label="Close" onPress={onCancel} /> : null}
      </View>

      <View style={styles.chips}>
        {options.map((name) => (
          <Chip key={name} label={name} selected={selected.includes(name)} onPress={() => toggle(name)} />
        ))}
      </View>

      <View style={[styles.customRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          onSubmitEditing={addCustom}
          placeholder="Add your own, like “Bangladesh cricket”"
          placeholderTextColor={theme.textSecondary}
          style={[styles.customInput, { color: theme.text }]}
          returnKeyType="done"
          accessibilityLabel="Custom topic"
        />
        <IconButton icon="plus" label="Add topic" tone="accent" onPress={addCustom} disabled={!custom.trim()} />
      </View>

      <Button
        label={selected.length ? `Show my feed (${selected.length})` : 'Pick at least one topic'}
        onPress={save}
        disabled={!selected.length}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: Spacing.two,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  customInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
});
