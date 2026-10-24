/**
 * App colors for light and dark mode. Dark mode follows the original sketch:
 * near-black surfaces, white text and thin light borders.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0A0A0B',
    textSecondary: '#5F5F68',
    background: '#FFFFFF',
    backgroundElement: '#F2F2F4',
    backgroundSelected: '#E4E4E8',
    border: '#DCDCE0',
    accent: '#3557D6',
    accentContrast: '#FFFFFF',
    accentSoft: '#E6ECFF',
    danger: '#D93636',
    success: '#1F9D55',
    warning: '#B7791F',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    background: '#121212',
    backgroundElement: '#1E1E21',
    backgroundSelected: '#2A2A2F',
    border: '#3A3A40',
    accent: '#8EA8FF',
    accentContrast: '#0B0B0C',
    accentSoft: '#1E2640',
    danger: '#FF6B6B',
    success: '#4ADE80',
    warning: '#F6C453',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 14,
  large: 20,
  pill: 999,
} as const;

export const MaxContentWidth = 800;
