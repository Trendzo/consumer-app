// Live keyboard height, for UI that must sit above it.
//
// Why not KeyboardAvoidingView: a React Native <Modal> gets its OWN Android
// window, and that window does not inherit the activity's
// `windowSoftInputMode="adjustResize"`. So inside a Modal the layout is never
// resized, KeyboardAvoidingView has nothing to react to, and any sheet pinned to
// the bottom ends up underneath the keyboard. Measuring the keyboard directly and
// offsetting by it works in both windows and on both platforms.

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS reports `will*` ahead of the animation, so the sheet travels WITH the
    // keyboard instead of snapping after it. Android only emits `did*`.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvt, (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));

    // Covers the case where the keyboard is ALREADY open when this mounts —
    // e.g. a sheet opened from a screen that had a focused field.
    const metrics = Keyboard.metrics?.();
    if (metrics?.height) setHeight(metrics.height);

    return () => { show.remove(); hide.remove(); };
  }, []);

  return height;
}
