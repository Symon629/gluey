import { useMemo } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { Composer } from '@/components/chat/composer';
import { MessageBubble, TypingBubble } from '@/components/chat/message-bubble';
import { KeyboardAvoidingView } from '@/components/keyboard';
import { ThemedText } from '@/components/themed-text';
import { Chip, IconButton } from '@/components/ui/buttons';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useWindowTopOffset } from '@/hooks/use-window-top-offset';
import { clearChat } from '@/lib/actions';
import { chooseOption, sendUserText } from '@/lib/assistant/conversation';
import { confirmAction } from '@/lib/confirm';
import { useStore } from '@/lib/store';

const EXAMPLES = [
  'Remind me to shop for groceries at 10am tomorrow',
  "I have a doctor's appointment on 26 Nov 2026",
  'Take vitamins every day at 8am',
  'Create a note called Trip ideas: visit Kyoto in spring',
  'Add milk and eggs to my Groceries note',
  "Text Mom that I'm on my way",
];

export default function ChatScreen() {
  const messages = useStore((s) => s.messages);
  const pending = useStore((s) => s.pending);
  const busy = useStore((s) => s.assistantBusy);
  const mode = useStore((s) => s.assistantMode);
  const data = useMemo(() => [...messages].reverse(), [messages]);
  const { onLayout: onKeyboardAreaLayout, offset: keyboardOffset } = useWindowTopOffset();

  const onClear = async () => {
    if (await confirmAction('Clear chat?', 'Your reminders and notes stay. Only the conversation is removed.', 'Clear')) {
      clearChat();
    }
  };

  const subtitle =
    mode === 'local'
      ? 'Offline mode: basic requests only'
      : mode === 'ai'
        ? 'Powered by Claude'
        : 'Reminders, events, notes and texts';

  return (
    <Screen>
      <ScreenHeader
        title="Chat"
        subtitle={subtitle}
        right={messages.length ? <IconButton icon="trash" label="Clear chat" onPress={onClear} /> : null}
      />
      {/*
        The offset accounts for the status bar above this screen. Without it the keyboard
        covers the message box. (The library's automaticOffset option does the same job,
        but its native measurement fails on Android with React Native 0.88.)
      */}
      <KeyboardAvoidingView
        onLayout={onKeyboardAreaLayout}
        keyboardVerticalOffset={keyboardOffset}
        behavior="padding"
        style={styles.flex}>
        {messages.length === 0 ? (
          <ScrollView contentContainerStyle={styles.empty} keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              What can I help with?
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Tell me what to remember and I&apos;ll put it on your calendar, in your notes, or in a text.
            </ThemedText>
            <View style={styles.examples}>
              {EXAMPLES.map((example) => (
                <Chip key={example} label={example} onPress={() => void sendUserText(example)} />
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            inverted
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                choicesActive={pending?.promptId === item.id}
                disabled={busy}
                onChoose={(choice) => void chooseOption(choice)}
              />
            )}
            ListHeaderComponent={busy ? <TypingBubble /> : undefined}
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          />
        )}
        <Composer
          onSend={(text) => void sendUserText(text)}
          disabled={busy}
          placeholder={pending ? 'Type an answer or pick one above' : 'Ask me to remember something'}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  empty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  emptyTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 22,
  },
  examples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
