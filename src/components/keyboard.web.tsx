import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type ViewProps } from 'react-native';

// react-native-keyboard-controller has no web build. Browsers resize the page
// for the on-screen keyboard themselves, so plain views are enough here.

export function KeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function KeyboardAvoidingView({
  behavior: _behavior,
  keyboardVerticalOffset: _offset,
  automaticOffset: _automaticOffset,
  ...props
}: ViewProps & { behavior?: string; keyboardVerticalOffset?: number; automaticOffset?: boolean }) {
  return <View {...props} />;
}

export function KeyboardAwareScrollView({
  bottomOffset: _bottomOffset,
  ...props
}: ScrollViewProps & { bottomOffset?: number }) {
  return <ScrollView {...props} />;
}
