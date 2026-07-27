// Hide-on-scroll for the floating bottom tab bar.
// Returns an onScroll handler you spread onto any ScrollView / FlatList: it
// watches scroll direction and drives the shared `tabBarOffset` (0 = shown,
// 1 = hidden). Scroll down → bar slides away; scroll up (or reach the top) →
// it comes back. Small deltas are ignored so it doesn't flicker.
import { useCallback, useRef } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { withTiming } from 'react-native-reanimated';
import { useApp } from '../state/AppState';

const THRESHOLD = 8; // px of travel before we react

export function useTabBarScroll() {
  const { tabBarOffset } = useApp();
  const lastY = useRef(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    if (y <= 4) {
      tabBarOffset.value = withTiming(0, { duration: 200 });
    } else if (dy > THRESHOLD) {
      tabBarOffset.value = withTiming(1, { duration: 220 }); // hide
    } else if (dy < -THRESHOLD) {
      tabBarOffset.value = withTiming(0, { duration: 200 }); // show
    }
    lastY.current = y;
  }, [tabBarOffset]);

  return { onScroll, scrollEventThrottle: 16 };
}
