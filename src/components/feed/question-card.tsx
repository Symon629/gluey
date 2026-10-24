import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function QuestionCard({
  question,
  yesLabel,
  noLabel,
  onYes,
  onNo,
}: {
  question: string;
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
  onNo: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
      <View style={styles.row}>
        <Icon name="sparkles" size={16} color={theme.accent} />
        <ThemedText style={styles.question}>{question}</ThemedText>
      </View>
      <View style={styles.row}>
        <Button label={yesLabel} onPress={onYes} style={styles.button} />
        <Button label={noLabel} variant="secondary" onPress={onNo} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  question: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 600,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
  },
});
