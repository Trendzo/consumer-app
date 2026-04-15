// HOME — Modern Brutalism / ASCII art / monochrome
// Every section has a UNIQUE layout — no two look alike
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ScrollView, View, Text, Pressable, Image, StyleSheet, StatusBar, Dimensions, FlatList, RefreshControl, TextInput, DeviceEventEmitter } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor, useDerivedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { AsciiDivider, BrutalButton, BrutalIconBtn, CachedImage, Chip, FadeInUp, ProductCard, SectionHead, useGenderCurve } from '../components/Brutal';
import {
  PRODUCTS, CATEGORIES, GAMES, BRANDS, OCCASIONS, BUNDLES, COMMUNITY, HERO_IMG,
  HER_PRODUCTS, HIM_PRODUCTS, HER_CATEGORIES, HIM_CATEGORIES,
  HER_BUNDLES, HIM_BUNDLES, HER_OCCASIONS, HIM_OCCASIONS, HER_HERO, HIM_HERO,
} from '../data/mockData';
import { useApp } from '../state/AppState';

const HOME_HERO = require('../../assets/home.jpeg');
const { width: W } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedImage = Animated.createAnimatedComponent(Image);

// ─── PIXEL DISSOLVE — mosaic overlay that "generates" pixels during the drag ───
// Each cell owns a random threshold in [0,1]. As curveProgress crosses that
// threshold the cell flashes visible, then fades, so the banner looks like
// it's being re-rendered pixel-by-pixel rather than a smooth crossfade.
//
// Perf notes: cell size was bumped from 26 → 40 to cut the live-animated-view
// count by ~2.4x (225 → ~95 on a full-width banner). PixelCell is memoized so
// theme / state re-renders up the tree don't flush every cell. The worklet
// early-exits at the rest positions (p≈0 / p≈1) so idle frames cost nothing.
const PIXEL_SIZE = 40;
const PIXEL_PALETTE = ['#000000', '#FFFFFF', '#1a1a1a', '#e5e5e5', '#808080'];

const PixelCell = React.memo(function PixelCell({ threshold, color, progress }: { threshold: number; color: string; progress: Animated.SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const p = progress.value;
    // At rest — skip the bell math entirely, keep the overlay fully transparent.
    if (p <= 0.01 || p >= 0.99) return { opacity: 0 };
    // Global envelope fades overlay to 0 near the endpoints so the final
    // image always reads clean (no stray cells visible at rest).
    const edge = Math.min(p, 1 - p) * 3;
    if (edge <= 0.01) return { opacity: 0 };
    // Bell around threshold — cell is visible while drag is in its slot.
    const dist = Math.abs(p - threshold);
    const near = Math.max(0, 1 - dist * 5);
    return { opacity: near * Math.min(1, edge) };
  });
  return <Animated.View style={[{ width: PIXEL_SIZE, height: PIXEL_SIZE, backgroundColor: color }, style]} />;
});

function PixelDissolve({ progress, width, height }: { progress: Animated.SharedValue<number>; width: number; height: number }) {
  const cells = useMemo(() => {
    const cols = Math.ceil(width / PIXEL_SIZE);
    const rows = Math.ceil(height / PIXEL_SIZE);
    const out: { t: number; c: string }[] = [];
    for (let i = 0; i < cols * rows; i++) {
      out.push({
        t: Math.random(),
        c: PIXEL_PALETTE[Math.floor(Math.random() * PIXEL_PALETTE.length)],
      });
    }
    return out;
  }, [width, height]);
  if (width <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' }]}
    >
      {cells.map((cell, idx) => (
        <PixelCell key={idx} threshold={cell.t} color={cell.c} progress={progress} />
      ))}
    </View>
  );
}

// Expanded product list for the Explore More infinite feed — fake 24 items from PRODUCTS
const EXPLORE_PRODUCTS = Array.from({ length: 24 }, (_, i) => ({
  ...PRODUCTS[i % PRODUCTS.length],
  id: `exp-${i}-${PRODUCTS[i % PRODUCTS.length].id}`,
}));

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, cartCount, night, toggleNight, gender, setGender, curveProgress, theme } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [time, setTime] = useState({ h: 2, m: 47, s: 19 });
  // Gender-specific data — swaps when gender toggle changes
  const activeProducts = gender === 'her' ? HER_PRODUCTS : HIM_PRODUCTS;
  const activeCategories = gender === 'her' ? HER_CATEGORIES : HIM_CATEGORIES;
  const activeBundles = gender === 'her' ? HER_BUNDLES : HIM_BUNDLES;
  const activeOccasions = gender === 'her' ? HER_OCCASIONS : HIM_OCCASIONS;
  const activeHero = gender === 'her' ? HER_HERO : HIM_HERO;
  const brandPage = useRef(0);
  const brandRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  // Gender → curvature: HIM = 0 (sharp brutalist), HER = 1 (rounded/soft).
  // curveProgress lives in AppState so the GenderSwitch drag can drive it
  // and every component in the app stays in sync during the gesture.
  const curveStyle = useAnimatedStyle(() => ({ borderRadius: curveProgress.value * 18 }));
  const curveSmStyle = useAnimatedStyle(() => ({ borderRadius: curveProgress.value * 10 }));
  // Fades out brutalist ASCII corner marks when curves are active
  const fadeBrutalStyle = useAnimatedStyle(() => ({ opacity: 1 - curveProgress.value }));
  // Gap styles for connected tile groups — tiles separate slightly when curves activate
  const miniGapStyle = useAnimatedStyle(() => ({ gap: curveProgress.value * 6 }));
  const rowGapStyle = useAnimatedStyle(() => ({ gap: curveProgress.value * 8 }));
  // Breathing room beneath the flash-sale timer bar when cards round
  const flashColStyle = useAnimatedStyle(() => ({ marginBottom: curveProgress.value * 10 }));

  // Hero banner — pixel-dissolve transition. HIM sits beneath, HER fades in on top,
  // and a mosaic of staggered cells flashes across so the swap reads as pixels
  // being rebuilt rather than a smooth fade.
  const [heroSize, setHeroSize] = useState({ w: 0, h: 380 });
  const herHeroStyle = useAnimatedStyle(() => ({ opacity: curveProgress.value }));
  const himHeadlineStyle = useAnimatedStyle(() => ({ opacity: 1 - curveProgress.value }));
  const herHeadlineStyle = useAnimatedStyle(() => ({ opacity: curveProgress.value }));

  // ─── EXPLORE MORE state — infinite scroll + filters + sticky search bar ───
  const [exploreY, setExploreY] = useState(99999);
  const [exploreFilter, setExploreFilter] = useState<'ALL' | 'HER' | 'HIM' | 'Tops' | 'Bottomwear' | 'Footwear' | 'Accessories' | 'Dresses'>('ALL');
  const [explorePage, setExplorePage] = useState(1);
  const [exploreQuery, setExploreQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  // Slide-only animation for the sticky search bar (no fade)
  const searchBarSlide = useSharedValue(-220);
  const searchBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: searchBarSlide.value }],
  }));

  useEffect(() => {
    const t = setInterval(() => {
      setTime(prev => {
        let { h, m, s } = prev;
        s -= 1;
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) { h = 23; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const onRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 900); };
  const goToProduct = (p: any) => nav.navigate('ProductDetail', { product: p });

  // Double-tap on Home tab scrolls back to the top of the page.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('homeScrollToTop', () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => sub.remove();
  }, []);

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#000000' : '#FFFFFF' }}>
      <StatusBar barStyle={night ? 'light-content' : 'dark-content'} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: 56, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollYRef.current = y;
          // Slide sticky search bar in from top when Explore More enters viewport
          const shouldShow = y + 120 > exploreY;
          if (shouldShow !== showSearchBar) {
            setShowSearchBar(shouldShow);
            searchBarSlide.value = withTiming(shouldShow ? 0 : -220, { duration: 260 });
          }
        }}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {/* ═══════════ HEADER ═══════════ */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: SP.l, marginBottom: SP.m }}>
          <View>
            <Text style={[T.mono, { letterSpacing: 1 }]}>{`> CLOSET-X.SYS // v4.26`}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 26, color: C.ink, letterSpacing: -1, marginTop: 2 }}>CLOSET×</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <BrutalIconBtn icon={night ? 'sun' : 'moon'} onPress={toggleNight} />
            <BrutalIconBtn icon="bell" onPress={() => nav.navigate('Notifications')} />
            <BrutalIconBtn icon="shopping-bag" onPress={() => nav.navigate('Cart')} />
          </View>
        </View>

        {/* ═══════════ USER STRIP ═══════════ */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingVertical: 6, borderBottomWidth: 1, borderColor: C.ink, marginBottom: SP.m }}>
          <Text style={[T.monoB, { fontSize: 11 }]}>{`HELLO, ${user?.name?.toUpperCase() || 'GUEST'}`}</Text>
          <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>{cartCount > 0 ? `${cartCount} IN BAG` : 'BAG EMPTY'}</Text>
        </View>

        {/* ═══════════ SEARCH ═══════════ */}
        <AnimatedPressable onPress={() => nav.navigate('Search')} style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12, gap: 10, marginHorizontal: SP.l, borderWidth: 1, borderColor: C.ink, backgroundColor: C.white }, curveStyle]}>
          <Feather name="search" size={16} color={C.ink} />
          <Text style={[T.mono, { flex: 1 }]}>SEARCH 60-MIN DROPS...</Text>
          <Animated.View style={[{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.ink }, curveSmStyle]}><Text style={[T.monoB, { fontSize: 9 }]}>{'⌘ K'}</Text></Animated.View>
        </AnimatedPressable>

        {/* ═══════════ GENDER SWITCH — Animated dot track ═══════════ */}
        <GenderSwitch gender={gender} onSwitch={setGender} />

        {/* ═══════════ HERO ═══════════ */}
        <FadeInUp delay={50}>
          <Animated.View
            onLayout={e => setHeroSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            style={[{ marginHorizontal: SP.l, marginTop: SP.l, height: 380, overflow: 'hidden', backgroundColor: C.white }, BORDER(1), curveStyle]}
          >
            {/* HIM base layer */}
            <CachedImage source={{ uri: HIM_HERO }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            {/* HER overlay — opacity tracks curveProgress so the drag drives the crossfade live */}
            <AnimatedImage source={{ uri: HER_HERO }} style={[StyleSheet.absoluteFillObject as any, herHeroStyle]} resizeMode="cover" />
            {/* Pixel-dissolve mosaic — cells flash in/out across the drag like the banner is being regenerated */}
            <PixelDissolve progress={curveProgress} width={heroSize.w} height={heroSize.h} />
            <View style={{ flex: 1, padding: 18, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.25)' }}>
              <Animated.View style={[{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1), curveSmStyle]}>
                <Text style={[T.monoB, { fontSize: 10 }]}>60-MIN ETA</Text>
              </Animated.View>
              <View>
                <Animated.Text style={[{ fontFamily: 'Inter_900Black', fontSize: 60, color: '#FFFFFF', lineHeight: 58, letterSpacing: -2.5, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 }, himHeadlineStyle]}>{'HIS\nCODE.\nNO FILLER.'}</Animated.Text>
                <Animated.Text style={[{ position: 'absolute', top: 0, left: 0, fontFamily: 'Inter_900Black', fontSize: 60, color: '#FFFFFF', lineHeight: 58, letterSpacing: -2.5, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 }, herHeadlineStyle]}>{'HER\nSTYLE.\nHER RULES.'}</Animated.Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Text style={[T.monoB, { color: '#FFFFFF', fontSize: 10 }]}>{`// FROM YOUR BLOCK`}</Text>
                <AnimatedPressable onPress={() => nav.navigate('Category', { id: 'all', label: 'All Drops' })} style={[{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.ink }, BORDER(1), curveSmStyle]}>
                  <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 12, letterSpacing: 0.5 }}>SHOP NOW ──▶</Text>
                </AnimatedPressable>
              </View>
            </View>
            {['┌','┐','└','┘'].map((ch, i) => (
              <Animated.View key={i} style={[{ position: 'absolute', width: 14, height: 14, alignItems: 'center', justifyContent: 'center', ...[{top:-1,left:-1},{top:-1,right:-1},{bottom:-1,left:-1},{bottom:-1,right:-1}][i] }, fadeBrutalStyle]}>
                <Text style={[T.monoB, { fontSize: 14 }]}>{ch}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        </FadeInUp>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  CATEGORIES — Grid with overflowing images    ║
        ║  Images pop out of the top of each card       ║
        ║  No swipe — all visible in a 4×2 grid         ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="SHOP BY" emphasis="VIBE" action="ALL" onAction={() => nav.navigate('Category', { id: 'all', label: 'All Categories' })} />
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.s }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {activeCategories.map((c, i) => {
              const cardW = (W - SP.l * 2 - SP.s * 3) / 4;
              return (
                <Pressable key={c.id} onPress={() => nav.navigate('Category', { id: c.id, label: c.label })} style={{ width: cardW, marginBottom: SP.xl, alignItems: 'center' }}>
                  <FadeInUp delay={i * 40}>
                    {/* Image — overflows above the card */}
                    <View style={{ alignItems: 'center', zIndex: 2 }}>
                      <CachedImage                         source={{ uri: c.img }}
                        style={{ width: cardW * 0.85, height: cardW * 0.85, marginBottom: -cardW * 0.3 }}
                        resizeMode="contain"
                      />
                    </View>
                    {/* Card body */}
                    <Animated.View style={[{
                      width: cardW,
                      paddingTop: cardW * 0.35,
                      paddingBottom: SP.s,
                      alignItems: 'center',
                      backgroundColor: C.white,
                    }, BORDER(1), curveSmStyle]}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: C.ink, letterSpacing: 0.5 }}>{c.label.toUpperCase()}</Text>
                      <Text style={[T.mono, { fontSize: 7, color: C.dim, marginTop: 2 }]}>{`0${i + 1}`}</Text>
                    </Animated.View>
                  </FadeInUp>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  FLASH SALE — Diagonal slash layout          ║
        ║  Big featured card + 3 stacked mini cards    ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="FLASH" emphasis="SALE" action="ALL DEALS" onAction={() => nav.navigate('Category', { id: 'flash', label: 'Flash Sale' })} />
        {/* Timer bar */}
        <Animated.View style={[{ marginHorizontal: SP.l }, flashColStyle]}>
          <Animated.View style={[{ backgroundColor: C.ink, padding: SP.s, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, curveSmStyle]}>
            <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{'// TIME-LOCKED · 50% OFF'}</Text>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {[String(time.h).padStart(2, '0'), String(time.m).padStart(2, '0'), String(time.s).padStart(2, '0')].map((n, i) => (
                <Animated.View key={i} style={[{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.white }, curveSmStyle]}>
                  <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 12, color: C.ink }}>{n}</Text>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        </Animated.View>
        {/* Featured + Stack layout */}
        <Animated.View style={[{ paddingHorizontal: SP.l, flexDirection: 'row' }, rowGapStyle]}>
          {/* Big featured card */}
          <AnimatedPressable onPress={() => goToProduct(activeProducts[0])} style={[{ flex: 2, height: 280, backgroundColor: C.hairline, overflow: 'hidden', borderWidth: 1, borderColor: C.ink }, curveStyle]}>
            <CachedImage source={{ uri: activeProducts[0].img }} style={{ width: '100%', height: '65%' }} resizeMode="contain" />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={[T.monoB, { color: C.white, fontSize: 18 }]}>50%</Text>
              </View>
              <View style={{ backgroundColor: C.white, paddingHorizontal: 6, paddingVertical: 3, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: C.ink }}>
                <Text style={[T.monoB, { fontSize: 8 }]}>FEATURED</Text>
              </View>
            </View>
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: SP.s, borderTopWidth: 1, borderColor: C.ink, backgroundColor: C.white }}>
              <Text style={[T.monoB, { fontSize: 9 }]}>{activeProducts[0].brand}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }} numberOfLines={1}>{activeProducts[0].name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink }}>₹{activeProducts[0].price}</Text>
                <Text style={[T.caption, { textDecorationLine: 'line-through', fontSize: 10 }]}>₹{activeProducts[0].original}</Text>
              </View>
              <View style={{ marginTop: 4, height: 4, backgroundColor: C.hairline }}><View style={{ width: '60%', height: '100%', backgroundColor: C.ink }} /></View>
              <Text style={[T.mono, { fontSize: 8, color: C.dim }]}>60% CLAIMED</Text>
            </View>
          </AnimatedPressable>
          {/* 3 stacked mini cards */}
          <Animated.View style={[{ flex: 1 }, miniGapStyle]}>
            {activeProducts.slice(1, 4).map((p, i) => (
              <AnimatedPressable key={p.id} onPress={() => goToProduct(p)} style={[{ flex: 1, flexDirection: 'row', backgroundColor: C.white, borderWidth: 1, borderColor: C.ink, overflow: 'hidden' }, curveStyle]}>
                <View style={{ width: 60, backgroundColor: C.hairline, borderRightWidth: 1, borderColor: C.ink }}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
                <View style={{ flex: 1, padding: 6, justifyContent: 'center' }}>
                  <Text style={[T.monoB, { fontSize: 8 }]}>{p.brand}</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: C.ink }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.ink }}>₹{p.price}</Text>
                </View>
                <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: C.ink, paddingHorizontal: 4, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 7, color: C.white }}>{`-${Math.round((1 - p.price/p.original)*100)}%`}</Text>
                </View>
              </AnimatedPressable>
            ))}
          </Animated.View>
        </Animated.View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  PLAY & WIN — Stacked cards → Wheel          ║
        ║  Tap to fan out in circle, drag to rotate     ║
        ╚══════════════════════════════════════════════╝
        */}
        <PlayWheelSection nav={nav} scrollRef={scrollRef} scrollYRef={scrollYRef} />

        {/*
        ╔══════════════════════════════════════════════╗
        ║  TRENDING — Large rank numbers + horizontal  ║
        ║  Oversized #01 behind each card              ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="TRENDING" emphasis="NOW" action="VIEW ALL" onAction={() => nav.navigate('Category', { id: 'trending', label: 'Trending Now' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: 0 }}>
          {activeProducts.slice(0, 6).map((p, i) => (
            <FadeInUp key={p.id} delay={i * 30}>
              <Pressable onPress={() => goToProduct(p)} style={{ width: 170, marginRight: SP.m }}>
                <Animated.View style={[{ height: 230, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1), curveStyle]}>
                  {/* Giant rank number behind product */}
                  <Text style={{ position: 'absolute', top: -15, left: -4, fontFamily: 'Inter_900Black', fontSize: 110, color: C.ink, opacity: 0.06 }}>{`0${i + 1}`}</Text>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  {/* Rank badge — diagonal strip */}
                  <View style={{ position: 'absolute', top: 8, left: 0, backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.white, letterSpacing: 1 }}>{`#0${i + 1}`}</Text>
                  </View>
                  {/* Fire indicator at bottom */}
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.75)', padding: 6, gap: 4, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12 }}>🔥</Text>
                    <Text style={[T.monoB, { color: '#FFFFFF', fontSize: 9 }]}>{Math.floor(Math.random() * 500 + 100)} VIEWS</Text>
                  </View>
                </Animated.View>
                <Text style={[T.monoB, { marginTop: 6, fontSize: 9 }]}>{p.brand}</Text>
                <Text style={[T.body, { marginTop: 1 }]} numberOfLines={1}>{p.name}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink, marginTop: 2 }}>₹{p.price}</Text>
              </Pressable>
            </FadeInUp>
          ))}
        </ScrollView>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  BRANDS — Swipeable grid, 3 rows × 4 cols   ║
        ║  24 brands total, 2 pages, real logos         ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="DISCOVER" emphasis="BRANDS" action="ALL" onAction={() => nav.navigate('DiscoverBrands')} />
        <View style={{ paddingHorizontal: SP.l }}>
          {/* Outer curved frame — clips all inner cell borders against the rounded outside */}
          <Animated.View style={[{ borderWidth: 1, borderColor: C.ink, overflow: 'hidden' }, curveStyle]}>
            <FlatList
              ref={brandRef}
              data={[0, 1]}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => String(item)}
              renderItem={({ item: page }) => (
                <View style={{ width: W - SP.l * 2 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {BRANDS.slice(page * 12, page * 12 + 12).map((b, i) => {
                      const cardW = (W - SP.l * 2) / 4;
                      return (
                        <Pressable key={b.id} onPress={() => nav.navigate('Category', { id: 'brand-' + b.id, label: b.name })} style={{ width: cardW, height: cardW, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderRightWidth: (i % 4 < 3) ? 1 : 0, borderBottomWidth: i < 8 ? 1 : 0, borderColor: C.ink, backgroundColor: C.white }}>
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            <CachedImage source={{ uri: b.logo }} style={{ width: cardW * 0.7, height: cardW * 0.5 }} resizeMode="contain" />
                          </View>
                          <Text style={[T.monoB, { fontSize: 7, textAlign: 'center' }]} numberOfLines={1}>{b.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            />
          </Animated.View>
          {/* Page dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SP.s }}>
            <Text style={[T.monoB, { fontSize: 9 }]}>{'◀ SWIPE FOR MORE ▶'}</Text>
          </View>
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  VIRTUAL TRY-ON — Headline section            ║
        ║  Bold hero card + AR / photo try-on tiles     ║
        ║  Rewards moved to Games; streak lives there.  ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="VIRTUAL" emphasis="TRY-ON" />
        <Animated.View style={[{ paddingHorizontal: SP.l }, miniGapStyle]}>
          {/* HERO banner — high-contrast attention grab */}
          <AnimatedPressable onPress={() => nav.navigate('TryOn')} style={[{ height: 180, backgroundColor: C.ink, overflow: 'hidden', borderWidth: 1, borderColor: C.ink }, curveStyle]}>
            <View style={{ position: 'absolute', top: -24, right: -10 }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 140, color: 'rgba(255,255,255,0.06)', letterSpacing: -8 }}>FIT</Text>
            </View>
            <View style={{ flex: 1, padding: SP.m, justifyContent: 'space-between' }}>
              <View>
                <Text style={[T.monoB, { color: C.white, fontSize: 9, opacity: 0.7 }]}>{'> NEW · AR POWERED'}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 34, letterSpacing: -1.5, lineHeight: 32, marginTop: 8 }}>TRY BEFORE{'\n'}YOU BUY.</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Animated.View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.white }, curveSmStyle]}>
                  <Text style={[T.monoB, { fontSize: 10 }]}>ENTER STUDIO ──▶</Text>
                </Animated.View>
                <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>2,400+ fits scanned today</Text>
              </View>
            </View>
          </AnimatedPressable>

          {/* Two-up: AR Try-On + Photo Try-On */}
          <Animated.View style={[{ flexDirection: 'row' }, rowGapStyle]}>
            <AnimatedPressable onPress={() => nav.navigate('TryOn', { mode: 'ar' })} style={[{ flex: 1, padding: SP.m, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink, minHeight: 120 }, curveStyle]}>
              <Animated.View style={[{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }, curveSmStyle]}>
                <Feather name="video" size={20} color={C.white} />
              </Animated.View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.ink, marginTop: 10, letterSpacing: -0.5 }}>AR TRY-ON</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 2 }]}>Live camera · body tracking</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => nav.navigate('TryOn', { mode: 'photo' })} style={[{ flex: 1, padding: SP.m, backgroundColor: C.ink, borderWidth: 1, borderColor: C.ink, minHeight: 120 }, curveStyle]}>
              <Animated.View style={[{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, curveSmStyle]}>
                <Feather name="image" size={20} color={C.ink} />
              </Animated.View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.white, marginTop: 10, letterSpacing: -0.5 }}>PHOTO TRY-ON</Text>
              <Text style={[T.mono, { color: C.white, fontSize: 9, marginTop: 2, opacity: 0.7 }]}>Upload a pic · drop the fit</Text>
            </AnimatedPressable>
          </Animated.View>

          {/* Image search — kept, re-styled as a supporting tool */}
          <AnimatedPressable onPress={() => nav.navigate('ImageSearch')} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.m, gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink }, curveStyle]}>
            <Animated.View style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }, curveSmStyle]}>
              <Feather name="camera" size={20} color={C.white} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>SNAP TO FIND</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>AI-powered visual search · 98% accuracy</Text>
            </View>
            <Text style={[T.monoB, { fontSize: 18 }]}>──▶</Text>
          </AnimatedPressable>
        </Animated.View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  NEW ARRIVALS — Staggered masonry grid        ║
        ║  Alternating tall/short cards in 2 columns    ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="NEW" emphasis="ARRIVALS" action="ALL" onAction={() => nav.navigate('NewArrivals')} />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', gap: SP.s }}>
          {/* Left column — tall first */}
          <View style={{ flex: 1, gap: SP.s }}>
            {activeProducts.filter((_,i) => i % 2 === 0).slice(0,3).map((p, i) => (
              <FadeInUp key={p.id} delay={i * 40}>
                <AnimatedPressable onPress={() => goToProduct(p)} style={[{ height: 220, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1), curveStyle]}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '65%' }} resizeMode="contain" />
                  <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>NEW</Text>
                  </View>
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.ink }}>
                    <Text style={[T.monoB, { fontSize: 8 }]}>{p.brand}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink }} numberOfLines={1}>{p.name}</Text>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink }}>₹{p.price}</Text>
                  </View>
                </AnimatedPressable>
              </FadeInUp>
            ))}
          </View>
          {/* Right column — short first */}
          <View style={{ flex: 1, gap: SP.s, marginTop: 30 }}>
            {activeProducts.filter((_,i) => i % 2 === 1).slice(0,3).map((p, i) => (
              <FadeInUp key={p.id} delay={i * 40 + 60}>
                <AnimatedPressable onPress={() => goToProduct(p)} style={[{ height: 220, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1), curveStyle]}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '65%' }} resizeMode="contain" />
                  <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>JUST IN</Text>
                  </View>
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.ink }}>
                    <Text style={[T.monoB, { fontSize: 8 }]}>{p.brand}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink }} numberOfLines={1}>{p.name}</Text>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink }}>₹{p.price}</Text>
                  </View>
                </AnimatedPressable>
              </FadeInUp>
            ))}
          </View>
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  OUTFIT BUNDLES — Full-width horizontal cards ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="GET" emphasis="THE LOOK" />
        <View style={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {activeBundles.map((b, i) => (
            <FadeInUp key={b.id} delay={i * 40}>
              <AnimatedPressable onPress={() => nav.navigate('Category', { id: 'bundle-' + b.id, label: b.title })} style={[{ flexDirection: 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1), curveStyle]}>
                <View style={{ width: 130, height: 130, borderRightWidth: 1, borderColor: C.ink, overflow: 'hidden' }}>
                  <CachedImage source={{ uri: b.img }} style={{ width: '100%', height: '100%' }} />
                </View>
                <View style={{ flex: 1, padding: SP.m, justifyContent: 'space-between' }}>
                  <View>
                    <Text style={[T.monoB, { fontSize: 9 }]}>{`LOOK_0${i + 1}`}</Text>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink, marginTop: 4, letterSpacing: -0.3 }}>{b.title.toUpperCase()}</Text>
                    <Text style={[T.body, { fontSize: 11, color: C.dim, marginTop: 2 }]}>{b.pieces} PIECES · CURATED</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink }}>₹{b.price}</Text>
                    <Text style={[T.monoB, { fontSize: 10 }]}>{'SHOP ──▶'}</Text>
                  </View>
                </View>
              </AnimatedPressable>
            </FadeInUp>
          ))}
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  OCCASIONS — Overlapping stacked cards        ║
        ║  Each card overlaps the previous slightly     ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="THE" emphasis="OCCASION" action="ALL" onAction={() => nav.navigate('OccasionShopping')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, paddingRight: SP.l, gap: 12 }}>
          {activeOccasions.map((o, i) => (
            <Pressable key={o.id} onPress={() => nav.navigate('Category', { id: o.id, label: o.label })}>
              <FadeInUp delay={i * 30}>
                <Animated.View style={[{ width: 170, height: 230, overflow: 'hidden', backgroundColor: C.white }, BORDER(1), curveStyle]}>
                  <CachedImage source={{ uri: o.img }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
                  <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={[{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.white }, BORDER(1)]}>
                        <Text style={[T.monoB, { fontSize: 9, color: C.ink }]}>{`0${i + 1}`}</Text>
                      </View>
                      <View style={[{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderColor: '#FFFFFF', borderWidth: 1 }]}>
                        <Text style={[T.monoB, { fontSize: 8, color: '#FFFFFF' }]}>MODE</Text>
                      </View>
                    </View>
                    <View>
                      <Text style={[T.mono, { color: '#FFFFFF', fontSize: 9, opacity: 0.85, marginBottom: 2 }]}>{`// SHOP THE`}</Text>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 24, color: '#FFFFFF', letterSpacing: 0.3, lineHeight: 26 }}>{o.label.toUpperCase()}</Text>
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ width: 32, height: 2, backgroundColor: '#FFFFFF' }} />
                        <View style={[{ width: 28, height: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
                          <Feather name="arrow-up-right" size={14} color="#000000" />
                        </View>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              </FadeInUp>
            </Pressable>
          ))}
        </ScrollView>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  COUPON WALLET — Tear-off ticket style        ║
        ║  Dashed border, perforated edge effect        ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="COUPON" emphasis="WALLET" action="ALL" onAction={() => nav.navigate('CouponWallet')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {[
            { code: 'NEWVIBE', off: '₹500 OFF', min: 'Min ₹999' },
            { code: 'FLASH50', off: '50% OFF', min: 'Min ₹1,499' },
            { code: 'FREESHIP', off: 'FREE SHIP', min: 'No minimum' },
          ].map((c, i) => (
            <Pressable key={c.code} onPress={() => nav.navigate('CouponWallet')}>
              <FadeInUp delay={i * 40}>
                <Animated.View style={[{ flexDirection: 'row', width: 220, height: 80, overflow: 'hidden', borderWidth: 1, borderColor: C.ink }, curveStyle]}>
                  {/* Left side — dark */}
                  <View style={{ width: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, padding: 8 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.white, textAlign: 'center' }}>{c.off}</Text>
                  </View>
                  {/* Perforated divider */}
                  <View style={{ width: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    {[...Array(9)].map((_, j) => <View key={j} style={{ width: 1, height: 3, backgroundColor: C.ink }} />)}
                  </View>
                  {/* Right side — light */}
                  <View style={{ flex: 1, padding: SP.s, backgroundColor: C.white, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink, letterSpacing: 1 }}>{c.code}</Text>
                    <Text style={[T.mono, { color: C.dim, fontSize: 8, marginTop: 2 }]}>{c.min}</Text>
                    <View style={{ marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="copy" size={10} color={C.ink} />
                      <Text style={[T.monoB, { fontSize: 8 }]}>TAP TO COPY</Text>
                    </View>
                  </View>
                </Animated.View>
              </FadeInUp>
            </Pressable>
          ))}
        </ScrollView>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  COMMUNITY — Mosaic grid layout               ║
        ║  1 big + 2 small stacked                      ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="THE" emphasis="FEED" action="ALL" onAction={() => nav.navigate('CommunityFeed')} />
        <View style={{ paddingHorizontal: SP.l }}>
          <Animated.View style={[{ flexDirection: 'row', height: 260 }, rowGapStyle]}>
            {/* Big left */}
            <AnimatedPressable onPress={() => nav.navigate('CommunityFeed')} style={[{ flex: 2, overflow: 'hidden', borderWidth: 1, borderColor: C.ink }, curveStyle]}>
              <CachedImage source={{ uri: COMMUNITY[0].img }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
              <View style={{ position: 'absolute', bottom: SP.s, left: SP.s }}>
                <Text style={[T.monoB, { color: '#FFFFFF', fontSize: 11 }]}>{COMMUNITY[0].user}</Text>
                <Text style={[T.mono, { color: '#FFFFFF', fontSize: 9 }]}>{`♥ ${COMMUNITY[0].likes}`}</Text>
              </View>
            </AnimatedPressable>
            {/* 2 stacked right */}
            <Animated.View style={[{ flex: 1 }, miniGapStyle]}>
              {COMMUNITY.slice(1, 3).map((p, i) => (
                <AnimatedPressable key={p.id} onPress={() => nav.navigate('CommunityFeed')} style={[{ flex: 1, overflow: 'hidden', borderWidth: 1, borderColor: C.ink }, curveStyle]}>
                  <CachedImage source={{ uri: p.img }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                  <View style={{ position: 'absolute', bottom: 4, left: 6 }}>
                    <Text style={[T.monoB, { color: '#FFFFFF', fontSize: 9 }]}>{p.user}</Text>
                  </View>
                </AnimatedPressable>
              ))}
            </Animated.View>
          </Animated.View>
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  MOOD BOARD — Pinterest-style preview         ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="MOOD" emphasis="BOARD" action="VIEW" onAction={() => nav.navigate('MoodBoard')} />
        <View style={{ paddingHorizontal: SP.l }}>
          <AnimatedPressable onPress={() => nav.navigate('MoodBoard')} style={[{ backgroundColor: C.white, overflow: 'hidden' }, BORDER(1), curveStyle]}>
            <View style={{ flexDirection: 'row', height: 100 }}>
              {activeProducts.slice(0, 4).map((p, j) => (
                <View key={p.id} style={{ flex: 1, borderRightWidth: j < 3 ? 1 : 0, borderColor: C.ink, backgroundColor: C.hairline }}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
              ))}
            </View>
            <View style={{ padding: SP.m, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: C.ink }}>
              <Feather name="layout" size={18} color={C.ink} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>SAVE OUTFIT COMBOS</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>3 BOARDS · 13 ITEMS SAVED</Text>
              </View>
              <Text style={[T.monoB]}>──▶</Text>
            </View>
          </AnimatedPressable>
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  FASHION CALENDAR — Timeline strip            ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="FASHION" emphasis="CALENDAR" action="ALL" onAction={() => nav.navigate('FashionCalendar')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: 0 }}>
          {[
            { date: 'APR 15', title: 'SUMMER DROP', icon: 'sun' },
            { date: 'APR 20', title: 'FLASH SALE', icon: 'zap' },
            { date: 'MAY 01', title: 'BRAND COLLAB', icon: 'star' },
            { date: 'MAY 10', title: 'FESTIVAL EDIT', icon: 'gift' },
          ].map((e, i) => (
            <FadeInUp key={i} delay={i * 40}>
              <Pressable onPress={() => nav.navigate('FashionCalendar')} style={{ alignItems: 'center', width: 100, marginRight: SP.s }}>
                <Animated.View style={[{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 0 ? C.ink : C.white }, BORDER(1), curveStyle]}>
                  <Feather name={e.icon as any} size={22} color={i === 0 ? C.white : C.ink} />
                </Animated.View>
                <View style={{ width: 1, height: 12, backgroundColor: C.ink }} />
                <Animated.View style={[{ padding: 6, alignItems: 'center', backgroundColor: C.white }, BORDER(1), curveSmStyle]}>
                  <Text style={[T.monoB, { fontSize: 9 }]}>{e.date}</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: C.ink, marginTop: 2, textAlign: 'center' }}>{e.title}</Text>
                </Animated.View>
              </Pressable>
            </FadeInUp>
          ))}
        </ScrollView>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  SUSTAINABILITY — Banner with icon strip      ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="ECO" emphasis="FRIENDLY" action="LEARN" onAction={() => nav.navigate('Sustainability')} />
        <View style={{ paddingHorizontal: SP.l }}>
          <AnimatedPressable onPress={() => nav.navigate('Sustainability')} style={[{ backgroundColor: C.ink, padding: SP.l, overflow: 'hidden' }, BORDER(1), curveStyle]}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.white }}>FASHION{'\n'}FOR GOOD.</Text>
            <View style={{ flexDirection: 'row', gap: SP.m, marginTop: SP.m }}>
              {[{ icon: 'package', label: 'ECO PKG' }, { icon: 'wind', label: 'CARBON 0' }, { icon: 'heart', label: 'ETHICAL' }, { icon: 'refresh-cw', label: '2ND LIFE' }].map(item => (
                <View key={item.label} style={{ alignItems: 'center' }}>
                  <Animated.View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, curveSmStyle]}>
                    <Feather name={item.icon as any} size={16} color={C.ink} />
                  </Animated.View>
                  <Text style={[T.monoB, { color: C.white, fontSize: 7, marginTop: 4 }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </AnimatedPressable>
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  EXPLORE MORE — Filters + infinite product grid ║
        ║  Sticky search bar slides in from top           ║
        ╚══════════════════════════════════════════════╝
        */}
        <View
          onLayout={(e) => setExploreY(e.nativeEvent.layout.y)}
          style={{ marginTop: SP.xl }}
        >
          <SectionHead title="EXPLORE" emphasis="MORE" />

          {/* Filter chip rail */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: 6 }}>
            {(['ALL', 'HER', 'HIM', 'Tops', 'Bottomwear', 'Footwear', 'Accessories', 'Dresses'] as const).map(f => {
              const on = exploreFilter === f;
              return (
                <Pressable key={f} onPress={() => { setExploreFilter(f); setExplorePage(1); }}>
                  <Animated.View style={[{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? C.ink : C.white }, BORDER(1), curveSmStyle]}>
                    <Text style={[T.monoB, { fontSize: 10, color: on ? C.white : C.ink, letterSpacing: 1 }]}>{f.toUpperCase()}</Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Result count + sort */}
          {(() => {
            const list = EXPLORE_PRODUCTS.filter(p => {
              if (exploreQuery && !p.name.toLowerCase().includes(exploreQuery.toLowerCase()) && !p.brand.toLowerCase().includes(exploreQuery.toLowerCase())) return false;
              if (exploreFilter === 'ALL' || exploreFilter === 'HER' || exploreFilter === 'HIM') return true;
              return p.category === exploreFilter;
            });
            const visible = list.slice(0, explorePage * 6);
            return (
              <View>
                <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, marginTop: SP.m, marginBottom: SP.s, justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>{`> ${list.length} RESULTS · ${exploreFilter}`}</Text>
                  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 }, BORDER(1)]}>
                    <Feather name="sliders" size={10} color={C.ink} />
                    <Text style={[T.monoB, { fontSize: 9 }]}>POPULAR</Text>
                  </View>
                </View>

                {/* Staggered 2-col grid — brutalist cards */}
                <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
                  {visible.map((p, i) => (
                    <Pressable key={p.id + '-' + i} onPress={() => goToProduct(p)} style={{ width: '48.5%' }}>
                      <FadeInUp delay={(i % 4) * 50}>
                        <Animated.View style={[{ backgroundColor: C.white, overflow: 'hidden', height: 240 }, BORDER(1), curveStyle]}>
                          <View style={{ flex: 1, backgroundColor: C.hairline }}>
                            <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                            {p.tag && (
                              <View style={[{ position: 'absolute', top: 8, left: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }]}>
                                <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>{p.tag}</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ padding: 8, borderTopWidth: 1, borderColor: C.ink }}>
                            <Text style={[T.monoB, { fontSize: 8 }]}>{p.brand}</Text>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink, marginTop: 1 }} numberOfLines={1}>{p.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink }}>₹{p.price}</Text>
                              <Text style={[T.caption, { textDecorationLine: 'line-through', fontSize: 9 }]}>₹{p.original}</Text>
                            </View>
                          </View>
                        </Animated.View>
                      </FadeInUp>
                    </Pressable>
                  ))}
                </View>

                {/* Load more */}
                {visible.length < list.length ? (
                  <Pressable onPress={() => setExplorePage(p => p + 1)} style={[{ marginHorizontal: SP.l, marginTop: SP.m, padding: SP.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.ink }, BORDER(1)]}>
                    <Feather name="arrow-down" size={14} color={C.white} />
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.white, letterSpacing: 1 }}>LOAD MORE ({list.length - visible.length})</Text>
                  </Pressable>
                ) : list.length > 0 ? (
                  <View style={{ marginHorizontal: SP.l, marginTop: SP.m, padding: SP.m, alignItems: 'center' }}>
                    <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>{'◆ END OF FEED'}</Text>
                  </View>
                ) : (
                  <View style={[{ marginHorizontal: SP.l, marginTop: SP.m, padding: SP.xl, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
                    <Feather name="search" size={32} color={C.dim} />
                    <Text style={[T.monoB, { marginTop: 8 }]}>NO MATCHES</Text>
                    <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4, textAlign: 'center' }]}>Try a different filter or search term</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </View>

        {/* ═══════════ FOOTER ═══════════ */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.huge }}>
          <AsciiDivider />
          <Text style={[T.mono, { color: C.dim, textAlign: 'center', marginTop: 8, fontSize: 9 }]}>// END.STREAM · CLOSET× · v4.26 //</Text>
          <Text style={[T.mono, { color: C.dim, textAlign: 'center', marginTop: 4, fontSize: 9 }]}>FROM YOUR BLOCK · IN 60 MINUTES</Text>
          <AsciiDivider faint style={{ marginTop: 8 }} />
        </View>
      </ScrollView>

      {/* STICKY SEARCH BAR — slides down from top (no fade) */}
      <Animated.View pointerEvents={showSearchBar ? 'auto' : 'none'} style={[{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: Math.max(insets.top - 8, 4), paddingHorizontal: SP.l, paddingBottom: 6, backgroundColor: C.bg, borderBottomWidth: 1, borderColor: C.ink, zIndex: 100 }, searchBarStyle]}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 10, gap: 10, backgroundColor: C.white }, BORDER(1)]}>
          <Feather name="search" size={16} color={C.ink} />
          <TextInput
            value={exploreQuery}
            onChangeText={(t) => { setExploreQuery(t); setExplorePage(1); }}
            placeholder="SEARCH EXPLORE..."
            placeholderTextColor={C.dim}
            style={{ flex: 1, fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: C.ink, padding: 0, letterSpacing: 0.5 }}
          />
          {exploreQuery.length > 0 && (
            <Pressable onPress={() => setExploreQuery('')} hitSlop={10}>
              <Feather name="x" size={14} color={C.dim} />
            </Pressable>
          )}
          <View style={[{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.ink }]}>
            <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>{exploreFilter}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── PLAY & WIN — Tap to open circle, tap card to navigate ───
const CIRCLE_R = 140;
const PW = 82;
const PH = 110;
const SECTION_HEAD_H = 70; // approx height of SectionHead
const CLOSED_PH = SECTION_HEAD_H + PH + 70;
const OPEN_PH = SECTION_HEAD_H + CIRCLE_R * 2 + PH + 40;
const GAME_MAP: any = { g1:'DailyReward', g2:'SpinWheel', g3:'LuckyDraw', g4:'StyleQuiz', g5:'InviteFriends', g6:'AppChallenges' };

function PlayWheelSection({ nav, scrollRef, scrollYRef }: { nav: any; scrollRef: any; scrollYRef: any }) {
  const progress = useSharedValue(0);
  const closeRot = useSharedValue(0);
  const isOpen = useRef(false);

  const toggle = () => {
    const halfExpand = (OPEN_PH - CLOSED_PH) / 2;
    // Spin the close button forward on every toggle (open AND close).
    closeRot.value = withSpring(closeRot.value + 360, { damping: 14, stiffness: 90, mass: 0.9 });
    if (!isOpen.current) {
      isOpen.current = true;
      progress.value = withSpring(1, { damping: 16, stiffness: 120, mass: 0.8 });
      // Scroll down by half the expansion so the cards stay centered in viewport —
      // visually content above slides up, content below slides down.
      scrollRef.current?.scrollTo({ y: (scrollYRef?.current ?? 0) + halfExpand, animated: true });
    } else {
      isOpen.current = false;
      progress.value = withSpring(0, { damping: 16, stiffness: 120, mass: 0.8 });
      scrollRef.current?.scrollTo({ y: Math.max(0, (scrollYRef?.current ?? 0) - halfExpand), animated: true });
    }
  };

  const expand = (OPEN_PH - CLOSED_PH);
  const containerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      height: CLOSED_PH + expand * p,
    };
  });

  return (
    <Animated.View
      style={[{ overflow: 'hidden' }, containerStyle]}
    >
      <SectionHead title="PLAY" emphasis="& WIN" />
      <View style={{ width: W, flex: 1, alignItems: 'center' }}>
        {GAMES.map((g, i) => (
          <PlayGameCard
            key={g.id}
            game={g}
            index={i}
            progress={progress}
            onTap={() => {
              if (!isOpen.current) { toggle(); return; }
              nav.navigate(GAME_MAP[g.id] || 'DailyReward');
            }}
          />
        ))}
        {/* Close button */}
        <PlayCloseBtn progress={progress} rotation={closeRot} onPress={toggle} />
      </View>
      <PlayLabel progress={progress} />
    </Animated.View>
  );
}

function PlayGameCard({ game, index, progress, onTap }: { game: any; index: number; progress: any; onTap: () => void }) {
  const total = GAMES.length;
  const mid = (total - 1) / 2;
  const offset = index - mid;
  const cardCurve = useGenderCurve(12);

  // Stacked fan position
  const sX = offset * 18;
  const sY = Math.abs(offset) * 4;
  const sRot = offset * 5;

  // Circle position — evenly around 360°
  const angle = -90 + (index / total) * 360;
  const rad = (angle * Math.PI) / 180;
  const cX = Math.cos(rad) * CIRCLE_R;
  const cY = Math.sin(rad) * CIRCLE_R;

  // When closed: cards at top of the card area (top: 0)
  // When open: circle center at CIRCLE_R (so top card at 0, bottom card at 2*CIRCLE_R)
  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      top: 0 + CIRCLE_R * p,
      transform: [
        { translateX: sX + (cX - sX) * p },
        { translateY: sY + (cY - sY) * p },
        { rotate: `${sRot * (1 - p)}deg` },
        { scale: 1 + p * 0.15 },
      ],
    };
  });

  const dark = index % 2 !== 0;
  const fg = dark ? C.white : C.ink;
  const bg = dark ? C.ink : C.white;
  const dimC = dark ? C.white : C.dim;

  return (
    <Animated.View style={[{
      position: 'absolute', width: PW, height: PH,
      zIndex: total - Math.abs(Math.round(offset)),
    }, animStyle]}>
      <AnimatedPressable onPress={onTap} style={[{ flex: 1, padding: 6, backgroundColor: bg, justifyContent: 'space-between', overflow: 'hidden' }, BORDER(1), cardCurve]}>
        <Text style={[T.monoB, { fontSize: 6, color: dimC }]}>{`Q_0${index + 1}`}</Text>
        <Ionicons name={game.icon as any} size={22} color={fg} style={{ alignSelf: 'center' }} />
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: fg, textAlign: 'center', lineHeight: 11 }} numberOfLines={2}>{game.title.toUpperCase()}</Text>
        <View style={{ borderTopWidth: 1, borderColor: fg, paddingTop: 2, alignItems: 'center' }}>
          <Text style={[T.monoB, { fontSize: 7, color: fg }]}>{`▶ ${game.cta}`}</Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function PlayCloseBtn({ progress, rotation, onPress }: { progress: any; rotation: any; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      top: CIRCLE_R * p + PH / 2 - 20,
      transform: [{ scale: 0.4 + p * 0.6 }],
    };
  });
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const btnCurve = useGenderCurve(20);
  return (
    <Animated.View style={[{ position: 'absolute', width: 40, height: 40, zIndex: 200 }, style]}>
      <AnimatedPressable onPress={onPress} style={[{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, btnCurve]}>
        <Animated.View style={iconStyle}>
          <Feather name="x" size={20} color={C.white} />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function PlayLabel({ progress }: { progress: any }) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));
  return (
    <Animated.View style={[{ alignSelf: 'center', marginTop: SP.s }, style]}>
      <Text style={[T.monoB, { fontSize: 9, textAlign: 'center' }]}>{'[ TAP DECK TO OPEN ]'}</Text>
    </Animated.View>
  );
}

// ─── GENDER SWITCH — Animated dot sliding on a track ───────
const DOT_SIZE = 28;
const TRACK_H = 48;

// Shared spring config — used by drag, taps, and the AppState sync effect so
// every path into curveProgress feels identical. Tuned for zero overshoot and
// a settle time that matches the 280ms base animation.
const GENDER_SPRING = { damping: 22, stiffness: 180, mass: 0.7, overshootClamping: false } as const;

function GenderSwitch({ gender, onSwitch }: { gender: 'her' | 'him'; onSwitch: (g: 'her' | 'him') => void }) {
  // curveProgress = 0 → HIM (sharp square, left), = 1 → HER (round, right).
  // Single shared source of truth — drag updates it in real time and every
  // other UI element (cards, tab bar, buttons) reacts instantly.
  const { curveProgress, night, setGenderFromDrag } = useApp();
  const [trackW, setTrackW] = useState(0);
  const trackWShared = useSharedValue(0);
  const startProgress = useSharedValue(0);
  // Worklets can't call the C Proxy on the UI thread — snapshot the colors
  // we need on the JS thread and pass them in as plain strings.
  const activeColor = night ? '#FFFFFF' : '#000000';
  const dimColor = night ? '#a0a0a0' : '#666666';

  // Square slides from left to right AND rounds itself based on progress.
  const dotStyle = useAnimatedStyle(() => {
    const maxX = Math.max(trackWShared.value - DOT_SIZE, 0);
    return {
      transform: [{ translateX: curveProgress.value * maxX }],
      borderRadius: curveProgress.value * (DOT_SIZE / 2),
    };
  });

  // Labels dim / highlight smoothly — live interpolation, no timing jitter
  const himTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(curveProgress.value, [0, 1], [activeColor, dimColor]),
  }));
  const herTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(curveProgress.value, [0, 1], [dimColor, activeColor]),
  }));

  // Committing from the drag path: set the ref flag via context so the
  // AppState effect does not re-spring curveProgress (the gesture already did).
  const commitFromDrag = (g: 'him' | 'her') => {
    setGenderFromDrag(g);
  };

  // Drag gesture — moves the square along the track and updates curveProgress live.
  // activeOffsetX lets pure taps fall through to the Pressable underneath,
  // failOffsetY prevents vertical scroll from accidentally becoming a drag.
  const panGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      startProgress.value = curveProgress.value;
    })
    .onUpdate((e) => {
      const maxX = Math.max(trackWShared.value - DOT_SIZE, 1);
      const next = Math.min(1, Math.max(0, startProgress.value + e.translationX / maxX));
      curveProgress.value = next;
    })
    .onEnd((e) => {
      const maxX = Math.max(trackWShared.value - DOT_SIZE, 1);
      const final = Math.min(1, Math.max(0, startProgress.value + e.translationX / maxX));
      // Velocity-biased snap — flicks in either direction commit immediately
      // even if the square hasn't crossed the midpoint.
      const velocityBias = e.velocityX / 1200;
      const target = Math.min(1, Math.max(0, final + velocityBias)) >= 0.5 ? 1 : 0;
      curveProgress.value = withSpring(target, GENDER_SPRING);
      runOnJS(commitFromDrag)(target === 1 ? 'her' : 'him');
    });

  // Tap-on-line handler: tap left of midpoint → HIM, right of midpoint → HER.
  // Runs through the normal setter so AppState's effect drives the spring.
  const handleTrackTap = (x: number) => {
    if (trackW <= 0) return;
    onSwitch(x < trackW / 2 ? 'him' : 'her');
  };

  return (
    <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
        {/* HIM label — left side (tap to snap) */}
        <Pressable onPress={() => onSwitch('him')} hitSlop={12}>
          <Animated.Text style={[{ fontFamily: 'Inter_900Black', fontSize: 18, letterSpacing: 1 }, himTextStyle]}>
            ◀ HIM
          </Animated.Text>
        </Pressable>

        {/* Track: full tap target wrapping center line + draggable square */}
        <Pressable
          onPress={(e) => handleTrackTap(e.nativeEvent.locationX)}
          style={{ flex: 1, height: TRACK_H, justifyContent: 'center' }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setTrackW(w);
            trackWShared.value = w;
          }}
        >
          {/* Center line */}
          <View style={{ position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.ink }} />

          {/* Draggable square — grows a border radius as it slides */}
          <GestureDetector gesture={panGesture}>
            <Animated.View
              hitSlop={16}
              style={[{
                width: DOT_SIZE,
                height: DOT_SIZE,
                backgroundColor: C.ink,
              }, dotStyle]}
            />
          </GestureDetector>
        </Pressable>

        {/* HER label — right side (tap to snap) */}
        <Pressable onPress={() => onSwitch('her')} hitSlop={12}>
          <Animated.Text style={[{ fontFamily: 'Inter_900Black', fontSize: 18, letterSpacing: 1 }, herTextStyle]}>
            HER ▶
          </Animated.Text>
        </Pressable>
      </View>

      {/* Mode indicator */}
      <Text style={[T.mono, { color: C.dim, textAlign: 'center', marginTop: 4, fontSize: 9 }]}>
        {`// MODE: ${gender.toUpperCase()} · TAP OR DRAG`}
      </Text>
    </View>
  );
}
