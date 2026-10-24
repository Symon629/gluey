import { StyleSheet, View } from 'react-native';

import { ChatCardView } from '@/components/chat/chat-cards';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage, Choice } from '@/lib/types';

export function MessageBubble({
  message,
  choicesActive,
  disabled,
  onChoose,
}: {
  message: ChatMessage;
  /** Only the latest open question accepts taps. */
  choicesActive: boolean;
  disabled: boolean;
  onChoose: (choice: Choice) => void;
}) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.accent, borderBottomRightRadius: Radius.small / 2 }
            : {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderBottomLeftRadius: Radius.small / 2,
              },
        ]}>
        <ThemedText selectable style={[styles.text, isUser && { color: theme.accentContrast }]}>
          {message.text}
        </ThemedText>
        {message.card ? <ChatCardView card={message.card} /> : null}
      </View>
      {message.choices?.length && choicesActive ? (
        <View style={styles.choices}>
          {message.choices.map((choice) => (
            <Chip
              key={choice.id}
              label={choice.label}
              disabled={disabled}
              onPress={() => onChoose(choice)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function TypingBubble() {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth * 2 },
        ]}>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          Thinking…
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: Spacing.one,
    maxWidth: '100%',
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.large,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 400,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    maxWidth: '95%',
  },
});
