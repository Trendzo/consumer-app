// Shared-element zoom for product cards → detail page.
//
// OPEN runs inside ProductDetail (its white bg covers the home, image expands, content
// fades in — no Modal handoff). CLOSE runs HERE, over the home: we pop first so the home
// is visible, then fly the image from the gallery slot back down into the card.

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { Animated, Easing, Dimensions, View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { StackActions } from '@react-navigation/native';
import { C, HEADER_TOP } from '../theme/brutal';

const { width: W } = Dimensions.get('window');
const TARGET = { x: 0, y: HEADER_TOP + 47, w: W, h: W * 1.2 }; // gallery slot (matches ProductDetail's derived SLOT)
const TCX = TARGET.x + TARGET.w / 2;
const TCY = TARGET.y + TARGET.h / 2;
const ZOOM_MS = 440;

type Frame = { x: number; y: number; w: number; h: number };

type ZoomApi = {
  openZoom: (ref: React.RefObject<any> | any, uri: string | number, product: any, params?: any) => void;
  closeZoom: (frame?: Frame, uri?: string | number) => void;
  /** Measure a node's frame NORMALISED to this provider's root — the same
      coordinate space every fullscreen zoom screen lays out in. Raw
      measureInWindow y may or may not include the status bar depending on the
      Android device/OS (the exact bug that made hero-morphs take off a
      status-bar height above the tapped card); subtracting the root's own
      window position removes the ambiguity. cb(null) when unmeasurable. */
  measureToRoot: (node: any, cb: (f: Frame | null) => void) => void;
  /** Same correction for an ALREADY-measured window frame. */
  rebaseFrame: (frame: Frame, cb: (f: Frame) => void) => void;
};

const ZoomCtx = createContext<ZoomApi>({ openZoom: () => {}, closeZoom: () => {}, measureToRoot: (_n, cb) => cb(null), rebaseFrame: (f, cb) => cb(f) });
export const useZoom = () => useContext(ZoomCtx);

export function useZoomCard() {
  const { openZoom } = useZoom();
  const ref = useRef<any>(null);
  const open = useCallback((uri: string | number, product: any, params?: any) => openZoom(ref, uri, product, params), [openZoom]);
  return { ref, open };
}

export function ZoomProvider({ navRef, children }: { navRef: any; children: React.ReactNode }) {
  const [sess, setSess] = useState<{ uri: string | number; frame: Frame } | null>(null);
  const rootRef = useRef<View>(null);
  const t = useRef(new Animated.Value(1)).current;  // 1 = gallery slot, 0 = card
  const op = useRef(new Animated.Value(0)).current;
  const bgOp = useRef(new Animated.Value(0)).current;
  const closePending = useRef(false);

  const openZoom = useCallback((ref: any, uri: string | number, product: any, params?: any) => {
    if (!navRef?.isReady?.()) return;
    const go = (frame?: Frame) => {
      const payload = { product, _zoom: !!frame, _cardFrame: frame, ...(params || {}) };
      if (navRef.getCurrentRoute?.()?.name === 'ProductDetail') navRef.dispatch(StackActions.push('ProductDetail', payload));
      else navRef.navigate('ProductDetail', payload);
    };
    // The card is measured RELATIVE TO THIS PROVIDER'S ROOT via measureLayout —
    // both fly overlays (here and in ProductDetail) lay out in that same space,
    // so there is no window-origin ambiguity at all. The previous approach
    // (measureInWindow + re-basing on the root's window position) kept breaking
    // on Android: whether "window" includes the status bar varies by device,
    // OS version and window type, which is exactly the class of bug that made
    // the close-fly land a status-bar height above the real card.
    // Window coords for BOTH the card and this provider's root, subtracted —
    // that normalizes away the status-bar/window-origin ambiguity that made
    // the fly start and land offset on Android. Everything here uses only
    // measureInWindow, which works on every runtime (measureLayout does not —
    // it hard-errors in some environments and the product never opened).
    const node = ref?.current ?? ref;
    if (!node?.measureInWindow) { go(undefined); return; }
    // ONE navigation per tap, whichever path gets there first. In RELEASE builds
    // Fabric can flatten/detach a view that debug kept, and measureInWindow on a
    // dead node never calls back — the tap did NOTHING and the user had to tap
    // again (and again). The timer below guarantees the product still opens
    // (plain, no zoom) within ~120ms even if every measure callback is dead.
    let done = false;
    const goOnce = (frame?: Frame) => { if (done) return; done = true; clearTimeout(failsafe); go(frame); };
    const failsafe = setTimeout(() => goOnce(undefined), 120);
    const goLocal = (x: number, y: number, w: number, h: number) => {
      const root = rootRef.current as any;
      if (!root?.measureInWindow) { goOnce({ x, y, w, h }); return; }
      root.measureInWindow((rx: number, ry: number) => goOnce({ x: x - rx, y: y - ry, w, h }));
    };
    // measureInWindow can return 0×0 on the first try inside a scroll list —
    // retry once next frame so the card still zooms instead of opening plain.
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (w && h) { goLocal(x, y, w, h); return; }
      requestAnimationFrame(() =>
        node.measureInWindow((x2: number, y2: number, w2: number, h2: number) =>
          w2 && h2 ? goLocal(x2, y2, w2, h2) : goOnce(undefined)));
    });
  }, [navRef]);

  const measureToRoot = useCallback((node: any, cb: (f: Frame | null) => void) => {
    const n = node?.current ?? node;
    if (!n?.measureInWindow) { cb(null); return; }
    let done = false;
    const once = (f: Frame | null) => { if (done) return; done = true; clearTimeout(dead); cb(f); };
    // Same dead-callback failsafe as openZoom — a flattened/detached node in a
    // release build must degrade to "no zoom", never to a tap that does nothing.
    const dead = setTimeout(() => once(null), 120);
    n.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (!w || !h) { once(null); return; }
      const root = rootRef.current as any;
      if (!root?.measureInWindow) { once({ x, y, w, h }); return; }
      root.measureInWindow((rx: number, ry: number) => once({ x: x - rx, y: y - ry, w, h }));
    });
  }, []);

  const rebaseFrame = useCallback((frame: Frame, cb: (f: Frame) => void) => {
    const root = rootRef.current as any;
    if (!root?.measureInWindow) { cb(frame); return; }
    root.measureInWindow((rx: number, ry: number) => cb({ ...frame, x: frame.x - rx, y: frame.y - ry }));
  }, []);

  const closeZoom = useCallback((frame?: Frame, uri?: string | number) => {
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
    <ZoomCtx.Provider value={{ openZoom, closeZoom, measureToRoot, rebaseFrame }}>
      <View ref={rootRef} collapsable={false} style={styles.root}>
        {children}
        {f && (
          <View pointerEvents="none" style={styles.overlay}>
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.white, opacity: bgOp }} />
            <Animated.View
              pointerEvents="none"
              // Android: rasterize the flying image once and move the texture
              // on the GPU — matches the buttery iOS close-fly frame-for-frame.
              renderToHardwareTextureAndroid
              style={{
                position: 'absolute',
                left: TARGET.x,
                top: TARGET.y,
                width: TARGET.w,
                height: TARGET.h,
                backgroundColor: C.white,
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
              <ExpoImage source={typeof sess!.uri === 'number' ? sess!.uri : { uri: sess!.uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" cachePolicy="memory-disk" transition={0} />
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
