import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Dimensions, Alert, InteractionManager, Platform, BackHandler, Modal } from 'react-native';
import Animated, { FadeIn, FadeInDown, withSpring, useAnimatedStyle, useSharedValue, useAnimatedScrollHandler, useAnimatedReaction, withTiming, withDelay, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import { MotiView as MV } from 'moti';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, StackActions, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER, HELV, HEADER_TOP, rf, useThemeVersion } from '../theme/brutal';
import { BrutalButton, BrutalIconBtn, BagButton, CenterModal, OptionSheet, CachedImage, ProductCard, FadeInUp, CARD_STYLES} from '../components/Brutal';
import { useApp } from '../state/AppState';
import { RichText } from '../components/RichText';
import { ReviewComposer } from '../components/ReviewComposer';
import type { Product } from '../data/mockData';
import { CatalogEmpty, ProductRailSkeleton, ProductGridSkeleton } from '../components/CatalogState';
import {
  getProductDetail, listReviews, listProducts, isBackendListingId, listSizeScales,
  type ProductDetailData, type Review,
} from '../services/catalog';
import { listCoupons, type Coupon } from '../services/promotions';

const { width, height: SCREEN_H } = Dimensions.get('window');
const PRODUCT_ZOOM_MS = 440;
const PRODUCT_CONTENT_FADE_MS = 260;
const PRODUCT_ZOOM_EASING = Easing.inOut(Easing.cubic);
/** How long before the image lands that the white backdrop lifts, revealing the card beneath. */
const CARD_REVEAL_MS = 180;
const CTA_CROSSFADE_DISTANCE = 44;

const fmtReviewDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
};

// Last-resort only. A product's real sizes come from its variants; failing that
// we ask the backend for the scale that fits its CATEGORY (so shoes get UK
// numbers, belts inches). This letter run is what shows if both are unavailable.
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

/**
 * Stand-in for "this screen was opened without a product".
 *
 * It used to be `PRODUCTS[0]` — a bundled demo coat — so a broken navigation
 * silently rendered a real-looking, buyable product page for an item that does
 * not exist. Blank fields plus an empty `id` let the render below show the
 * unavailable state instead, without every hook needing an optional chain.
 */
const NO_PRODUCT: Product = {
  id: '', brand: '', name: '', price: 0, original: 0, rating: 0,
  colors: ['#e6e6e6', '#e6e6e6'], img: '', category: '',
};

export default function ProductDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  // Loosely typed on purpose: grids decorate their rows with extra display-only
  // fields (rating/reviews/stock) before pushing them here.
  const product: any = route.params?.product ?? NO_PRODUCT;
  const hasProduct = !!product.id;
  // Stable so the "More to Love" rail's ProductCard memo can hold.
  const pushProduct = useCallback((p: any) => nav.push('ProductDetail', { product: p }), [nav]);
  // Every live coupon, not just the headline one. The banner advertises the
  // first; tapping it opens a sheet with all of them and their real terms — the
  // banner used to be inert, so a shopper who wanted to know what "Min ₹999"
  // meant, or whether a second code existed, had nowhere to go.
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponSheet, setCouponSheet] = useState(false);
  /** Which coupon's fine print is expanded in the sheet. */
  const [openCouponId, setOpenCouponId] = useState<string | null>(null);
  const topCoupon = coupons[0] ?? null;
  useEffect(() => {
    let cancelled = false;
    listCoupons()
      .then((cs) => { if (!cancelled) setCoupons(cs.filter((c) => c.active)); })
      .catch(() => { /* no banner rather than a fake one */ });
    return () => { cancelled = true; };
  }, []);
  const brandName = route.params?.brand || product.brand; // store brand when opened from a brand store
  const { addToCart, showToast, showConfirm, gender, requireAuth, token } = useApp();
  // Real product detail (variants/sizes/colours/gallery) + reviews + similar, keyed
  // off the listing id. Category strips ids as `lst_…-<index>`, so recover the base
  // id. Falls back to the passed adapted/mock product + mock reviews on any failure.
  const listingId = String(product?.id ?? '').replace(/-\d+$/, '');
  const [detail, setDetail] = useState<ProductDetailData | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  // Category-appropriate sizes, fetched only when the product itself has none.
  const [scaleSizes, setScaleSizes] = useState<string[]>([]);
  const [similar, setSimilar] = useState<Product[] | null>(null);
  const [similarStatus, setSimilarStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const closeStarted = useRef(false);
  /**
   * The pop is guarded + failsafed. This screen is a TRANSPARENT modal, so if
   * it fails to pop it silently sits over the page below — list "pinned",
   * scroll dead, "More to Love" floating with no background. That is exactly
   * what happened after a camera/try-on round trip: Android detaches this
   * screen while the camera is on top, and on re-attach Reanimated's
   * completion callbacks (which used to be the ONLY thing calling goBack)
   * can go dead. The animation is now best-effort; the pop is guaranteed.
   */
  const popped = useRef(false);
  const popFailsafe = useRef<any>(null);
  const popNow = () => {
    if (popped.current) return;
    popped.current = true;
    if (popFailsafe.current) { clearTimeout(popFailsafe.current); popFailsafe.current = null; }
    nav.goBack();
  };
  // Close mirrors open: fade content, then fly the image/backdrop back to the measured card frame.
  const goBack = () => {
    if (closeStarted.current) return;
    closeStarted.current = true;
    if (route.params?._zoom && route.params?._cardFrame) {
      clearReveal();
      galleryOpacity.value = 0;
      overlayOpacity.value = 1;
      // Failsafe: pop no matter what, a beat after the full fly should have
      // finished. If the animation ran, popNow was already called and this is
      // a no-op; if the animation system was dead, this still frees the page.
      popFailsafe.current = setTimeout(popNow, PRODUCT_CONTENT_FADE_MS + PRODUCT_ZOOM_MS + 160);
      contentFade.value = withTiming(0, { duration: PRODUCT_CONTENT_FADE_MS, easing: Easing.out(Easing.cubic) }, (contentDone) => {
        if (!contentDone) return;
        // Animated HERE, not handed to ZoomProvider.
        //
        // This path is one continuous UI-thread timeline over an image that is already decoded and
        // on screen. `backdropFade` lifts the white cover over the LAST 180ms so the home card is
        // revealed just as the image lands on it, and the pop happens only once the flight is done.
        backdropFade.value = withDelay(
          PRODUCT_ZOOM_MS - CARD_REVEAL_MS,
          withTiming(0, { duration: CARD_REVEAL_MS, easing: Easing.out(Easing.cubic) })
        );
        // The flying image fades into the real card over the flight's last
        // 120ms — the landing is a crossfade, never a swap.
        overlayOpacity.value = withDelay(
          PRODUCT_ZOOM_MS - 120,
          withTiming(0, { duration: 120 })
        );
        imgAnim.value = withTiming(0, { duration: PRODUCT_ZOOM_MS, easing: PRODUCT_ZOOM_EASING }, (fin) => {
          if (fin) runOnJS(popNow)();
        });
      });
    } else popNow();
  };
  // Clear the failsafe if the screen unmounts through any other path.
  useEffect(() => () => { if (popFailsafe.current) clearTimeout(popFailsafe.current); }, []);

  /**
   * Re-bind Reanimated after a round trip to a pushed screen (camera try-on,
   * search). Android detaches this screen while another sits on top; on
   * re-attach the animated styles can be bound to stale native views, so
   * animations "run" without drawing. A forced re-render on refocus makes
   * every useAnimatedStyle re-attach to the live view tree.
   */
  const [, setFocusNonce] = useState(0);
  const everFocused = useRef(false);
  useFocusEffect(React.useCallback(() => {
    if (everFocused.current) setFocusNonce((n) => n + 1);
    else everFocused.current = true;
  }, []));
  /**
   * Android back must run the SAME animated close as the on-screen arrow.
   *
   * Without this the hardware button and the back gesture pop the screen straight out through
   * React Navigation — and since ProductDetail is registered with `animation: 'none'`, that is a
   * hard cut with no fly-down at all. Anyone closing the page that way would see no animation no
   * matter how correct the zoom code is.
   */
  // FOCUS-SCOPED — never a bare useEffect. This screen stays mounted (it's a
  // transparent modal) while TryOn/Search sit on top of it, and a global
  // listener registered here STEALS the back gesture from those screens: it
  // ran this screen's close invisibly, popped the TOP screen (TryOn) instead,
  // and left an invisible ProductDetail sheet over the whole app whose
  // ScrollView swallowed every scroll on every page ("pages freeze" bug).
  useFocusEffect(React.useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true; // handled — do not let the navigator pop underneath us
    });
    return () => sub.remove();
  }, []));

  const s = React.useMemo(() => makeS(), [useThemeVersion()]);
  const [size, setSize] = useState<string | null>(null);
  /**
   * The pending Add/Buy action while the CENTRED size modal is open.
   *
   * Tapping "Add to bag" without a size used to fire a "Pick a size" toast and
   * scroll the page — a notification with no instruction and no obvious next
   * step, which read as the button simply not working. It now blocks with a
   * modal in the middle of the screen: choose a size there and the action the
   * shopper originally asked for continues by itself.
   */
  const [sizeSheet, setSizeSheet] = useState<null | 'add' | 'buy'>(null);
  /** The centred "Added to bag" confirmation. Closes itself after a beat. */
  const [addedModal, setAddedModal] = useState<null | { size: string }>(null);
  const addedTimer = useRef<any>(null);
  useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);
  const [needSize, setNeedSize] = useState(false);
  // Size-row position = INFO section's y in the scroll + the row's y inside it.
  const infoYRef = useRef(0);
  const sizeLocalYRef = useRef(0);
  // Heavy below-the-fold content (carousels, grid) renders only AFTER the open transition,
  // so it never competes with the animation on the JS thread → no dropped frames.
  // Two-stage reveal so the deferred content doesn't all mount in one janky frame:
  // First paint = just the viewport (image/price/coupon); the rest mounts AFTER the fade so it
  // never competes with the transition. Scroll stays locked until the page is loaded.
  const cardFrame = route.params?._cardFrame as { x: number; y: number; w: number; h: number } | undefined;
  const isZoom = !!(route.params?._zoom && cardFrame);
  // First paint = just the viewport (image/price/coupon). Everything else mounts AFTER the zoom,
  // so nothing competes with the animation. Scroll stays locked until it's done.
  // NO staged mounting. Every previous variant (two waves, one wave, opacity
  // gymnastics) still let "More to Love" sit right under the hero for the
  // first frames and then get pushed down as colors/sizes/description mounted
  // above it. The WHOLE page now lays out from frame one — the zoom's
  // contentFade covers the mount, and when content fades in, every section is
  // already exactly where it will stay.
  const [ready, setReady] = useState(true);
  const [gridReady, setGridReady] = useState(true);
  // `settled` = the open animation is done; network fetches (detail, reviews,
  // similar) wait for it so their responses can never re-render the page
  // mid-flight. Layout is fully mounted from frame one regardless.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (isZoom) return; // the fly's completion raises contentFade + settled
    contentFade.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setSettled(true), 320);
    return () => clearTimeout(t);
  }, []);
  // NOTE: gated on gridReady — these responses used to land MID-ZOOM and
  // re-render the whole page during the fly, which is exactly the jank the
  // deferred-mount logic tries to avoid. Now they fire only after the open
  // transition (and its two-stage reveal) has fully settled.
  useEffect(() => {
    if (!settled || !isBackendListingId(listingId)) return;
    let cancelled = false;
    getProductDetail(listingId).then((d) => { if (!cancelled) setDetail(d); }).catch(() => {});
    listReviews(listingId).then((r) => { if (!cancelled) setReviews(r); }).catch(() => {});
    // 24, not 12: the "More to Love" grid used to pad itself by repeating the
    // same 12 rows four times. Ask for as many as the grid can show and let it
    // end honestly when the catalog does.
    setSimilarStatus('loading');
    listProducts({ gender, limit: 24 })
      .then((p) => { if (!cancelled) { setSimilar(p); setSimilarStatus('ready'); } })
      .catch(() => { if (!cancelled) { setSimilar([]); setSimilarStatus('error'); } });
    return () => { cancelled = true; };
  }, [listingId, gender, settled]);
  // Where the gallery image lands: MEASURED from the header's actual rendered
  // height (+1 divider). Every derived formula was off by a pixel or two on
  // some device — measurement is exact by construction.
  const [slotY, setSlotY] = useState(HEADER_TOP + 47);
  const slotMeasured = useRef(false);
  // MEMOISED, not rebuilt per render. Both fly worklets below capture SLOT, so
  // a fresh object identity on every render re-created and re-attached
  // `overlayStyle`/`overlayImgStyle` — and the header's onLayout fires setSlotY
  // right as the flight starts, so that churn landed squarely inside the
  // animation. Now it only changes when the measured slot actually moves.
  const SLOT = useMemo(() => ({ x: 0, y: slotY, w: width, h: width * 1.2 }), [slotY]);
  const imgAnim = useSharedValue(isZoom ? 0 : 1);         // 0 = at card, 1 = at gallery slot
  const backdropFade = useSharedValue(isZoom ? 0 : 1);     // home → white as the image expands
  const contentFade = useSharedValue(0);      // header / details opacity — ALWAYS fades in
  const galleryOpacity = useSharedValue(isZoom ? 0 : 1);   // real gallery (hidden until handoff)
  const overlayOpacity = useSharedValue(0); // flying image visibility — raised the tick the flight starts
  const flyStarted = useRef(false);
  // Pending "load the rest" timers — cancelled on close so a heavy mount never lands mid-close.
  const revealTimers = useRef<any[]>([]);
  const clearReveal = () => { revealTimers.current.forEach(clearTimeout); revealTimers.current = []; };
  const revealContent = () => { setReady(true); setGridReady(true); setSettled(true); }; // layout is pre-mounted; this now just unlocks the network work
  const scheduleReveal = () => { revealTimers.current.push(setTimeout(revealContent, 280)); };
  // Fire EXACTLY when the page is mounted + laid out (overlay onLayout) → runs on a free UI
  // thread. One flow: image expands + bg turns white → hand off → content fades → content loads.
  const flyRetries = useRef(0);
  const startFly = () => {
    if (flyStarted.current || !isZoom) return;
    // Bounded wait for the header measurement so the flight aims at the REAL
    // slot from its first frame (10 frames max, then fly with the estimate).
    if (!slotMeasured.current && flyRetries.current < 10) {
      flyRetries.current += 1;
      requestAnimationFrame(startFly);
      return;
    }
    flyStarted.current = true;
    overlayOpacity.value = 1; // becomes visible in the same frame the flight begins
    backdropFade.value = withTiming(1, { duration: PRODUCT_ZOOM_MS, easing: PRODUCT_ZOOM_EASING });
    imgAnim.value = withTiming(1, { duration: PRODUCT_ZOOM_MS, easing: PRODUCT_ZOOM_EASING }, (fin) => {
      if (fin) {
        galleryOpacity.value = 1;
        // Crossfade the overlay away — a hard swap made any sub-pixel
        // difference between overlay and gallery read as a tiny jump.
        overlayOpacity.value = withTiming(0, { duration: 110 });
        contentFade.value = withTiming(1, { duration: PRODUCT_CONTENT_FADE_MS, easing: Easing.out(Easing.cubic) });
        runOnJS(scheduleReveal)();                                      // load the rest after the fade
      }
    });
  };
  useEffect(() => {
    if (!isZoom) return;
    const id = setTimeout(startFly, 180); // fallback if onLayout is delayed
    return () => clearTimeout(id);
  }, []);
  // TRANSFORM-ONLY fly (translate + scale around the centre) — the old version
  // animated left/top/width/height, which forces a full layout pass EVERY
  // frame; iOS absorbed it, Android showed it as jitter. The overlay is now
  // laid out ONCE at the gallery slot and flown purely on the GPU — identical
  // motion on both platforms, zero per-frame layout.
  const overlayStyle = useAnimatedStyle(() => {
    if (!cardFrame) return { opacity: 0 };
    const cx = cardFrame.x + cardFrame.w / 2, cy = cardFrame.y + cardFrame.h / 2;
    const scx = SLOT.x + SLOT.w / 2, scy = SLOT.y + SLOT.h / 2;
    return {
      opacity: overlayOpacity.value,
      transform: [
        { translateX: interpolate(imgAnim.value, [0, 1], [cx - scx, 0]) },
        { translateY: interpolate(imgAnim.value, [0, 1], [cy - scy, 0]) },
        { scaleX: interpolate(imgAnim.value, [0, 1], [cardFrame.w / SLOT.w, 1]) },
        { scaleY: interpolate(imgAnim.value, [0, 1], [cardFrame.h / SLOT.h, 1]) },
      ],
    };
  });
  // The overlay frame is scaled NON-uniformly (card and gallery slot have
  // different aspect ratios), which visibly stretched the product photo and
  // made the "inside" of the card appear to reflow during the fly. This
  // counter-scale cancels the distortion on the image itself every frame: the
  // photo stays perfectly proportioned while only the frame morphs shape.
  const overlayImgStyle = useAnimatedStyle(() => {
    if (!cardFrame) return {};
    const sx = interpolate(imgAnim.value, [0, 1], [cardFrame.w / SLOT.w, 1]);
    const sy = interpolate(imgAnim.value, [0, 1], [cardFrame.h / SLOT.h, 1]);
    // max, not min: cards render COVER (fill + crop) while the gallery renders
    // CONTAIN. max makes the undistorted image FILL the frame at the card end
    // (the frame's overflow:hidden crops it exactly like the card does) and
    // settle to u=1 — a perfect contain match — at the gallery end.
    const u = Math.max(sx, sy);
    return { transform: [{ scaleX: u / sx }, { scaleY: u / sy }] };
  });
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentFade.value }));
  const galleryStyle = useAnimatedStyle(() => ({ opacity: galleryOpacity.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropFade.value }));
  const [colorIdx, setColorIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  // Full-screen image viewer — opened by tapping the gallery image; all
  // slides swipeable inside, starting at the tapped one.
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [viewerPage, setViewerPage] = useState(0);
  const galleryRef = useRef<ScrollView>(null);
  const scrollRef = useRef<any>(null);
  // CTA is pinned to the bottom until the user scrolls down to the inline buttons (just
  // before the recommendations); then it un-pins and the inline buttons take over.
  const [ctaY, setCtaY] = useState(99999);
  const [viewH, setViewH] = useState(0);
  const [barH, setBarH] = useState(88);
  const [fixedCtaInteractive, setFixedCtaInteractive] = useState(true);
  const scrollY = useSharedValue(0);
  const fixedCtaStyle = useAnimatedStyle(() => {
    // Below ~40px of scroll the bar is unconditionally parked: content mounting
    // (description arriving, the grid appearing) moves the inline anchor around
    // at open, and the crossfade chased it — the visible "Add to bag glitches
    // then moves down". The crossfade only matters near the page bottom anyway.
    if (scrollY.value < 40) {
      return { opacity: contentFade.value, transform: [{ translateY: 0 }] };
    }
    const anchorY = width * 1.2 + ctaY;
    const parkScroll = Math.max(1, anchorY - viewH + barH);
    const p = Math.min(1, Math.max(0, (scrollY.value - (parkScroll - CTA_CROSSFADE_DISTANCE)) / CTA_CROSSFADE_DISTANCE));
    return {
      opacity: contentFade.value * (1 - p),
      transform: [{ translateY: p * (barH + 12) }],
    };
  });
  const inlineCtaStyle = useAnimatedStyle(() => {
    const anchorY = width * 1.2 + ctaY;
    const parkScroll = Math.max(1, anchorY - viewH + barH);
    const p = Math.min(1, Math.max(0, (scrollY.value - (parkScroll - CTA_CROSSFADE_DISTANCE)) / CTA_CROSSFADE_DISTANCE));
    return {
      opacity: p,
    };
  });
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  useAnimatedReaction(
    () => {
      const anchorY = width * 1.2 + ctaY;
      const parkScroll = Math.max(1, anchorY - viewH + barH);
      const p = Math.min(1, Math.max(0, (scrollY.value - (parkScroll - CTA_CROSSFADE_DISTANCE)) / CTA_CROSSFADE_DISTANCE));
      return p < 0.98;
    },
    (interactive, prev) => {
      if (interactive !== prev) runOnJS(setFixedCtaInteractive)(interactive);
    },
    [ctaY, viewH, barH]
  );

  const discount = Math.round((1 - product.price / product.original) * 100);

  // Backend-or-mock display data for gallery / colours / sizes / reviews / similar.
  // The image the shopper ARRIVED with stays slide 1 forever. The detail
  // response used to REPLACE the list (same photo, different URL), so the
  // visible image tore itself down and re-downloaded a few seconds after the
  // page opened — a visible reload glitch. Extra gallery shots now append
  // behind the already-decoded first slide instead.
  const galleryImgs = React.useMemo(() => {
    const g = (detail?.gallery ?? []).filter(Boolean).filter((u) => u !== product.img);
    return [product.img, ...g];
  }, [detail, product.img]);
  const colorSwatches = (detail?.swatches ?? []).map((sw) => sw.hex).filter(Boolean) as string[];

  /**
   * Does this product have options at all?
   *
   * The retailer declares it: 'single' means one price, one SKU, one stock count
   * — no colour axis, no size axis. The consumer API did not ship `variantMode`,
   * so this page could not tell and drew BOTH pickers for everything: four
   * invented hex swatches from a local COLORS constant and a size row reading
   * "Default". A shirt the retailer had explicitly set up as a single product
   * looked like it came in four colours.
   *
   * Until the detail request lands we assume single, so nothing invented ever
   * flashes on screen before the truth arrives.
   */
  const isSingle = !detail || detail.variantMode === 'single';
  const showColors = !isSingle && colorSwatches.length > 0;
  const showSizes = !isSingle;

  // Real sizes come from the variants; failing that we ask the backend for the
  // scale that fits the CATEGORY. The letter run is the last resort — and only
  // for products that genuinely have a size axis.
  const colors = colorSwatches;
  const sizes = detail?.sizes && detail.sizes.length
    ? detail.sizes
    : (scaleSizes.length ? scaleSizes : SIZES);
  // Products that come in a single size (bags, watches, "One Size") auto-select it.
  useEffect(() => {
    if (detail && detail.sizes.length === 1) setSize(detail.sizes[0]);
  }, [detail]);
  useEffect(() => {
    // Only when the variants gave us nothing — otherwise the product is the truth.
    if (!detail || detail.sizes.length > 0 || !detail.categoryId) { setScaleSizes([]); return; }
    let cancelled = false;
    listSizeScales(detail.categoryId)
      .then((scales) => {
        if (cancelled) return;
        // Lowest sortOrder is the most specific scale for this category.
        const best = scales.filter((sc) => sc.isActive).sort((a, b) => a.sortOrder - b.sortOrder)[0];
        setScaleSizes(best?.values ?? []);
      })
      .catch(() => { if (!cancelled) setScaleSizes([]); });
    return () => { cancelled = true; };
  }, [detail]);

  const reviewsCount = detail?.ratingCount ?? 0;
  const ratingAvg = detail?.ratingAvg ?? product.rating ?? 0;
  // Only backend listings have a real reviews API; a signed-in shopper on one can
  // write a review. Mock/demo products (non-`lst_` ids) can't be reviewed.
  const canReview = !!token && isBackendListingId(listingId);
  // Memoized for stable item identity across re-renders. No mock fallback: an empty
  // list is the truth, and the Ratings & Reviews section hides itself when empty.
  const reviewList = React.useMemo(() => (reviews ?? []).map((r) => ({
    id: r.id, user: r.author || 'Trendzo Shopper', rating: r.rating, text: r.body,
    date: fmtReviewDate(r.createdAt), verified: r.verifiedPurchase,
  })), [reviews]);
  // Re-pull the public (verified) list after posting so a verified review shows at
  // once; a non-verified one stays hidden from others by design (composer explains).
  const refetchReviews = useCallback(() => {
    if (!isBackendListingId(listingId)) return;
    listReviews(listingId).then(setReviews).catch(() => {});
  }, [listingId]);
  const similarList = React.useMemo(
    () => (similar ?? []).filter((p) => p.id !== product.id),
    [similar, product.id]);

  // The 4x-repeat-then-slice used to run on EVERY render of this screen,
  // allocating a 4N array and throwing most of it away. It only depends on
  // similarList, which is itself memoised.
  //
  // NOT virtualised, deliberately: this grid lives inside the parallax
  // Animated.ScrollView that also drives the sticky header and the scroll-linked
  // CTA. Restructuring that into a FlatList is a large, risky change for 16
  // cards that are already gated behind `gridReady`. Revisit if the count grows.
  // NO repetition. This used to concatenate similarList four times and slice to
  // 16, so a 4-product catalog rendered the same four cards four times over —
  // an inventory claim the store could not back. It now shows what exists.
  const moreToLove = React.useMemo(() => similarList.slice(0, 16), [similarList]);

  // Resolve the selected size (+ colour) to a real backend variant id so the cart can be
  // priced/checked-out server-side. Undefined for mock products (falls back to local math).
  //
  // Prefers an IN-STOCK variant: a listing can carry a sold-out row and a live one
  // for the same size in different colourways, and picking the first match landed
  // the sold-out one in the bag.
  const variantsFor = (sz: string) => {
    if (!detail) return [];
    const selColor = detail.swatches[colorIdx]?.name;
    const exact = detail.variants.filter((v) => v.size === sz && (!selColor || v.color === selColor));
    return exact.length ? exact : detail.variants.filter((v) => v.size === sz);
  };
  const variantFor = (sz: string): string | undefined => {
    const vs = variantsFor(sz);
    return (vs.find((v) => v.available > 0) ?? vs[0])?.id;
  };
  /**
   * Whether this size can actually be bought in the selected colourway.
   *
   * `available` has always been on the variant and was never read, so every size
   * looked buyable: tapping a sold-out one added it to the bag and the shopper
   * found out at checkout. Unknown (a mock product, or a size that came from the
   * category size-scale rather than from a variant) counts as available — the
   * server is still the authority, and greying out a size we know nothing about
   * would hide stock that exists.
   */
  const sizeAvailable = (sz: string): boolean => {
    if (!detail || detail.variants.length === 0) return true;
    const vs = variantsFor(sz);
    return vs.length === 0 ? true : vs.some((v) => v.available > 0);
  };

  // Open THE bag (the CartTab) from a pushed/modal screen. Navigating straight
  // to 'Tabs' from a transparentModal makes iOS present a SECOND Tabs as a
  // sheet (the "modal bag with menu" bug) — so pop back to the real Tabs
  // first, then just switch its tab.
  const goBag = () => {
    nav.dispatch(StackActions.popToTop());
    setTimeout(() => nav.navigate('Tabs', { screen: 'CartTab' }), 0);
  };

  const doAdd = (sz: string) => {
    addToCart(product, sz, undefined, variantFor(sz));
    // Confirmed in the CENTRE of the screen, where the size modal just was, so
    // the two steps read as one flow — and it dismisses itself so nothing is
    // left for the shopper to close.
    setAddedModal({ size: sz });
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedModal(null), 1600);
  };
  // Buy now → SINGLE-ITEM checkout. The line goes to Review Order as a param
  // and the bag is left exactly as it is: it used to be added to the cart and
  // Review Order opened on the WHOLE bag, so buying one shirt silently swept
  // every parked item into the order. Guests get the sign-in sheet first;
  // the pending line rides the resumed navigation.
  const doBuy = (sz: string) => {
    // `size` stays EMPTY when the product has no size axis. It used to fall back to
    // 'M', so a watch or a one-size bag arrived at Review Order labelled "Size M";
    // the review page now labels it from the quote's `attributesLabel` instead.
    const line = { ...product, qty: 1, size: sz, method: 'express' as const, variantId: variantFor(sz) };
    requireAuth(() => setTimeout(() => nav.navigate('ReviewOrder', { buyNow: line }), 60));
  };
  // Require a size first — a centred modal, not a toast. The inline row is still
  // highlighted underneath so the page and the modal agree about what is missing.
  const askSize = (action: 'add' | 'buy') => {
    setSizeSheet(action);
    setNeedSize(true);
  };
  // A single product has no size axis, so there is nothing to ask for — demanding
  // one would strand the shopper on a picker that isn't rendered.
  // Belt and braces: the pickers disable a sold-out size, but a size auto-selected
  // for a one-size product never went through a picker at all.
  const guardStock = (sz: string): boolean => {
    if (!showSizes || sizeAvailable(sz)) return true;
    showToast('Out of stock', `Size ${sz} isn't available right now`, 'alert-circle');
    return false;
  };
  const handleAdd = () => { if (!size && showSizes) { askSize('add'); return; } if (!guardStock(size ?? '')) return; doAdd(size ?? ''); };
  const handleBuy = () => { if (!size && showSizes) { askSize('buy'); return; } if (!guardStock(size ?? '')) return; doBuy(size ?? ''); };
  const pickSize = (sz: string) => {
    const action = sizeSheet;
    setSize(sz);
    setSizeSheet(null);
    setNeedSize(false);
    // Continue the pending action straight away — picking the size IS the
    // confirmation, so don't make the user tap Buy now / Add again.
    if (action === 'add') setTimeout(() => doAdd(sz), 80);
    else if (action === 'buy') setTimeout(() => doBuy(sz), 80);
  };
  /** Tapping a size in the inline row when nothing is pending: just select it. */
  const selectSize = (sz: string) => (sizeSheet ? pickSize(sz) : setSize(sz));

  // Opened without a product (a bad deep link, a stale nav param). Say so
  // instead of rendering a page for the demo coat that used to stand in here.
  if (!hasProduct) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: HEADER_TOP }}>
        <StatusBar barStyle="dark-content" />
        <View style={{ paddingHorizontal: SP.l }}>
          <BrutalIconBtn icon="arrow-left" onPress={() => nav.goBack()} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <CatalogEmpty
            icon="alert-circle"
            title="Product unavailable"
            sub="We couldn't open this item. It may have been removed."
            actionLabel="Go back"
            onAction={() => nav.goBack()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isZoom ? 'transparent' : '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />

      {/* White backdrop — the home shows through, then this fades in as the image expands */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, backdropStyle]} />

      <View style={{ flex: 1 }}>

      {/* HEADER — back + search + cart. High zIndex + bg so the CTA bar passes UNDER it
          (instead of over the search) when it scrolls up and away. */}
      <Animated.View
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height) + 1; // +1 divider below
          slotMeasured.current = true;
          setSlotY((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
        }}
        style={[{ paddingTop: HEADER_TOP, paddingHorizontal: SP.l, paddingBottom: SP.s, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: SP.s, zIndex: 30, elevation: 30 }, contentStyle]}>
        <BrutalIconBtn icon="arrow-left" onPress={goBack} />
        <Pressable onPress={() => nav.navigate('Search')} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SP.m, paddingVertical: 9 }, BORDER(1)]}>
          <Feather name="search" size={15} color={C.dim} />
          <Text style={[T.body, { color: C.dim }]} numberOfLines={1}>Search products...</Text>
        </Pressable>
        {/* ONE bag only — pop to the real Tabs, then switch to the Bag tab.
            BagButton carries the live count: this was a bare glyph, so adding
            an item from here changed nothing visible in the header. */}
        <BagButton onPress={goBag} />
      </Animated.View>
      <Animated.View style={[{ height: 1, backgroundColor: C.ink, zIndex: 30, elevation: 30 }, contentStyle]} />

      <Animated.ScrollView
        ref={scrollRef as any}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        scrollEnabled={ready}
        scrollEventThrottle={16}
        // removeClippedSubviews is OFF here on purpose. It detached offscreen
        // views on Android, but coming BACK from a pushed screen (camera
        // try-on, search) re-attached them corrupted: cards drawn on top of
        // each other, scroll frozen, the opened product "pinned" behind a
        // second broken feed. The perf it bought is minor next to that.
        removeClippedSubviews={false}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onScroll={scrollHandler}
      >
        {/* IMAGE GALLERY - hidden during the fly, revealed instantly at handoff */}
        <Animated.View style={[{ width, height: width * 1.2, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.hairline }, galleryStyle]}>
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setImgIdx(idx);
            }}
          >
            {(ready ? galleryImgs : galleryImgs.slice(0, 1)).map((uri, i) => (
              <Pressable key={i} onPress={() => { setViewerPage(i); setViewerIdx(i); }} style={{ width, height: width * 1.2, alignItems: 'center', justifyContent: 'center' }}>
                <CachedImage transition={0} placeholder={null} source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.imgDots}>
            {galleryImgs.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  setImgIdx(i);
                  galleryRef.current?.scrollTo({ x: i * width, animated: true });
                }}
                style={[{ width: i === imgIdx ? 24 : 10, height: 6, backgroundColor: i === imgIdx ? C.ink : C.white }, BORDER(1)]}
              />
            ))}
          </View>
        </Animated.View>

        {/* INFO */}
        <Animated.View onLayout={(e) => { infoYRef.current = e.nativeEvent.layout.y; }} style={[{ padding: SP.l }, contentStyle]}>
          {/* Brand + name on one line — rating aligned with this line on the right */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 }}>
              <Text style={[T.productTitle]} numberOfLines={1}>{brandName}</Text>
              <Text style={[T.body, { color: C.dim, flex: 1 }]} numberOfLines={1}>{product.name}</Text>
            </View>
            {reviewsCount > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, ...BORDER(1) }}>
                <Feather name="star" size={13} color={C.ink} />
                <Text style={[T.caption, { color: C.ink }]}>{ratingAvg.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Price (smaller) */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <Text style={[T.price]}>₹{product.price}</Text>
            {/* Only when there IS one. A product priced at its MRP was rendering
                "₹1749  ₹1749  -0%" — a struck-through price identical to the
                real one and a discount badge claiming nothing off. */}
            {discount > 0 && (<>
              <Text style={[T.mrp]}>₹{product.original}</Text>
              <Text style={[T.discount]}>{`-${discount}%`}</Text>
            </>)}
          </View>

          {/* COUPON OFFER — only shown when a REAL coupon is running.
              This used to advertise a hardcoded 'TRENDZO10' with an invented
              "extra 10% off". That code does not exist on the backend, so every
              shopper who followed the prompt was told at checkout that it was
              invalid. Now it renders the live coupon from /promotions/active, or
              nothing at all. */}
          {topCoupon && (
            <Pressable
              onPress={() => { setOpenCouponId(topCoupon.id); setCouponSheet(true); }}
              style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.m }, BORDER(1)]}
            >
              <Feather name="tag" size={16} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyB]}>{`${topCoupon.discount} with ${topCoupon.code}`}</Text>
                <Text style={[T.micro, { marginTop: 1 }]} numberOfLines={1}>
                  {/* A store-scoped code may not apply to THIS listing's store, and
                      /promotions/active cannot say — so the banner does not imply
                      it will. */}
                  {[
                    topCoupon.min,
                    topCoupon.storeScoped ? 'selected stores' : null,
                    coupons.length > 1 ? `${coupons.length} offers` : null,
                    'tap for details',
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: C.ink }}>
                <Text style={[T.monoB, { color: C.white }]}>{topCoupon.code}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={C.ink} />
            </Pressable>
          )}

          <View style={{ height: 1, backgroundColor: C.ink, marginTop: SP.l }} />

          {/* COLOR — only when the product genuinely has colours to choose between. */}
          {showColors && (
            <>
              <Text style={[T.caption, { marginTop: SP.l }]}>{'Color'}</Text>
              <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
                {colors.map((c, i) => (
                  <Pressable key={i} onPress={() => setColorIdx(i)} style={[{ width: 36, height: 36, backgroundColor: c, padding: 3 }, i === colorIdx ? BORDER(2) : BORDER(1)]}>
                    {i === colorIdx && <View style={{ flex: 1, borderWidth: 1, borderColor: c === '#000000' ? C.white : C.ink }} />}
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* SIZE — inline picker; when Add/Buy is tapped without a size the
              page scrolls here and the label flips to a highlighted prompt.
              Picking a size then CONTINUES the pending action (see pickSize).
              Hidden entirely for a single product, which has no size axis. */}
          {showSizes && (<>
          <View
            onLayout={(e) => { sizeLocalYRef.current = e.nativeEvent.layout.y; }}
            style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.l }}
          >
            <View>
              {needSize && <View style={{ position: 'absolute', left: -3, right: -5, bottom: 0, height: 9, backgroundColor: C.accent }} />}
              <Text style={[T.caption, needSize && { color: C.ink, fontFamily: HELV, fontWeight: '700' }]}>
                {needSize ? 'PICK A SIZE TO CONTINUE' : 'Size'}
              </Text>
            </View>
            <Pressable onPress={() => showConfirm({ title: 'Size guide', msg: 'XS · 32 in chest\nS · 34 in chest\nM · 36 in chest\nL · 38 in chest\nXL · 40 in chest', confirmLabel: 'Got it', cancelLabel: 'Close', icon: 'ruler' })}>
              <Text style={[T.caption]}>{'[ Size guide ]'}</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8, flexWrap: 'wrap' }}>
            {sizes.map(sz => {
              const ok = sizeAvailable(sz);
              return (
                <Pressable
                  key={sz}
                  disabled={!ok}
                  onPress={() => selectSize(sz)}
                  style={[{ minWidth: 48, paddingHorizontal: 10, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: size === sz ? C.ink : C.white }, BORDER(needSize ? 2 : 1), !ok && { opacity: 0.4 }]}
                >
                  <Text style={[T.caption, { color: size === sz ? C.white : C.ink, textDecorationLine: ok ? 'none' : 'line-through' }]}>{sz}</Text>
                </Pressable>
              );
            })}
          </View>
          </>)}

          {/* Below-the-fold — mounts only after the open, off-screen, so no visible layout shift */}
          {ready && (<>
          {/* DESCRIPTION — real short + rich-text long description from the listing.
              Hidden entirely when the listing has neither, so we never invent specs
              (this block used to be a hardcoded "Key Highlights" table identical for
              every product). */}
          {(!!detail?.description || !!detail?.descriptionLong) && (
            <View style={{ marginTop: SP.l }}>
              <Text style={T.h2}>{'Description'}</Text>
              {!!detail?.description && (
                <Text style={[T.body, { color: C.inkSoft, marginTop: SP.m, lineHeight: rf(21) }]}>{detail.description}</Text>
              )}
              <RichText html={detail?.descriptionLong} />
            </View>
          )}

          {/* Real parked CTA. The fixed overlay fades away as this reaches the bottom. */}
          <Animated.View
            onLayout={(e) => setCtaY(e.nativeEvent.layout.y)}
            // paddingBottom was a hardcoded 28 vs paddingTop 12 — the box read as
            // bottom-heavy (screenshot in the audit). Equal padding both sides now.
            style={[{ flexDirection: 'row', gap: SP.s, backgroundColor: C.bg, borderWidth: 1, borderColor: C.hairline, paddingHorizontal: SP.m, paddingVertical: SP.m, marginTop: SP.xl }, inlineCtaStyle]}
          >
            <BrutalButton label="Add to bag" icon="shopping-bag" variant="outline" onPress={handleAdd} style={{ flex: 1 }} />
            <BrutalButton label="Buy now" iconRight="arrow-right" onPress={handleBuy} style={{ flex: 1 }} />
          </Animated.View>

          {/* SIMILAR — hidden entirely when the catalog has nothing else to show,
              rather than padded out with bundled art. */}
          {(similarStatus === 'loading' || similarList.length > 0) && (<>
            <Text style={[T.h2, { marginTop: SP.xl }]}>{`You may also like`}</Text>
            {similarStatus === 'loading' ? (
              <View style={{ marginTop: SP.m, marginHorizontal: -SP.l }}>
                <ProductRailSkeleton count={3} animated={settled} />
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.m, marginTop: SP.m }}>
                {similarList.slice(0, 5).map(p => (
                  <ProductCard key={p.id} p={p} onPress={pushProduct} />
                ))}
              </ScrollView>
            )}
          </>)}

          {/* RATINGS & REVIEWS — shown when there are (verified) reviews to display OR
              the shopper is signed in and can write one. Guests with no reviews see
              nothing. Only verified-purchase reviews come back from the API, so every
              card carries the badge. */}
          {(reviewList.length > 0 || canReview) && (<>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SP.xl }}>
              <Text style={T.h2}>{`Ratings & Reviews`}</Text>
              {reviewList.length > 0 && (
                <Pressable onPress={() => nav.navigate('Reviews', { product, count: reviewsCount })} hitSlop={8}>
                  <Text style={[T.caption]}>View all ──▶</Text>
                </Pressable>
              )}
            </View>
            {reviewsCount > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.s }}>
                <Feather name="star" size={14} color={C.ink} />
                <Text style={[T.bodyB]}>{ratingAvg.toFixed(1)}</Text>
                <Text style={[T.caption]}>{`· ${reviewsCount} ${reviewsCount === 1 ? 'review' : 'reviews'}`}</Text>
              </View>
            )}
            {canReview && <ReviewComposer listingId={listingId} onSubmitted={refetchReviews} />}
            {reviewList.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.m, marginTop: SP.m }}>
                {reviewList.map(r => (
                  <View key={r.id} style={[{ width: 260, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[T.caption, { color: C.ink }]}>{r.user}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Feather name="star" size={11} color={C.ink} />
                        <Text style={[T.caption, { color: C.ink }]}>{r.rating.toFixed(1)}</Text>
                      </View>
                    </View>
                    {r.verified && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        <Feather name="check-circle" size={11} color={C.ink} />
                        <Text style={[T.micro, { color: C.ink }]}>Verified Purchase</Text>
                      </View>
                    )}
                    <Text style={[T.body, { color: C.inkSoft, marginTop: 8, lineHeight: rf(19) }]} numberOfLines={4}>{r.text ? `"${r.text}"` : ''}</Text>
                    <Text style={[T.micro, { marginTop: 10 }]}>{r.date}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>No reviews yet — be the first to review this product.</Text>
            )}
          </>)}
          </>)}

        </Animated.View>

        {/* MORE TO LOVE — STICKY header (pins just below the search); the grid scrolls under it.
            NOT sticky any more. The native sticky-header system CLONES its
            child and injects its own style — which stripped the contentFade
            binding, so this header rendered fully visible mid-zoom while the
            rest of the page was transparent (the "More to Love appears the
            moment I open a product" bug, three fixes deep). A normally
            scrolling header fades with the page like everything else. */}
        {/* Both ride contentFade like everything else. They had NO opacity
            binding — during a zoom open the whole page is transparent except
            these two, so "More to Love" floated visible mid-screen and slid
            around as the content above it mounted. Animated.View (not a
            Fragment) keeps the sticky-index contract intact. */}
        <Animated.View style={[{ backgroundColor: '#FFFFFF', paddingHorizontal: SP.l, paddingTop: SP.l, paddingBottom: SP.s, borderBottomWidth: 1, borderColor: C.hairline }, contentStyle]}>
          <Text style={T.h2}>{`More to Love`}</Text>
        </Animated.View>
        <Animated.View style={[{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.m, minHeight: gridReady ? undefined : 600 }, contentStyle]}>
          {gridReady && (similarStatus === 'loading'
            ? <ProductGridSkeleton count={4} animated={settled} />
            : similarStatus === 'error'
              ? <CatalogEmpty compact icon="wifi-off" title="Couldn't load more" sub="Check your connection and pull to refresh." />
              : moreToLove.length === 0
                ? <CatalogEmpty compact title="Nothing else yet" sub="More lands here as stores go live." />
                : moreToLove.map((p, i) => (
                    <ProductCard key={p.id + '-' + i} p={p} style={CARD_STYLES.mb_m} />
                  )))}
        </Animated.View>

      </Animated.ScrollView>

      {/* Sticky CTA — single bar, NATIVE-driven: pinned at the bottom, then physically moves up
          with the scroll once you reach its parked spot. No fade, no jitter (synced to scroll). */}
      <Animated.View
        pointerEvents={fixedCtaInteractive ? 'auto' : 'none'}
        onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
        // Android draws edge-to-edge UNDER the system nav buttons — a fixed 28
        // put the CTAs behind them on button-nav phones. Pad by the real
        // system inset instead; iOS keeps its tuned 28.
        style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, flexDirection: 'row', gap: SP.s, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.hairline, paddingHorizontal: SP.l, paddingTop: SP.m, paddingBottom: Platform.OS === 'ios' ? 28 : Math.max(insets.bottom, SP.m) }, fixedCtaStyle]}
      >
        <BrutalButton label="Add to bag" icon="shopping-bag" variant="outline" onPress={handleAdd} style={{ flex: 1 }} />
        <BrutalButton label="Buy now" iconRight="arrow-right" onPress={handleBuy} style={{ flex: 1 }} />
      </Animated.View>

      {/* FLOATING TRY-ON FAB — fades with product content so it does not remain during close */}
      <Animated.View
        style={[{ position: 'absolute', right: SP.l, bottom: 104, zIndex: 50 }, contentStyle]}
      >
        {/* Sign in FIRST. Try-on is auth-gated server-side, and asking from
            inside the try-on screen never worked: requireAuth returns true
            without showing a sheet when AppState holds a token, and a <Modal>
            opened from a transparentModal may not present at all. Gating here
            means the sheet opens from a screen that can actually show it. */}
        <Pressable onPress={() => requireAuth(() => nav.navigate('TryOn', { product }))}>
          <MV
            from={{ scale: 1 }}
            animate={{ scale: 1.06 }}
            transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Pill label that pokes out from the circle */}
              <View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.ink }, BORDER(1)]}>
                <Text style={[T.caption, { color: C.white }]}>Try On</Text>
              </View>
              {/* The circular FAB */}
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: C.ink, borderWidth: 2, borderColor: C.hairline,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
                elevation: 8,
              }}>
                {/* Inner ring + icon — gives it a "smart camera" / chat-bot look */}
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="camera" size={22} color={C.ink} />
                  {/* Tiny green status dot at the corner like an online indicator */}
                  <View style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink, borderWidth: 2, borderColor: C.white }} />
                </View>
              </View>
            </View>
          </MV>
        </Pressable>
      </Animated.View>

      </View>

      {/* Flying image: card -> gallery slot. The actual frame animates so contain-fit matches
          the product card exactly at close; no post-close resize snap. */}
      {isZoom && cardFrame && (
        <Animated.View
          onLayout={startFly}
          pointerEvents="none"
          // Rasterize once on Android and fly the texture — no re-draws mid-flight.
          renderToHardwareTextureAndroid
          style={[{ position: 'absolute', left: SLOT.x, top: SLOT.y, width: SLOT.w, height: SLOT.h, backgroundColor: C.white, overflow: 'hidden', zIndex: 50 }, overlayStyle]}
        >
          <Animated.View style={[{ width: '100%', height: '100%' }, overlayImgStyle]}>
            <CachedImage transition={0} placeholder={null} source={{ uri: product.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </Animated.View>
        </Animated.View>
      )}

      {/* ── SIZE — centred modal, shown when Add/Buy is tapped without one.
             Picking a size here IS the confirmation: the pending action runs
             straight afterwards, so nothing has to be tapped twice. ── */}
      <CenterModal
        visible={!!sizeSheet}
        title="Select a size"
        icon="maximize-2"
        onClose={() => { setSizeSheet(null); setNeedSize(false); }}
      >
        <View style={{ padding: SP.l }}>
          <View style={{ flexDirection: 'row', gap: SP.m, alignItems: 'center' }}>
            <View style={[{ width: 54, height: 66, overflow: 'hidden', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
              <CachedImage source={{ uri: product.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.micro, { color: C.dim, letterSpacing: 1 }]} numberOfLines={1}>{String(brandName || '').toUpperCase()}</Text>
              <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={2}>{product.name}</Text>
              <Text style={[T.price, { marginTop: 3 }]}>₹{product.price}</Text>
            </View>
          </View>
          <Text style={[T.caption, { color: C.dim, marginTop: SP.l }]}>
            {sizes.every((sz) => !sizeAvailable(sz))
              ? 'Every size is out of stock right now.'
              : sizeSheet === 'buy' ? 'Choose a size to continue to checkout' : 'Choose a size to add this to your bag'}
          </Text>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.s, flexWrap: 'wrap' }}>
            {sizes.map((sz) => {
              const ok = sizeAvailable(sz);
              return (
                <Pressable
                  key={sz}
                  disabled={!ok}
                  onPress={() => pickSize(sz)}
                  style={[{ minWidth: 52, paddingHorizontal: 12, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: size === sz ? C.ink : C.white }, BORDER(1), !ok && { opacity: 0.4 }]}
                >
                  <Text style={[T.caption, { color: size === sz ? C.white : C.ink, textDecorationLine: ok ? 'none' : 'line-through' }]}>{sz}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => showConfirm({ title: 'Size guide', msg: 'XS · 32 in chest\nS · 34 in chest\nM · 36 in chest\nL · 38 in chest\nXL · 40 in chest', confirmLabel: 'Got it', cancelLabel: 'Close', icon: 'ruler' })}
            hitSlop={6}
            style={{ marginTop: SP.m, flexDirection: 'row', alignItems: 'center', gap: 5 }}
          >
            <Feather name="info" size={12} color={C.dim} />
            <Text style={[T.caption, { textDecorationLine: 'underline' }]}>Size guide</Text>
          </Pressable>
        </View>
      </CenterModal>

      {/* ── ADDED TO BAG — the same centre of the screen, auto-dismissed. ── */}
      <CenterModal visible={!!addedModal} onClose={() => setAddedModal(null)} maxWidth={330}>
        <View style={{ padding: SP.l, alignItems: 'center' }}>
          <View style={[{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
            <Feather name="check" size={26} color={C.white} />
          </View>
          <Text style={[T.h2, { marginTop: SP.m, textTransform: 'uppercase', textAlign: 'center' }]}>Added to bag</Text>
          <Text style={[T.caption, { color: C.dim, marginTop: 6, textAlign: 'center' }]} numberOfLines={2}>
            {`${product.name}${addedModal ? ` · Size ${addedModal.size}` : ''}`}
          </Text>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l, alignSelf: 'stretch' }}>
            <BrutalButton label="Keep browsing" variant="outline" small onPress={() => setAddedModal(null)} style={{ flex: 1 }} />
            <BrutalButton label="View bag" small onPress={() => { setAddedModal(null); goBag(); }} style={{ flex: 1 }} />
          </View>
        </View>
      </CenterModal>

      {/* ── OFFERS — every live coupon with its real terms, from
             /promotions/active. Opened from the offer banner above. ── */}
      <OptionSheet visible={couponSheet} title="Offers & coupons" onClose={() => setCouponSheet(false)}>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: SP.l, gap: SP.s }}>
          {coupons.length === 0 ? (
            <Text style={[T.body, { color: C.dim, textAlign: 'center', paddingVertical: SP.l }]}>
              No offers are running right now.
            </Text>
          ) : coupons.map((c) => {
            const expanded = openCouponId === c.id;
            return (
              <View key={c.id} style={[{ backgroundColor: C.white }, BORDER(1)]}>
                <Pressable
                  onPress={() => setOpenCouponId(expanded ? null : c.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m }}
                >
                  <View style={[{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                    <Text style={[T.monoB, { color: C.ink }]}>{c.code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.bodyB]} numberOfLines={1}>{c.discount}</Text>
                    <Text style={[T.micro, { color: C.dim, marginTop: 1 }]} numberOfLines={1}>{`${c.min}${c.expires ? ` · till ${c.expires}` : ''}`}</Text>
                  </View>
                  <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.ink} />
                </Pressable>
                {expanded && (
                  <View style={{ paddingHorizontal: SP.m, paddingBottom: SP.m, borderTopWidth: 1, borderColor: C.hairline, paddingTop: SP.s }}>
                    {c.terms.map((t, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: i === 0 ? 0 : 6 }}>
                        <Text style={[T.caption, { color: C.dim }]}>•</Text>
                        <Text style={[T.caption, { color: C.dim, flex: 1, lineHeight: rf(17) }]}>{t}</Text>
                      </View>
                    ))}
                    <Text style={[T.micro, { color: C.dim, marginTop: 10 }]}>
                      Enter this code in your bag or on Review order. Eligibility is checked against your bag when you apply it.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </OptionSheet>

      {/* ── IMAGE VIEWER — full-screen, centred, ALL slides swipeable ── */}
      <Modal transparent visible={viewerIdx !== null} animationType="fade" statusBarTranslucent onRequestClose={() => setViewerIdx(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIdx ?? 0) * width, y: 0 }}
            onMomentumScrollEnd={(e) => setViewerPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {galleryImgs.map((uri, i) => (
              <Pressable key={i} onPress={() => setViewerIdx(null)} style={{ width, alignItems: 'center', justifyContent: 'center' }}>
                <CachedImage source={{ uri }} style={{ width: '100%', height: '78%' }} resizeMode="contain" />
              </Pressable>
            ))}
          </ScrollView>
          {galleryImgs.length > 1 && (
            <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {galleryImgs.map((_, i) => (
                <View key={i} style={{ width: i === viewerPage ? 22 : 8, height: 5, backgroundColor: i === viewerPage ? '#fff' : 'rgba(255,255,255,0.4)' }} />
              ))}
            </View>
          )}
          <Pressable onPress={() => setViewerIdx(null)} hitSlop={12} style={{ position: 'absolute', top: HEADER_TOP, right: SP.l, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18 }}>
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const makeS = () => StyleSheet.create({
  topBar: { position: 'absolute', top: 56, left: SP.l, right: SP.l, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between' },
  imgIdx: { position: 'absolute', top: 110, right: 16, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white },
  imgDots: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6, left: 0, right: 0, justifyContent: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg },
});
