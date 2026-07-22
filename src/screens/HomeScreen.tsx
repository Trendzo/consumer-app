// HOME — Modern Brutalism / ASCII art / monochrome
// Every section has a UNIQUE layout — no two look alike
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Image, StyleSheet, StatusBar, Dimensions, FlatList, RefreshControl, DeviceEventEmitter, Platform, InteractionManager, Vibration } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withSpring, withRepeat, interpolate, interpolateColor, withTiming, runOnJS, SharedValue, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { AsciiDivider, BrutalButton, CachedImage, Chip, FadeInUp, ProductCard, SectionHead, useGenderCurve } from '../components/Brutal';
import { RealIcon, RealIconName, categoryIconName } from '../components/RealIcon';
import {
  PRODUCTS, CATEGORIES, GAMES, BRANDS, OCCASIONS, BUNDLES, COMMUNITY, REELS, HERO_IMG, HERO_IMG_2,
  HER_PRODUCTS, HIM_PRODUCTS, HER_CATEGORIES, HIM_CATEGORIES,
  HER_BUNDLES, HIM_BUNDLES, HER_OCCASIONS, HIM_OCCASIONS, HER_HERO, HIM_HERO,
} from '../data/mockData';
import type { Product, Category, Brand, Bundle, Occasion } from '../data/mockData';
import { listProducts, listBrands, listBundles, listOccasions } from '../services/catalog';
import { warmCatalog } from '../services/prefetch';
import { useApp } from '../state/AppState';

const HOME_HERO = require('../../assets/home.jpeg');

// FEATURED CATEGORIES — the horizontal swipeable row only. Local cutout art
// (not the pngimg.com hotlinks the grid below still uses), one set per gender.
const HER_FEATURED_CATEGORIES = [
  { id: 'feat-her-dress', label: 'Dresses',  img: require('../../assets/github-import/women/dress.png') },
  { id: 'feat-her-ethnic', label: 'Ethnic',   img: require('../../assets/github-import/women/ethenic.png') },
  { id: 'feat-her-glasses', label: 'Eyewear', img: require('../../assets/github-import/women/glasses.png') },
  { id: 'feat-her-heels', label: 'Heels',     img: require('../../assets/github-import/women/heels.png') },
  { id: 'feat-her-jwellery', label: 'Jewelry', img: require('../../assets/github-import/women/jwellery.png') },
  { id: 'feat-her-pants', label: 'Pants',     img: require('../../assets/github-import/women/pants.png') },
  { id: 'feat-her-skirts', label: 'Skirts',   img: require('../../assets/github-import/women/skirts.png') },
  { id: 'feat-her-top', label: 'Tops',        img: require('../../assets/github-import/women/top.png') },
];
const HIM_FEATURED_CATEGORIES = [
  { id: 'feat-him-cap', label: 'Caps',       img: require('../../assets/github-import/men/cap.png') },
  { id: 'feat-him-jackets', label: 'Jackets', img: require('../../assets/github-import/men/jackets.png') },
  { id: 'feat-him-jeans', label: 'Jeans',     img: require('../../assets/github-import/men/jeans.png') },
  { id: 'feat-him-shirt', label: 'Shirts',    img: require('../../assets/github-import/men/shirt.png') },
  { id: 'feat-him-shoes', label: 'Shoes',     img: require('../../assets/github-import/men/shoes.png') },
  { id: 'feat-him-short', label: 'Shorts',    img: require('../../assets/github-import/men/short.png') },
  { id: 'feat-him-tshirt', label: 'Tees',     img: require('../../assets/github-import/men/tshirt.png') },
  { id: 'feat-him-watchs', label: 'Watches',  img: require('../../assets/github-import/men/watchs.png') },
];

// STEALS — bento grid of price-banded deals, one big hero tile + two smaller
// tiles per gender, real catalog images/prices (no invented pricing).
const HER_STEALS = [
  { id: 'steal-her-1', label: 'Beauty',  priceLine: 'Under ₹999',  img: require('../../assets/steals/her/beauty.jpeg') },
  { id: 'steal-her-2', label: 'Jewelry', priceLine: 'Under ₹1499', img: require('../../assets/steals/her/jewelry.jpeg') },
  { id: 'steal-her-3', label: 'Tops',    priceLine: 'Under ₹1999', img: require('../../assets/steals/her/tops.jpeg') },
];
const HIM_STEALS = [
  { id: 'steal-him-1', label: 'Tees',    priceLine: 'Under ₹1499', img: require('../../assets/steals/him/tee.jpeg') },
  { id: 'steal-him-2', label: 'Eyewear', priceLine: 'Under ₹1999', img: require('../../assets/steals/him/eyewear.jpeg') },
  { id: 'steal-him-3', label: 'Jackets', priceLine: 'Under ₹2499', img: require('../../assets/steals/him/jacket.jpeg') },
];

// SHOP BY OCCASION — a seasonal hero banner + a swipeable row of white
// occasion cards (product cutout + label), one set per gender. Hero uses a
// local campaign banner — these already carry their own baked-in typography
// (same art used in the top hero carousel), so the card adds ONLY a small
// corner CTA badge rather than a second competing headline on top of it.
// Cards reuse the local github-import cutouts so nothing hits a slow/
// blocked CDN. `hero` is a require() (local asset).
const HER_OCCASION = {
  hero: require('../../assets/banners/her-friday.jpg'),
  cards: [
    { id: 'occ-her-brunch',  label: 'Brunch',  img: require('../../assets/github-import/women/dress.png') },
    { id: 'occ-her-party',   label: 'Party',   img: require('../../assets/github-import/women/top.png') },
    { id: 'occ-her-date',    label: 'Date',    img: require('../../assets/github-import/women/heels.png') },
    { id: 'occ-her-wedding', label: 'Wedding', img: require('../../assets/github-import/women/ethenic.png') },
    { id: 'occ-her-casual',  label: 'Casual',  img: require('../../assets/github-import/women/pants.png') },
  ],
};
const HIM_OCCASION = {
  hero: require('../../assets/banners/him-friday.jpg'),
  cards: [
    { id: 'occ-him-office',  label: 'Office',     img: require('../../assets/github-import/men/shirt.png') },
    { id: 'occ-him-street',  label: 'Streetwear', img: require('../../assets/github-import/men/jackets.png') },
    { id: 'occ-him-gym',     label: 'Gym',        img: require('../../assets/github-import/men/tshirt.png') },
    { id: 'occ-him-travel',  label: 'Travel',     img: require('../../assets/github-import/men/jeans.png') },
    { id: 'occ-him-weekend', label: 'Weekend',    img: require('../../assets/github-import/men/shoes.png') },
  ],
};

const { width: W } = Dimensions.get('window');
// Featured Categories tile sizing — solved so exactly 4 tiles are fully
// visible before scrolling, with a sliver of the 5th peeking at the edge as
// a "swipe for more" affordance.
const FEATURED_TILE_PAD = SP.l; // matches the SP.l edge padding every other section uses
const FEATURED_TILE_GAP = SP.s;
const FEATURED_TILE_W = (W - FEATURED_TILE_PAD * 2 - FEATURED_TILE_GAP * 4) / 4.3;
// Steals bento grid — one tall hero tile + a stacked pair beside it, all the
// same fixed 2-column width so the grid never depends on image aspect ratio.
const STEAL_GAP = SP.s;
const STEAL_COL_W = (W - SP.l * 2 - STEAL_GAP) / 2;
const STEAL_SMALL_H = STEAL_COL_W * 0.95;
const STEAL_BIG_H = STEAL_SMALL_H * 2 + STEAL_GAP;
// Explore Reels poster row — roughly 2.3 cards visible so the next one peeks.
const REEL_TILE_PAD = SP.l;
const REEL_TILE_GAP = SP.s;
const REEL_TILE_W = (W - REEL_TILE_PAD * 2 - REEL_TILE_GAP * 2) / 2.3;
const REEL_TILE_H = REEL_TILE_W * 1.5;
// Shop-by-Occasion card row — ~2.6 cards visible so the next one peeks.
const OCC_CARD_PAD = SP.l;
const OCC_CARD_GAP = SP.s;
const OCC_CARD_W = (W - OCC_CARD_PAD * 2 - OCC_CARD_GAP * 2) / 2.6;
const OCC_CARD_H = OCC_CARD_W * 1.15;
// Text shadow for the header/search overlay now sitting on top of the hero
// photo — keeps white text legible over whatever part of the image is behind it.
const HERO_SHADOW = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// Expanded product list for the Explore More infinite feed — fake 24 items from PRODUCTS
const EXPLORE_PRODUCTS = Array.from({ length: 24 }, (_, i) => ({
  ...PRODUCTS[i % PRODUCTS.length],
  id: `exp-${i}-${PRODUCTS[i % PRODUCTS.length].id}`,
}));

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { night, gender, setGender, curveProgress, theme, showConfirm } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Live catalog from the backend, cached PER GENDER. A missing slice = not
  // loaded yet or the fetch failed; the selectors below fall back to the mock
  // arrays so the home is never blank (the backend is a free tier that
  // cold-starts slowly). Caching both genders is what makes the HER↔HIM slide
  // swap content INSTANTLY — before, the old gender's API data stayed on
  // screen until a slow refetch landed, so the category boxes looked frozen.
  type GenderSlice = { categories?: Category[]; products?: Product[]; bundles?: Bundle[]; occasions?: Occasion[] };
  const [apiCache, setApiCache] = useState<{ her: GenderSlice; him: GenderSlice; brands?: Brand[] }>({ her: {}, him: {} });

  // Armed on the FIRST focus of the Home tab: on a guest launch the Login
  // modal covers the tabs, HomeTab is not focused, and neither the catalog
  // fetch nor the image warm-up runs behind it. First focus also kicks the
  // deferred two-wave image prefetch (moved out of AppProvider).
  const [homeArmed, setHomeArmed] = useState(false);
  useFocusEffect(useCallback(() => {
    if (homeArmed) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setHomeArmed(true);
      warmCatalog(gender);
    });
    return () => task.cancel();
  }, [homeArmed, gender]));

  // Refetch the whole home catalog when HER/HIM flips or the user pulls to
  // refresh. Each slice lands independently into the per-gender cache so one
  // slow/failed endpoint doesn't blank the others; failures (or empty results)
  // leave the slice untouched → mock fallback.
  // GUARDED: a flip to a gender whose slice is already cached and fresh
  // (<5 min) does ZERO network — a HER↔HIM↔HER round trip used to fire 15
  // requests for data already on screen. Pull-to-refresh always forces.
  const apiCacheRef = useRef(apiCache);
  useEffect(() => { apiCacheRef.current = apiCache; }, [apiCache]);
  const fetchedAt = useRef<{ her?: number; him?: number }>({});
  const lastReloadKey = useRef(0);
  useEffect(() => {
    if (!homeArmed) return;
    const g = gender;
    const forced = reloadKey !== lastReloadKey.current;
    lastReloadKey.current = reloadKey;
    const slice = apiCacheRef.current[g];
    const hasCache = !!(slice.categories || slice.products);
    const age = Date.now() - (fetchedAt.current[g] ?? 0);
    if (!forced && hasCache && age < 5 * 60_000) { setRefreshing(false); return; }
    fetchedAt.current[g] = Date.now();
    let cancelled = false;
    const put = (patch: GenderSlice) =>
      setApiCache((prev) => ({ ...prev, [g]: { ...prev[g], ...patch } }));
    void Promise.allSettled([
      listProducts({ gender: g, limit: 50 }).then((v) => { if (!cancelled && v.length) put({ products: v }); }),
      listBrands().then((v) => { if (!cancelled && v.length) setApiCache((prev) => ({ ...prev, brands: v })); }),
      listBundles(g).then((v) => { if (!cancelled && v.length) put({ bundles: v }); }),
      listOccasions(g).then((v) => { if (!cancelled && v.length) put({ occasions: v }); }),
    ]).then(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [gender, reloadKey, homeArmed]);

  // Gender-specific data — backend cache when available, else the mock arrays.
  // Categories are ALWAYS the local PNG sets (no backend/CDN fetch) so both
  // the featured strip and the vibe grid can crossfade HIM↔HER live while the
  // gender bar is being dragged.
  const herCategories = HER_CATEGORIES;
  const himCategories = HIM_CATEGORIES;
  const activeSlice = apiCache[gender];
  const activeProducts = activeSlice.products ?? (gender === 'her' ? HER_PRODUCTS : HIM_PRODUCTS);
  const activeBundles = activeSlice.bundles ?? (gender === 'her' ? HER_BUNDLES : HIM_BUNDLES);
  const activeOccasions = activeSlice.occasions ?? (gender === 'her' ? HER_OCCASIONS : HIM_OCCASIONS);
  const activeBrands = apiCache.brands ?? BRANDS;
  const exploreProducts = activeSlice.products ?? EXPLORE_PRODUCTS;
  const activeHero = gender === 'her' ? HER_HERO : HIM_HERO;
  const brandPage = useRef(0);
  const brandRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Gender → curvature: HIM = 0 (sharp brutalist), HER = 1 (rounded/soft).
  // curveProgress lives in AppState so the GenderSwitch drag can drive it
  // and every component in the app stays in sync during the gesture.
  // Smoothly round the page as the HIM/HER bar slides — borderRadius tracks curveProgress
  // live so cards/boxes curve in real time during the drag.
  const curveStyle = useAnimatedStyle(() => ({ borderRadius: curveProgress.value * 18 }));
  const curveSmStyle = useAnimatedStyle(() => ({ borderRadius: curveProgress.value * 10 }));
  // Featured Categories pin: the row stays a NORMAL in-flow child pinned by
  // native stickyHeaderIndices — no scroll-linked transform, so it scrolls in
  // perfect lockstep with the page (a synced overlay lags native scroll by a
  // frame on Android → visible jitter). The outer sticky wrapper is 100%
  // static styles (safe-area padding + white bg fixed, always-on) because
  // Reanimated-driven styles on the exact node stickyHeaderIndices manages
  // don't reliably apply on Android (confirmed: animated backgroundColor and
  // animated padding both silently no-op'd there). All animation instead
  // targets a plain, non-sticky child ONE level in — a single scale transform
  // on the whole row (not per-tile) so there's only one animated style
  // computation total, not two per tile. pinP is a one-shot 220ms timing that
  // fires only at the dock/undock instant, never during scroll itself.
  const catSectionY = useSharedValue(999999);
  const pinP = useSharedValue(0);
  const wasPinned = useSharedValue(false);
  const [catPinned, setCatPinned] = useState(false);
  const onHomeScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const nowPinned = e.contentOffset.y >= catSectionY.value - 1;
      if (nowPinned !== wasPinned.value) {
        wasPinned.value = nowPinned;
        pinP.value = withTiming(nowPinned ? 1 : 0, { duration: 220 });
        runOnJS(setCatPinned)(nowPinned);
      }
    },
  });
  const FEATURED_PIN_SCALE = 0.62;
  const featuredRowH = useSharedValue(0);
  const featuredScaleStyle = useAnimatedStyle(() => ({
    // Scaling around the centre left large fake gutters on both sides and kept
    // the row's full, unscaled height in layout. Anchor the compact row to the
    // leading edge, widen its pre-transform viewport so it still fills the
    // screen, and give the released space back to the section below.
    width: interpolate(pinP.value, [0, 1], [W, W / FEATURED_PIN_SCALE]),
    marginBottom: -featuredRowH.value * (1 - interpolate(pinP.value, [0, 1], [1, FEATURED_PIN_SCALE])),
    transformOrigin: 'left top',
    transform: [{ scale: interpolate(pinP.value, [0, 1], [1, FEATURED_PIN_SCALE]) }],
  }));
  // Collapsible top header (brand + ETA headline + address): it now scrolls away
  // NATIVELY (it's the first child of the ScrollView) while the search + quick-cats
  // row below it is a native stickyHeaderIndices header that pins to the top. No
  // Reanimated transform is driven off the scroll offset any more, so the header
  // can't lag the native scroll by a frame — which is what made the old
  // transform-collapse jitter on Android until it clamped. See the JSX below.
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

  // ─── EXPLORE MORE state — infinite scroll + filters ───
  const [exploreFilter, setExploreFilter] = useState<'ALL' | 'HER' | 'HIM' | 'Tops' | 'Bottomwear' | 'Footwear' | 'Accessories' | 'Dresses'>('ALL');
  const [explorePage, setExplorePage] = useState(1);

  // PERF: while the page is actively scrolling, background animations (the
  // brand banner's auto-rotate) hold still so they don't compete for frames.
  // Refs only — no re-renders, no behavior change when the page is idle.
  const scrollingRef = useRef(false);
  const scrollResumeT = useRef<any>(null);
  const markScrollStart = () => {
    scrollingRef.current = true;
    if (scrollResumeT.current) clearTimeout(scrollResumeT.current);
  };
  const markScrollStop = (delay: number) => {
    if (scrollResumeT.current) clearTimeout(scrollResumeT.current);
    scrollResumeT.current = setTimeout(() => { scrollingRef.current = false; }, delay);
  };

  // PERF: mount the below-the-fold sections (everything after Play & Win —
  // two screens down) one beat after first paint. Same content, same order;
  // the initial frame just isn't paying for 40+ offscreen images at once.
  const [tailMounted, setTailMounted] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setTailMounted(true));
    return () => task.cancel();
  }, []);


  const onRefresh = () => { setRefreshing(true); setReloadKey((k) => k + 1); };
  // Card taps zoom via the global ProductCard (zoom is built into it now).

  // ── Adaptive header tint (Amazon/Blinkit-style) ──
  // The campaign banner reports its slide's dominant colour; the header wears it
  // as a light top fade, crossfading old → new as the carousel rotates.
  const [bannerTint, setBannerTint] = useState(() => {
    const t = gender === 'her' ? HER_CAMPAIGN_TINTS[0] : HIM_CAMPAIGN_TINTS[0];
    return { prev: t, curr: t };
  });
  const tintRef = useRef(bannerTint);
  const tintFade = useSharedValue(1);
  const onBannerTint = useCallback((hex: string) => {
    if (tintRef.current.curr === hex) return;
    tintRef.current = { prev: tintRef.current.curr, curr: hex };
    // Zero the fade BEFORE the new colour commits — the incoming layer mounts
    // invisible and eases in, so the colour never snaps.
    tintFade.value = 0;
    setBannerTint(tintRef.current);
    tintFade.value = withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) });
  }, []);
  const tintFadeStyle = useAnimatedStyle(() => ({ opacity: tintFade.value }));

  // Double-tap on Home tab scrolls back to the top of the page.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('homeScrollToTop', () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => sub.remove();
  }, []);

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#000000' : '#FFFFFF' }}>
      {/* Hero redesign: the banner now bleeds full-bleed under the status bar with
          a transparent header overlaid on it, so status bar icons stay legible over
          the photo. (Was adaptive per night mode; the old dark/light logic is
          commented below in case the hero goes back to a white top section.) */}
      <StatusBar barStyle={catPinned ? 'dark-content' : 'light-content'} />
      {/* <StatusBar barStyle={night ? 'light-content' : 'dark-content'} /> */}

      {/* ═══ ADAPTIVE-TINT STRIP behind the status bar — commented out per redesign
          request (no more colour-changing background as the banner rotates). Was
          keeping the pinned search bar reading as one continuous coloured app-bar. ═══
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, zIndex: 5 }}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.white }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hexA(bannerTint.prev, 0.5) }]} />
        <Animated.View style={[StyleSheet.absoluteFill, tintFadeStyle, { backgroundColor: hexA(bannerTint.curr, 0.5) }]} />
      </View>
      */}

      {/* No top inset padding any more — the banner needs to bleed edge-to-edge
          under the status bar, with the header overlaid transparently on top of it
          (see the HERO block below). Sticky search was dropped along with it: with
          header+search now living INSIDE the hero overlay instead of their own
          white sticky row, there's no separate index to pin. */}
      <View style={{ flex: 1 }}>
        <AnimatedScrollView
          ref={scrollRef as any}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          onScroll={onHomeScroll}
          scrollEventThrottle={16}
          // Child 2 (hero → marquee → categories) pins natively at the top.
          stickyHeaderIndices={[2]}
          onScrollBeginDrag={markScrollStart}
          onMomentumScrollBegin={markScrollStart}
          onScrollEndDrag={() => markScrollStop(1200)}
          onMomentumScrollEnd={() => markScrollStop(150)}
          // No removeClippedSubviews — sections hold transformed/absolute children and
          // Android's subview clipping mis-tracks that combo, blanking detached sections.
          removeClippedSubviews={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
        >
          {/* ═══ HERO — banner bleeds full-bleed edge-to-edge under the status bar;
              header + search float transparently on top of it, per redesign. ═══ */}
          <View>
            {/* ═══════════ BRAND BANNER — swipeable, auto-rotating brand posters ═══════════ */}
            <BrandBanner nav={nav} curveStyle={curveStyle} pausedRef={scrollingRef} gender={gender} />

            {/* Scrim so the header/search stay legible over whichever banner art is
                showing — the new campaign photos have bright sky/wall backgrounds
                at the top, so this needs to be strong (near-solid black) rather
                than a subtle fade, all the way down past the search bar. */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)']}
              locations={[0, 0.35, 0.75, 1]}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 230 }}
            />

            {/* Bottom scrim — keeps the HIM/HER switch legible now that it sits
                on the banner's bottom edge instead of the plain page background. */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 130 }}
            />

            {/* ═══ HEADER + SEARCH overlay — transparent, sits on top of the banner.
                White text + shadow for legibility over the photo (was dark text on a
                white bar before). Same fields as before, just restyled/repositioned.
                Pulled up out of the safe-area inset (small fixed padding instead of
                insets.top) so it sits right under the status bar, not below it. ═══ */}
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 40 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SP.l }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: rf(9), color: '#fff', letterSpacing: 1, ...HERO_SHADOW }}>TRENDZO</Text>
                  {/* Delivery ETA — the headline. Mirrors the quick-commerce "X minutes · Y away" line */}
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                    <Text numberOfLines={1} style={{ fontFamily: 'Inter_900Black', fontSize: rf(22), color: '#fff', letterSpacing: -0.2, lineHeight: rf(24), flexShrink: 0, ...HERO_SHADOW }}>60 minutes</Text>
                    <Text numberOfLines={1} style={[T.mono, { fontSize: 9, color: '#fff', opacity: 0.85, flexShrink: 1 }, HERO_SHADOW]}>3 STORES NEARBY</Text>
                  </View>
                  {/* Delivery location — tap to change (Myntra-style) */}
                  <Pressable onPress={() => nav.navigate('SavedAddresses')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                    <RealIcon name="marker" size={13} color="#fff" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#fff', letterSpacing: -0.2, ...HERO_SHADOW }} numberOfLines={1}>Bandra, Mumbai 400050</Text>
                    <Feather name="chevron-down" size={13} color="#fff" />
                  </Pressable>
                </View>
                <Pressable onPress={() => nav.navigate('ProfileTab')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="user" size={22} color="#fff" />
                </Pressable>
              </View>

              {/* ═══════════ SEARCH — overlaid on the banner, frosted/transparent ═══════════ */}
              <AnimatedPressable onPress={() => nav.navigate('Search')} style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12, gap: 10, marginHorizontal: SP.l, marginTop: SP.m, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.35)' }, curveStyle]}>
                <RealIcon name="search" size={22} color="#FFFFFF" />
                <Text style={[T.mono, { flex: 1, color: '#fff' }]}>SEARCH 60-MIN DROPS...</Text>
                <RealIcon name="mic" size={16} color="#fff" />
                <Pressable onPress={() => nav.navigate('ImageSearch')} hitSlop={8}>
                  <RealIcon name="camera" size={16} color="#fff" />
                </Pressable>
              </AnimatedPressable>

              {/* ═══════════ QUICK CATEGORIES — commented out for now (redesign request).
                  Kept intact below so it can be restored later; not deleted. ═══════════
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, marginTop: SP.m, paddingBottom: SP.s }}>
                <Pressable onPress={() => nav.navigate('Categories')} style={{ alignItems: 'center', width: 60 }}>
                  <Animated.View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, borderWidth: 1, borderColor: C.ink }, curveSmStyle]}>
                    <RealIcon name="dashboard" size={22} color={C.white} />
                  </Animated.View>
                  <Text style={[T.monoB, { fontSize: 9, marginTop: 4, textAlign: 'center' }]} numberOfLines={1}>ALL</Text>
                </Pressable>
                {Array.from({ length: Math.max(herCategories.length, himCategories.length) }).map((_, i) => (
                  <QuickCat
                    key={i}
                    her={herCategories[i]}
                    him={himCategories[i]}
                    progress={curveProgress}
                    active={gender}
                    curveSmStyle={curveSmStyle}
                    onPress={(c) => nav.navigate('Categories', { id: c.id, label: c.label })}
                  />
                ))}
              </ScrollView>
              */}
            </View>

            {/* ═══════════ GENDER SWITCH — pinned to the banner's bottom edge, above the marquee ═══════════ */}
            <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              <GenderSwitch gender={gender} onSwitch={setGender} onPhoto />
            </View>
          </View>

        {/* ═══ MARQUEE — sticks directly to the bottom of the banner, no gap ═══ */}
        <Marquee text="NEW STYLES EVERYDAY  //  120+ STORES ACROSS INDIA  //  60-MIN DELIVERY  //  HASSLE-FREE RETURNS " />

        {/*
        ╔══════════════════════════════════════════════╗
        ║  FEATURED CATEGORIES — swipeable PNG cutouts  ║
        ║  Image only (no card/border), label below     ║
        ╚══════════════════════════════════════════════╝
        */}
        {/* Sticky wrapper: STATIC styles only (see note above on why nothing
            animated lives directly on this node). Safe-area padding is
            always-on rather than animated in only while docked — a fixed
            small gap under the marquee beats an unreliable animated one. */}
        <View
          style={{ backgroundColor: C.white, paddingTop: insets.top, paddingBottom: SP.xs }}
          onLayout={(e) => { catSectionY.value = e.nativeEvent.layout.y; }}
        >
          <Animated.View
            style={featuredScaleStyle}
            onLayout={(e) => {
              if (!featuredRowH.value) featuredRowH.value = e.nativeEvent.layout.height;
            }}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: FEATURED_TILE_PAD, gap: FEATURED_TILE_GAP, paddingTop: SP.xs }}>
              {(gender === 'her' ? HER_FEATURED_CATEGORIES : HIM_FEATURED_CATEGORIES).map((c) => (
                <FeaturedCatTile
                  key={c.id}
                  item={c}
                  onPress={() => nav.navigate('Categories', { id: c.id, label: c.label })}
                />
              ))}
            </ScrollView>
          </Animated.View>
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  STEALS — price-banded bento grid             ║
        ║  1 tall hero tile + 2 stacked tiles beside it ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="STEALS" action="ALL" onAction={() => nav.navigate('Categories')} hideCaret hideBottomDivider />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', gap: STEAL_GAP }}>
          {(() => {
            const steals = gender === 'her' ? HER_STEALS : HIM_STEALS;
            return (
              <>
                <StealTile
                  label={steals[0].label}
                  priceLine={steals[0].priceLine}
                  img={steals[0].img}
                  width={STEAL_COL_W}
                  height={STEAL_BIG_H}
                  curveSmStyle={curveSmStyle}
                  onPress={() => nav.navigate('Categories', { id: steals[0].id, label: steals[0].label })}
                />
                <View style={{ gap: STEAL_GAP }}>
                  {steals.slice(1, 3).map((s) => (
                    <StealTile
                      key={s.id}
                      label={s.label}
                      priceLine={s.priceLine}
                      img={s.img}
                      width={STEAL_COL_W}
                      height={STEAL_SMALL_H}
                      curveSmStyle={curveSmStyle}
                      onPress={() => nav.navigate('Categories', { id: s.id, label: s.label })}
                    />
                  ))}
                </View>
              </>
            );
          })()}
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  EXPLORE REELS — dark poster row + promo band ║
        ║  Cards tease a reel, tap redirects to Reels   ║
        ║  tab where it actually plays (nothing plays   ║
        ║  inline here).                                ║
        ╚══════════════════════════════════════════════╝
        */}
        <View style={{ marginTop: SP.xl, backgroundColor: '#0a0a0a', paddingVertical: SP.l }}>
          <Text style={{ textAlign: 'center', fontFamily: 'Inter_900Black', fontSize: rf(20), color: '#fff', letterSpacing: -0.3 }}>
            EXPLORE <Text style={{ color: '#9fffb0', fontStyle: 'italic' }}>REELS</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: REEL_TILE_PAD, gap: REEL_TILE_GAP, paddingTop: SP.m }}>
            {REELS.map((r) => (
              <ReelPosterTile
                key={r.id}
                title={r.title}
                user={r.user}
                img={r.img}
                curveSmStyle={curveSmStyle}
                onPress={() => nav.navigate('ReelsTab')}
              />
            ))}
          </ScrollView>
          <PromoBanner
            curveSmStyle={curveSmStyle}
            onPress={() => nav.navigate('Categories')}
            slides={[
              {
                id: 'promo-steals',
                bg: '#FF7A1A',
                title: (gender === 'her' ? HER_STEALS[0] : HIM_STEALS[0]).priceLine.toUpperCase() + '\nDEALS',
                sub: 'Fresh steals, everyday',
                cta: 'SHOP NOW',
                img: (gender === 'her' ? HER_STEALS[0] : HIM_STEALS[0]).img,
              },
              {
                id: 'promo-delivery',
                bg: '#111',
                title: '60-MINUTE\nDELIVERY',
                sub: 'Straight to your door',
                cta: 'ORDER NOW',
                img: activeHero,
              },
            ]}
          />
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  SHOP BY OCCASION — seasonal hero + card row  ║
        ╚══════════════════════════════════════════════╝
        */}
        <View style={{ marginTop: SP.xl }}>
          {(() => {
            const occ = gender === 'her' ? HER_OCCASION : HIM_OCCASION;
            return (
              <>
                <AnimatedPressable
                  onPress={() => nav.navigate('OccasionShopping')}
                  style={[{ marginHorizontal: SP.l, height: 210, overflow: 'hidden' }, curveStyle]}
                >
                  <CachedImage source={occ.hero} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
                  {/* Small corner CTA only — the campaign art already carries its
                      own headline, so this doesn't compete with a second one. */}
                  <View style={{ position: 'absolute', right: SP.m, bottom: SP.m, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.ink, letterSpacing: 0.3 }}>SHOP NOW</Text>
                    <Feather name="arrow-right" size={13} color={C.ink} />
                  </View>
                </AnimatedPressable>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: OCC_CARD_PAD, gap: OCC_CARD_GAP, paddingTop: SP.l }}>
                  {occ.cards.map((c) => (
                    <OccasionCard
                      key={c.id}
                      label={c.label}
                      img={c.img}
                      curveSmStyle={curveSmStyle}
                      onPress={() => nav.navigate('Categories', { id: c.id, label: c.label })}
                    />
                  ))}
                </ScrollView>
              </>
            );
          })()}
        </View>

        {/* ═══════════ SHOP BY VIBE — commented out for now (redesign request).
            Kept intact below so it can be restored later; not deleted.
        <SectionHead title="SHOP BY" emphasis="VIBE" action="ALL" onAction={() => nav.navigate('Categories')} />
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.s }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {Array.from({ length: Math.max(herCategories.length, himCategories.length) }).map((_, i) => (
              <VibeTile
                key={i}
                index={i}
                her={herCategories[i]}
                him={himCategories[i]}
                progress={curveProgress}
                active={gender}
                curveSmStyle={curveSmStyle}
                onPress={(c) => nav.navigate('Categories', { id: c.id, label: c.label })}
              />
            ))}
          </View>
        </View>
        ═══════════ */}

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
        {/* Horizontal deal carousel — global standard-size cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m, marginTop: SP.m }}>
          {activeProducts.slice(0, 6).map((p, i) => {
            const claimed = 42 + ((i * 17) % 52); // deterministic "X% claimed"
            return (
              <ProductCard key={p.id} p={p} frameStyle={curveStyle}>
                {/* claimed progress overlay — pinned to the image box bottom */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                  <View style={{ height: 5, backgroundColor: C.hairline, flexDirection: 'row', overflow: 'hidden' }}>
                    <View style={{ flex: claimed, backgroundColor: C.ink }} />
                    <View style={{ flex: 100 - claimed, backgroundColor: C.white }} />
                  </View>
                </View>
              </ProductCard>
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
        <Animated.View style={feedPushStyle}>
        {tailMounted && (<>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  TRENDING — Large rank numbers + horizontal  ║
        ║  Oversized #01 behind each card              ║
        ╚══════════════════════════════════════════════╝
        */}
        <SectionHead title="TRENDING" emphasis="NOW" action="VIEW ALL" onAction={() => nav.navigate('Category', { id: 'trending', label: 'Trending Now' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {activeProducts.slice(0, 6).map((p, i) => (
            <FadeInUp key={p.id} delay={i * 30}>
              <ProductCard p={p} rank={i + 1} frameStyle={curveStyle} />
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
                <RealIcon name="camcorder" size={22} color={C.white} />
              </Animated.View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.ink, marginTop: 10, letterSpacing: -0.5 }}>AR TRY-ON</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 2 }]}>Live camera</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => nav.navigate('TryOnPicker', { mode: 'photo' })} style={[{ flex: 1, padding: SP.m, backgroundColor: C.ink, borderWidth: 1, borderColor: C.ink, minHeight: 120 }, curveStyle]}>
              <Animated.View style={[{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, curveSmStyle]}>
                <RealIcon name="photo" size={22} />
              </Animated.View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.white, marginTop: 10, letterSpacing: -0.5 }}>PHOTO TRY-ON</Text>
              <Text style={[T.mono, { color: C.white, fontSize: 9, marginTop: 2, opacity: 0.7 }]}>Upload a pic</Text>
            </AnimatedPressable>
          </Animated.View>

          {/* Image search — kept, re-styled as a supporting tool */}
          <AnimatedPressable onPress={() => nav.navigate('ImageSearch')} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.m, gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink }, curveStyle]}>
            <Animated.View style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }, curveSmStyle]}>
              <RealIcon name="camera" size={22} color={C.white} />
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
          {/* Left column */}
          <View style={{ gap: SP.s }}>
            {activeProducts.filter((_,i) => i % 2 === 0).slice(0,3).map((p, i) => (
              <FadeInUp key={p.id} delay={i * 40}>
                <ProductCard p={p} frameStyle={curveStyle}>
                  <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>NEW</Text>
                  </View>
                </ProductCard>
              </FadeInUp>
            ))}
          </View>
          {/* Right column — staggered start, same card size */}
          <View style={{ gap: SP.s, marginTop: 30 }}>
            {activeProducts.filter((_,i) => i % 2 === 1).slice(0,3).map((p, i) => (
              <FadeInUp key={p.id} delay={i * 40 + 60}>
                <ProductCard p={p} frameStyle={curveStyle}>
                  <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>JUST IN</Text>
                  </View>
                </ProductCard>
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
              <RealIcon name="palette" size={20} />
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
          {([
            { date: 'APR 15', title: 'SUMMER DROP', icon: 'sun' },
            { date: 'APR 20', title: 'FLASH SALE', icon: 'sale' },
            { date: 'MAY 01', title: 'BRAND COLLAB', icon: 'star' },
            { date: 'MAY 10', title: 'FESTIVAL EDIT', icon: 'gift' },
          ] as { date: string; title: string; icon: RealIconName }[]).map((e, i) => (
            <FadeInUp key={i} delay={i * 40}>
              <Pressable onPress={() => nav.navigate('FashionCalendar')} style={{ alignItems: 'center', width: 100, marginRight: SP.s }}>
                <Animated.View style={[{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 0 ? C.ink : C.white }, BORDER(1), curveStyle]}>
                  <RealIcon name={e.icon} size={24} color={i === 0 ? C.white : C.ink} />
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
              {([{ icon: 'package', label: 'ECO PKG' }, { icon: 'plant', label: 'CARBON 0' }, { icon: 'heart', label: 'ETHICAL' }, { icon: 'forward', label: '2ND LIFE' }] as { icon: RealIconName; label: string }[]).map(item => (
                <View key={item.label} style={{ alignItems: 'center' }}>
                  <Animated.View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, curveSmStyle]}>
                    <RealIcon name={item.icon} size={18} />
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
        ╚══════════════════════════════════════════════╝
        */}
        <View style={{ marginTop: SP.xl }}>
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
              if (exploreFilter === 'ALL' || exploreFilter === 'HER' || exploreFilter === 'HIM') return true;
              return p.category === exploreFilter;
            });
            const visible = list.slice(0, explorePage * 6);
            return (
              <View>
                <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, marginTop: SP.m, marginBottom: SP.s, justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>{`${list.length} RESULTS · ${exploreFilter}`}</Text>
                  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 }, BORDER(1)]}>
                    <RealIcon name="filter" size={12} />
                    <Text style={[T.monoB, { fontSize: 9 }]}>POPULAR</Text>
                  </View>
                </View>

                {/* 2-col grid — global standard-size cards */}
                <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
                  {visible.map((p, i) => (
                    <FadeInUp key={p.id + '-' + i} delay={(i % 4) * 50}>
                      <ProductCard p={p} frameStyle={curveStyle} style={{ marginBottom: SP.s }} />
                    </FadeInUp>
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
                    <RealIcon name="search" size={32} color={C.dim} />
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
        </>)}
        </Animated.View>
        </AnimatedScrollView>
      </View>
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

// ─── CAMPAIGN BANNER — swipeable, auto-rotating Trendzo campaign posters ───
// Gender-matched pairs of the same campaigns (Desktop/trendzo art). The art is
// 1080×1440 (3:4) and the banner box matches, so posters show uncropped.
const HER_CAMPAIGNS = [
  require('../../assets/banners/her-new1.png'),
  require('../../assets/banners/her-new2.png'),
];
const HIM_CAMPAIGNS = [
  require('../../assets/banners/him-new1.png'),
  require('../../assets/banners/him-traditional.jpg'),
];
// LIGHT pastel of each poster's dominant colour (sampled from the actual art,
// lifted to high lightness) — drives the Amazon/Blinkit-style adaptive top
// gradient. Order matches the campaign arrays above.
export const HER_CAMPAIGN_TINTS = ['#f4e6c3', '#efcdc8'];
export const HIM_CAMPAIGN_TINTS = ['#ebe5cb', '#f2ddc4'];
const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

// 3:4 banner box — full-bleed edge-to-edge (redesign), matches the campaign art
// aspect ratio exactly (no crop).
const { height: SCREEN_H } = Dimensions.get('window');
const BANNER_W = W;
// Was a 3:4 ratio (~1.33x width) — too short. Ties to screen height instead
// so the hero reads as a proper full banner, closer to the reference layout.
// (0.78 was too tall — pushed Featured Categories off the first screen; dialed
// back so the marquee + categories peek into view without scrolling.)
const BANNER_H = Math.round(SCREEN_H * 0.8);
// How far the adaptive tint reaches into the page: past the gender switch (~60)
// and the banner's top margin, ending at the MIDDLE of the banner.
const CONTENT_TINT_H = 60 + SP.l + Math.round(BANNER_H / 2);
// Overlap the content-side tint into the header overlay's tail end (see below) —
// swallows any sub-pixel rounding gap between the two so there's never a seam.
const SEAM_OVERLAP = 16;

// One campaign poster inside the banner carousel — plain full-bleed slide,
// no scale/fade (that left gaps around the shrinking art). The dots below
// carry the "changing" feedback instead.
function BannerSlide({ item, onPress }: { item: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: W }}>
      {/* Campaign art — full-bleed edge-to-edge 3:4, no overlay/border (the poster IS the design) */}
      <View style={{ width: BANNER_W, height: BANNER_H, overflow: 'hidden', backgroundColor: C.white }}>
        <CachedImage source={item.campaign} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      </View>
    </Pressable>
  );
}

function BrandBanner({ nav, curveStyle, pausedRef, gender, onTint }: { nav: any; curveStyle: any; pausedRef?: React.MutableRefObject<boolean>; gender: 'her' | 'him'; onTint?: (hex: string) => void }) {
  // Campaign art only — full-bleed, the art carries its own typography.
  const tints = gender === 'her' ? HER_CAMPAIGN_TINTS : HIM_CAMPAIGN_TINTS;
  const data = (gender === 'her' ? HER_CAMPAIGNS : HIM_CAMPAIGNS).map((img, i) => ({ id: `camp-${gender}-${i}`, campaign: img, tint: tints[i] }));
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  // Drives the per-slide crossfade/scale below — the outgoing poster shrinks
  // and fades while the incoming one grows to full size, instead of a flat cut.
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => { scrollX.value = e.contentOffset.x; } });

  // Tell the header which colour the visible poster is (adaptive top gradient).
  useEffect(() => { onTint?.(tints[index] ?? tints[0]); }, [index, gender]);

  // Gender flip swaps the campaign set — restart the carousel from slide 1 so
  // the fresh gender's art is what the user sees.
  useEffect(() => {
    setIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [gender]);

  // Auto-advance every 3.5s, looping back. Pauses while the user is swiping (otherwise the
  // timer fires mid-swipe and yanks the poster back, so swipes look like they do nothing).
  const timer = useRef<any>(null);
  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const start = () => {
    stop();
    timer.current = setInterval(() => {
      // Hold the rotation while the page is scrolling — the animated
      // full-width poster swap was stealing frames mid-scroll.
      if (pausedRef?.current) return;
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
    <View>
      <AnimatedFlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b: any) => b.id}
        getItemLayout={(_: any, i: number) => ({ length: W, offset: W * i, index: i })}
        // Android defaults list clipping ON — with the parent scroll translated it
        // blanks the posters after scrolling away and back. 3-4 slides; keep attached.
        removeClippedSubviews={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={stop}
        onMomentumScrollEnd={(e: any) => { setIndex(Math.round(e.nativeEvent.contentOffset.x / W)); start(); }}
        renderItem={({ item }: { item: any }) => (
          <BannerSlide item={item} onPress={() => nav.navigate(gender === 'her' ? 'ForHer' : 'ForHim')} />
        )}
      />
    </View>
  );
}

// ─── MARQUEE — infinite auto-scrolling ticker, sits flush under the banner ───
// Classic seamless-loop trick: render the text twice back to back and scroll
// left by exactly one copy's width, then snap back to 0 — since the second
// copy is sitting right where the first started, the reset is invisible.
function Marquee({ text }: { text: string }) {
  const [segW, setSegW] = useState(0);
  const tx = useSharedValue(0);
  useEffect(() => {
    if (!segW) return;
    tx.value = 0;
    tx.value = withRepeat(withTiming(-segW, { duration: segW * 22, easing: Easing.linear }), -1, false);
  }, [segW]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const seg = (
    <Text numberOfLines={1} style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: C.white, letterSpacing: 1 }}>
      {text}
    </Text>
  );
  return (
    <View style={{ height: 34, backgroundColor: C.ink, overflow: 'hidden', justifyContent: 'center' }}>
      <Animated.View style={[{ flexDirection: 'row' }, style]}>
        <View onLayout={(e) => setSegW(e.nativeEvent.layout.width)}>{seg}</View>
        {seg}
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
// Realistic 3D icon per game — replaces the old flat Ionicons glyphs.
const GAME_ICON: Record<string, RealIconName> = { g1: 'gift', g2: 'wheel', g3: 'trophy', g4: 'palette', g5: 'friends', g6: 'fire' };

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
        <RealIcon name={GAME_ICON[game.id] ?? 'gift'} size={24} color={fg} />
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
const DOT_SIZE = 20;
const TRACK_H = 34;

// Shared spring config — used by drag, taps, and the AppState sync effect so
// every path into curveProgress feels identical. High stiffness/low mass so a
// tap snaps the puck across almost instantly instead of visibly travelling.
const GENDER_SPRING = { damping: 26, stiffness: 500, mass: 0.5, overshootClamping: false } as const;

function GenderSwitch({ gender, onSwitch, onPhoto }: { gender: 'her' | 'him'; onSwitch: (g: 'her' | 'him') => void; onPhoto?: boolean }) {
  // curveProgress = 0 → HIM (sharp square, left), = 1 → HER (round, right).
  // Single shared source of truth — drag updates it in real time and every
  // other UI element (cards, tab bar, buttons) reacts instantly.
  const { curveProgress, night, setGenderFromDrag } = useApp();
  const [trackW, setTrackW] = useState(0);
  const trackWShared = useSharedValue(0);
  const startProgress = useSharedValue(0);
  // Worklets can't call the C Proxy on the UI thread — snapshot the colors
  // we need on the JS thread and pass them in as plain strings. On the banner
  // photo it's always white-on-dark regardless of night mode (matches the
  // rest of the header overlay).
  const activeColor = onPhoto ? '#FFFFFF' : (night ? '#FFFFFF' : '#000000');
  const dimColor = onPhoto ? 'rgba(255,255,255,0.55)' : (night ? '#a0a0a0' : '#666666');
  const lineColor = onPhoto ? 'rgba(255,255,255,0.75)' : C.ink;
  const pukColor = onPhoto ? '#FFFFFF' : C.ink;
  const gripColor = onPhoto ? '#000000' : '#FFFFFF';
  // Pill backdrop — same frosted treatment as the search bar above it, so the
  // switch reads as a defined control instead of bare text floating on the photo.
  const pillStyle = useAnimatedStyle(() => ({ borderRadius: onPhoto ? curveProgress.value * 16 : 0 }));
  // "Wheel" spin — a quick multi-turn flourish on the puck whenever a switch
  // commits (tap OR drag release), on top of its normal slide.
  const spin = useSharedValue(0);
  const spinToggle = () => {
    spin.value = withTiming(spin.value + 720, { duration: 420, easing: Easing.out(Easing.cubic) });
    Vibration.vibrate(15);
  };

  // Square slides from left to right, rounds itself based on progress, and
  // spins like a fast-rolling wheel on every commit.
  const dotStyle = useAnimatedStyle(() => {
    const maxX = Math.max(trackWShared.value - DOT_SIZE, 0);
    return {
      transform: [{ translateX: curveProgress.value * maxX }, { rotate: `${spin.value}deg` }],
      borderRadius: curveProgress.value * (DOT_SIZE / 2),
    };
  });

  // Labels + their outline boxes dim / highlight smoothly — live
  // interpolation, no timing jitter.
  const himTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(curveProgress.value, [0, 1], [activeColor, dimColor]),
  }));
  const herTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(curveProgress.value, [0, 1], [dimColor, activeColor]),
  }));
  // Same her=rounded/him=sharp rule as every other brutalist box on the page —
  // both boxes round together since it's a global "her mode" style, not a
  // per-side thing.
  const himBoxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(curveProgress.value, [0, 1], [activeColor, dimColor]),
    borderRadius: curveProgress.value * 10,
  }));
  const herBoxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(curveProgress.value, [0, 1], [dimColor, activeColor]),
    borderRadius: curveProgress.value * 10,
  }));

  // Committing from the drag path: set the ref flag via context so the
  // AppState effect does not re-spring curveProgress (the gesture already did).
  const commitFromDrag = (g: 'him' | 'her') => {
    spinToggle();
    setGenderFromDrag(g);
  };

  // Tapping a label or the track. Drives curveProgress directly on the UI
  // thread — same as the drag path — instead of calling the plain setGender
  // setter and waiting for AppState's effect to react after React's render
  // commits. That extra render round-trip was the "takes so much time
  // before it moves" lag; driving it here makes tap and drag feel identical.
  const commitFromTap = (g: 'him' | 'her') => {
    spinToggle();
    curveProgress.value = withSpring(g === 'her' ? 1 : 0, GENDER_SPRING);
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
      // Commit the gender IMMEDIATELY on release. The old spring-completion
      // callback (runOnJS inside withSpring) silently failed to fire on the
      // new architecture, leaving MODE/banner/API data stuck on the previous
      // gender while the visuals (curveProgress) showed the new one. The
      // commit re-render is cheap now (per-gender catalog cache), so it no
      // longer needs to wait for the spring to land.
      curveProgress.value = withSpring(target, GENDER_SPRING);
      runOnJS(commitFromDrag)(nextGender);
    });

  // Tap-on-line handler: tap left of midpoint → HIM, right of midpoint → HER.
  // Runs through the normal setter so AppState's effect drives the spring.
  const handleTrackTap = (x: number) => {
    if (trackW <= 0) return;
    commitFromTap(x < trackW / 2 ? 'him' : 'her');
  };

  return (
    <View style={{ paddingHorizontal: SP.l, paddingBottom: onPhoto ? SP.m : 0, marginTop: SP.s }}>
      <Animated.View style={[
        { flexDirection: 'row', alignItems: 'center' },
        onPhoto ? { paddingHorizontal: SP.m, paddingVertical: SP.s, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.35)' } : null,
        onPhoto ? pillStyle : null,
      ]}>
        {/* HIM — boxed outline instead of a floating arrow glyph, wired to
            the track by a short connector so it reads as one drawn piece. */}
        <Pressable onPress={() => commitFromTap('him')} hitSlop={12}>
          <Animated.View style={[{ borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 3 }, himBoxStyle]}>
            <Animated.Text style={[{ fontFamily: 'Inter_900Black', fontSize: 12, letterSpacing: 0.5 }, himTextStyle, onPhoto ? HERO_SHADOW : null]}>
              HIM
            </Animated.Text>
          </Animated.View>
        </Pressable>
        <View style={{ width: SP.s, height: 1.5, backgroundColor: lineColor }} />

        {/* Track: full tap target wrapping the middle line + draggable puck */}
        <Pressable
          onPress={(e) => handleTrackTap(e.nativeEvent.locationX)}
          style={{ flex: 1, height: TRACK_H, justifyContent: 'center' }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setTrackW(w);
            trackWShared.value = w;
          }}
        >
          {/* Middle line — runs edge to edge, connecting straight into the HIM/HER boxes */}
          <View style={{ position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: lineColor }} />

          {/* Draggable square — grows a border radius as it slides, spins on commit.
              Three grip lines inside it are the "this is draggable" cue,
              replacing the old MODE/TAP-OR-DRAG text hint below. */}
          <GestureDetector gesture={panGesture}>
            <Animated.View
              hitSlop={16}
              style={[{
                width: DOT_SIZE,
                height: DOT_SIZE,
                backgroundColor: pukColor,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 2,
              }, dotStyle]}
            >
              <View style={{ width: 1.5, height: DOT_SIZE * 0.4, backgroundColor: gripColor, opacity: 0.8 }} />
              <View style={{ width: 1.5, height: DOT_SIZE * 0.4, backgroundColor: gripColor, opacity: 0.8 }} />
              <View style={{ width: 1.5, height: DOT_SIZE * 0.4, backgroundColor: gripColor, opacity: 0.8 }} />
            </Animated.View>
          </GestureDetector>
        </Pressable>

        {/* HER — boxed outline, mirrors HIM */}
        <View style={{ width: SP.s, height: 1.5, backgroundColor: lineColor }} />
        <Pressable onPress={() => commitFromTap('her')} hitSlop={12}>
          <Animated.View style={[{ borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 3 }, herBoxStyle]}>
            <Animated.Text style={[{ fontFamily: 'Inter_900Black', fontSize: 12, letterSpacing: 0.5 }, herTextStyle, onPhoto ? HERO_SHADOW : null]}>
              HER
            </Animated.Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── QUICK CATEGORY — one box under the search bar. The box is a clipping
// wrapper: as the gender bar drags toward HER, the HIM icon slides OUT the
// left edge while the HER icon slides IN from the right — a conveyor scrubbed
// live by curveProgress (dragging back plays the same motion in reverse).
const QC_BOX = 44;
const QC_LBL = 60;
function QuickCat({ her, him, progress, active, curveSmStyle, onPress }: {
  her?: Category;
  him?: Category;
  progress: SharedValue<number>;
  active: 'her' | 'him';
  curveSmStyle: any;
  onPress: (c: Category) => void;
}) {
  // HIM: centered at p=0 → fully out the left edge at p=1.
  // HER: parked outside the right edge at p=0 → centered at p=1.
  const himStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -QC_BOX * progress.value }],
  }));
  const herStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: QC_BOX * (1 - progress.value) }],
  }));
  // Labels don't move — they blur/unblur in place. RN has no animatable text
  // blur filter, so we fake it: as a label fades its text-shadow radius grows
  // (soft halo = blur-out), while the incoming one sharpens as it fades in.
  const ink = C.ink;
  const inkClear = ink + '00';
  // Sequenced, non-overlapping: over the FIRST half of the drag the outgoing
  // label dissolves to a full blur (glyph fades to transparent so only its
  // blurred shadow remains) and disappears; over the SECOND half the incoming
  // label appears as a blur smear and sharpens. Never both readable at once.
  const himLblStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.3, 0.5, 1], [1, 1, 0, 0], 'clamp'),
      color: interpolateColor(p, [0, 0.25, 1], [ink, inkClear, inkClear]),
      textShadowRadius: interpolate(p, [0, 0.35, 1], [0, 10, 10], 'clamp'),
    };
  });
  const herLblStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.5, 0.65, 1], [0, 0, 1, 1], 'clamp'),
      color: interpolateColor(p, [0, 0.75, 1], [inkClear, inkClear, ink]),
      textShadowRadius: interpolate(p, [0, 0.6, 1], [10, 10, 0], 'clamp'),
    };
  });
  const cat = (active === 'her' ? her : him) ?? her ?? him;
  if (!cat) return null;
  const center = { alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <Pressable onPress={() => onPress(cat)} style={{ alignItems: 'center', width: QC_LBL }}>
      <Animated.View style={[{ width: QC_BOX, height: QC_BOX, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink, overflow: 'hidden' }, curveSmStyle]}>
        {him && (
          <Animated.View style={[StyleSheet.absoluteFillObject, center, himStyle]}>
            <RealIcon name={categoryIconName(him.label)} size={24} />
          </Animated.View>
        )}
        {her && (
          <Animated.View style={[StyleSheet.absoluteFillObject, center, herStyle]}>
            <RealIcon name={categoryIconName(her.label)} size={24} />
          </Animated.View>
        )}
      </Animated.View>
      <View style={[{ width: QC_LBL, height: 13, marginTop: 4 }, center]}>
        {him && (
          <Animated.Text numberOfLines={1} style={[T.monoB, { fontSize: 9, textAlign: 'center', position: 'absolute', left: 0, right: 0, textShadowColor: ink, textShadowOffset: { width: 0, height: 0 } }, himLblStyle]}>
            {him.label.toUpperCase()}
          </Animated.Text>
        )}
        {her && (
          <Animated.Text numberOfLines={1} style={[T.monoB, { fontSize: 9, textAlign: 'center', position: 'absolute', left: 0, right: 0, textShadowColor: ink, textShadowOffset: { width: 0, height: 0 } }, herLblStyle]}>
            {her.label.toUpperCase()}
          </Animated.Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── FEATURED CAT TILE — plain, static-size tile. The dock shrink is a
// single scale transform on the whole row's wrapper (featuredScaleStyle),
// not per-tile animation, so this stays a cheap, ordinary component.
function FeaturedCatTile({ item, onPress }: {
  item: { id: string; label: string; img: string | number };
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', width: FEATURED_TILE_W }}>
      <CachedImage source={item.img} style={{ width: FEATURED_TILE_W, height: FEATURED_TILE_W * 1.24 }} resizeMode="contain" />
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{item.label}</Text>
    </Pressable>
  );
}

// ─── STEAL TILE — Steals bento card. Full-bleed image, editorial-style
// caption pinned to the BOTTOM behind a gradient (never over the subject's
// face/product like a top overlay would) — a thin tracked-caps label over
// an italic price line, monochrome only. Border + radius are driven by
// BORDER()/curveSmStyle like every other card in this screen, so it
// sharpens/rounds with the same HIM↔HER gender curve as the rest of the app.
function StealTile({ label, priceLine, img, height, width, curveSmStyle, onPress }: {
  label: string;
  priceLine: string;
  img: string | number;
  height: number;
  width: number;
  curveSmStyle: any;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[{ width, height, overflow: 'hidden', backgroundColor: C.white }, BORDER(1), curveSmStyle]}
    >
      <CachedImage source={typeof img === 'string' ? { uri: img } : img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.65)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject as any}
      />
      <View style={{ position: 'absolute', left: SP.s, right: SP.s, bottom: SP.s }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.4 }}>{label.toUpperCase()}</Text>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: '#fff', letterSpacing: -0.3, marginTop: 1, ...HERO_SHADOW }}>{priceLine}</Text>
      </View>
    </AnimatedPressable>
  );
}

// ─── REEL POSTER TILE — Explore Reels card. Full-bleed thumbnail, bottom
// gradient for legibility, "REEL" badge, and an arrow CTA — tapping ANY part
// jumps straight to the Reels tab (nothing plays inline here, this is just a
// teaser rail). Border/radius share the same curveSmStyle as every other
// card, so it rounds/sharpens with the gender curve like the rest of Home.
function ReelPosterTile({ title, user, img, curveSmStyle, onPress }: {
  title: string;
  user: string;
  img: string;
  curveSmStyle: any;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[{ width: REEL_TILE_W, height: REEL_TILE_H, overflow: 'hidden', backgroundColor: '#111' }, BORDER(1), curveSmStyle]}
    >
      <CachedImage source={{ uri: img }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        start={{ x: 0, y: 0.35 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject as any}
      />
      <View style={{ position: 'absolute', top: SP.s, left: SP.s, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 4 }}>
        <Feather name="play" size={9} color="#fff" />
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#fff', letterSpacing: 0.5 }}>REEL</Text>
      </View>
      <View style={{ position: 'absolute', left: SP.s, right: SP.s, bottom: SP.s, flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1, marginRight: SP.s }}>
          <Text numberOfLines={1} style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#9fffb0' }}>{user}</Text>
          <Text numberOfLines={2} style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: '#fff', marginTop: 2 }}>{title}</Text>
        </View>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-up-right" size={14} color="#000" />
        </View>
      </View>
    </AnimatedPressable>
  );
}

// ─── OCCASION CARD — white product-cutout card with a label below, matching
// the reference shot's "Retro Sneakers / Oversized Sweatshirts" row. Border/
// radius ride the shared gender curve like every other card on Home.
function OccasionCard({ label, img, curveSmStyle, onPress }: {
  label: string;
  img: string | number;
  curveSmStyle: any;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ width: OCC_CARD_W }}>
      <Animated.View style={[{ width: OCC_CARD_W, height: OCC_CARD_H, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, BORDER(1), curveSmStyle]}>
        <CachedImage source={typeof img === 'string' ? { uri: img } : img} style={{ width: '82%', height: '82%' }} resizeMode="contain" />
      </Animated.View>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink, marginTop: 8, textAlign: 'center' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ─── PROMO BANNER — small swipeable strip with pagination dots, sits under
// the Explore Reels row. Each slide ties back to real content already on
// Home (the active gender's Steals hero image, the delivery hero photo)
// instead of inventing offers/pricing that don't exist elsewhere in the app.
function PromoBanner({ slides, curveSmStyle, onPress }: {
  slides: { id: string; bg: string; title: string; sub: string; cta: string; img: string | number }[];
  curveSmStyle: any;
  onPress: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const bw = W - SP.l * 2;
  const goto = (i: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    scrollRef.current?.scrollTo({ x: next * bw, animated: true });
    setIdx(next);
  };
  return (
    <View style={{ marginTop: SP.l, paddingHorizontal: SP.l }}>
      <View>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / bw))}
        >
          {slides.map((s) => (
            <AnimatedPressable
              key={s.id}
              onPress={onPress}
              style={[{ width: bw, height: 148, backgroundColor: s.bg, flexDirection: 'row', overflow: 'hidden' }, BORDER(1), curveSmStyle]}
            >
              <View style={{ flex: 1, padding: SP.m, justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 19, color: '#fff', lineHeight: 21 }}>{s.title}</Text>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{s.sub}</Text>
                <View style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: '#000', letterSpacing: 0.3 }}>{s.cta} →</Text>
                </View>
              </View>
              <CachedImage source={typeof s.img === 'string' ? { uri: s.img } : s.img} style={{ width: 128, height: '100%' }} resizeMode="cover" />
            </AnimatedPressable>
          ))}
        </ScrollView>
        {slides.length > 1 && (
          <>
            <Pressable onPress={() => goto(idx - 1)} hitSlop={10} style={{ position: 'absolute', left: 6, top: '50%', marginTop: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="chevron-left" size={16} color="#fff" />
            </Pressable>
            <Pressable onPress={() => goto(idx + 1)} hitSlop={10} style={{ position: 'absolute', right: 6, top: '50%', marginTop: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="chevron-right" size={16} color="#fff" />
            </Pressable>
          </>
        )}
      </View>
      {slides.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SP.s }}>
          {slides.map((_, i) => (
            <View key={i} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.35)' }} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── VIBE TILE — Shop-by-Vibe grid card. Same conveyor motion as QuickCat:
// the image wrapper clips its content, the HIM product slides out the left
// edge while the HER product rides in from the right (label matches), all
// scrubbed live by the gender drag.
function VibeTile({ her, him, index, progress, active, curveSmStyle, onPress }: {
  her?: Category;
  him?: Category;
  index: number;
  progress: SharedValue<number>;
  active: 'her' | 'him';
  curveSmStyle: any;
  onPress: (c: Category) => void;
}) {
  const cardW = (W - SP.l * 2 - SP.s * 3) / 4;
  const imgW = cardW * 0.85;
  const himStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -imgW * progress.value }],
  }));
  const herStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: imgW * (1 - progress.value) }],
  }));
  // Labels blur/unblur in place (no movement) — see QuickCat for the trick.
  const ink = C.ink;
  const inkClear = ink + '00';
  // Sequenced, non-overlapping: over the FIRST half of the drag the outgoing
  // label dissolves to a full blur (glyph fades to transparent so only its
  // blurred shadow remains) and disappears; over the SECOND half the incoming
  // label appears as a blur smear and sharpens. Never both readable at once.
  const himLblStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.3, 0.5, 1], [1, 1, 0, 0], 'clamp'),
      color: interpolateColor(p, [0, 0.25, 1], [ink, inkClear, inkClear]),
      textShadowRadius: interpolate(p, [0, 0.35, 1], [0, 10, 10], 'clamp'),
    };
  });
  const herLblStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.5, 0.65, 1], [0, 0, 1, 1], 'clamp'),
      color: interpolateColor(p, [0, 0.75, 1], [inkClear, inkClear, ink]),
      textShadowRadius: interpolate(p, [0, 0.6, 1], [10, 10, 0], 'clamp'),
    };
  });
  const cat = (active === 'her' ? her : him) ?? her ?? him;
  if (!cat) return null;
  const center = { alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <Pressable onPress={() => onPress(cat)} style={{ width: cardW, marginBottom: SP.xl, alignItems: 'center' }}>
      <FadeInUp delay={index * 40}>
        {/* Image — overflows above the card; the wrapper clips the conveyor */}
        <View style={{ alignItems: 'center', zIndex: 2 }}>
          <View style={{ width: imgW, height: imgW, marginBottom: -cardW * 0.3, overflow: 'hidden' }}>
            {him && (
              <Animated.View style={[StyleSheet.absoluteFillObject, himStyle]}>
                <CachedImage source={him.img} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </Animated.View>
            )}
            {her && (
              <Animated.View style={[StyleSheet.absoluteFillObject, herStyle]}>
                <CachedImage source={her.img} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </Animated.View>
            )}
          </View>
        </View>
        {/* Card body */}
        <Animated.View style={[{
          width: cardW,
          paddingTop: cardW * 0.35,
          paddingBottom: SP.s,
          alignItems: 'center',
          backgroundColor: C.white,
        }, BORDER(1), curveSmStyle]}>
          <View style={[{ width: cardW, height: 12 }, center]}>
            {him && (
              <Animated.Text numberOfLines={1} style={[{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: 'Inter_900Black', fontSize: 9, color: C.ink, letterSpacing: 0.5, textShadowColor: ink, textShadowOffset: { width: 0, height: 0 } }, himLblStyle]}>
                {him.label.toUpperCase()}
              </Animated.Text>
            )}
            {her && (
              <Animated.Text numberOfLines={1} style={[{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: 'Inter_900Black', fontSize: 9, color: C.ink, letterSpacing: 0.5, textShadowColor: ink, textShadowOffset: { width: 0, height: 0 } }, herLblStyle]}>
                {her.label.toUpperCase()}
              </Animated.Text>
            )}
          </View>
          <Text style={[T.mono, { fontSize: 7, color: C.dim, marginTop: 2 }]}>{`0${index + 1}`}</Text>
        </Animated.View>
      </FadeInUp>
    </Pressable>
  );
}
