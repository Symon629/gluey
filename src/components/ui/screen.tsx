import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Edges = { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };

/**
 * Full-screen container for a tab. Native tabs leave inset handling to us
 * (disableAutomaticContentInsets), and this view pads for the status bar and tab bar.
 */
export function Screen({
  children,
  edges = { top: true, bottom: true, left: true, right: true },
  style,
}: {
  children: ReactNode;
  edges?: Edges;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.inner, style]}>{children}</View>
    </SafeAreaView>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <ThemedText style={styles.title} accessibilityRole="header">
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
  },
});
