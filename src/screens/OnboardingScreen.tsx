import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER } from '../theme/brutal';
import { BrutalButton } from '../components/Brutal';

const ONB1 = require('../../assets/onb1.jpeg');
const ONB2 = require('../../assets/onb2.jpeg');
const ONB3 = require('../../assets/onb3.jpeg');

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// LIGHT design language — image lives in a framed grey card in the upper
// region; copy + progress sit on white below it.
const CARD_MX = SP.l;
const CARD_W = width - CARD_MX * 2;
const CARD_H = Math.round(height * 0.5);

// ── Sub-components so hooks are never called inside .map() ──────────────────
function SlideImage({ slide, index, scrollX }: { slide: { img: any }; index: number; scrollX: Animated.SharedValue<number> }) {
  const bgStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (scrollX.value - (index - 1) * width) / width));
    const tx = (1 - p) * width;
    return { transform: [{ translateX: tx }] };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, left: 0, width: CARD_W, height: CARD_H, alignItems: 'center', justifyContent: 'center' },
        bgStyle,
      ]}
    >
      <Image source={slide.img} style={{ width: CARD_W, height: CARD_H }} resizeMode="cover" />
    </Animated.View>
  );
}

function NavDot({ index, scrollX }: { index: number; scrollX: Animated.SharedValue<number> }) {
  const dotStyle = useAnimatedStyle(() => {
    const w = interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [8, 28, 8],
      Extrapolation.CLAMP,
    );
    const op = interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0.3, 1, 0.3],
      Extrapolation.CLAMP,
    );
    return { width: w, opacity: op };
  });
  return <Animated.View style={[styles.dot, dotStyle]} />;
}

const SLIDES = [
  {
    kicker: 'Delivery',
    title: 'Fashion\nin an hour',
    body: 'Local boutiques, designer drops, and the trends you crave — at your door in 60 minutes flat.',
    img: ONB1,
  },
  {
    kicker: 'Rewards',
    title: 'Play.\nEarn. Flex.',
    body: 'Daily rewards, spin wheels, style quizzes & lucky draws. Shopping is the game.',
    img: ONB2,
  },
  {
    kicker: 'AI Stylist',
    title: 'Your closet,\nunlocked',
    body: 'AI-powered try-on, body measurements, and curated bundles from the brands you actually love.',
    img: ONB3,
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const ref = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const scrollX = useSharedValue(0);

  const lastPage = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      // Flip text the moment the new image crosses the halfway line
      const p = Math.round(e.contentOffset.x / width);
      if (p !== lastPage.value) {
        lastPage.value = p;
        runOnJS(setPage)(p);
      }
    },
  });

  const onMomentum = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const next = () => {
    if (page < SLIDES.length - 1) {
      ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
    } else {
      onDone();
    }
  };

  const isLast = page === SLIDES.length - 1;

  const topBarH = insets.top + SP.xl;
  const cardTop = topBarH + SP.s;
  const textTop = cardTop + CARD_H + SP.xl;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />

      {/* ── Framed image card (upper region) ───────────────── */}
      <View
        style={[
          {
            position: 'absolute',
            top: cardTop,
            left: CARD_MX,
            width: CARD_W,
            height: CARD_H,
            backgroundColor: '#F4F4F4',
            overflow: 'hidden',
          },
          BORDER(1),
        ]}
      >
        {/* Each image slides in from the right over the previous one and
            stays put; going back it slides out to the right. Only the
            active slide and its neighbours mount. */}
        {SLIDES.map((s, i) => (
          Math.abs(i - page) <= 1
            ? <SlideImage key={i} slide={s} index={i} scrollX={scrollX} />
            : null
        ))}
      </View>

      {/* ── Copy (animated per page) ───────────────────────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: textTop,
          left: SP.l,
          right: SP.l,
        }}
      >
        {/* kicker — reveals from behind a mask */}
        <View style={{ overflow: 'hidden', alignSelf: 'flex-start', marginBottom: SP.s }}>
          <MotiView
            key={`kicker-${page}`}
            from={{ translateY: 24 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 550 }}
          >
            <Text style={[T.caption, { color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }]}>
              {SLIDES[page].kicker}
            </Text>
          </MotiView>
        </View>

        {/* title — line-by-line mask reveal */}
        {SLIDES[page].title.split('\n').map((line, li) => (
          <View key={`title-${page}-${li}`} style={{ overflow: 'hidden' }}>
            <MotiView
              from={{ translateY: 40 }}
              animate={{ translateY: 0 }}
              transition={{ type: 'timing', duration: 650, delay: 100 + li * 80 }}
            >
              <Text style={[T.h1, { textTransform: 'uppercase' }]}>{line}</Text>
            </MotiView>
          </View>
        ))}

        {/* body — slides up from behind a mask */}
        <View style={{ overflow: 'hidden', marginTop: SP.m }}>
          <MotiView
            key={`body-${page}`}
            from={{ translateY: 24 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 260 }}
          >
            <Text style={[T.body, { color: C.dim, maxWidth: 340 }]}>{SLIDES[page].body}</Text>
          </MotiView>
        </View>
      </View>

      {/* ── Pager (transparent — swipe gesture only) ───────── */}
      <AnimatedScrollView
        ref={ref as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        onMomentumScrollEnd={onMomentum}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
      >
        {SLIDES.map((_, i) => (
          <View key={i} style={{ width, height }} />
        ))}
      </AnimatedScrollView>

      {/* ── Top bar (above pager so Skip is tappable) ──────── */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: SP.l,
          paddingTop: insets.top + SP.s,
          paddingBottom: SP.m,
          zIndex: 10,
        }}
      >
        <Text style={[T.caption, { color: C.ink }]}>TRENDZO</Text>
        <Pressable onPress={onDone} hitSlop={16}>
          <Text style={[T.caption, { color: C.ink }]}>Skip →</Text>
        </Pressable>
      </View>

      {/* ── Bottom: progress dots + solid full-width CTA ───── */}
      <View
        style={{
          position: 'absolute',
          left: SP.l,
          right: SP.l,
          bottom: insets.bottom + SP.l,
          zIndex: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SP.l }}>
          {SLIDES.map((_, i) => (
            <NavDot key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        <BrutalButton
          label={isLast ? 'Enter' : 'Next'}
          iconRight={isLast ? 'check' : 'arrow-right'}
          onPress={next}
          block
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    backgroundColor: C.ink,
  },
});
