import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS: { name: string; href: '/' | '/feed' | '/calendar' | '/notes' | '/agents'; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Chat', icon: 'sms' },
  { name: 'feed', href: '/feed', label: 'Feed', icon: 'globe' },
  { name: 'calendar', href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { name: 'notes', href: '/notes', label: 'Notes', icon: 'note' },
  { name: 'agents', href: '/agents', label: 'Agents', icon: 'sparkles' },
];

/** Web layout: content on top, a bottom bar with the five tabs (as in the original sketch). */
export default function AppTabs() {
  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <BottomBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </BottomBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, icon, ref, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  const color = isFocused ? theme.accent : theme.textSecondary;
  return (
    <Pressable
      {...props}
      // expo-router types this ref as the View component, which React Native's strict
      // TypeScript API no longer accepts for an element ref. The runtime value is the same.
      ref={ref as ComponentProps<typeof Pressable>['ref']}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <Icon name={icon} size={20} color={color} />
      <ThemedText type="small" style={{ color }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

function BottomBar(props: TabListProps) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
      <View {...props} style={styles.barInner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  barInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  tab: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    minWidth: 64,
  },
  pressed: {
    opacity: 0.6,
  },
});
