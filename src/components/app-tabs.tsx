import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();
  return (
    <NativeTabs
      backgroundColor={theme.background}
      indicatorColor={theme.backgroundSelected}
      tintColor={theme.accent}
      labelStyle={{ selected: { color: theme.text } }}
      labelVisibilityMode="labeled"
      disableTransparentOnScrollEdge>
      {/* Each screen pads for the status bar and tab bar itself (see components/ui/screen.tsx). */}
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="forum"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'newspaper', selected: 'newspaper.fill' }} md="newspaper" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notes" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'note.text', selected: 'note.text' }} md="sticky_note_2" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agents" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Agents</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" md="smart_toy" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
