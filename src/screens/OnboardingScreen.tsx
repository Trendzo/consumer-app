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
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, rf } from '../theme/brutal';

const ONB1 = require('../../assets/onb1.jpeg');
const ONB2 = require('../../assets/onb2.jpeg');
const ONB3 = require('../../assets/onb3.jpeg');

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// ── Sub-components so hooks are never called inside .map() ──────────────────
function SlideBackground({ slide, index, scrollX }: { slide: { img: any }; index: number; scrollX: Animated.SharedValue<number> }) {
  const bgStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (scrollX.value - (index - 1) * width) / width));
    const tx = (1 - p) * width;
    return { transform: [{ translateX: tx }] };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, left: 0, width, height, alignItems: 'center', justifyContent: 'center' },
        bgStyle,
      ]}
    >
      <Image source={slide.img} style={{ width, height }} resizeMode="cover" />
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
      [0.4, 1, 0.4],
      Extrapolation.CLAMP,
    );
    return { width: w, opacity: op };
  });
  return <Animated.View style={[styles.dot, dotStyle]} />;
}

const SLIDES = [
  {
    kicker: 'DELIVERY',
    title: 'FASHION\nIN AN HOUR',
    body: 'Local boutiques, designer drops, and the trends you crave — at your door in 60 minutes flat.',
    img: ONB1,
  },
  {
    kicker: 'REWARDS',
    title: 'PLAY.\nEARN. FLEX.',
    body: 'Daily rewards, spin wheels, style quizzes & lucky draws. Shopping is the game.',
    img: ONB2,
  },
  {
    kicker: 'AI STYLIST',
    title: 'YOUR CLOSET,\nUNLOCKED',
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

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />

      {/* ── Stacked reveal: each image slides in from the right
              over the previous one and stays put. Going back, it
              slides back out to the right. ──────────────────── */}
      {/* PERF: only the active slide and its neighbors mount — a slide's
          worklet derives position purely from scrollX, so a neighbor mounting
          mid-gesture lands at the correct translateX on its first frame. The
          animation is identical; steady-state overdraw drops from 3 stacked
          full-screen images to at most 2. */}
      {SLIDES.map((s, i) => (
        Math.abs(i - page) <= 1
          ? <SlideBackground key={i} slide={s} index={i} scrollX={scrollX} />
          : null
      ))}

      {/* heavy bottom-up gradient so text reads */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)', '#000']}
        locations={[0, 0.4, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Pager (used purely for swipe gesture) ───────── */}
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

      {/* ── Top bar (above scroll view so Skip is tappable) ─ */}
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
        <Text style={styles.brand}>{`TRENDZO`}</Text>
        <Pressable onPress={onDone} hitSlop={16}>
          <Text style={styles.brand}>SKIP →</Text>
        </Pressable>
      </View>

      {/* ── Foreground content (animated per page) ──────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: SP.l,
          paddingBottom: insets.bottom + 140,
        }}
      >
        {/* kicker — reveals from behind a mask */}
        <View style={{ overflow: 'hidden', alignSelf: 'flex-start', marginBottom: SP.m }}>
          <MotiView
            key={`kicker-${page}`}
            from={{ translateY: 40 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 650 }}
          >
            <View style={styles.kickerChip}>
              <View style={styles.kickerDot} />
              <Text style={styles.kickerText}>{SLIDES[page].kicker}</Text>
            </View>
          </MotiView>
        </View>

        {/* title — line-by-line mask reveal */}
        {SLIDES[page].title.split('\n').map((line, li) => (
          <View key={`title-${page}-${li}`} style={{ overflow: 'hidden' }}>
            <MotiView
              from={{ translateY: 70 }}
              animate={{ translateY: 0 }}
              transition={{ type: 'timing', duration: 750, delay: 120 + li * 90 }}
            >
              <Text style={styles.title}>{line}</Text>
            </MotiView>
          </View>
        ))}

        {/* body — slides up from behind a mask */}
        <View style={{ overflow: 'hidden', marginTop: SP.s }}>
          <MotiView
            key={`body-${page}`}
            from={{ translateY: 40 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 700, delay: 320 }}
          >
            <Text style={styles.body}>{SLIDES[page].body}</Text>
          </MotiView>
        </View>
      </View>

      {/* ── Bottom row: dots + glassy CTA (no background) ── */}
      <View
        style={{
          position: 'absolute',
          left: SP.l,
          right: SP.l,
          bottom: insets.bottom + SP.l,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* progress dots — white */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {SLIDES.map((_, i) => (
            <NavDot key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        {/* CTA — glass morphism */}
        <Pressable onPress={next} style={styles.cta}>
          {/* iOS: real glass blur. Android: expo-blur was already a translucent
              fallback (no actual blur) — a plain view drops the extra native
              platform-view from the frame without changing a pixel. */}
          {Platform.OS === 'ios'
            ? <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.9)' }} />
          <View style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }]} pointerEvents="none" />
          <Text style={styles.ctaText}>{isLast ? 'ENTER' : 'NEXT'}</Text>
          <Feather name={isLast ? 'check' : 'arrow-right'} size={16} color="#000" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    color: '#fff',
    letterSpacing: 1.5,
  },
  kickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: SP.m,
  },
  kickerDot: {
    width: 6,
    height: 6,
    backgroundColor: '#fff',
  },
  kickerText: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: 'Inter_900Black',
    fontSize: rf(48),
    color: '#fff',
    letterSpacing: -2.2,
    lineHeight: rf(50),
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
    maxWidth: 340,
  },
  dockInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  dot: {
    height: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    height: 52,
    minWidth: 120,
    overflow: 'hidden',
  },
  ctaText: {
    fontFamily: 'Inter_900Black',
    fontSize: 13,
    color: '#000',
    letterSpacing: 0.5,
  },
});
