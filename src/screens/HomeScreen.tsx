// HOME — Modern Brutalism / ASCII art / monochrome
// Every section has a UNIQUE layout — no two look alike
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Image, StyleSheet, StatusBar, Dimensions, FlatList, RefreshControl, DeviceEventEmitter, Platform, InteractionManager, Vibration, Modal } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withSpring, withRepeat, interpolate, interpolateColor, withTiming, runOnJS, SharedValue, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { BrutalButton, CachedImage, CARD, Chip, FadeInUp, OptionSheet, ProductCard, SectionHead, useGenderCurve } from '../components/Brutal';
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
// Full-bleed campaign background for the "SHOP BY OCCASION" section.
const OCC_HEAD_BG = require('../../assets/github-import/top/bg.png');
// FLASH FIT tiles — swap these three requires with your own art when ready.
const FLASH_TSHIRT_IMG = require('../../assets/github-import/men/tshirt.png');
const FLASH_JEANS_IMG = require('../../assets/github-import/men/jeans.png');
const FLASH_SHOES_IMG = require('../../assets/github-import/men/shoes.png');
// Cutout models (bg removed) for the "TRY AND BUY" band above Explore More.
const VR_TRY_ON = require('../../assets/vr-try-on.png');

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
// ALL = a genuine mix — interleave her/him (her, him, her, him…) so the ALL
// tab looks distinct from WOMEN (which used to be the first half of a plain
// concat) instead of "showing the same only".
const ALL_FEATURED_CATEGORIES = (() => {
  const out: typeof HER_FEATURED_CATEGORIES = [];
  const n = Math.max(HER_FEATURED_CATEGORIES.length, HIM_FEATURED_CATEGORIES.length);
  for (let i = 0; i < n; i++) {
    if (HER_FEATURED_CATEGORIES[i]) out.push(HER_FEATURED_CATEGORIES[i]);
    if (HIM_FEATURED_CATEGORIES[i]) out.push(HIM_FEATURED_CATEGORIES[i]);
  }
  return out;
})();

// STEALS — bento grid of price-banded deals, one big hero tile + two smaller
// tiles per gender, real catalog images/prices (no invented pricing).
const HER_STEALS = [
  { id: 'steal-her-1', label: 'Beauty',  priceLine: 'Under ₹999',  img: require('../../assets/steals/her/beauty.jpeg') },
  { id: 'steal-her-2', label: 'Jewelry', priceLine: 'Under ₹1499', img: require('../../assets/steals/her/jewelry.jpeg') },
  { id: 'steal-her-3', label: 'Tops',    priceLine: 'Under ₹1999', img: require('../../assets/steals/her/tops.jpeg') },
];
const HIM_STEALS = [
  { id: 'steal-him-1', label: 'T-shirts', priceLine: 'Under ₹1499', img: require('../../assets/steals/him/tee.jpeg') },
  { id: 'steal-him-2', label: 'Eyewear', priceLine: 'Under ₹1999', img: require('../../assets/steals/him/eyewear.jpeg') },
  { id: 'steal-him-3', label: 'Jackets', priceLine: 'Under ₹2499', img: require('../../assets/steals/him/jacket.jpeg') },
];

// TOP STORIES OF THE WEEK — finished poster artwork, split by active gender.
const HER_STORIES = [
  { id: 'her-story-1', img: require('../../assets/story-posters/her-60-min.png') },
  { id: 'her-story-2', img: require('../../assets/story-posters/her-friday.png') },
  { id: 'her-story-3', img: require('../../assets/story-posters/her-roommate.png') },
  { id: 'her-story-4', img: require('../../assets/story-posters/her-latest-drops.png') },
  { id: 'her-story-5', img: require('../../assets/story-posters/her-casual-affair.png') },
];
const HIM_STORIES = [
  { id: 'him-story-1', img: require('../../assets/story-posters/him-coffee.png') },
  { id: 'him-story-2', img: require('../../assets/story-posters/him-60-min.png') },
  { id: 'him-story-3', img: require('../../assets/story-posters/him-friday.png') },
  { id: 'him-story-4', img: require('../../assets/story-posters/him-bros.png') },
];

// CATEGORIES TO EXPLORE — a 3-col bento grid, gender-driven. 7 model cards laid
// out 3 / (1 + text block) / 3, with the "OUR FAVOURITE TRENDING CATEGORIES"
// copy sitting in the middle-right. Uses the local numbered model photos.
// NOTE: swap these requires for the real campaign images when available.
const HER_EXPLORE = [
  { id: 'exh-1', label: 'Wide Leg Denim', img: require('../../assets/github-import/numbered/1.png') },
  { id: 'exh-2', label: 'Sun Dress',      img: require('../../assets/github-import/numbered/2.png') },
  { id: 'exh-3', label: 'Bags',           img: require('../../assets/github-import/numbered/3.png') },
  { id: 'exh-4', label: 'Matching Sets',  img: require('../../assets/github-import/numbered/4.png') },
  { id: 'exh-5', label: 'Everyday Tanks', img: require('../../assets/github-import/numbered/5.png') },
  { id: 'exh-6', label: 'Workwear',       img: require('../../assets/github-import/numbered/6.png') },
  { id: 'exh-7', label: 'Mini Skirts',    img: require('../../assets/github-import/numbered/7.png') },
];
const HIM_EXPLORE = [
  { id: 'exm-1', label: 'Baggy Denim',  img: require('../../assets/github-import/numbered-men/1.png') },
  { id: 'exm-2', label: 'Graphic Tees', img: require('../../assets/github-import/numbered-men/2.png') },
  { id: 'exm-3', label: 'Sneakers',     img: require('../../assets/github-import/numbered-men/3.png') },
  { id: 'exm-4', label: 'Co-ord Sets',  img: require('../../assets/github-import/numbered-men/4.png') },
  { id: 'exm-5', label: 'Overshirts',   img: require('../../assets/github-import/numbered-men/5.png') },
  { id: 'exm-6', label: 'Workwear',     img: require('../../assets/github-import/numbered-men/6.png') },
  { id: 'exm-7', label: 'Cargos',       img: require('../../assets/github-import/numbered-men/7.png') },
];
const EX_YELLOW = '#F2E63C'; // highlighter accent behind the headline words
const EX_GAP = SP.s;

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
// Pixel-block underline for the shop-by tabs (same square-pixel language as the
// splash). N squares that slide under the active tab and re-form one by one.
const IND_N = 5;
const IND_PX = 5;
const IND_GAP = 3;
const IND_W = IND_N * IND_PX + (IND_N - 1) * IND_GAP;
const CAT_ORDER = ['all', 'men', 'women'] as const;
const FEATURED_TILE_GAP = SP.s;
const FEATURED_TILE_W = (W - FEATURED_TILE_PAD * 2 - FEATURED_TILE_GAP * 4) / 5.1;
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
// Same footprint as a product card — ~2 per screen with a sliver of the next.
const OCC_CARD_W = (W - OCC_CARD_PAD * 2 - OCC_CARD_GAP) / 2.15;
const OCC_CARD_H = Math.round(OCC_CARD_W * 1.42);
// Height of the SHOP BY OCCASION section — matches bg.png's 4:5 aspect at full
// width, so the campaign models fill the frame with the empty lower area free
// for the product cards to sit on.
const OCC_SECTION_H = Math.round(W * 1.42);
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
  const { gender, setGender, curveProgress, showConfirm, tabBarOffset } = useApp();
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
  // Which set the featured-categories row shows — independent of the page's
  // gender slice. ALL merges women + men.
  const [catFilter, setCatFilter] = useState<'all' | 'women' | 'men'>('all');
  // Measured width of the tabs row — used to slide the pixel underline under
  // whichever tab is active.
  const [tabsRowW, setTabsRowW] = useState(0);
  // Previous active-tab index, so the pixel underline can lead its trail from
  // the correct edge (rightmost dot first when moving right, leftmost first
  // when moving left) and read the same in both directions.
  const catIdxRef = useRef(CAT_ORDER.indexOf('all'));
  useEffect(() => { catIdxRef.current = CAT_ORDER.indexOf(catFilter); }, [catFilter]);

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
  // Sharp cards — no corner radius anywhere.
  const curveStyle = useAnimatedStyle(() => ({ borderRadius: 0 }));
  const curveSmStyle = useAnimatedStyle(() => ({ borderRadius: 0 }));
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
  const lastScrollY = useSharedValue(0);
  // Floating top search bar: hidden while scrolling, and revealed (sliding down
  // from the top) only once the user has scrolled PAST the hero/banner and comes
  // to a stop. 0 = hidden, 1 = shown.
  const floatSearch = useSharedValue(0);
  const [floatSearchOn, setFloatSearchOn] = useState(false);
  // Reveal only after the banner section has scrolled away.
  const SEARCH_REVEAL_Y = BANNER_H - 120;
  const floatSearchStyle = useAnimatedStyle(() => ({
    opacity: floatSearch.value,
    transform: [{ translateY: interpolate(floatSearch.value, [0, 1], [-24, 0]) }],
  }));
  const onHomeScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      // Hide the floating tab bar on scroll-down, reveal on scroll-up / at top.
      const dy = y - lastScrollY.value;
      if (y <= 4) tabBarOffset.value = withTiming(0, { duration: 200 });
      else if (dy > 8) tabBarOffset.value = withTiming(1, { duration: 220 });
      else if (dy < -8) tabBarOffset.value = withTiming(0, { duration: 200 });
      lastScrollY.value = y;

      const nowPinned = y >= catSectionY.value - 1;
      if (nowPinned !== wasPinned.value) {
        wasPinned.value = nowPinned;
        pinP.value = withTiming(nowPinned ? 1 : 0, { duration: 220 });
        runOnJS(setCatPinned)(nowPinned);
      }
    },
  });
  // Top viewport fade — hidden over the hero (it has its own black scrim);
  // fades in once the hero banner scrolls away.
  const topFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lastScrollY.value, [BANNER_H - 220, BANNER_H - 60], [0, 1], 'clamp'),
  }));
  const featuredRowH = useSharedValue(0);
  // Categories row no longer shrinks on scroll — it stays at full size (was a
  // scroll-linked scale transform tied to pinP).
  const featuredScaleStyle = useAnimatedStyle(() => ({}));
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
  const [exploreFilter, setExploreFilter] = useState<'ALL' | 'Tops' | 'Bottomwear' | 'Footwear' | 'Accessories' | 'Dresses'>('ALL');
  const [explorePage, setExplorePage] = useState(1);
  const [exploreSort, setExploreSort] = useState<'Popular' | 'Price: Low to High' | 'Price: High to Low' | 'Rating' | 'Biggest Discount'>('Popular');
  const [filterSheet, setFilterSheet] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  // Infinite feed — bump the page whenever a scroll gesture ends near the
  // bottom (once per gesture, so it can't runaway). The list loops, so the
  // feed never actually ends.
  const maybeLoadMoreExplore = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentSize.height - (contentOffset.y + layoutMeasurement.height) < 800) {
      setExplorePage(p => p + 1);
    }
  };

  // PERF: while the page is actively scrolling, background animations (the
  // brand banner's auto-rotate) hold still so they don't compete for frames.
  // Refs only — no re-renders, no behavior change when the page is idle.
  const scrollingRef = useRef(false);
  const scrollResumeT = useRef<any>(null);
  const markScrollStart = () => {
    scrollingRef.current = true;
    // Hide the floating search bar the moment scrolling starts.
    floatSearch.value = withTiming(0, { duration: 140 });
    if (floatSearchOn) setFloatSearchOn(false);
    if (scrollResumeT.current) clearTimeout(scrollResumeT.current);
    if (menuRevealT.current) clearTimeout(menuRevealT.current);
  };
  const menuRevealT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markScrollStop = (delay: number) => {
    if (scrollResumeT.current) clearTimeout(scrollResumeT.current);
    scrollResumeT.current = setTimeout(() => { scrollingRef.current = false; }, delay);
    // Menu (tab bar) + header (floating search) return TOGETHER the instant
    // scrolling stops — one shared fast timer with matching smooth timing, so
    // they animate in as a single motion (cancelled if momentum keeps scrolling).
    if (menuRevealT.current) clearTimeout(menuRevealT.current);
    menuRevealT.current = setTimeout(() => {
      // Never reveal while a screen is stacked over Home (category zoom etc.)
      if (!nav.isFocused()) return;
      const past = lastScrollY.value > SEARCH_REVEAL_Y;
      tabBarOffset.value = withTiming(0, { duration: 200 });
      floatSearch.value = withTiming(past ? 1 : 0, { duration: 200 });
      setFloatSearchOn(past);
    }, 80);
  };

  // Floating search vs covering screens (CategoryZoom etc.): the bar slides
  // AWAY the moment another screen opens over Home — so the zoom flight never
  // shares the frame with it — and slides back in when Home regains focus.
  useEffect(() => {
    const onBlur = nav.addListener('blur', () => {
      // Kill ANY pending reveal timers — a scroll-idle reveal (or the 2s
      // focus reveal from a previous return) firing after blur was popping
      // the search bar back in while a category screen was open.
      if (menuRevealT.current) clearTimeout(menuRevealT.current);
      if (searchFocusT.current) clearTimeout(searchFocusT.current);
      floatSearch.value = withTiming(0, { duration: 160 });
      setFloatSearchOn(false);
    });
    const onFocus = nav.addListener('focus', () => {
      // SEARCH BAR waits a couple of seconds after returning to Home — the
      // card's landing animation gets the stage to itself, THEN the search
      // bar slides back down. (Menu/tab bar is untouched — returns normally.)
      floatSearch.value = 0;
      setFloatSearchOn(false);
      if (searchFocusT.current) clearTimeout(searchFocusT.current);
      searchFocusT.current = setTimeout(() => {
        const past = lastScrollY.value > SEARCH_REVEAL_Y;
        floatSearch.value = withTiming(past ? 1 : 0, { duration: 260 });
        setFloatSearchOn(past);
      }, 2000);
    });
    return () => { onBlur(); onFocus(); if (searchFocusT.current) clearTimeout(searchFocusT.current); };
  }, [nav]);
  const searchFocusT = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
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
          // Categories no longer pin on scroll — they scroll away with the rest
          // of the page (was stickyHeaderIndices={[2]}).
          onScrollBeginDrag={markScrollStart}
          onMomentumScrollBegin={markScrollStart}
          onScrollEndDrag={(e) => { markScrollStop(1200); maybeLoadMoreExplore(e); }}
          onMomentumScrollEnd={(e) => { markScrollStop(150); maybeLoadMoreExplore(e); }}
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
                  <Text style={[T.caption, { color: '#fff', ...HERO_SHADOW }]}>TRENDZO</Text>
                  {/* Delivery ETA — the headline. Mirrors the quick-commerce "X minutes · Y away" line */}
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                    <Text numberOfLines={1} style={[T.h1, { color: '#fff', flexShrink: 0, ...HERO_SHADOW }]}>60 minutes</Text>
                    <Text numberOfLines={1} style={[T.micro, { color: '#fff', opacity: 0.85, flexShrink: 1 }, HERO_SHADOW]}>3 stores nearby</Text>
                  </View>
                  {/* Delivery location — tap to change (Myntra-style) */}
                  <Pressable onPress={() => nav.navigate('SavedAddresses')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                    <RealIcon name="marker" size={13} color="#fff" />
                    <Text style={[T.caption, { color: '#fff', ...HERO_SHADOW }]} numberOfLines={1}>Bandra, Mumbai 400050</Text>
                    <Feather name="chevron-down" size={13} color="#fff" />
                  </Pressable>
                </View>
                <Pressable onPress={() => nav.navigate('Profile')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="user" size={22} color="#fff" />
                </Pressable>
              </View>

              {/* ═══════════ SEARCH — overlaid on the banner, frosted/transparent ═══════════ */}
              <AnimatedPressable onPress={() => nav.navigate('Search')} style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12, gap: 10, marginHorizontal: SP.l, marginTop: SP.m, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.35)' }, curveStyle]}>
                <RealIcon name="search" size={22} color="#FFFFFF" />
                <Text style={[T.body, { flex: 1, color: '#fff' }]}>Search 60-min drops...</Text>
                <RealIcon name="mic" size={16} color="#fff" />
                <Pressable onPress={() => nav.navigate('ImageSearch')} hitSlop={8}>
                  <RealIcon name="camera" size={16} color="#fff" />
                </Pressable>
              </AnimatedPressable>

              {/* ═══════════ QUICK CATEGORIES — commented out for now (redesign request).
                  Kept intact below so it can be restored later; not deleted. ═══════════
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, marginTop: SP.m, paddingBottom: SP.s }}>
                <Pressable onPress={() => nav.navigate('Categories')} style={{ alignItems: 'center', width: 60 }}>
                  <Animated.View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, borderWidth: 1, borderColor: C.hairline }, curveSmStyle]}>
                    <RealIcon name="dashboard" size={22} color={C.white} />
                  </Animated.View>
                  <Text style={[T.micro, { marginTop: 4, textAlign: 'center' }]} numberOfLines={1}>ALL</Text>
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

            {/* GENDER SWITCH removed from the banner per redesign. `gender` state
                still drives which campaigns/categories/steals show. */}
          </View>

        {/* ═══ MARQUEE — sticks directly to the bottom of the banner, no gap ═══ */}
        <Marquee text="New styles everyday  //  120+ stores across India  //  60-min delivery  //  Hassle-free returns " />

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
          // The section no longer docks to the top (see stickyHeader note above),
          // so the old insets.top clearance is just dead space — a small gap
          // under the marquee is all that's needed.
          style={{ backgroundColor: C.white, paddingTop: SP.s, paddingBottom: SP.xs }}
          onLayout={(e) => { catSectionY.value = e.nativeEvent.layout.y; }}
        >
          {/* Bento grid of explore categories — gender-driven (him / her). */}
          <ExploreGrid nav={nav} gender={gender} setGender={setGender} />
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
                  qualifier="Starting at"
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
        ║  TOP STORIES OF THE WEEK — editorial carousel ║
        ╚══════════════════════════════════════════════╝
        */}
        <TopStories key={gender} nav={nav} gender={gender} />

        <ReelsForYouSection nav={nav} gender={gender} />

        {/*
        ╔══════════════════════════════════════════════╗
        ║  SHOP BY OCCASION — seasonal hero + card row  ║
        ╚══════════════════════════════════════════════╝
        */}
        <View style={{ marginTop: SP.xl }}>
          {(() => {
            const occ = gender === 'her' ? HER_OCCASION : HIM_OCCASION;
            return (
              // Full-bleed campaign background (bg.png). The centered heading sits
              // near the top over the models, and the product cards sit ON the
              // image's empty lower area.
              <View style={{ height: OCC_SECTION_H, overflow: 'hidden' }}>
                <CachedImage source={OCC_HEAD_BG} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />

                {/* Centered heading. */}
                <Pressable onPress={() => nav.navigate('OccasionShopping')} style={{ alignItems: 'center', paddingTop: SP.l }}>
                  <Text style={[T.h2, { textAlign: 'center', textTransform: 'uppercase' }]}>
                    Shop by Occasion
                  </Text>
                </Pressable>

                {/* Product cards pinned to the bottom, sitting on top of the image. */}
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: SP.l }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: OCC_CARD_PAD, gap: OCC_CARD_GAP }}
                  >
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
                </View>
              </View>
            );
          })()}
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  FLASH FIT OF THE DAY — bundle grid (fit)     ║
        ╚══════════════════════════════════════════════╝
        */}
        <FlashFitBundle onOpen={(label) => nav.navigate('Category', { id: label.toLowerCase(), label })} />

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

        <Animated.View style={feedPushStyle}>
        {tailMounted && (<>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  TRY AND BUY — cutout models over wordmark    ║
        ╚══════════════════════════════════════════════╝
        */}
        <View style={{ marginTop: SP.xl, paddingHorizontal: SP.l }}>
          {/* centred section heading (like Shop by Occasion) */}
          <View style={{ alignItems: 'center', marginBottom: SP.m }}>
            <Text style={[T.h2, { textAlign: 'center', textTransform: 'uppercase' }]}>See It On You</Text>
            <Text style={[T.caption, { color: C.dim, marginTop: 8, textAlign: 'center' }]}>Tap a look and try it on yourself</Text>
          </View>
          {/* BIG BOX */}
          <View style={[{ height: rf(430), overflow: 'hidden' }, BORDER(1)]}>
            {/* soft grey gradient backdrop */}
            <LinearGradient colors={['#C9C9C9', '#ECECEC']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
            {/* big wordmark near the TOP — sits behind the models' heads, where the cutout is transparent */}
            <Text adjustsFontSizeToFit numberOfLines={1} style={{ position: 'absolute', top: rf(8), left: SP.m, right: SP.m, textAlign: 'center', fontFamily: 'Inter_900Black', fontSize: rf(84), letterSpacing: -1, color: '#A6A6A6', textTransform: 'uppercase' }}>Try & Buy</Text>
            {/* cutout models on top — transparent bg lets the wordmark show through */}
            <CachedImage source={VR_TRY_ON} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            {/* plain "Explore" text link, pinned to the bottom (no box/bg) */}
            <Pressable onPress={() => nav.navigate('Categories')} style={{ position: 'absolute', left: 0, right: 0, bottom: SP.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Text style={[T.button, { color: C.ink }]}>View</Text>
              <Feather name="arrow-right" size={16} color={C.ink} />
            </Pressable>
          </View>
        </View>

        {/*
        ╔══════════════════════════════════════════════╗
        ║  EXPLORE MORE — Filters + infinite product grid ║
        ╚══════════════════════════════════════════════╝
        */}
        <View>
          {/* heading with Sort & Filter controls on the right */}
          <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[T.h2, { textTransform: 'uppercase', flex: 1 }]} numberOfLines={1}>Explore More</Text>
              {/* Sort (left) */}
              <Pressable
                onPress={() => setSortSheet(true)}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: exploreSort === 'Popular' ? C.white : C.ink, marginRight: 6 }, BORDER(1)]}
              >
                <Feather name="bar-chart-2" size={12} color={exploreSort === 'Popular' ? C.ink : C.white} />
                <Text style={[T.caption, { color: exploreSort === 'Popular' ? C.ink : C.white }]}>Sort</Text>
              </Pressable>
              {/* Filter (right) */}
              <Pressable
                onPress={() => setFilterSheet(true)}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: exploreFilter === 'ALL' ? C.white : C.ink }, BORDER(1)]}
              >
                <RealIcon name="filter" size={12} color={exploreFilter === 'ALL' ? C.ink : C.white} />
                <Text style={[T.caption, { color: exploreFilter === 'ALL' ? C.ink : C.white }]}>{exploreFilter === 'ALL' ? 'Filter' : exploreFilter}</Text>
              </Pressable>
            </View>
          </View>

          {(() => {
            const list = exploreProducts.filter(p => exploreFilter === 'ALL' || p.category === exploreFilter);
            // Sort a copy — 'Popular' keeps the natural order.
            const sorted = [...list];
            if (exploreSort === 'Price: Low to High') sorted.sort((a, b) => a.price - b.price);
            else if (exploreSort === 'Price: High to Low') sorted.sort((a, b) => b.price - a.price);
            else if (exploreSort === 'Rating') sorted.sort((a, b) => b.rating - a.rating);
            else if (exploreSort === 'Biggest Discount') sorted.sort((a, b) => (1 - b.price / b.original) - (1 - a.price / a.original));
            // Loop the list so the feed is endless — page grows on scroll.
            const count = explorePage * 6;
            const visible = sorted.length ? Array.from({ length: count }, (_, i) => sorted[i % sorted.length]) : [];
            return (
              <View>
                <View style={{ paddingHorizontal: SP.l, marginBottom: SP.s }}>
                  <Text style={[T.micro]}>{`${list.length} results · ${exploreFilter} · ${exploreSort}`}</Text>
                </View>

                {/* 2-col grid — image fills the card frame */}
                <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
                  {visible.map((p, i) => (
                    <Pressable key={p.id + '-' + i} onPress={() => nav.navigate('ProductDetail', { product: p })} style={{ width: CARD.w, marginBottom: SP.s }}>
                      <View style={[{ width: CARD.w, height: CARD.imgH, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
                        <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </View>
                      <Text style={[T.productName, { marginTop: 6 }]} numberOfLines={1}>{p.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                        <Text style={T.price}>₹{p.price}</Text>
                        {p.original > p.price && <Text style={T.mrp}>₹{p.original}</Text>}
                      </View>
                    </Pressable>
                  ))}
                </View>

                {/* infinite feed — auto-loads on scroll; only the empty state shows */}
                {list.length === 0 && (
                  <View style={[{ marginHorizontal: SP.l, marginTop: SP.m, padding: SP.xl, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
                    <RealIcon name="search" size={32} color={C.dim} />
                    <Text style={[T.h3, { marginTop: 8 }]}>No matches</Text>
                    <Text style={[T.caption, { marginTop: 4, textAlign: 'center' }]}>Try a different filter or search term</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </View>

        {/* ═══════════ FOOTER ═══════════ */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.huge }}>
          <Text style={[T.micro, { textAlign: 'center', marginTop: 8 }]}>End.Stream · Trendzo</Text>
          <Text style={[T.micro, { textAlign: 'center', marginTop: 4 }]}>From your block · in 60 minutes</Text>
        </View>
        </>)}
        </Animated.View>
        </AnimatedScrollView>

        {/* Viewport fades — content appears to emerge at the top and dissolve at
            the bottom while scrolling. Non-interactive. */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 54 }, topFadeStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 84 }}
        />

        {/* ═══ FLOATING SEARCH — pinned at the very top. Hidden while scrolling,
            slides down when scrolling stops, and only once past the banner. ═══ */}
        <Animated.View
          pointerEvents={floatSearchOn ? 'auto' : 'none'}
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: SP.l, backgroundColor: C.bg, zIndex: 50, elevation: 50 }, floatSearchStyle]}
        >
          <AnimatedPressable onPress={() => nav.navigate('Search')} style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: C.hairline, backgroundColor: C.white }, curveStyle]}>
            <RealIcon name="search" size={20} color={C.ink} />
            <Text style={[T.body, { flex: 1, color: C.dim }]}>Search 60-min drops...</Text>
            <RealIcon name="mic" size={16} color={C.ink} />
            <Pressable onPress={() => nav.navigate('ImageSearch')} hitSlop={8}>
              <RealIcon name="camera" size={16} color={C.ink} />
            </Pressable>
          </AnimatedPressable>
        </Animated.View>
      </View>

      {/* EXPLORE MORE — Filter bottom sheet */}
      <OptionSheet
        visible={filterSheet}
        title="Filter"
        options={['ALL', 'Tops', 'Bottomwear', 'Footwear', 'Accessories', 'Dresses']}
        selected={exploreFilter}
        onSelect={(v) => { setExploreFilter(v as typeof exploreFilter); setExplorePage(1); setFilterSheet(false); }}
        onClose={() => setFilterSheet(false)}
      />
      {/* EXPLORE MORE — Sort bottom sheet */}
      <OptionSheet
        visible={sortSheet}
        title="Sort by"
        options={['Popular', 'Price: Low to High', 'Price: High to Low', 'Rating', 'Biggest Discount']}
        selected={exploreSort}
        onSelect={(v) => { setExploreSort(v as typeof exploreSort); setExplorePage(1); setSortSheet(false); }}
        onClose={() => setSortSheet(false)}
      />
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
          <Text style={[T.monoB]}>{n}</Text>
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
const BANNER_H = Math.round(SCREEN_H * 0.72);
// How far the adaptive tint reaches into the page: past the gender switch (~60)
// and the banner's top margin, ending at the MIDDLE of the banner.
const CONTENT_TINT_H = 60 + SP.l + Math.round(BANNER_H / 2);
// Overlap the content-side tint into the header overlay's tail end (see below) —
// swallows any sub-pixel rounding gap between the two so there's never a seam.
const SEAM_OVERLAP = 16;

// ─── CATEGORIES TO EXPLORE — gender-driven bento grid ────────────────────────
function ExploreCard({ label, img, w, h, onPress, onZoom }: { label: string; img: any; w: number; h: number; onPress: () => void; onZoom?: (frame: { x: number; y: number; w: number; h: number }) => void }) {
  // The colour box only fills the lower ~78%; the model PNG fills the full
  // frame (uncropped) and is layered on top, so its head/shoulders rise out of
  // the box on top.
  // onZoom: measure the tile's on-screen frame and hand it to the caller so
  // the CategoryZoom hero-morph can take off from EXACTLY this rect.
  const boxRef = useRef<View>(null);
  const handlePress = () => {
    if (!onZoom) return onPress();
    const node = boxRef.current;
    if (!node) return onPress();
    node.measureInWindow((x, y, mw, mh) => {
      if (mw && mh) onZoom({ x, y, w: mw, h: mh });
      else onPress();
    });
  };
  return (
    <Pressable onPress={handlePress} style={{ width: w, zIndex: 2 }}>
      <View ref={boxRef} collapsable={false} style={{ width: w, height: h }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.78, backgroundColor: '#f1f1f1' }} />
        <CachedImage
          source={img}
          style={[StyleSheet.absoluteFillObject, { zIndex: 5 }] as any}
          resizeMode="contain"
        />
      </View>
      <Text
        numberOfLines={1}
        style={[T.caption, { width: w, color: C.ink, marginTop: 6, textAlign: 'center' }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── GENDER PULL TAB — elastic drag-to-switch, stuck to the right edge of the
// category section. Pull it left like a rubber band: it stretches with real
// resistance (the further you pull, the harder it fights), and on release it
// snaps back with a bouncy spring. Pull past ~half the travel → flips HIM/HER.
function GenderPullTab({ him, onFlip }: { him: boolean; onFlip: () => void }) {
  const tx = useSharedValue(0);      // rubber-banded pull distance (0 … -LIMIT)
  const boxW = useSharedValue(80);   // measured tab width — needed to pin the right edge
  const LIMIT = 96; // max visual travel — the rubber band asymptotes here
  const buzz = () => Vibration.vibrate(8);
  const pan = Gesture.Pan()
    // Horizontal pulls only — vertical moves stay with the page scroll.
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const mag = Math.max(0, -e.translationX); // only pull LEFT (outward)
      // Rubber-band resistance: displacement asymptotes toward LIMIT.
      tx.value = -(LIMIT * mag) / (mag + LIMIT);
    })
    .onEnd((e) => {
      // Two ways to flip, like real elastic:
      //  • a NORMAL steady pull past ~55% of the stretch, or
      //  • a STRONG fast yank (high leftward velocity) even if shorter.
      // Tiny idle tugs still just bounce back.
      const strongYank = e.velocityX < -900 && tx.value <= -LIMIT * 0.28;
      const willFlip = tx.value <= -LIMIT * 0.55 || strongYank;
      if (willFlip) runOnJS(buzz)(); // instant haptic acknowledgement
      // FAST springy snap-back — stiffer spring so the whole bounce (overshoot
      // + wobble) is over in ~0.4s; the gender flip fires only in the spring's
      // completion callback, i.e. strictly AFTER the animation has finished.
      tx.value = withSpring(0, { damping: 12, stiffness: 460, mass: 0.6 }, (finished) => {
        if (willFlip && finished) runOnJS(onFlip)();
      });
    });
  // The tab does NOT move — its right edge stays glued to the screen edge and
  // the body STRETCHES leftward (scale around the pinned right edge), so the
  // pull reads as forcing a stuck piece of elastic, never a sliding box.
  const boxStyle = useAnimatedStyle(() => {
    const mag = -tx.value;
    const s = 1 + mag / boxW.value;          // left edge extends exactly by the pull
    const p = Math.min(1, mag / LIMIT);
    return {
      transform: [
        { translateX: -(boxW.value * (s - 1)) / 2 }, // re-pin the RIGHT edge while scaling
        { scaleX: s },
        { scaleY: 1 - p * 0.14 },                    // thins as it strains, like real rubber
      ],
    };
  });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(e) => { boxW.value = e.nativeEvent.layout.width; }}
        style={[{ position: 'absolute', right: -SP.l, bottom: 0 }, boxStyle]}
      >
        {/* fixed width — the HER↔HIM label swap must not relayout mid-bounce */}
        <View style={{ width: 96, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, paddingVertical: 10, paddingLeft: 10, paddingRight: SP.l + 4 }}>
          <Feather name="chevrons-left" size={14} color={C.white} />
          <Text style={[T.caption, { color: C.white, fontFamily: 'Helvetica Neue', fontWeight: '700', letterSpacing: 0.5 }]} numberOfLines={1}>{him ? 'HER' : 'HIM'}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// Pastel dome tints for the CategoryZoom hero-morph — salmon first to match
// the reference art, then a rotation so neighbouring tiles differ.
const ZOOM_TINTS = ['#E8A79A', '#A9BFE6', '#BDE3C3', '#E6D3A9', '#D9B8E6', '#A9DEDA', '#E6B8C4'];

function ExploreGrid({ nav, gender, setGender }: { nav: any; gender: 'her' | 'him'; setGender: (g: 'her' | 'him') => void }) {
  const cats = gender === 'her' ? HER_EXPLORE : HIM_EXPLORE;
  const go = (label: string) => nav.navigate('Categories', { label });
  // Tap → hero-morph: the measured tile frame rides along so the dome takes
  // off from the exact card the user touched.
  const goZoom = (c: { label: string; img: any }, i: number) => (frame: { x: number; y: number; w: number; h: number }) =>
    nav.navigate('CategoryZoom', { label: c.label, img: c.img, tint: ZOOM_TINTS[i % ZOOM_TINTS.length], _frame: frame });
  const EX_CW = (W - SP.l * 2 - EX_GAP * 2) / 3; // 3 columns
  const EX_H = Math.round(EX_CW * 1.32);         // every card uses the same image height
  const him = gender === 'him';
  return (
    <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m }}>
      {/* Row 1 — three cards (static, always mounted → no reload on open) */}
      <View style={{ flexDirection: 'row', gap: EX_GAP }}>
        {cats.slice(0, 3).map((c, i) => (
          <ExploreCard key={i} label={c.label} img={c.img} w={EX_CW} h={EX_H} onPress={() => go(c.label)} onZoom={goZoom(c, i)} />
        ))}
      </View>

      {/* Row 2 — card left, headline right (same layout for both genders).
          The "View <other>" button switches gender. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: EX_GAP, marginTop: SP.l }}>
        <ExploreCard label={cats[3].label} img={cats[3].img} w={EX_CW} h={EX_H} onPress={() => go(cats[3].label)} onZoom={goZoom(cats[3], 3)} />
        <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', paddingLeft: SP.s }}>
          <View style={{ alignSelf: 'flex-start' }}>
            <View style={{ alignSelf: 'flex-start' }}>
              <View style={{ position: 'absolute', left: 12, right: -3, bottom: 3, height: 10, backgroundColor: EX_YELLOW }} />
              <Text style={[T.h2, { textTransform: 'uppercase' }]}>Our Favourite</Text>
            </View>
            <View style={{ alignSelf: 'flex-start', marginTop: -2 }}>
              <View style={{ position: 'absolute', left: 0, right: -8, bottom: 3, height: 10, backgroundColor: EX_YELLOW }} />
              <Text style={[T.h2, { textTransform: 'uppercase' }]}>Trending</Text>
            </View>
            <View style={{ alignSelf: 'flex-start', marginTop: -2 }}>
              <View style={{ position: 'absolute', left: 10, right: -10, bottom: 3, height: 10, backgroundColor: EX_YELLOW }} />
              <Text style={[T.h2, { textTransform: 'uppercase' }]}>Categories</Text>
              <View style={{ position: 'absolute', right: -23, bottom: 1, width: 18, height: 18, borderRadius: 9, backgroundColor: EX_YELLOW }} />
            </View>
          </View>
          {/* Elastic pull-tab stuck to the right edge — drag & release to flip gender. */}
          <GenderPullTab him={him} onFlip={() => setGender(him ? 'her' : 'him')} />
        </View>
      </View>

      {/* Row 3 — three cards (static) */}
      <View style={{ flexDirection: 'row', gap: EX_GAP, marginTop: SP.m }}>
        {cats.slice(4, 7).map((c, i) => (
          <ExploreCard key={i + 4} label={c.label} img={c.img} w={EX_CW} h={EX_H} onPress={() => go(c.label)} onZoom={goZoom(c, i + 4)} />
        ))}
      </View>
    </View>
  );
}

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
  // A swipe should never open the campaign page. Set true the moment a drag
  // starts and clear it a beat after the drag/momentum ends, so the tap that
  // fires on finger-lift after a swipe is ignored.
  const swipingRef = useRef(false);
  const clearSwipeSoon = () => { setTimeout(() => { swipingRef.current = false; }, 60); };

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
    // Keyed by gender so switching the ALL/MEN/WOMEN tab crossfades the banner
    // in with a gentle zoom instead of the old hard `animated:false` cut.
    <MotiView
      key={gender}
      from={{ opacity: 0, scale: 1.06 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 460, easing: Easing.out(Easing.cubic) }}
    >
      <AnimatedFlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        // No rubber-band past the first/last poster — overscroll was revealing
        // the white page behind the banner.
        bounces={false}
        alwaysBounceHorizontal={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b: any) => b.id}
        getItemLayout={(_: any, i: number) => ({ length: W, offset: W * i, index: i })}
        // Android defaults list clipping ON — with the parent scroll translated it
        // blanks the posters after scrolling away and back. 3-4 slides; keep attached.
        removeClippedSubviews={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { swipingRef.current = true; stop(); }}
        onScrollEndDrag={clearSwipeSoon}
        onMomentumScrollEnd={(e: any) => { setIndex(Math.round(e.nativeEvent.contentOffset.x / W)); start(); clearSwipeSoon(); }}
        renderItem={({ item }: { item: any }) => (
          <BannerSlide item={item} onPress={() => { if (swipingRef.current) return; nav.navigate(gender === 'her' ? 'ForHer' : 'ForHim'); }} />
        )}
      />
    </MotiView>
  );
}

// ─── TOP STORIES — editorial "In the spotlight" carousel ─────────────────────
// Centered heading + subheading, a snapping row of finished tall posters with a
// small "TRENDING NOW" card label, and pagination dots.
const STORY_CARD_W = Math.round(W - 104);          // narrower so both neighbours peek in
const STORY_IMG_H = Math.round(STORY_CARD_W * 1.32);
const STORY_SNAP = STORY_CARD_W + STEAL_GAP; // same gutter as the STEALS bento grid

type StoryPoster = (typeof HER_STORIES)[number] | (typeof HIM_STORIES)[number];

function StoryCard({ s, i, scrollX, nav }: { s: StoryPoster; i: number; scrollX: SharedValue<number>; nav: any }) {
  // Smoothly grow the card as it reaches the centre and shrink the neighbours —
  // driven off the live scroll offset, so it eases continuously (never a jump).
  // No opacity change — side cards stay fully visible, just smaller.
  const aStyle = useAnimatedStyle(() => {
    const input = [(i - 1) * STORY_SNAP, i * STORY_SNAP, (i + 1) * STORY_SNAP];
    const scale = interpolate(scrollX.value, input, [0.9, 1, 0.9], 'clamp');
    const translateY = interpolate(scrollX.value, input, [8, 0, 8], 'clamp');
    // Scale toward the INNER edge (the one facing the centre card) so the
    // shrink never widens the gutter — the gap between cards stays constant
    // (matches the STEALS bento). Right-side cards anchor left, left-side right.
    const origin = i * STORY_SNAP - scrollX.value >= 0 ? 'left center' : 'right center';
    return { transformOrigin: origin, transform: [{ scale }, { translateY }] };
  });
  return (
    <Animated.View style={[{ width: STORY_CARD_W }, aStyle]}>
      <Pressable
        onPress={() => nav.navigate('Categories')}
        style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.hairline, overflow: 'hidden' }}
      >
        <Text style={[T.caption, { textAlign: 'center', paddingVertical: 12 }]}>
          Trending Now
        </Text>
        <View style={{ width: '100%', height: STORY_IMG_H }}>
          <CachedImage source={s.img} style={{ width: '100%', height: '100%' } as any} resizeMode="cover" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function TopStories({ nav, gender }: { nav: any; gender: 'her' | 'him' }) {
  const stories = gender === 'her' ? HER_STORIES : HIM_STORIES;
  const storyN = stories.length;
  // Three copies make the row loop seamlessly; the gender key remounts this
  // section at the correct middle-copy offset whenever HER/HIM changes.
  const storyLoop = [...stories, ...stories, ...stories];
  const storyMid = storyN * STORY_SNAP;
  const [index, setIndex] = useState(0);
  // Start at the middle-copy offset so the scale interpolation is correct on the
  // very first frame — otherwise every visible card reads as "off-centre" and
  // renders shrunk (too much gutter) until the first swipe syncs the real offset.
  const scrollX = useSharedValue(storyMid);
  const listRef = useRef<any>(null);
  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => { scrollX.value = e.contentOffset.x; } });

  const onSettle = (x: number) => {
    const abs = Math.round(x / STORY_SNAP);
    setIndex(((abs % storyN) + storyN) % storyN);
    // Recenter into the middle copy so there's always room to swipe both ways.
    if (abs < storyN || abs >= storyN * 2) {
      const target = (abs % storyN) * STORY_SNAP + storyMid;
      listRef.current?.scrollTo({ x: target, animated: false });
    }
  };

  return (
    <View style={{ marginTop: SP.xl }}>
      <Text style={[T.h2, { textAlign: 'center', textTransform: 'uppercase' }]}>
        Top Stories of the Week
      </Text>
      <Text style={[T.body, { color: C.dim, textAlign: 'center', marginTop: 3 }]}>
        In the spotlight
      </Text>

      <Animated.ScrollView
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STORY_SNAP}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: storyMid, y: 0 }}
        contentContainerStyle={{ paddingHorizontal: (W - STORY_CARD_W) / 2, gap: STEAL_GAP, paddingTop: SP.l, paddingBottom: SP.s }}
        onMomentumScrollEnd={(e) => onSettle(e.nativeEvent.contentOffset.x)}
      >
        {storyLoop.map((s, i) => (
          <StoryCard key={`${s.id}-${i}`} s={s} i={i} scrollX={scrollX} nav={nav} />
        ))}
      </Animated.ScrollView>

      {/* Pagination dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: SP.s }}>
        {stories.map((_, i) => (
          <View
            key={i}
            style={{ width: i === index ? 8 : 6, height: i === index ? 8 : 6, borderRadius: 4, backgroundColor: i === index ? C.ink : C.hairline }}
          />
        ))}
      </View>
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
    <Text numberOfLines={1} style={[T.caption, { color: C.white }]}>
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
        <Text style={[T.micro, { color: fg, textAlign: 'center' }]} numberOfLines={2}>{game.title}</Text>
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
      <Text style={[T.micro, { textAlign: 'center' }]}>{'[ Tap deck to open ]'}</Text>
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
  const { curveProgress, setGenderFromDrag } = useApp();
  const [trackW, setTrackW] = useState(0);
  const trackWShared = useSharedValue(0);
  const startProgress = useSharedValue(0);
  // Worklets can't call the C Proxy on the UI thread — snapshot the colors
  // we need on the JS thread and pass them in as plain strings. On the banner
  // photo it's always white-on-dark regardless of night mode (matches the
  // rest of the header overlay).
  const activeColor = onPhoto ? '#FFFFFF' : '#000000';
  const dimColor = onPhoto ? 'rgba(255,255,255,0.55)' : '#666666';
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
            <Animated.Text style={[T.caption, himTextStyle, onPhoto ? HERO_SHADOW : null]}>
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
            <Animated.Text style={[T.caption, herTextStyle, onPhoto ? HERO_SHADOW : null]}>
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
      <Animated.View style={[{ width: QC_BOX, height: QC_BOX, backgroundColor: C.white, borderWidth: 1, borderColor: C.hairline, overflow: 'hidden' }, curveSmStyle]}>
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
          <Animated.Text numberOfLines={1} style={[T.micro, { textAlign: 'center', position: 'absolute', left: 0, right: 0, textShadowColor: ink, textShadowOffset: { width: 0, height: 0 } }, himLblStyle]}>
            {him.label}
          </Animated.Text>
        )}
        {her && (
          <Animated.Text numberOfLines={1} style={[T.micro, { textAlign: 'center', position: 'absolute', left: 0, right: 0, textShadowColor: ink, textShadowOffset: { width: 0, height: 0 } }, herLblStyle]}>
            {her.label}
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
      <Text style={[T.caption, { color: C.ink, marginTop: 4, textAlign: 'center' }]} numberOfLines={1}>{item.label}</Text>
    </Pressable>
  );
}

// ─── STEAL TILE — consistent three-level merchandising hierarchy:
// product name, small qualifier, then the large price.
function StealTile({ label, priceLine, qualifier = 'Under', img, height, width, curveSmStyle, onPress }: {
  label: string;
  priceLine: string;
  qualifier?: string;
  img: string | number;
  height: number;
  width: number;
  curveSmStyle: any;
  onPress: () => void;
}) {
  const amount = priceLine.replace(/^[^₹]*/, '');
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[{ width, height, overflow: 'hidden', backgroundColor: C.white }, BORDER(1), curveSmStyle]}
    >
      <CachedImage source={typeof img === 'string' ? { uri: img } : img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        start={{ x: 0, y: 0.55 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject as any}
      />
      <View style={{ position: 'absolute', left: SP.s, right: SP.s, bottom: SP.s }}>
        <Text style={
          label === 'T-shirts'
            ? { fontFamily: 'Inter_900Black', fontSize: rf(14), lineHeight: rf(18), letterSpacing: 0, color: '#fff' }
            : [T.body, { color: '#fff' }]
        }>
          {label}
        </Text>
        <Text style={[T.micro, { color: '#fff', marginTop: 5 }]}>{qualifier}</Text>
        <Text style={[T.h1, { color: '#fff', marginTop: -2 }]}>{amount}</Text>
      </View>
    </AnimatedPressable>
  );
}

const REEL_SECTION_W = W - SP.l * 2;
const REEL_PORTRAIT_GAP = STEAL_GAP;
const REEL_PORTRAIT_W = (REEL_SECTION_W - REEL_PORTRAIT_GAP) / 2; // 2-up row
const REEL_PORTRAIT_H = Math.round(REEL_PORTRAIT_W * 1.6); // portrait cards, 2-up
const REEL_FEATURE_IMAGE_W = STEAL_COL_W;
const REEL_FEATURE_H = Math.round(STEAL_COL_W * 1.25); // top-2 editorial cards bumped up
const REEL_FEATURE_SHEER = require('../../assets/reel-features/sheer-confidence.png');
const REEL_FEATURE_EVENING = require('../../assets/reel-features/evening-edit.png');
const REEL_FEATURE_HIM_CITY = require('../../assets/reel-features/him-city.png');
const REEL_FEATURE_HIM_DARK = require('../../assets/reel-features/him-after-dark.jpeg');
const HIM_REEL_PREVIEWS = [
  require('../../assets/reels/men1.mp4'),
  require('../../assets/reels/men2.mp4'),
  require('../../assets/reels/men3.mp4'),
];
const HER_REEL_PREVIEWS = [
  require('../../assets/reels/female1.mp4'),
  require('../../assets/reels/female2.mp4'),
  require('../../assets/reels/female3.mp4'),
];

function EditorialReelFeature({ img, reverse, label, title, copy, cta, accent, panelColors, onPress }: {
  img: string | number;
  reverse?: boolean;
  label: string;
  title: string;
  copy: string;
  cta: string;
  accent: string;
  panelColors: readonly [string, string];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ height: REEL_FEATURE_H, flexDirection: reverse ? 'row-reverse' : 'row', borderWidth: 1, borderColor: C.hairline, backgroundColor: C.white, overflow: 'hidden' }}
    >
      <View style={{ width: REEL_FEATURE_IMAGE_W, height: '100%' }}>
        <CachedImage source={typeof img === 'string' ? { uri: img } : img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      </View>
      <LinearGradient colors={panelColors} style={{ flex: 1, overflow: 'hidden', padding: SP.m, justifyContent: 'flex-start' }}>
        {/* Giant faded word (its own text, different from the heading) BLEEDING
            off the panel — clipped hard mid-letter, no ellipsis, no shrinking. */}
        <Text
          numberOfLines={1}
          ellipsizeMode="clip"
          style={{ position: 'absolute', bottom: -rf(16), left: -10, width: '160%', fontFamily: 'Inter_900Black', fontSize: rf(74), letterSpacing: -2, color: C.ink, opacity: 0.1, textTransform: 'uppercase' }}
        >
          {title}
        </Text>
        {/* Big black offer number — fully visible (wraps, never cut); only the
            faded background word gets clipped. */}
        <Text
          numberOfLines={2}
          style={{ fontFamily: 'Inter_900Black', fontSize: rf(24), lineHeight: rf(28), letterSpacing: -0.5, color: C.ink, textTransform: 'uppercase' }}
        >
          {label}
        </Text>
        {/* Plain "View" link — sits under the heading, ABOVE the faded word */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SP.s }}>
          <Text style={[T.button, { color: C.ink, fontSize: rf(14) }]}>View</Text>
          <Feather name="arrow-right" size={14} color={C.ink} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function LocalReelPreview({ source }: { source: number }) {
  const player = useVideoPlayer(source, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} nativeControls={false} contentFit="cover" style={StyleSheet.absoluteFillObject} />;
}

function PortraitReelCard({ img, video, onPress }: {
  img?: string;
  video?: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ width: REEL_PORTRAIT_W, height: REEL_PORTRAIT_H, overflow: 'hidden', backgroundColor: '#111' }}>
      {video ? (
        <LocalReelPreview source={video} />
      ) : (
        <CachedImage source={{ uri: img! }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.22)']} start={{ x: 0, y: 0.66 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject as any} />
      <View style={{ position: 'absolute', left: 7, bottom: 7 }}>
        <Text style={[T.micro, { color: '#fff', textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#fff', paddingBottom: 2 }]}>View</Text>
      </View>
    </Pressable>
  );
}

function ReelDeliveryBanner({ her, onPress }: { her: boolean; onPress: () => void }) {
  // Light pastel gradients (no dark tones) — dark ink text for legibility.
  const gradient = her ? ['#FBDCE9', '#F6C6D9'] as const : ['#DCE9FB', '#C6D9F6'] as const;
  const fg = '#111';
  const divider = 'rgba(0,0,0,0.15)';
  return (
    <Pressable onPress={onPress} style={{ height: 116, borderWidth: 1, borderColor: C.hairline, overflow: 'hidden' }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 10 }}>
        <View style={{ height: 42, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="timer-outline" size={27} color={fg} />
          </View>
          <View style={{ flex: 1, height: 42, marginLeft: SP.s, justifyContent: 'center' }}>
            <Text style={[T.h3, { fontFamily: 'Inter_900Black', color: fg }]}>60-Minute Delivery</Text>
            <Text numberOfLines={1} style={[T.micro, { color: 'rgba(0,0,0,0.6)', marginTop: 1 }]}>Your style. Now, not later.</Text>
          </View>
          <View style={{ height: 42, backgroundColor: '#111', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={[T.caption, { color: '#fff' }]}>SHOP NOW</Text>
            <Feather name="arrow-right" size={14} color="#fff" />
          </View>
        </View>

        <View style={{ flex: 1, flexDirection: 'row', marginTop: 6, paddingVertical: 4 }}>
          {[
            ['heart', 'Trendy Styles'],
            ['zap', 'Lightning Fast'],
            ['rotate-ccw', 'Easy Returns'],
          ].map(([icon, text], i) => (
            <View key={text} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, borderLeftWidth: i ? 1 : 0, borderLeftColor: divider }}>
              <Feather name={icon as any} size={10} color={fg} />
              <Text numberOfLines={1} style={{ fontFamily: 'Helvetica Neue', fontWeight: '400', fontSize: rf(10), color: fg }}>{text}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function ReelsForYouSection({ nav, gender }: { nav: any; gender: 'her' | 'him' }) {
  const openReels = () => nav.navigate('ReelsTab');
  const her = gender === 'her';
  const activeReels = her ? HER_REEL_PREVIEWS : HIM_REEL_PREVIEWS;
  const openSelectedReel = (index: number) => nav.navigate('ReelsTab', {
    selectedVideo: activeReels[index],
    selectedIndex: index,
    selectedGender: gender,
    selectionToken: Date.now(),
  });
  return (
    <View style={{ marginTop: SP.xl, paddingHorizontal: SP.l }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.m }}>
        <Text style={[T.h2, { textTransform: 'uppercase' }]}>Reels For You</Text>
        <Pressable onPress={openReels} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={[T.caption, { color: C.ink }]}>View all</Text>
          <Feather name="chevron-right" size={15} color={C.ink} />
        </Pressable>
      </View>

      <View style={{ gap: STEAL_GAP }}>
        <EditorialReelFeature
          img={her ? REEL_FEATURE_SHEER : REEL_FEATURE_HIM_CITY}
          label="Up to 50% Off"
          title="Stay"
          copy=""
          cta=""
          accent="#111111"
          panelColors={['#FFFFFF', '#FFFFFF']}
          onPress={openReels}
        />
        <EditorialReelFeature
          img={her ? REEL_FEATURE_EVENING : REEL_FEATURE_HIM_DARK}
          reverse
          label="Hot on the Gram"
          title="Fresh"
          copy=""
          cta=""
          accent={her ? '#C84F87' : '#245A9B'}
          panelColors={her ? ['#FFF8FC', '#F5E5F1'] : ['#F7FAFF', '#DFEAF7']}
          onPress={openReels}
        />

        <View style={{ flexDirection: 'row', gap: REEL_PORTRAIT_GAP }}>
          <PortraitReelCard video={activeReels[0]} onPress={() => openSelectedReel(0)} />
          <PortraitReelCard video={activeReels[1]} onPress={() => openSelectedReel(1)} />
        </View>

        <ReelDeliveryBanner her={her} onPress={() => nav.navigate('Categories')} />
      </View>
    </View>
  );
}

// ─── OCCASION CARD — white product-cutout card with a label below, matching
// the reference shot's "Retro Sneakers / Oversized Sweatshirts" row. Border/
// radius ride the shared gender curve like every other card on Home.
function OccasionCard({ label, img, curveSmStyle, onPress }: {
  label: string;
  img: string | number;
  curveSmStyle?: any;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ width: OCC_CARD_W }}>
      <View style={[{ width: OCC_CARD_W, height: OCC_CARD_H, backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
        {/* soft depth behind the cutout so it doesn't float on flat white */}
        <LinearGradient
          colors={['rgba(0,0,0,0.06)', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* product cutout fills the upper area */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 }}>
          <CachedImage source={typeof img === 'string' ? { uri: img } : img} style={{ width: '88%', height: '95%' }} resizeMode="contain" />
        </View>
        {/* label bar baked into the card, with a go arrow */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.ink, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={[T.caption, { color: C.white }]} numberOfLines={1}>{label}</Text>
          <Feather name="arrow-right" size={15} color={C.white} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── FLASH FIT BUNDLE — a 4-piece "fit" (top / bottom / shoe / accessory) in a
// proper bento grid: the two tall tiles sit diagonally (top-left + bottom-right)
// so the sizes read as intentional, not lopsided. Clean white — a black eyebrow
// chip and gold full-star tiles carry the interest instead of a bg colour.
function FlashFitBundle({ onOpen }: { onOpen?: (label: string) => void }) {
  // Right tile = full column height; left-top (t-shirt) is taller than
  // left-bottom (shoe) so the two left tiles are intentionally uneven.
  const GRID_H = Math.round(W * 0.95);             // full height → right (jeans) tile
  const topH = Math.round(GRID_H * 0.56);          // left-top (t-shirt) — the taller one
  const bottomH = GRID_H - topH - SP.s;            // left-bottom (shoe) — the shorter one

  const Tile = ({ label, img, h }: { label: string; img: any; h: number }) => (
    <Pressable onPress={() => onOpen?.(label)} style={[{ backgroundColor: '#F4F4F4', height: h, overflow: 'hidden' }, BORDER(1)]}>
      {/* centred heading-style label, no stars */}
      <Text style={[T.h3, { color: C.ink, textAlign: 'center', textTransform: 'uppercase', paddingTop: 12, paddingHorizontal: 8 }]} numberOfLines={1}>{label}</Text>
      {/* image fills the rest of the grey tile — no inner spacing */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <CachedImage source={img} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>
    </Pressable>
  );

  return (
    <View style={{ marginTop: SP.xl, backgroundColor: C.white }}>
      {/* header */}
      <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
        <Text style={[T.h2, { color: C.ink, textTransform: 'uppercase' }]} numberOfLines={1} adjustsFontSizeToFit>Flash Fit of the Day</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Text style={[T.caption, { color: C.dim }]}>Fresh looks served hot!</Text>
          <Text style={[T.caption, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '700' }]}>Under ₹999</Text>
          <Feather name="chevron-right" size={14} color={C.ink} />
        </View>
      </View>
      {/* bento grid — tall tiles on the diagonal */}
      <View style={{ flexDirection: 'row', gap: SP.s, padding: SP.l }}>
        <View style={{ flex: 1, gap: SP.s }}>
          <Tile label="T-Shirt" img={FLASH_TSHIRT_IMG} h={topH} />
          <Tile label="Shoes" img={FLASH_SHOES_IMG} h={bottomH} />
        </View>
        <View style={{ flex: 1.35 }}>
          <Tile label="Jeans" img={FLASH_JEANS_IMG} h={GRID_H} />
        </View>
      </View>
    </View>
  );
}

// ─── PROMO BANNER — auto-advancing strip that cycles through its slides slowly
// and continuously (loops back to the start). Instead of pagination dots it
// shows story-style progress bars: one thin bar per slide, the active one
// filling left-to-right over the slide's duration. Each slide ties back to real
// content already on Home (Steals hero image, delivery hero photo, occasion).
const PROMO_SLIDE_MS = 4500; // how long each banner holds before advancing (slow)

// One progress bar in the story-style indicator row. `done` slides read full,
// the `active` slide fills over PROMO_SLIDE_MS, upcoming slides stay empty.
function PromoProgressBar({ state, progress }: { state: 'done' | 'active' | 'todo'; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    width: state === 'done' ? '100%' : state === 'active' ? `${progress.value * 100}%` : '0%',
  }));
  return (
    <View style={{ flex: 1, height: 3, backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden', borderRadius: 2 }}>
      <Animated.View style={[{ height: '100%', backgroundColor: C.ink }, fill]} />
    </View>
  );
}

function PromoBanner({ slides, curveSmStyle, onPress }: {
  slides: { id: string; bg: string; title: string; sub: string; cta: string; img: string | number }[];
  curveSmStyle: any;
  onPress: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const bw = W - SP.l * 2;
  const progress = useSharedValue(0);

  // Auto-advance: whenever the active slide changes, restart its fill animation
  // and schedule the jump to the next slide (looping back to the first).
  useEffect(() => {
    if (slides.length <= 1) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: PROMO_SLIDE_MS, easing: Easing.linear });
    const t = setTimeout(() => {
      setIdx((prev) => {
        const next = (prev + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: next * bw, animated: true });
        return next;
      });
    }, PROMO_SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, slides.length, bw]);

  return (
    <View style={{ marginTop: SP.l, paddingHorizontal: SP.l }}>
      <View>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // Manual swipe just updates which slide is active — the effect above
          // then restarts the timer/fill from there.
          onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / bw))}
        >
          {slides.map((s) => (
            <AnimatedPressable
              key={s.id}
              onPress={onPress}
              style={[{ width: bw, height: 112, backgroundColor: s.bg, flexDirection: 'row', overflow: 'hidden' }, BORDER(1), curveSmStyle]}
            >
              <View style={{ flex: 1, padding: SP.m, justifyContent: 'center' }}>
                <Text style={[T.productTitle, { color: '#fff' }]}>{s.title}</Text>
                <Text style={[T.body, { color: 'rgba(255,255,255,0.85)', marginTop: 4 }]}>{s.sub}</Text>
                <View style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={[T.button, { color: '#000' }]}>{s.cta} →</Text>
                </View>
              </View>
              <CachedImage source={typeof s.img === 'string' ? { uri: s.img } : s.img} style={{ width: 128, height: '100%' }} resizeMode="cover" />
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>
      {slides.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: SP.s }}>
          {slides.map((_, i) => (
            <PromoProgressBar
              key={i}
              progress={progress}
              state={i < idx ? 'done' : i === idx ? 'active' : 'todo'}
            />
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
              <Animated.Text numberOfLines={1} style={[T.micro, { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: C.ink, textShadowColor: ink, textShadowOffset: { width: 0, height: 0 } }, himLblStyle]}>
                {him.label}
              </Animated.Text>
            )}
            {her && (
              <Animated.Text numberOfLines={1} style={[T.micro, { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: C.ink, textShadowColor: ink, textShadowOffset: { width: 0, height: 0 } }, herLblStyle]}>
                {her.label}
              </Animated.Text>
            )}
          </View>
          <Text style={[T.micro, { marginTop: 2 }]}>{`0${index + 1}`}</Text>
        </Animated.View>
      </FadeInUp>
    </Pressable>
  );
}
