import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Dimensions, Alert, Modal, InteractionManager } from 'react-native';
import Animated, { FadeIn, FadeInDown, withSpring, useAnimatedStyle, useSharedValue, useAnimatedScrollHandler, useAnimatedReaction, withTiming, withDelay, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import { MotiView as MV } from 'moti';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, ASCII, rf } from '../theme/brutal';
import { AsciiDivider, BrutalButton, BrutalIconBtn, CachedImage, ProductCard, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { useZoom } from '../navigation/ZoomTransition';
import { PRODUCTS } from '../data/mockData';

const { width, height: SCREEN_H } = Dimensions.get('window');
const PRODUCT_ZOOM_MS = 440;
const PRODUCT_CONTENT_FADE_MS = 260;
const PRODUCT_ZOOM_EASING = Easing.inOut(Easing.cubic);
const CARD_REVEAL_MS = 180;
const CTA_CROSSFADE_DISTANCE = 44;

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const COLORS = ['#000000', '#666666', '#bdbdbd', '#FFFFFF'];
const REVIEWS = [
  { id: '1', user: '@maya.k', rating: 5, date: '2 days ago', text: 'Fits perfect, exactly as shown. Delivery in 47 minutes — unreal.' },
  { id: '2', user: '@arjun_r', rating: 4, date: '5 days ago', text: 'Great quality fabric. Runs slightly large, so size down a notch.' },
  { id: '3', user: '@zoya.x', rating: 5, date: '1 week ago', text: 'Obsessed. The fit is exactly my vibe and the material feels premium.' },
  { id: '4', user: '@dev.m', rating: 4, date: '2 weeks ago', text: 'Solid buy. Colour is true to the photos. Would order again.' },
];

export default function ProductDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const product = route.params?.product || PRODUCTS[0];
  const brandName = route.params?.brand || product.brand; // store brand when opened from a brand store
  const { addToCart, night, theme, showToast, showConfirm } = useApp();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<{ [k: string]: any }>({});
  const closeStarted = useRef(false);
  // Close mirrors open: fade content, then fly the image/backdrop back to the measured card frame.
  const goBack = () => {
    if (closeStarted.current) return;
    closeStarted.current = true;
    if (route.params?._zoom && route.params?._cardFrame) {
      clearReveal();
      galleryOpacity.value = 0;
      overlayOpacity.value = 1;
      contentFade.value = withTiming(0, { duration: PRODUCT_CONTENT_FADE_MS, easing: Easing.out(Easing.cubic) }, (contentDone) => {
        if (!contentDone) return;
        backdropFade.value = withDelay(
          PRODUCT_ZOOM_MS - CARD_REVEAL_MS,
          withTiming(0, { duration: CARD_REVEAL_MS, easing: Easing.out(Easing.cubic) })
        );
        imgAnim.value = withTiming(0, { duration: PRODUCT_ZOOM_MS, easing: PRODUCT_ZOOM_EASING }, (fin) => {
          if (fin) runOnJS(nav.goBack)();
        });
      });
    } else nav.goBack();
  };
  const s = React.useMemo(() => makeS(), [night]);
  const [size, setSize] = useState<string | null>(null);
  const [sizeSheet, setSizeSheet] = useState<null | 'add' | 'buy'>(null);
  // Heavy below-the-fold content (carousels, grid) renders only AFTER the open transition,
  // so it never competes with the animation on the JS thread → no dropped frames.
  // Two-stage reveal so the deferred content doesn't all mount in one janky frame:
  // First paint = just the viewport (image/price/coupon); the rest mounts AFTER the fade so it
  // never competes with the transition. Scroll stays locked until the page is loaded.
  const cardFrame = route.params?._cardFrame as { x: number; y: number; w: number; h: number } | undefined;
  const isZoom = !!(route.params?._zoom && cardFrame);
  // First paint = just the viewport (image/price/coupon). Everything else mounts AFTER the zoom,
  // so nothing competes with the animation. Scroll stays locked until it's done.
  const [ready, setReady] = useState(!isZoom);
  const [gridReady, setGridReady] = useState(!isZoom);
  const SLOT = { x: 0, y: 105, w: width, h: width * 1.2 }; // where the gallery image lands
  const imgAnim = useSharedValue(isZoom ? 0 : 1);         // 0 = at card, 1 = at gallery slot
  const backdropFade = useSharedValue(isZoom ? 0 : 1);     // home → white as the image expands
  const contentFade = useSharedValue(isZoom ? 0 : 1);      // header / details opacity
  const galleryOpacity = useSharedValue(isZoom ? 0 : 1);   // real gallery (hidden until handoff)
  const overlayOpacity = useSharedValue(isZoom ? 1 : 0); // flying image visibility (no re-mount)
  const flyStarted = useRef(false);
  // Pending "load the rest" timers — cancelled on close so a heavy mount never lands mid-close.
  const revealTimers = useRef<any[]>([]);
  const clearReveal = () => { revealTimers.current.forEach(clearTimeout); revealTimers.current = []; };
  const revealContent = () => { setReady(true); revealTimers.current.push(setTimeout(() => setGridReady(true), 260)); };
  const scheduleReveal = () => { revealTimers.current.push(setTimeout(revealContent, 280)); };
  // Fire EXACTLY when the page is mounted + laid out (overlay onLayout) → runs on a free UI
  // thread. One flow: image expands + bg turns white → hand off → content fades → content loads.
  const startFly = () => {
    if (flyStarted.current || !isZoom) return;
    flyStarted.current = true;
    backdropFade.value = withTiming(1, { duration: PRODUCT_ZOOM_MS, easing: PRODUCT_ZOOM_EASING });
    imgAnim.value = withTiming(1, { duration: PRODUCT_ZOOM_MS, easing: PRODUCT_ZOOM_EASING }, (fin) => {
      if (fin) {
        galleryOpacity.value = 1;
        overlayOpacity.value = 0;                                       // hand off (no unmount)
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
  const overlayStyle = useAnimatedStyle(() => {
    if (!cardFrame) return { opacity: 0 };
    const cx = cardFrame.x + cardFrame.w / 2, cy = cardFrame.y + cardFrame.h / 2;
    const scx = SLOT.x + SLOT.w / 2, scy = SLOT.y + SLOT.h / 2;
    return {
      opacity: overlayOpacity.value,
      left: interpolate(imgAnim.value, [0, 1], [cx - cardFrame.w / 2, scx - SLOT.w / 2]),
      top: interpolate(imgAnim.value, [0, 1], [cy - cardFrame.h / 2, scy - SLOT.h / 2]),
      width: interpolate(imgAnim.value, [0, 1], [cardFrame.w, SLOT.w]),
      height: interpolate(imgAnim.value, [0, 1], [cardFrame.h, SLOT.h]),
    };
  });
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentFade.value }));
  const galleryStyle = useAnimatedStyle(() => ({ opacity: galleryOpacity.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropFade.value }));
  const [colorIdx, setColorIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const galleryRef = useRef<ScrollView>(null);
  const scrollRef = useRef<any>(null);
  const [upsellY, setUpsellY] = useState(0);
  const [tab, setTab] = useState<'details' | 'reviews' | 'care'>('details');
  // CTA is pinned to the bottom until the user scrolls down to the inline buttons (just
  // before the recommendations); then it un-pins and the inline buttons take over.
  const [ctaY, setCtaY] = useState(99999);
  const [viewH, setViewH] = useState(0);
  const [barH, setBarH] = useState(88);
  const [fixedCtaInteractive, setFixedCtaInteractive] = useState(true);
  const scrollY = useSharedValue(0);
  const fixedCtaStyle = useAnimatedStyle(() => {
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
  const couponPrice = Math.round(product.price * 0.9); // extra 10% off with coupon

  const doAdd = (sz: string) => {
    addToCart(product, sz);
    showToast('Added to bag', `${product.name} · Size ${sz}`, 'shopping-bag', {
      label: 'View bag',
      onPress: () => nav.navigate('Tabs', { screen: 'CartTab' }),
    });
    // Slide down to the "buy more, save more" upsell on the SAME page
    setTimeout(() => scrollRef.current?.scrollTo?.({ y: Math.max(0, upsellY - 8), animated: true }), 140);
  };
  // Buy now → straight to the single-page Review Order (no multi-step checkout)
  const doBuy = (sz: string) => {
    addToCart(product, sz);
    setTimeout(() => nav.navigate('ReviewOrder'), 60);
  };
  // Require a size first — otherwise pop the "select a size" sheet from the bottom
  const handleAdd = () => { if (!size) { setSizeSheet('add'); return; } doAdd(size); };
  const handleBuy = () => { if (!size) { setSizeSheet('buy'); return; } doBuy(size); };
  const pickSize = (sz: string) => {
    const action = sizeSheet;
    setSize(sz);
    setSizeSheet(null);
    setTimeout(() => { if (action === 'add') doAdd(sz); else if (action === 'buy') doBuy(sz); }, 260);
  };

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: isZoom ? 'transparent' : (night ? '#000000' : '#FFFFFF') }}>
      <StatusBar barStyle={night ? 'light-content' : 'dark-content'} />

      {/* White backdrop — the home shows through, then this fades in as the image expands */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: night ? '#000000' : '#FFFFFF' }, backdropStyle]} />

      <View style={{ flex: 1 }}>

      {/* HEADER — back + search + cart. High zIndex + bg so the CTA bar passes UNDER it
          (instead of over the search) when it scrolls up and away. */}
      <Animated.View style={[{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.s, backgroundColor: night ? '#000000' : '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: SP.s, zIndex: 30, elevation: 30 }, contentStyle]}>
        <BrutalIconBtn icon="arrow-left" onPress={goBack} />
        <Pressable onPress={() => nav.navigate('Search')} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SP.m, paddingVertical: 9 }, BORDER(1)]}>
          <Feather name="search" size={15} color={C.dim} />
          <Text style={[T.mono, { color: C.dim }]} numberOfLines={1}>Search products...</Text>
        </Pressable>
        <BrutalIconBtn icon="shopping-bag" onPress={() => nav.navigate('Cart')} />
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
        stickyHeaderIndices={[3]}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onScroll={scrollHandler}
      >
        {/* IMAGE GALLERY - hidden during the fly, revealed instantly at handoff */}
        <Animated.View style={[{ width, height: width * 1.2, backgroundColor: C.hairline, borderBottomWidth: 1, borderColor: C.ink }, galleryStyle]}>
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
            {(ready ? [0, 1, 2, 3] : [0]).map(i => (
              <View key={i} style={{ width, height: width * 1.2, alignItems: 'center', justifyContent: 'center' }}>
                <CachedImage transition={0} source={{ uri: product.img }} style={{ width: '100%', height: '100%', transform: [{ scale: i === 0 ? 1 : i === 1 ? 1.1 : i === 2 ? 0.95 : 1.05 }] }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <View style={s.imgDots}>
            {[0, 1, 2, 3].map(i => (
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
        <Animated.View style={[{ padding: SP.l }, contentStyle]}>
          {/* Brand + name on one line — rating aligned with this line on the right */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.ink, letterSpacing: -0.3 }} numberOfLines={1}>{brandName}</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.dim, flex: 1 }} numberOfLines={1}>{product.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, ...BORDER(1) }}>
              <Feather name="star" size={13} color={C.ink} />
              <Text style={[T.monoB, { fontSize: 11 }]}>{product.rating}</Text>
            </View>
          </View>

          {/* Price (smaller) */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(17), color: C.ink }}>₹{product.price}</Text>
            <Text style={[T.body, { color: C.dim, textDecorationLine: 'line-through', fontSize: 12 }]}>₹{product.original}</Text>
            <Text style={[T.monoB, { fontSize: 11 }]}>{`-${discount}%`}</Text>
          </View>

          {/* COUPON OFFER — get it for less with a code */}
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.m }, BORDER(1)]}>
            <Feather name="tag" size={16} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyB, { fontSize: 13 }]}>Get it for ₹{couponPrice}</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 1 }]}>Extra 10% off · applied at checkout</Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: C.ink }}>
              <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>TRENDZO10</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: C.ink, marginTop: SP.l }} />

          {/* COLOR */}
          <Text style={[T.label, { marginTop: SP.l }]}>{'COLOR'}</Text>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
            {COLORS.map((c, i) => (
              <Pressable key={i} onPress={() => setColorIdx(i)} style={[{ width: 36, height: 36, backgroundColor: c, padding: 3 }, i === colorIdx ? BORDER(2) : BORDER(1)]}>
                {i === colorIdx && <View style={{ flex: 1, borderWidth: 1, borderColor: c === '#000000' ? C.white : C.ink }} />}
              </Pressable>
            ))}
          </View>

          {/* SIZE */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.l }}>
            <Text style={T.label}>{'SIZE'}</Text>
            <Pressable onPress={() => showConfirm({ title: 'Size guide', msg: 'XS · 32 in chest\nS · 34 in chest\nM · 36 in chest\nL · 38 in chest\nXL · 40 in chest', confirmLabel: 'Got it', cancelLabel: 'Close', icon: 'ruler' })}>
              <Text style={[T.monoB, { fontSize: 10 }]}>{'[ SIZE GUIDE ]'}</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
            {SIZES.map(sz => (
              <Pressable key={sz} onPress={() => setSize(sz)} style={[{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: size === sz ? C.ink : C.white }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: size === sz ? C.white : C.ink, letterSpacing: 0.5 }}>{sz}</Text>
              </Pressable>
            ))}
          </View>

          {/* DELIVERY */}
          <View style={[{ marginTop: SP.l, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 12 }, BORDER(1)]}>
            <Feather name="zap" size={18} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyB, { fontSize: 12 }]}>60-MIN DELIVERY</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>FROM NEAREST STORE · 2.4 KM AWAY</Text>
            </View>
            <Text style={[T.monoB, { fontSize: 11 }]}>FREE</Text>
          </View>

          {/* Below-the-fold — mounts only after the open, off-screen, so no visible layout shift */}
          {ready && (<>
          {/* KEY HIGHLIGHTS */}
          <Text style={[T.label, { marginTop: SP.l }]}>{'KEY HIGHLIGHTS'}</Text>
          <View style={[{ marginTop: 8 }, BORDER(1)]}>
            {[
              { k: 'Material', v: '100% Pure Wool' },
              { k: 'Fit', v: 'Oversized · Tailored' },
              { k: 'Care', v: 'Dry clean only' },
              { k: 'Made in', v: 'India' },
              { k: 'Returns', v: '7-day easy returns' },
            ].map((h, i, arr) => (
              <View key={h.k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 11, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: C.hairline }}>
                <Text style={[T.mono, { color: C.dim, fontSize: 11 }]}>{h.k}</Text>
                <Text style={[T.bodyB, { fontSize: 12 }]}>{h.v}</Text>
              </View>
            ))}
          </View>

          {/* Real parked CTA. The fixed overlay fades away as this reaches the bottom. */}
          <Animated.View
            onLayout={(e) => setCtaY(e.nativeEvent.layout.y)}
            style={[{ flexDirection: 'row', gap: SP.s, backgroundColor: C.bg, borderWidth: 1, borderColor: C.ink, paddingHorizontal: SP.m, paddingTop: SP.m, paddingBottom: 28, marginTop: SP.xl }, inlineCtaStyle]}
          >
            <BrutalButton label="Add to bag" icon="shopping-bag" variant="outline" onPress={handleAdd} style={{ flex: 1 }} />
            <BrutalButton label="Buy now" iconRight="arrow-right" onPress={handleBuy} style={{ flex: 1 }} />
          </Animated.View>

          {/* TABS */}
          <View style={{ flexDirection: 'row', marginTop: SP.xl }}>
            {(['details', 'reviews', 'care'] as const).map(t => (
              <Pressable key={t} onPress={() => setTab(t)} style={[{ flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: tab === t ? C.ink : C.white }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: tab === t ? C.white : C.ink, letterSpacing: 0.5 }}>{t.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <MotiView key={tab} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ marginTop: SP.l }}>
            {tab === 'details' && (
              <Text style={[T.body, { color: C.inkSoft, lineHeight: 20 }]}>
                Premium fabric construction. Cut for an oversized, tailored fit. Featured in our Spring/Summer 26 lookbook. Designed in studio, sewn locally, delivered in 60 minutes.
                {'\n\n'}MATERIAL: 100% pure wool · LINING: Cupro
                {'\n'}MADE IN: India · CARE: Dry clean only
              </Text>
            )}
            {tab === 'reviews' && (
              <View>
                {[1, 2, 3].map(i => (
                  <View key={i} style={{ marginBottom: SP.m }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[T.monoB, { fontSize: 11 }]}>@user_0{i}</Text>
                      <Text style={[T.mono, { color: C.dim }]}>★ {5 - i * 0.1}</Text>
                    </View>
                    <Text style={[T.body, { marginTop: 4 }]}>"Fits perfect, exactly as shown. Delivery was crazy fast — 47 minutes."</Text>
                    <AsciiDivider faint style={{ marginTop: 8 }} />
                  </View>
                ))}
              </View>
            )}
            {tab === 'care' && (
              <Text style={[T.body, { color: C.inkSoft, lineHeight: 20 }]}>
                · DRY CLEAN ONLY{'\n'}
                · DO NOT BLEACH{'\n'}
                · COOL IRON IF NEEDED{'\n'}
                · STORE ON HANGER{'\n'}
                · KEEP AWAY FROM DIRECT SUNLIGHT
              </Text>
            )}
          </MotiView>

          {/* SIMILAR */}
          <Text style={[T.h2, { marginTop: SP.xl }]}>{`▌ YOU MAY ALSO LIKE`}</Text>
          <AsciiDivider faint style={{ marginTop: 4 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.m, marginTop: SP.m }}>
            {PRODUCTS.filter(p => p.id !== product.id).slice(0, 5).map(p => (
              <ProductCard key={p.id} p={p} onPress={() => nav.push('ProductDetail', { product: p })} />
            ))}
          </ScrollView>

          {/* RATINGS & REVIEWS — swipable carousel + View All */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SP.xl }}>
            <Text style={T.h2}>{`▌ RATINGS & REVIEWS`}</Text>
            <Pressable onPress={() => showToast('Reviews', `Showing all ${product.reviews || 128} reviews`, 'star')} hitSlop={8}>
              <Text style={[T.monoB, { fontSize: 10 }]}>VIEW ALL ──▶</Text>
            </Pressable>
          </View>
          <AsciiDivider faint style={{ marginTop: 4 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.m, marginTop: SP.m }}>
            {REVIEWS.map(r => (
              <View key={r.id} style={[{ width: 260, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.monoB, { fontSize: 11 }]}>{r.user}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Feather name="star" size={11} color={C.ink} />
                    <Text style={[T.monoB, { fontSize: 11 }]}>{r.rating}.0</Text>
                  </View>
                </View>
                <Text style={[T.body, { color: C.inkSoft, marginTop: 8, lineHeight: 19 }]} numberOfLines={4}>{`"${r.text}"`}</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 10 }]}>{r.date}</Text>
              </View>
            ))}
          </ScrollView>
          </>)}

        </Animated.View>

        {/* BUY MORE, SAVE MORE — Add to bag slides you down to this upsell on the same page */}
        <View onLayout={(e) => setUpsellY(e.nativeEvent.layout.y)} style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
          <View style={[{ padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.ink }, BORDER(1)]}>
            <Feather name="gift" size={18} color={C.white} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.white }}>Buy items & get ₹50 off</Text>
              <Text style={[T.mono, { color: C.white, fontSize: 9, marginTop: 2, opacity: 0.8 }]}>Add one more to unlock TRENDZO50 at checkout</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.m, marginTop: SP.m, minHeight: ready ? undefined : 230 }}>
            {ready && PRODUCTS.filter(p => p.id !== product.id).slice(0, 6).map(p => (
              <View key={p.id} style={{ width: 150 }}>
                <Pressable onPress={() => openZoom(zoomRefs.current['sim' + p.id], p.img, p)}>
                  <View ref={(el) => { zoomRefs.current['sim' + p.id] = el; }} collapsable={false} style={[{ height: 170, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                    <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                  <Text style={[T.monoB, { fontSize: 9, marginTop: 6 }]} numberOfLines={1}>{p.brand}</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: C.ink }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, marginTop: 2 }}>₹{p.price}</Text>
                </Pressable>
                <Pressable onPress={() => { addToCart(p, 'M'); showToast('Added to bag', p.name, 'shopping-bag'); }} style={[{ marginTop: 6, paddingVertical: 8, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: C.ink, letterSpacing: 0.5 }}>+ ADD</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* MORE TO LOVE — STICKY header (pins just below the search); the grid scrolls under it. */}
        <View style={{ backgroundColor: night ? '#000000' : '#FFFFFF', paddingHorizontal: SP.l, paddingTop: SP.l, paddingBottom: SP.s, borderBottomWidth: 1, borderColor: C.ink }}>
          <Text style={T.h2}>{`▌ MORE TO LOVE`}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.m, minHeight: gridReady ? undefined : 600 }}>
          {gridReady && [...PRODUCTS, ...PRODUCTS, ...PRODUCTS, ...PRODUCTS].filter(p => p.id !== product.id).slice(0, 16).map((p, i) => (
            <Pressable key={p.id + '-' + i} onPress={() => openZoom(zoomRefs.current['grid' + p.id + '-' + i], p.img, p)} style={{ width: (width - SP.l * 2 - SP.s) / 2, marginBottom: SP.m }}>
              <View ref={(el) => { zoomRefs.current['grid' + p.id + '-' + i] = el; }} collapsable={false} style={[{ height: 200, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
              <Text style={[T.monoB, { fontSize: 9, marginTop: 6 }]} numberOfLines={1}>{p.brand}</Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: C.ink, marginTop: 1 }} numberOfLines={1}>{p.name}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, marginTop: 2 }}>₹{p.price}</Text>
            </Pressable>
          ))}
        </View>

      </Animated.ScrollView>

      {/* Sticky CTA — single bar, NATIVE-driven: pinned at the bottom, then physically moves up
          with the scroll once you reach its parked spot. No fade, no jitter (synced to scroll). */}
      <Animated.View
        pointerEvents={fixedCtaInteractive ? 'auto' : 'none'}
        onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
        style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, flexDirection: 'row', gap: SP.s, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.ink, paddingHorizontal: SP.l, paddingTop: SP.m, paddingBottom: 28 }, fixedCtaStyle]}
      >
        <BrutalButton label="Add to bag" icon="shopping-bag" variant="outline" onPress={handleAdd} style={{ flex: 1 }} />
        <BrutalButton label="Buy now" iconRight="arrow-right" onPress={handleBuy} style={{ flex: 1 }} />
      </Animated.View>

      {/* FLOATING TRY-ON FAB — fades with product content so it does not remain during close */}
      <Animated.View
        style={[{ position: 'absolute', right: SP.l, bottom: 104, zIndex: 50 }, contentStyle]}
      >
        <Pressable onPress={() => nav.navigate('TryOn', { product })}>
          <MV
            from={{ scale: 1 }}
            animate={{ scale: 1.06 }}
            transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Pill label that pokes out from the circle */}
              <View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.ink }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: C.white, letterSpacing: 0.5 }}>TRY ON</Text>
              </View>
              {/* The circular FAB */}
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: C.ink, borderWidth: 2, borderColor: C.ink,
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
        <Animated.View onLayout={startFly} pointerEvents="none" style={[{ position: 'absolute', backgroundColor: C.hairline, overflow: 'hidden', zIndex: 50 }, overlayStyle]}>
          <CachedImage transition={0} source={{ uri: product.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </Animated.View>
      )}

      {/* ═══ SELECT-A-SIZE SHEET — pops from the bottom when no size is chosen ═══ */}
      <Modal transparent visible={!!sizeSheet} animationType="none" onRequestClose={() => setSizeSheet(null)}>
        <Pressable onPress={() => setSizeSheet(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <MV
            from={{ translateY: 400 }}
            animate={{ translateY: 0 }}
            exit={{ translateY: 400 }}
            transition={{ type: 'timing', duration: 300 }}
            onStartShouldSetResponder={() => true}
            style={{ backgroundColor: night ? '#0a0a0a' : '#FFFFFF', paddingTop: SP.m, paddingHorizontal: SP.l, paddingBottom: 36, borderTopWidth: 2, borderColor: C.ink }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 4, backgroundColor: C.ink, marginBottom: SP.m }} />
            <Text style={[T.monoB, { fontSize: 10, color: C.dim }]}>{'SELECT_A_SIZE'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(26), color: C.ink, letterSpacing: -1, marginTop: 2 }}>Pick your size</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>Choose a size to continue</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, marginTop: SP.l }}>
              {SIZES.map((sz) => (
                <Pressable key={sz} onPress={() => pickSize(sz)} style={[{ width: 56, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink, letterSpacing: 0.5 }}>{sz}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => showConfirm({ title: 'Size guide', msg: 'XS · 32 in chest\nS · 34 in chest\nM · 36 in chest\nL · 38 in chest\nXL · 40 in chest', confirmLabel: 'Got it', cancelLabel: 'Close', icon: 'ruler' })} style={{ marginTop: SP.m, alignSelf: 'flex-start' }}>
              <Text style={[T.monoB, { fontSize: 10, textDecorationLine: 'underline' }]}>{'[ SIZE GUIDE ]'}</Text>
            </Pressable>
          </MV>
        </Pressable>
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
