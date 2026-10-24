import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Measures how far a view's parent sits from the top of the window, such as a
 * status bar inset or a header. Pass `offset` as a KeyboardAvoidingView's
 * `keyboardVerticalOffset`: the library compares the view's position relative to
 * its parent with the keyboard's position on screen, so without this the
 * keyboard covers the bottom of the view by that distance.
 */
export function useWindowTopOffset() {
  const [offset, setOffset] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const relativeY = event.nativeEvent.layout.y;
    const target = event.currentTarget;
    // Older renderers pass a numeric tag; web needs no offset. Both keep the default of 0.
    if (typeof target === 'number' || typeof target?.measureInWindow !== 'function') return;
    target.measureInWindow((_x, windowY) => {
      setOffset(Math.max(0, windowY - relativeY));
    });
  };

  return { onLayout, offset };
}
