import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Composer({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const canSend = text.trim().length > 0 && !disabled;

  const send = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View style={[styles.container, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: theme.backgroundElement, borderColor: focused ? theme.accent : theme.border },
        ]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }, Platform.OS === 'web' && styles.webInput]}
          // On web a multi-line field neither grows nor submits on Enter, so use a single line there.
          multiline={Platform.OS !== 'web'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={2000}
          submitBehavior="submit"
          onSubmitEditing={send}
          returnKeyType="send"
          accessibilityLabel="Message"
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[styles.send, { backgroundColor: canSend ? theme.accent : theme.backgroundSelected }]}>
          <Icon name="send" size={18} color={canSend ? theme.accentContrast : theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: Radius.large + 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    maxHeight: 120,
    paddingTop: 7,
    paddingBottom: 7,
  },
  webInput: {
    // The wrapper's border shows focus instead of the browser outline.
    outlineWidth: 0,
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
