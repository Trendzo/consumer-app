// CATEGORY ZOOM — hero morph from a Home category tile.
// Tap a bento category card and, in ONE continuous 520ms move:
//   • the grey square tile expands, its corners rounding as it grows, and
//     glides up-right until it settles as a huge pastel DOME bleeding off the
//     top of the screen (square → circle morph),
//   • the category PNG rides along and settles centred on the dome,
//   • a white sheet fades in underneath, wiping Home away,
//   • the category's products fade up below the dome.
// Back reverses the whole thing — the dome shrinks back into the tile.
//
// Jitter-free by construction: a SINGLE progress shared value drives every
// layer via transforms + opacity only (no layout props animate), the timing
// curve is one inOut-cubic (no springs to fight), and the product grid mounts
// only AFTER the morph completes so no JS work lands mid-flight.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StatusBar, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withTiming, interpolate, interpolateColor, Easing, runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, T, SP } from '../theme/brutal';
import { CachedImage, ProductCard, CARD } from '../components/Brutal';
import { PRODUCTS } from '../data/mockData';
import type { Product } from '../data/mockData';

const { width: W, height: H } = Dimensions.get('window');

// ── Final geometry ──────────────────────────────────────────────────
// Dome: a circle so large it bleeds off the top/left/right — on screen you
// see a full-width pastel dome with a softly rounded bottom edge (ref shot 4).
const D = Math.round(W * 1.55);           // dome diameter — a little smaller
const BLOB_CX = Math.round(W * 0.80);     // dome centre — tucked top-RIGHT
const BLOB_CY = Math.round(H * 0.05);
const BLOB_BOTTOM = BLOB_CY + D / 2;      // where the dome's bottom edge lands
// PNG: settles centred on the dome.
const IMG_W = Math.round(W * 0.86);
const IMG_H = Math.round(IMG_W * 0.82);
const IMG_X = Math.round(W * 0.72 - IMG_W / 2); // biased right — sits on the dome
const IMG_Y = Math.round(H * 0.07);

const MS = 520;
const EASE = Easing.inOut(Easing.cubic);

// Loose keyword → catalog-category mapping so every tile shows relevant items.
const matcherFor = (label: string): ((p: Product) => boolean) => {
  const l = label.toLowerCase();
  if (/(denim|cargo|skirt|trouser|pant|jean)/.test(l)) return (p) => p.category === 'Bottomwear';
  if (/(sneaker|shoe|heel|boot)/.test(l)) return (p) => p.category === 'Footwear';
  if (/(bag|watch|accessor|jewel)/.test(l)) return (p) => p.category === 'Accessories';
  if (/dress/.test(l)) return (p) => p.category === 'Dresses';
  if (/(tee|tank|shirt|top|set|workwear|jacket|coat|hoodie)/.test(l)) return (p) => p.category === 'Topwear';
  return () => true;
};

type Frame = { x: number; y: number; w: number; h: number };

export default function CategoryZoomScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { label = 'Category', img, tint = '#E8A79A' } = route.params ?? {};
  const frame: Frame = route.params?._frame ?? { x: W / 2 - 60, y: H / 2 - 90, w: 120, h: 158 };

  // One progress value drives the whole choreography.
  const p = useSharedValue(0);
  const [ready, setReady] = useState(false); // product grid mounts after the morph
  const closing = useRef(false);

  useEffect(() => {
    p.value = withTiming(1, { duration: MS, easing: EASE }, (fin) => {
      if (fin) runOnJS(setReady)(true);
    });
  }, []);

  const goBack = () => {
    if (closing.current) return;
    closing.current = true;
    // Close settles HARD: the curve ACCELERATES into the landing (no
    // decelerating tail), so the instant the card reaches the tile it IS the
    // tile — zero slow-motion settling at the end.
    const CLOSE_MS = 280;
    const CLOSE_EASE = Easing.bezier(0.5, 0, 0.9, 1);
    // If the page was scrolled, the dome/png positions carry -scrollY — tween
    // it back to 0 IN SYNC with the reverse flight, otherwise the card lands
    // `scroll` pixels too high (parked over the search bar) and then snaps.
    scrollY.value = withTiming(0, { duration: CLOSE_MS, easing: CLOSE_EASE });
    // NOTE: the grid stays MOUNTED during the reverse flight — unmounting it
    // here caused a JS hitch that delayed the animation (dome parked at full
    // size, then snapped). It simply fades out with the same progress value.
    p.value = withTiming(0, { duration: CLOSE_MS, easing: CLOSE_EASE }, (fin) => {
      if (fin) runOnJS(nav.goBack)();
    });
  };

  // Scroll offset — the dome, PNG and header all ride the scroll 1:1 so the
  // hero area scrolls away naturally instead of staying pinned.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  // ── DOME — rendered at FINAL size; flies/scales from the tile rect.
  // Scaling a fixed-size view (instead of animating width/height) keeps the
  // whole morph on the UI thread with zero layout passes.
  // The tile's grey box only fills the BOTTOM 78% of the card (the model's
  // head rises above it), so the blob departs from / lands on that exact
  // sub-rect — the handoff to the real card is pixel-perfect, no square pop.
  const greyY = frame.y + frame.h * 0.22;
  const greyH = frame.h * 0.78;
  const blobStyle = useAnimatedStyle(() => {
    const s = p.value;
    return {
      transform: [
        { translateX: interpolate(s, [0, 1], [frame.x + frame.w / 2 - BLOB_CX, 0]) },
        { translateY: interpolate(s, [0, 1], [greyY + greyH / 2 - BLOB_CY, 0]) - scrollY.value },
        { scaleX: interpolate(s, [0, 1], [frame.w / D, 1]) },
        { scaleY: interpolate(s, [0, 1], [greyH / D, 1]) },
      ],
      // Rounding collapses EARLY near the tile end of the flight, so on the
      // way back the card reads square well before it lands (no round→square
      // snap at touchdown), while still blooming to a full circle up top.
      borderRadius: interpolate(s, [0, 0.12, 0.55, 1], [0, D * 0.015, D * 0.22, D / 2]),
      backgroundColor: '#f1f1f1', // stays the tile grey — no colour morph
    };
  });

  // ── PNG — rides from the tile to centre-stage on the dome (uniform scale).
  // Start scale matches the tile's RENDERED image (height-fit inside the tall
  // card), so the cutout never pops smaller at takeoff — it leaves the card at
  // its exact current size and glides up-right, growing gently on the way.
  const imgStyle = useAnimatedStyle(() => {
    const s = p.value;
    const s0 = frame.h / IMG_H;
    return {
      transform: [
        { translateX: interpolate(s, [0, 1], [frame.x + frame.w / 2 - (IMG_X + IMG_W / 2), 0]) },
        { translateY: interpolate(s, [0, 1], [frame.y + frame.h / 2 - (IMG_Y + IMG_H / 2), 0]) - scrollY.value },
        { scale: interpolate(s, [0, 1], [s0, 1]) },
      ],
    };
  });

  // ── White sheet under everything — wipes Home away early in the flight.
  // Wipes Home out FAST (fully white by 30% of the flight) so the sticky
  // search bar / header underneath is gone before the card climbs past it —
  // the flight never reads as crossing "over" Home chrome.
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.3, 1], [0, 1, 1]),
  }));

  // ── Header + content fade in on the back half.
  const chromeStyle = useAnimatedStyle(() => ({
    // Fades in on the back half of the flight, then rides the scroll away
    // with the dome it sits on.
    opacity: interpolate(p.value, [0.55, 1], [0, 1]),
    transform: [{ translateY: -scrollY.value }],
  }));
  // A pinned ink back button takes over once the dome has scrolled away, so
  // there's always a visible way back on the white page.
  const pinnedBackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [BLOB_BOTTOM * 0.35, BLOB_BOTTOM * 0.7], [0, 1]),
  }));
  // Big faded wordmark on the dome, BEHIND the png — same treatment as the
  // Try & Buy band (huge Inter_900Black, tone-on-tone grey).
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.45, 1], [0, 1]),
    transform: [{ translateY: -scrollY.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.55, 1], [0, 1]),
    transform: [{ translateY: interpolate(p.value, [0.55, 1], [36, 0]) }],
  }));

  const products = useMemo(() => {
    const list = PRODUCTS.filter(matcherFor(label));
    return list.length ? list : PRODUCTS;
  }, [label]);

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <StatusBar barStyle="dark-content" />

      {/* 1 · white sheet (fades Home out) */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' }, sheetStyle]} />

      {/* 2 · products — scroll UNDER the dome */}
      <Animated.View style={[{ flex: 1 }, contentStyle]} pointerEvents={ready ? 'auto' : 'none'}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: BLOB_BOTTOM + SP.l, paddingBottom: 120, paddingHorizontal: SP.l }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: SP.m }}>
            <Text style={[T.h2, { textTransform: 'uppercase', flex: 1 }]} numberOfLines={1}>{label}</Text>
            <Text style={[T.caption, { color: C.dim }]}>{products.length} styles</Text>
          </View>
          {ready && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
              {products.map((prod) => (
                <ProductCard key={prod.id} p={prod} style={{ marginBottom: SP.s, width: CARD.w }} />
              ))}
            </View>
          )}
        </Animated.ScrollView>
      </Animated.View>

      {/* 3 · the morphing dome */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: BLOB_CX - D / 2, top: BLOB_CY - D / 2, width: D, height: D }, blobStyle]}
      />

      {/* 3.5 · giant faded wordmark on the dome — behind the png */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: Math.round(H * 0.085), left: SP.m, right: SP.m }, wordmarkStyle]}>
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{ fontFamily: 'Inter_900Black', fontSize: 84, letterSpacing: -1, color: '#A6A6A6', textTransform: 'uppercase', textAlign: 'center' }}
        >
          {label}
        </Text>
      </Animated.View>

      {/* 4 · the category PNG riding the dome */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: IMG_X, top: IMG_Y, width: IMG_W, height: IMG_H }, imgStyle]}>
        <CachedImage source={img} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </Animated.View>

      {/* 5 · header chrome — back + label over the dome */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 54, paddingHorizontal: SP.l, flexDirection: 'row', alignItems: 'center' }, chromeStyle]}>
        <Pressable onPress={goBack} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      {/* 6 · pinned ink back — appears once the dome has scrolled away */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, paddingTop: 54, paddingLeft: SP.l }, pinnedBackStyle]}>
        <Pressable onPress={goBack} hitSlop={12} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-left" size={22} color={C.ink} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
