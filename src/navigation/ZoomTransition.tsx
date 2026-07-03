// Shared-element zoom for product cards → detail page.
//
// OPEN runs inside ProductDetail (its white bg covers the home, image expands, content
// fades in — no Modal handoff). CLOSE runs HERE, over the home: we pop first so the home
// is visible, then fly the image from the gallery slot back down into the card.

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { Animated, Easing, Dimensions, View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { StackActions } from '@react-navigation/native';
import { C } from '../theme/brutal';

const { width: W } = Dimensions.get('window');
const TARGET = { x: 0, y: 105, w: W, h: W * 1.2 }; // gallery slot
const TCX = TARGET.x + TARGET.w / 2;
const TCY = TARGET.y + TARGET.h / 2;
const ZOOM_MS = 440;

type Frame = { x: number; y: number; w: number; h: number };

type ZoomApi = {
  openZoom: (ref: React.RefObject<any> | any, uri: string, product: any, params?: any) => void;
  closeZoom: (frame?: Frame, uri?: string) => void;
};

const ZoomCtx = createContext<ZoomApi>({ openZoom: () => {}, closeZoom: () => {} });
export const useZoom = () => useContext(ZoomCtx);

export function useZoomCard() {
  const { openZoom } = useZoom();
  const ref = useRef<any>(null);
  const open = useCallback((uri: string, product: any, params?: any) => openZoom(ref, uri, product, params), [openZoom]);
  return { ref, open };
}

export function ZoomProvider({ navRef, children }: { navRef: any; children: React.ReactNode }) {
  const [sess, setSess] = useState<{ uri: string; frame: Frame } | null>(null);
  const t = useRef(new Animated.Value(1)).current;  // 1 = gallery slot, 0 = card
  const op = useRef(new Animated.Value(0)).current;
  const bgOp = useRef(new Animated.Value(0)).current;
  const closePending = useRef(false);

  const openZoom = useCallback((ref: any, uri: string, product: any, params?: any) => {
    if (!navRef?.isReady?.()) return;
    const go = (frame?: Frame) => {
      const payload = { product, _zoom: !!frame, _cardFrame: frame, ...(params || {}) };
      if (navRef.getCurrentRoute?.()?.name === 'ProductDetail') navRef.dispatch(StackActions.push('ProductDetail', payload));
      else navRef.navigate('ProductDetail', payload);
    };
    const node = ref?.current ?? ref;
    if (!node?.measureInWindow) { go(undefined); return; }
    // measureInWindow can return 0×0 on the first try inside a scroll list — retry once on the
    // next frame so the card still zooms instead of silently falling back to a plain open.
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (w && h) { go({ x, y, w, h }); return; }
      requestAnimationFrame(() =>
        node.measureInWindow((x2: number, y2: number, w2: number, h2: number) =>
          go(w2 && h2 ? { x: x2, y: y2, w: w2, h: h2 } : undefined)));
    });
  }, [navRef]);

  const closeZoom = useCallback((frame?: Frame, uri?: string) => {
    if (!frame || !uri || !navRef?.isReady?.()) { navRef?.isReady?.() && navRef.goBack(); return; }
    setSess({ uri, frame });
    t.setValue(1);
    op.setValue(1);
    bgOp.setValue(1);
    closePending.current = true;
  }, [navRef, t, op, bgOp]);

  useEffect(() => {
    if (!sess || !closePending.current || !navRef?.isReady?.()) return;
    closePending.current = false;
    // Wait until the Modal overlay has painted, then pop and fly down over the real card.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      navRef.goBack();
      Animated.parallel([
        Animated.timing(t, { toValue: 0, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bgOp, { toValue: 0, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) { op.setValue(0); setSess(null); }
      });
    }));
  }, [sess, navRef, t, op, bgOp]);

  const f = sess?.frame;

  return (
    <ZoomCtx.Provider value={{ openZoom, closeZoom }}>
      <View style={styles.root}>
        {children}
        {f && (
          <View pointerEvents="none" style={styles.overlay}>
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.white, opacity: bgOp }} />
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: TARGET.x,
                top: TARGET.y,
                width: TARGET.w,
                height: TARGET.h,
                backgroundColor: C.hairline,
                overflow: 'hidden',
                opacity: op,
                transform: [
                  { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [f.x + f.w / 2 - TCX, 0] }) },
                  { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [f.y + f.h / 2 - TCY, 0] }) },
                  { scaleX: t.interpolate({ inputRange: [0, 1], outputRange: [f.w / TARGET.w, 1] }) },
                  { scaleY: t.interpolate({ inputRange: [0, 1], outputRange: [f.h / TARGET.h, 1] }) },
                ],
              }}
            >
              <ExpoImage source={{ uri: sess!.uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" cachePolicy="memory-disk" transition={0} />
            </Animated.View>
          </View>
        )}
      </View>
    </ZoomCtx.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
