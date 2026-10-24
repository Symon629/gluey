import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function IconButton({
  icon,
  onPress,
  label,
  size = 20,
  disabled,
  tone = 'default',
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  disabled?: boolean;
  tone?: 'default' | 'accent' | 'danger';
}) {
  const theme = useTheme();
  const color = tone === 'accent' ? theme.accent : tone === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? theme.backgroundSelected : 'transparent', opacity: disabled ? 0.4 : 1 },
      ]}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  selected,
  disabled,
  icon,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.accent : pressed ? theme.backgroundSelected : theme.backgroundElement,
          opacity: disabled ? 0.5 : 1,
        },
      ]}>
      {icon ? <Icon name={icon} size={14} color={selected ? theme.accentContrast : theme.text} /> : null}
      <ThemedText type="small" style={{ color: selected ? theme.accentContrast : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const background =
    variant === 'primary' ? theme.accent : variant === 'danger' ? theme.danger : theme.backgroundElement;
  const foreground = variant === 'secondary' ? theme.text : theme.accentContrast;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: theme.border },
        style,
      ]}>
      {loading ? <ActivityIndicator color={foreground} /> : null}
      {!loading && icon ? <Icon name={icon} size={16} color={foreground} /> : null}
      <ThemedText style={[styles.buttonLabel, { color: foreground }]}>{label}</ThemedText>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: 14,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    borderRadius: Radius.pill,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 600,
  },
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
  },
});
