// HOME — Modern Brutalism / ASCII art / monochrome
// Every section has a UNIQUE layout — no two look alike
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Image, StyleSheet, StatusBar, Dimensions, FlatList, RefreshControl, TextInput, DeviceEventEmitter } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withSpring, interpolateColor, withTiming, runOnJS, SharedValue, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, T, SP, BORDER, ASCII, rf } from '../theme/brutal';
import { AsciiDivider, BrutalButton, BrutalIconBtn, CachedImage, Chip, FadeInUp, ProductCard, SectionHead, useGenderCurve } from '../components/Brutal';
import { useZoom } from '../navigation/ZoomTransition';
import {
  PRODUCTS, CATEGORIES, GAMES, BRANDS, OCCASIONS, BUNDLES, COMMUNITY, HERO_IMG, HERO_IMG_2,
  HER_PRODUCTS, HIM_PRODUCTS, HER_CATEGORIES, HIM_CATEGORIES,
  HER_BUNDLES, HIM_BUNDLES, HER_OCCASIONS, HIM_OCCASIONS, HER_HERO, HIM_HERO,
} from '../data/mockData';
import type { Product, Category, Brand, Bundle, Occasion } from '../data/mockData';
import { listCategories, listProducts, listBrands, listBundles, listOccasions } from '../services/catalog';
import { useApp } from '../state/AppState';

const HOME_HERO = require('../../assets/home.jpeg');
const { width: W } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Expanded product list for the Explore More infinite feed — fake 24 items from PRODUCTS
const EXPLORE_PRODUCTS = Array.from({ length: 24 }, (_, i) => ({
  ...PRODUCTS[i % PRODUCTS.length],
  id: `exp-${i}-${PRODUCTS[i % PRODUCTS.length].id}`,
}));

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, cartCount, night, toggleNight, gender, setGender, curveProgress, theme, showConfirm } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Live catalog from the backend (gender-aware). `null` = not loaded yet or the
  // fetch failed; the selectors below fall back to the mock arrays so the home is
  // never blank (the backend is a free tier that cold-starts slowly).
  const [apiCategories, setApiCategories] = useState<Category[] | null>(null);
  const [apiProducts, setApiProducts] = useState<Product[] | null>(null);
  const [apiBrands, setApiBrands] = useState<Brand[] | null>(null);
  const [apiBundles, setApiBundles] = useState<Bundle[] | null>(null);
  const [apiOccasions, setApiOccasions] = useState<Occasion[] | null>(null);

  // Refetch the whole home catalog whenever HER/HIM flips or the user pulls to
  // refresh. Each slice sets independently so one slow/failed endpoint doesn't
  // blank the others; failures leave state null → mock fallback.
  useEffect(() => {
    let cancelled = false;
    const load = <T,>(p: Promise<T>, set: (v: T) => void) =>
      p.then((v) => { if (!cancelled) set(v); }).catch(() => { /* keep mock fallback */ });
    void Promise.allSettled([
      load(listCategories(gender), setApiCategories),
      load(listProducts({ gender, limit: 50 }), setApiProducts),
      load(listBrands(), setApiBrands),
      load(listBundles(gender), setApiBundles),
      load(listOccasions(gender), setApiOccasions),
    ]).then(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [gender, reloadKey]);

  // Gender-specific data — backend when available, else the mock arrays.
  const has = <T,>(a: T[] | null): a is T[] => !!a && a.length > 0;
  const activeProducts = has(apiProducts) ? apiProducts : (gender === 'her' ? HER_PRODUCTS : HIM_PRODUCTS);
  const activeCategories = has(apiCategories) ? apiCategories : (gender === 'her' ? HER_CATEGORIES : HIM_CATEGORIES);
  const activeBundles = has(apiBundles) ? apiBundles : (gender === 'her' ? HER_BUNDLES : HIM_BUNDLES);
  const activeOccasions = has(apiOccasions) ? apiOccasions : (gender === 'her' ? HER_OCCASIONS : HIM_OCCASIONS);
  const activeBrands = has(apiBrands) ? apiBrands : BRANDS;
  const exploreProducts = has(apiProducts) ? apiProducts : EXPLORE_PRODUCTS;
  const activeHero = gender === 'her' ? HER_HERO : HIM_HERO;
  const brandPage = useRef(0);
  const brandRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useSharedValue(0);
  // Gender → curvature: HIM = 0 (sharp brutalist), HER = 1 (rounded/soft).
  // curveProgress lives in AppState so the GenderSwitch drag can drive it
  // and every component in the app stays in sync during the gesture.
  // Smoothly round the page as the HIM/HER bar slides — borderRadius tracks curveProgress
  // live so cards/boxes curve in real time during the drag.
  const curveStyle = useAnimatedStyle(() => ({ borderRadius: curveProgress.value * 18 }));
  const curveSmStyle = useAnimatedStyle(() => ({ borderRadius: curveProgress.value * 10 }));
  // Fades out brutalist ASCII corner marks when curves are active
  const fadeBrutalStyle = useAnimatedStyle(() => ({ opacity: 1 - curveProgress.value }));
  // Gap / spacing for connected tile groups — tiles separate slightly in HER mode.
  // These are LAYOUT properties: animating them per-frame off the live drag forces a
  // full Yoga relayout every frame and makes the drag jitter. The spacing delta is
  // tiny (6–10px), so drive it off the committed `gender` instead — it settles at the
  // snap alongside the crossfade, while the GPU-cheap styles (radius/opacity/transform)
  // keep tracking the drag live for smoothness.
  const miniGapStyle = { gap: gender === 'her' ? 6 : 0 };
  const rowGapStyle = { gap: gender === 'her' ? 8 : 0 };
  const flashColStyle = { marginBottom: gender === 'her' ? 10 : 0 };

  // Hero banner — HIM sits beneath; the HER poster wipes IN from the left as the
  // bar drags toward HER. Pure transform (translateX) → GPU-only, no per-frame
  // layout. At progress 0 the HER poster sits fully off the left edge (only HIM
  // shows); at 1 it has slid fully across the box and covers it. The box already
  // has overflow:hidden, so the off-screen part is clipped.
  const HERO_W = W - SP.l * 2;
  const herHeroStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (curveProgress.value - 1) * HERO_W }],
  }));
  // Shared hero headline style — identical for the HIM and HER posters so the text
  // sits in the same spot on each. The HIM headline lives on the base layer; the HER
  // headline lives INSIDE the sliding HER poster, so it rides in with the image and
  // physically covers the HIM headline as the poster sweeps across.
  const heroHeadline = {
    position: 'absolute' as const,
    left: 18,
    bottom: 96,
    fontFamily: 'Inter_900Black' as const,
    fontSize: rf(60),
    color: '#FFFFFF',
    lineHeight: rf(58),
    letterSpacing: -2.5,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  };

  // Play & Win opens by sliding the rest of the feed DOWN via a GPU transform (translateY)
  // — no height change, no reflow, no lag. `playExpand` 0→1 drives both the card fan and
  // this push-down, so they stay perfectly in sync.
  const playExpand = useSharedValue(0);
  const feedPushStyle = useAnimatedStyle(() => ({ transform: [{ translateY: playExpand.value * (OPEN_PH - CLOSED_PH) }] }));

  // ─── EXPLORE MORE state — infinite scroll + filters + sticky search bar ───
  const [exploreY, setExploreY] = useState(99999);
  // The feed now lives inside the push-down wrapper, so the explore section's onLayout y
  // is relative to that wrapper. Track the wrapper's own top and add it back so the
  // sticky-search trigger still fires at the correct absolute scroll offset.
  const [feedTop, setFeedTop] = useState(0);
  const [exploreLocalY, setExploreLocalY] = useState(99999);
  useEffect(() => { setExploreY(feedTop + exploreLocalY); }, [feedTop, exploreLocalY]);
  const [exploreFilter, setExploreFilter] = useState<'ALL' | 'HER' | 'HIM' | 'Tops' | 'Bottomwear' | 'Footwear' | 'Accessories' | 'Dresses'>('ALL');
  const [explorePage, setExplorePage] = useState(1);
  const [exploreQuery, setExploreQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  // Slide-only animation for the sticky search bar (no fade)
  const searchBarSlide = useSharedValue(-220);
  const searchBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: searchBarSlide.value }],
  }));

  // UI-thread scroll handler — drives searchBarSlide directly and only pings
  // JS when the show/hide boolean actually flips. Replaces the 60Hz JS onScroll
  // that was causing scroll lag.
  const searchBarShownUI = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    'worklet';
    scrollY.value = e.contentOffset.y;
    const shouldShow = e.contentOffset.y + 120 > exploreY ? 1 : 0;
    if (shouldShow !== searchBarShownUI.value) {
      searchBarShownUI.value = shouldShow;
      searchBarSlide.value = withTiming(shouldShow ? 0 : -220, { duration: 260 });
      runOnJS(setShowSearchBar)(shouldShow === 1);
    }
  });


  const onRefresh = () => { setRefreshing(true); setReloadKey((k) => k + 1); };
  const { openZoom } = useZoom();
  const zoomRefs = useRef<Record<string, any>>({});
  // Zoom the card image into the product page; falls back to plain navigate
  const goToProduct = (p: any, key?: string) => {
    const node = key ? zoomRefs.current[key] : null;
    if (node) openZoom(node, p.img, p);
    else nav.navigate('ProductDetail', { product: p });
  };

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
      <AnimatedScrollView
        ref={scrollRef as any}
        contentContainerStyle={{ paddingTop: 56, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {/* ═══════════ HEADER ═══════════ */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SP.l, marginBottom: SP.m }}>
          <View>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(26), color: C.ink, letterSpacing: -1 }}>TRENDZO</Text>
            {/* Delivery location — tap to change (Myntra-style) */}
            <Pressable onPress={() => nav.navigate('SavedAddresses')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
              <Feather name="map-pin" size={11} color={C.ink} />
              <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>Deliver to</Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink, letterSpacing: -0.2 }} numberOfLines={1}>Bandra, Mumbai 400050</Text>
              <Feather name="chevron-down" size={13} color={C.ink} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <BrutalIconBtn icon={night ? 'sun' : 'moon'} onPress={toggleNight} />
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
        </AnimatedPressable>

        {/* ═══════════ GENDER SWITCH — Animated dot track ═══════════ */}
        <GenderSwitch gender={gender} onSwitch={setGender} />

        {/* ═══════════ BRAND BANNER — swipeable, auto-rotating brand posters ═══════════ */}
        <FadeInUp delay={50}>
          <BrandBanner nav={nav} curveStyle={curveStyle} />
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
            <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{'TIME-LOCKED · 50% OFF'}</Text>
            <FlashTimer curveSmStyle={curveSmStyle} />
          </Animated.View>
        </Animated.View>
        {/* Horizontal deal carousel — equal cards, discount + claimed progress */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m, marginTop: SP.m }}>
          {activeProducts.slice(0, 6).map((p, i) => {
            const off = Math.round((1 - p.price / p.original) * 100);
            const claimed = 42 + ((i * 17) % 52); // deterministic "X% claimed"
            return (
              <AnimatedPressable key={p.id} onPress={() => goToProduct(p, 'fl' + p.id)} style={[{ width: 152, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink, overflow: 'hidden' }, curveStyle]}>
                <Animated.View ref={(el) => { zoomRefs.current['fl' + p.id] = el; }} collapsable={false} style={{ height: 168, backgroundColor: C.hairline }}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.white, letterSpacing: 0.3 }}>{`-${off}%`}</Text>
                  </View>
                </Animated.View>
                <View style={{ padding: 8, borderTopWidth: 1, borderColor: C.ink }}>
                  <Text style={[T.monoB, { fontSize: 8 }]} numberOfLines={1}>{p.brand}</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink, marginTop: 1 }} numberOfLines={1}>{p.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.ink }}>₹{p.price}</Text>
                    <Text style={[T.caption, { textDecorationLine: 'line-through', fontSize: 9 }]}>₹{p.original}</Text>
                  </View>
                  {/* claimed progress (flex-based to avoid % typing) */}
                  <View style={{ marginTop: 7, height: 5, backgroundColor: C.hairline, flexDirection: 'row', overflow: 'hidden' }}>
                    <View style={{ flex: claimed, backgroundColor: C.ink }} />
                    <View style={{ flex: 100 - claimed }} />
                  </View>
                  <Text style={[T.mono, { fontSize: 7, color: C.dim, marginTop: 3 }]}>{`${claimed}% CLAIMED`}</Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  PLAY & WIN — Stacked cards → Wheel          ║
        ║  Tap to fan out in circle, drag to rotate     ║
        ╚══════════════════════════════════════════════╝
        */}
        <PlayWheelSection nav={nav} expandP={playExpand} />
        <Animated.View onLayout={(e) => setFeedTop(e.nativeEvent.layout.y)} style={feedPushStyle}>

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
              <Pressable onPress={() => goToProduct(p, 't' + p.id)} style={{ width: 170, marginRight: SP.m }}>
                <Animated.View ref={(el) => { zoomRefs.current['t' + p.id] = el; }} collapsable={false} style={[{ height: 230, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1), curveStyle]}>
                  {/* Giant rank number behind product */}
                  <Text style={{ position: 'absolute', top: -15, left: -4, fontFamily: 'Inter_900Black', fontSize: rf(110), color: C.ink, opacity: 0.06 }}>{`0${i + 1}`}</Text>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  {/* Rank badge — diagonal strip */}
                  <View style={{ position: 'absolute', top: 8, left: 0, backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.white, letterSpacing: 1 }}>{`#0${i + 1}`}</Text>
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
                    {activeBrands.slice(page * 12, page * 12 + 12).map((b, i) => {
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
          <AnimatedPressable onPress={() => nav.navigate('TryOnPicker', { mode: 'ar' })} style={[{ height: 180, backgroundColor: C.ink, overflow: 'hidden', borderWidth: 1, borderColor: C.ink }, curveStyle]}>
            {/* Info — explains what Virtual Try-On is */}
            <Pressable
              onPress={() => showConfirm({ title: 'Virtual Try-On', msg: 'See how an outfit looks on you before you buy.\n\n• AR Try-On — use your live camera\n• Photo Try-On — upload a photo\n\nSwap clothes in real time, then shop your favourites.', confirmLabel: 'Got it', cancelLabel: 'Close', icon: 'info' })}
              hitSlop={12}
              style={{ position: 'absolute', top: SP.m, right: SP.m, zIndex: 10, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 13 }}
            >
              <Feather name="info" size={14} color={C.white} />
            </Pressable>
            <View style={{ position: 'absolute', top: -24, right: -10 }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(140), color: 'rgba(255,255,255,0.06)', letterSpacing: -8 }}>FIT</Text>
            </View>
            <View style={{ flex: 1, padding: SP.m, justifyContent: 'center', gap: 16 }}>
              <View>
                <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: rf(34), letterSpacing: -1.5, lineHeight: rf(40) }}>TRY BEFORE{'\n'}YOU BUY.</Text>
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
            <AnimatedPressable onPress={() => nav.navigate('TryOnPicker', { mode: 'ar' })} style={[{ flex: 1, padding: SP.m, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink, minHeight: 120 }, curveStyle]}>
              <Animated.View style={[{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }, curveSmStyle]}>
                <Feather name="video" size={20} color={C.white} />
              </Animated.View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.ink, marginTop: 10, letterSpacing: -0.5 }}>AR TRY-ON</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 2 }]}>Live camera</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => nav.navigate('TryOnPicker', { mode: 'photo' })} style={[{ flex: 1, padding: SP.m, backgroundColor: C.ink, borderWidth: 1, borderColor: C.ink, minHeight: 120 }, curveStyle]}>
              <Animated.View style={[{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, curveSmStyle]}>
                <Feather name="image" size={20} color={C.ink} />
              </Animated.View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.white, marginTop: 10, letterSpacing: -0.5 }}>PHOTO TRY-ON</Text>
              <Text style={[T.mono, { color: C.white, fontSize: 9, marginTop: 2, opacity: 0.7 }]}>Upload a pic</Text>
            </AnimatedPressable>
          </Animated.View>

          {/* Image search — kept, re-styled as a supporting tool */}
          <AnimatedPressable onPress={() => nav.navigate('ImageSearch')} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.m, gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink }, curveStyle]}>
            <Animated.View style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }, curveSmStyle]}>
              <Feather name="camera" size={20} color={C.white} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>SNAP TO FIND</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>AI-powered visual search</Text>
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
            {activeProducts.filter((_,i) => i % 2 === 0).slice(0,3).map((p, i) => {
              const zoomKey = 'na-l' + p.id;
              return (
                <FadeInUp key={p.id} delay={i * 40}>
                  <AnimatedPressable onPress={() => goToProduct(p, zoomKey)} style={[{ height: 220, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1), curveStyle]}>
                    <Animated.View ref={(el) => { zoomRefs.current[zoomKey] = el; }} collapsable={false} style={{ width: '100%', height: '65%' }}>
                      <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>NEW</Text>
                      </View>
                    </Animated.View>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.ink }}>
                      <Text style={[T.monoB, { fontSize: 8 }]}>{p.brand}</Text>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink }} numberOfLines={1}>{p.name}</Text>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink }}>₹{p.price}</Text>
                    </View>
                  </AnimatedPressable>
                </FadeInUp>
              );
            })}
          </View>
          {/* Right column — short first */}
          <View style={{ flex: 1, gap: SP.s, marginTop: 30 }}>
            {activeProducts.filter((_,i) => i % 2 === 1).slice(0,3).map((p, i) => {
              const zoomKey = 'na-r' + p.id;
              return (
                <FadeInUp key={p.id} delay={i * 40 + 60}>
                  <AnimatedPressable onPress={() => goToProduct(p, zoomKey)} style={[{ height: 220, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1), curveStyle]}>
                    <Animated.View ref={(el) => { zoomRefs.current[zoomKey] = el; }} collapsable={false} style={{ width: '100%', height: '65%' }}>
                      <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>JUST IN</Text>
                      </View>
                    </Animated.View>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.ink }}>
                      <Text style={[T.monoB, { fontSize: 8 }]}>{p.brand}</Text>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink }} numberOfLines={1}>{p.name}</Text>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink }}>₹{p.price}</Text>
                    </View>
                  </AnimatedPressable>
                </FadeInUp>
              );
            })}
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
                      <Text style={[T.mono, { color: '#FFFFFF', fontSize: 9, opacity: 0.85, marginBottom: 2 }]}>{`SHOP THE`}</Text>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(24), color: '#FFFFFF', letterSpacing: 0.3, lineHeight: rf(26) }}>{o.label.toUpperCase()}</Text>
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
                <Animated.View style={[{ flexDirection: 'row', width: 240, height: 80, overflow: 'hidden', borderWidth: 1, borderColor: C.ink }, curveStyle]}>
                  {/* Left — dark discount block. Fixed SQUARE (80×80) so every coupon matches,
                      and the text auto-fits so ₹500 OFF / 50% OFF / FREE SHIP all look uniform. */}
                  <View style={{ width: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, paddingHorizontal: 6 }}>
                    <Text numberOfLines={2} adjustsFontSizeToFit style={{ fontFamily: 'Inter_900Black', fontSize: 16, lineHeight: 18, color: C.white, textAlign: 'center' }}>{c.off}</Text>
                  </View>
                  {/* Right — light body. Perforation lives INSIDE the white area with a gap from
                      the black block, so the dashes never blend into the black box. */}
                  <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.white }}>
                    <View style={{ marginLeft: 8, marginVertical: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                      {[...Array(7)].map((_, j) => <View key={j} style={{ width: 2, height: 4, backgroundColor: C.ink }} />)}
                    </View>
                    <View style={{ flex: 1, padding: SP.s, justifyContent: 'center' }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.ink, letterSpacing: 1 }}>{c.code}</Text>
                      <Text style={[T.mono, { color: C.dim, fontSize: 8, marginTop: 2 }]}>{c.min}</Text>
                      <View style={{ marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Feather name="copy" size={10} color={C.ink} />
                        <Text style={[T.monoB, { fontSize: 8 }]}>TAP TO COPY</Text>
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
          onLayout={(e) => setExploreLocalY(e.nativeEvent.layout.y)}
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
            const list = exploreProducts.filter(p => {
              if (exploreQuery && !p.name.toLowerCase().includes(exploreQuery.toLowerCase()) && !p.brand.toLowerCase().includes(exploreQuery.toLowerCase())) return false;
              if (exploreFilter === 'ALL' || exploreFilter === 'HER' || exploreFilter === 'HIM') return true;
              return p.category === exploreFilter;
            });
            const visible = list.slice(0, explorePage * 6);
            return (
              <View>
                <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, marginTop: SP.m, marginBottom: SP.s, justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>{`${list.length} RESULTS · ${exploreFilter}`}</Text>
                  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 }, BORDER(1)]}>
                    <Feather name="sliders" size={10} color={C.ink} />
                    <Text style={[T.monoB, { fontSize: 9 }]}>POPULAR</Text>
                  </View>
                </View>

                {/* Staggered 2-col grid — brutalist cards */}
                <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
                  {visible.map((p, i) => (
                    <Pressable key={p.id + '-' + i} onPress={() => goToProduct(p, 'f' + p.id + i)} style={{ width: '48.5%' }}>
                      <FadeInUp delay={(i % 4) * 50}>
                        <Animated.View style={[{ backgroundColor: C.white, overflow: 'hidden', height: 240 }, BORDER(1), curveStyle]}>
                          <Animated.View 
                            ref={(el) => { zoomRefs.current['f' + p.id + i] = el; }} 
                            collapsable={false}
                            style={{ flex: 1, backgroundColor: C.hairline }}
                          >
                            <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                            {p.tag && (
                              <View style={[{ position: 'absolute', top: 8, left: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }]}>
                                <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>{p.tag}</Text>
                              </View>
                            )}
                          </Animated.View>
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
          <Text style={[T.mono, { color: C.dim, textAlign: 'center', marginTop: 8, fontSize: 9 }]}>END.STREAM · TRENDZO</Text>
          <Text style={[T.mono, { color: C.dim, textAlign: 'center', marginTop: 4, fontSize: 9 }]}>FROM YOUR BLOCK · IN 60 MINUTES</Text>
          <AsciiDivider faint style={{ marginTop: 8 }} />
        </View>
        </Animated.View>
      </AnimatedScrollView>

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

// ─── FLASH TIMER — isolated so the 1s countdown re-renders ONLY itself, not the whole
//     HomeScreen (a per-second full re-render was hitching the Play & Win deck animation). ───
function FlashTimer({ curveSmStyle }: { curveSmStyle: any }) {
  const [time, setTime] = useState({ h: 2, m: 47, s: 19 });
  // Tick only while the screen is focused — no per-second work when off-screen.
  useFocusEffect(useCallback(() => {
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
  }, []));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[String(time.h).padStart(2, '0'), String(time.m).padStart(2, '0'), String(time.s).padStart(2, '0')].map((n, i) => (
        <Animated.View key={i} style={[{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.white }, curveSmStyle]}>
          <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 12, color: C.ink }}>{n}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── BRAND BANNER — swipeable, auto-rotating brand posters; tap opens that brand's store ───
// Six DISTINCT fashion photos so every brand poster looks clearly different as it rotates.
const POSTER_IMAGES = [
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=900&q=80&auto=format&fit=crop',
];
const BRAND_TAGLINES: Record<string, string> = {
  NIKE: 'JUST\nDO IT.',
  ADIDAS: 'IMPOSSIBLE\nIS NOTHING.',
  ZARA: 'NEW IN,\nEVERY WEEK.',
  'H&M': 'FASHION\nFOR EVERYONE.',
  UNIQLO: 'MADE\nFOR ALL.',
  PUMA: 'FOREVER\nFASTER.',
};
function BrandBanner({ nav, curveStyle }: { nav: any; curveStyle: any }) {
  // Same image poster cards as before (same size + image); we overlay each brand's logo,
  // a punchy heading + name, as a swipeable, auto-rotating carousel that opens the store.
  const data = BRANDS.slice(0, 6).map((b, i) => ({ ...b, img: POSTER_IMAGES[i % POSTER_IMAGES.length], tagline: BRAND_TAGLINES[b.name] || 'SHOP THE\nLATEST DROP.' }));
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  // Auto-advance every 3.5s, looping back. Pauses while the user is swiping (otherwise the
  // timer fires mid-swipe and yanks the poster back, so swipes look like they do nothing).
  const timer = useRef<any>(null);
  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const start = () => {
    stop();
    timer.current = setInterval(() => {
      setIndex(prev => {
        const next = (prev + 1) % data.length;
        listRef.current?.scrollToOffset({ offset: next * W, animated: true });
        return next;
      });
    }, 3500);
  };
  // Only auto-rotate while the Home screen is focused — when the user navigates away the
  // timer (and its animated scrolling) stops, so it doesn't burn GPU / cause lag off-screen.
  useFocusEffect(useCallback(() => { start(); return stop; }, [data.length]));

  return (
    <View style={{ marginTop: SP.l }}>
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.id}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        onScrollBeginDrag={stop}
        onMomentumScrollEnd={(e) => { setIndex(Math.round(e.nativeEvent.contentOffset.x / W)); start(); }}
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.navigate('Category', { id: 'brand-' + item.id, label: item.name })} style={{ width: W }}>
            {/* Image poster (unchanged size/style) with the brand logo + name overlaid on top */}
            <Animated.View style={[{ marginHorizontal: SP.l, height: 380, overflow: 'hidden', backgroundColor: C.white, borderWidth: 1, borderColor: C.ink }, curveStyle]}>
              <CachedImage source={{ uri: item.img }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject as any, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />
              <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
                {/* Brand logo on a white chip — stays visible over any photo */}
                <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#000' }}>
                  <CachedImage source={{ uri: item.logo }} style={{ width: 70, height: 24 }} resizeMode="contain" />
                </View>
                <View>
                  <Text style={[T.monoB, { color: '#fff', fontSize: 11, letterSpacing: 1, opacity: 0.95 }]}>{`${item.name}`}</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(32), lineHeight: rf(34), color: '#fff', letterSpacing: -1.2, marginTop: 4, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }}>{item.tagline}</Text>
                  <Text style={[T.monoB, { color: '#fff', fontSize: 10, marginTop: 8 }]}>TAP TO ENTER STORE ──▶</Text>
                </View>
              </View>
            </Animated.View>
          </Pressable>
        )}
      />
      {/* Page dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SP.s }}>
        {data.map((_, i) => (
          <View key={i} style={{ width: i === index ? 18 : 6, height: 5, backgroundColor: i === index ? C.ink : C.faint }} />
        ))}
      </View>
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

function PlayWheelSection({ nav, expandP }: { nav: any; expandP: SharedValue<number> }) {
  const closeRot = useSharedValue(0);
  const isOpen = useRef(false);

  const toggle = () => {
    // Spin the close button forward on every toggle (open AND close).
    closeRot.value = withSpring(closeRot.value + 360, { damping: 14, stiffness: 90, mass: 0.9 });
    const next = !isOpen.current;
    isOpen.current = next;
    // Drives BOTH the card fan AND the parent's push-down of the feed below, entirely via
    // GPU transforms (translateY) -> NOTHING re-lays-out, so no reflow = no lag/jitter.
    // One crisp eased timing -> no spring tail (no "stopping"/hitch at the end).
    expandP.value = withTiming(next ? 1 : 0, { duration: 340, easing: Easing.out(Easing.cubic) });
  };

  return (
    // FIXED height. The wheel fans out into the gap that opens BELOW it (the parent slides
    // the rest of the feed down by the same amount). No height animation = no reflow.
    <View style={{ height: CLOSED_PH }}>
      <SectionHead title="PLAY" emphasis="& WIN" />
      <View style={{ width: W, flex: 1, alignItems: 'center' }}>
        {GAMES.map((g, i) => (
          <PlayGameCard
            key={g.id}
            game={g}
            index={i}
            progress={expandP}
            onTap={() => {
              if (!isOpen.current) { toggle(); return; }
              nav.navigate(GAME_MAP[g.id] || 'DailyReward');
            }}
          />
        ))}
        {/* Close button */}
        <PlayCloseBtn progress={expandP} rotation={closeRot} onPress={toggle} />
      </View>
      <PlayLabel progress={expandP} />
    </View>
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
  // NOTE: the vertical `top: CIRCLE_R * p` is folded into translateY below. `top` is a
  // LAYOUT property — animating it per-frame relaid out every card (+ its children) on
  // every spring frame and caused the open/close jitter. translateY is the exact same
  // visual offset but GPU-only (no layout), so the animation is unchanged, just smooth.
  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: sX + (cX - sX) * p },
        { translateY: CIRCLE_R * p + sY + (cY - sY) * p },
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
      position: 'absolute', top: 0, width: PW, height: PH,
      zIndex: total - Math.abs(Math.round(offset)),
    }, animStyle]}>
      <AnimatedPressable onPress={onTap} style={[{ flex: 1, padding: 6, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', gap: 8, overflow: 'hidden' }, BORDER(1), cardCurve]}>
        <Ionicons name={game.icon as any} size={24} color={fg} />
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: fg, textAlign: 'center', lineHeight: 11 }} numberOfLines={2}>{game.title.toUpperCase()}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

function PlayCloseBtn({ progress, rotation, onPress }: { progress: any; rotation: any; onPress: () => void }) {
  // `top` folded into translateY (layout → GPU-only) to kill the per-frame relayout.
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [{ translateY: CIRCLE_R * p }, { scale: 0.4 + p * 0.6 }],
    };
  });
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const btnCurve = useGenderCurve(20);
  return (
    <Animated.View style={[{ position: 'absolute', top: PH / 2 - 20, width: 40, height: 40, zIndex: 200 }, style]}>
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
      const nextGender: 'her' | 'him' = target === 1 ? 'her' : 'him';
      // Delay the JS-side gender commit until the spring lands. The big
      // re-render (hero crossfade, product/category/bundle/occasion swap)
      // then happens after the dot has visually settled — no JS work
      // competing with the spring frames, so the snap is jitter-free.
      curveProgress.value = withSpring(target, GENDER_SPRING, (finished) => {
        if (finished) runOnJS(commitFromDrag)(nextGender);
      });
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
        {`MODE: ${gender.toUpperCase()} · TAP OR DRAG`}
      </Text>
    </View>
  );
}
