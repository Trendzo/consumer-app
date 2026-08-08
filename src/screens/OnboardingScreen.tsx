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
  type SharedValue,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP } from '../theme/brutal';
import { BrutalButton } from '../components/Brutal';
import { TrendzoLogo } from '../components/TrendzoLogo';

const ONB1 = require('../../assets/onb1.jpeg');
const ONB2 = require('../../assets/onb2.jpeg');
const ONB3 = require('../../assets/onb3.jpeg');

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Same text shadow the Home hero uses for white copy over photos.
const HERO_SHADOW = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as const;

// ── Sub-components so hooks are never called inside .map() ──────────────────
function SlideImage({ slide, index, scrollX }: { slide: { img: any }; index: number; scrollX: SharedValue<number> }) {
  const bgStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (scrollX.value - (index - 1) * width) / width));
    const tx = (1 - p) * width;
    return { transform: [{ translateX: tx }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
      <Image source={slide.img} style={{ width, height }} resizeMode="cover" />
    </Animated.View>
  );
}

function NavDot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
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

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Full-bleed image (whole screen) ────────────────── */}
      {/* Each image slides in from the right over the previous one and
          stays put; going back it slides out to the right. Only the
          active slide and its neighbours mount. */}
      <View style={StyleSheet.absoluteFill}>
        {SLIDES.map((s, i) => (
          Math.abs(i - page) <= 1
            ? <SlideImage key={i} slide={s} index={i} scrollX={scrollX} />
            : null
        ))}
      </View>

      {/* ── Scrims — same recipe as the Home hero: strong at the top for the
          logo/Skip, strong at the bottom for copy + CTA, clear in the middle
          so the photo breathes. ── */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 120 }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.35, 1]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(height * 0.5) }}
      />

      {/* ── Copy (animated per page, bottom-anchored over the scrim) ── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: SP.l,
          right: SP.l,
          bottom: insets.bottom + SP.l + 56 + SP.l + 8 + SP.l, // CTA + dots + gaps
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
            <Text style={[T.caption, { color: '#fff', textTransform: 'uppercase', letterSpacing: 1, ...HERO_SHADOW }]}>
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
              <Text style={[T.display, { color: '#fff', textTransform: 'uppercase', ...HERO_SHADOW }]}>{line}</Text>
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
            <Text style={[T.body, { color: 'rgba(255,255,255,0.92)', maxWidth: 340, ...HERO_SHADOW }]}>{SLIDES[page].body}</Text>
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
        <TrendzoLogo height={19} />
        <Pressable onPress={onDone} hitSlop={16}>
          <Text style={[T.caption, { color: '#fff', ...HERO_SHADOW }]}>Skip →</Text>
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

        {/* Outline = white fill + ink text: the app's own button, but the
            variant that stays legible over the dark bottom scrim. */}
        <BrutalButton
          label={isLast ? 'Enter' : 'Next'}
          iconRight={isLast ? 'check' : 'arrow-right'}
          onPress={next}
          variant="outline"
          block
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    backgroundColor: '#FFFFFF',
  },
});
