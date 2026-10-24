import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

const ICONS = {
  send: { ios: 'arrow.up', material: 'arrow_upward' },
  trash: { ios: 'trash', material: 'delete' },
  plus: { ios: 'plus', material: 'add' },
  close: { ios: 'xmark', material: 'close' },
  chevronLeft: { ios: 'chevron.left', material: 'chevron_left' },
  chevronRight: { ios: 'chevron.right', material: 'chevron_right' },
  expand: { ios: 'chevron.down', material: 'expand_more' },
  collapse: { ios: 'chevron.up', material: 'expand_less' },
  calendar: { ios: 'calendar', material: 'calendar_month' },
  bell: { ios: 'bell', material: 'notifications' },
  alarm: { ios: 'alarm', material: 'alarm' },
  sms: { ios: 'message', material: 'sms' },
  call: { ios: 'phone', material: 'call' },
  repeat: { ios: 'repeat', material: 'repeat' },
  note: { ios: 'note.text', material: 'description' },
  subnote: { ios: 'arrow.turn.down.right', material: 'subdirectory_arrow_right' },
  thumbUp: { ios: 'hand.thumbsup', material: 'thumb_up' },
  thumbDown: { ios: 'hand.thumbsdown', material: 'thumb_down' },
  sparkles: { ios: 'sparkles', material: 'auto_awesome' },
  tune: { ios: 'slider.horizontal.3', material: 'tune' },
  check: { ios: 'checkmark.circle.fill', material: 'check_circle' },
  circle: { ios: 'circle', material: 'radio_button_unchecked' },
  search: { ios: 'magnifyingglass', material: 'search' },
  refresh: { ios: 'arrow.clockwise', material: 'refresh' },
  event: { ios: 'calendar.badge.clock', material: 'event' },
  task: { ios: 'checklist', material: 'task_alt' },
  globe: { ios: 'globe', material: 'public' },
  external: { ios: 'arrow.up.right.square', material: 'open_in_new' },
} as const satisfies Record<string, { ios: SFSymbol; material: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  const icon = ICONS[name];
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.material, web: icon.material }}
      size={size}
      tintColor={color}
      resizeMode="scaleAspectFit"
    />
  );
}
