// BAG — redesigned in the app's editorial language: ink on white, hairline
// borders, Inter Black headlines with the highlighter-yellow bar, a black
// ticker strip, black method bars per delivery bucket, receipt-style summary
// and slab CTAs sinking into yellow offset shadows. All the original cart
// logic is preserved: per-method buckets, move-to, server pricing, coupon,
// auth-gated checkout, tab-bar scroll behaviour.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar, TextInput, Animated, Easing, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER, rf, HELV} from '../theme/brutal';
import { CachedImage, FadeInUp, ProductCard } from '../components/Brutal';
import { useApp, DeliveryMethod } from '../state/AppState';
import { useTabBarScroll } from '../hooks/useTabBarScroll';
import { ProductRailSkeleton } from '../components/CatalogState';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { priceCart, toRupees, type CartPricing } from '../services/pricing';
import { useAppConfig } from '../hooks/useAppConfig';
import type { AppConfig } from '../services/appConfig';
import { readCouponOutcome, type CouponOutcome } from '../services/coupons';

const TAB_BAR_HEIGHT = 72;
const YELLOW = '#F2E63C'; // the Home highlighter — the one accent
const FREE_SHIP_AT = 999;

type MethodMeta = { label: string; icon: string; time: string; fee: number; blurb: string };

/**
 * Delivery labels and fees come from GET /app-config, not from here.
 *
 * These were written twice with the same numbers — once in this file, once in
 * ReviewOrderScreen — while the real values live in
 * `platform_config.base_delivery_fee_table` x `surge_multiplier`, with per-store
 * overrides on top. They agreed by coincidence; the first pricing change would
 * have made the app wrong in two places at once.
 *
 * This shape is only the offline fallback and the type the screen renders.
 */
const methodMetaFrom = (cfg: AppConfig): Record<DeliveryMethod, MethodMeta> => {
  // Defensive: the hook merges over defaults, but a screen must not crash if
  // an older backend (or a bad cache entry) ever yields a partial config.
  const by = new Map((cfg.delivery?.methods ?? []).map((m) => [m.id, m]));
  const one = (id: DeliveryMethod, fallback: MethodMeta): MethodMeta => {
    const m = by.get(id);
    if (!m) return fallback;
    return {
      label: `${m.label} · ${m.etaLabel}`,
      icon: m.icon,
      time: m.etaLabel,
      fee: Math.round(m.feePaise / 100),
      blurb: m.blurb,
    };
  };
  return {
    express: one('express', { label: 'Express · 60 min', icon: 'zap', time: '60 min', fee: 99, blurb: 'From your block · in under an hour' }),
    standard: one('standard', { label: 'Standard · 2-3 days', icon: 'package', time: '2-3 days', fee: 49, blurb: 'Tracked shipping · door-to-door' }),
    pickup: one('pickup', { label: 'Instore pickup', icon: 'map-pin', time: 'In store', fee: 0, blurb: 'Ready at your nearest store · free' }),
  };
};
const METHOD_ORDER: DeliveryMethod[] = ['express', 'standard', 'pickup'];

// ── TICKER — the Home marquee strip, black with endlessly scrolling text ──
function Ticker({ text }: { text: string }) {
  const [segW, setSegW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  // Tabs stay mounted after their first visit, so an unmount-only cleanup meant
  // this marquee kept animating forever while the user was on Home, Reels or
  // Category. Tie it to focus instead.
  useFocusEffect(useCallback(() => {
    if (!segW) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: -segW, duration: segW * 20, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [segW, x]));
  const seg = <Text numberOfLines={1} style={[T.caption, { color: C.white }]}>{text}</Text>;
  return (
    <View style={{ height: 30, backgroundColor: C.ink, overflow: 'hidden', justifyContent: 'center' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
        <View onLayout={(e) => setSegW(e.nativeEvent.layout.width)}>{seg}</View>
        {seg}
      </Animated.View>
    </View>
  );
}

// ── SLAB — the brand CTA: black slab sinking into a yellow offset shadow ──
function Slab({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) {
  return (
    <View>
      <View style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, backgroundColor: YELLOW, borderWidth: 1, borderColor: C.ink }} />
      <Pressable onPress={onPress} style={{ backgroundColor: C.ink, paddingVertical: small ? 12 : 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, borderWidth: 1, borderColor: C.ink }}>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(small ? 13 : 15), color: C.white, letterSpacing: 2 }}>{label}</Text>
        <Feather name="arrow-right" size={small ? 14 : 16} color={C.white} />
      </Pressable>
    </View>
  );
}

export default function CartScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { cart, updateQty, removeFromCart, updateMethod, cartTotal, cartCount, showToast, requireAuth, gender } = useApp();
  const tabScroll = useTabBarScroll();
  const cfg = useAppConfig();
  const METHOD_META = useMemo(() => methodMetaFrom(cfg), [cfg]);
  const checkoutBarOffset = TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom : 12);
  const [coupon, setCoupon] = useState('');
  // `submitted` is the code currently being priced WITH the cart; `outcome` is
  // the server's verdict on it. The old `applied` was a locally-invented rupee
  // amount that never reached the backend.
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CouponOutcome>({ state: 'none' });
  // Real server-computed totals when every line carries a backend variant id
  // (guest-ok via /pricing/cart). Falls back to local math for mock items.
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const allPriceable = cart.length > 0 && cart.every(it => !!it.variantId);
  // Debounced. Every quantity tap used to fire an immediate, un-abortable
  // POST /pricing/cart; holding the + button put several in flight at once and
  // their results applied in arrival order, so the displayed total could settle
  // on a stale response. 400 ms is below the threshold where the delay reads as
  // lag but well above a rapid tap-tap-tap.
  useEffect(() => {
    if (!allPriceable) { setPricing(null); return; }
    let cancelled = false;
    const items = cart.map(it => ({ variantId: it.variantId as string, qty: it.qty }));
    const t = setTimeout(() => {
      priceCart(items, submitted ?? undefined)
        .then(p => {
          if (cancelled) return;
          setPricing(p);
          // The discount and the rejection reason both come from THIS response,
          // so what the customer is shown is exactly what the server computed.
          setOutcome(readCouponOutcome(submitted, p.aggregate.couponPaise, p.rejectedCodes));
        })
        .catch(() => { if (!cancelled) { setPricing(null); setOutcome({ state: 'none' }); } });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [cart, allPriceable, submitted]);
  const agg = pricing?.aggregate;

  // Submitting re-prices the cart with the code attached; the server decides.
  const apply = () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    if (!allPriceable) {
      showToast('Cannot apply yet', 'Some items in your bag are not checkout-ready', 'x');
      return;
    }
    setSubmitted(code);
  };
  const clearCoupon = () => { setSubmitted(null); setOutcome({ state: 'none' }); setCoupon(''); };

  // Surface the server's own reason rather than "Try NEWVIBE".
  const lastNotified = useRef<string | null>(null);
  useEffect(() => {
    const key = `${outcome.state}:${'code' in outcome ? outcome.code : ''}`;
    if (lastNotified.current === key) return;
    lastNotified.current = key;
    if (outcome.state === 'applied') {
      showToast('Coupon applied', `₹${Math.round(outcome.discountPaise / 100)} off · ${outcome.code}`, 'tag');
    } else if (outcome.state === 'rejected') {
      showToast('Code not applied', outcome.message, 'x');
    }
  }, [outcome, showToast]);

  const appliedRupees = outcome.state === 'applied' ? Math.round(outcome.discountPaise / 100) : 0;
  const isApplied = outcome.state === 'applied';

  // Group cart items by delivery method. Bucketing + the three derived totals all
  // depend ONLY on `cart`, but ran on every render — including once per keystroke
  // in the coupon field, which has nothing to do with the bag's contents.
  const { buckets, bucketSubtotal, bucketFee, allFees, activeBuckets } = useMemo(() => {
    const b: Record<DeliveryMethod, typeof cart> = { express: [], standard: [], pickup: [] };
    cart.forEach(it => {
      const m: DeliveryMethod = (it as any).method || 'express';
      b[m].push(it);
    });
    const subtotal = (m: DeliveryMethod) => b[m].reduce((s, it) => s + it.price * it.qty, 0);
    const fee = (m: DeliveryMethod) => (b[m].length > 0 ? METHOD_META[m].fee : 0);
    return {
      buckets: b,
      bucketSubtotal: subtotal,
      bucketFee: fee,
      allFees: METHOD_ORDER.reduce((s, m) => s + fee(m), 0),
      activeBuckets: METHOD_ORDER.filter(m => b[m].length > 0),
    };
  }, [cart]);
  // Server total when we have one — it already includes the coupon, delivery and
  // tax. The local arithmetic is the offline fallback only, and must subtract the
  // SERVER's discount, never a locally chosen number.
  const total = agg ? toRupees(agg.grandTotalPaise) : Math.max(0, cartTotal - appliedRupees) + allFees;

  /**
   * Both upsell rails come from the live catalog now.
   *
   * They were slices of the bundled demo array, so "Start with these" and
   * "Complete the fit" recommended six products the store does not sell — and
   * tapping one opened a fully priced, add-to-bag-able page for it.
   *
   * One fetch feeds both: the empty-bag rail shows the head of it, the
   * has-items rail shows the same list minus whatever is already in the bag.
   */
  const { products: suggested, status: suggestedStatus } = useCatalogProducts({ gender, limit: 12 });
  const startWith = useMemo(() => suggested.slice(0, 6), [suggested]);
  const completeTheFit = useMemo(
    () => suggested.filter(p => !cart.find(c => c.id === p.id)).slice(0, 6),
    [suggested, cart],
  );

  const checkoutBucket = (m: DeliveryMethod) => {
    // Single-page checkout (Myntra-style): address, delivery, payment and pay
    // all live on ReviewOrder — no multi-step wizard. The bucket's method
    // rides along so the page shows that bucket's items + delivery.
    // Guests get the login sheet first — checkout only opens once signed in.
    requireAuth(() => nav.navigate('ReviewOrder', { preMethod: m }));
  };

  // Stable so the upsell rails' ProductCard memo can hold.
  const goToProduct = useCallback((p: any) => nav.navigate('ProductDetail', { product: p }), [nav]);

  const shipProgress = Math.min(1, cartTotal / FREE_SHIP_AT);
  const shipRemaining = Math.max(0, FREE_SHIP_AT - cartTotal);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* ── HEADER — editorial: kicker, highlighter headline, count chip ── */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: SP.l, paddingBottom: SP.m, backgroundColor: C.white }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={[T.micro, { color: C.dim, letterSpacing: 3 }]}>TRENDZO · YOUR BAG</Text>
            <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <View style={{ position: 'absolute', left: -3, right: -6, bottom: 2, height: 11, backgroundColor: YELLOW }} />
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(30), lineHeight: rf(34), color: C.ink, letterSpacing: -1 }}>IN THE BAG.</Text>
            </View>
          </View>
          {/* What's in the bag, at a glance — overlapping item thumbnails */}
          <View style={{ alignItems: 'flex-end', marginBottom: 2 }}>
            {cart.length > 0 && (
              <View style={{ flexDirection: 'row' }}>
                {cart.slice(0, 3).map((it, i) => (
                  <View key={it.id + it.size} style={[{ width: 34, height: 42, backgroundColor: '#F4F4F4', overflow: 'hidden', marginLeft: i ? -10 : 0 }, BORDER(1)]}>
                    <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                ))}
                {cart.length > 3 && (
                  <View style={{ width: 34, height: 42, marginLeft: -10, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.ink }}>
                    <Text style={[T.micro, { color: C.white, fontFamily: HELV, fontWeight: '700' }]}>+{cart.length - 3}</Text>
                  </View>
                )}
              </View>
            )}
            <Text style={[T.micro, { color: C.dim, marginTop: 5, letterSpacing: 1 }]}>{cartCount} ITEM{cartCount === 1 ? '' : 'S'}</Text>
          </View>
        </View>
      </View>
      <Ticker text={'60-min delivery  //  free returns  //  free doorstep pickup  //  secure checkout  //  '} />

      {cart.length === 0 ? (
        /* ── EMPTY STATE — ghost wordmark, bordered tile, slab CTA, starter rail ── */
        <ScrollView {...tabScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SP.xl + checkoutBarOffset }}>
          <View style={{ alignItems: 'center', paddingTop: SP.huge, paddingHorizontal: SP.l }}>
            <Text numberOfLines={1} style={{ position: 'absolute', top: SP.xl, fontFamily: 'Inter_900Black', fontSize: rf(88), letterSpacing: -4, color: 'rgba(0,0,0,0.04)' }}>EMPTY</Text>
            <View style={[{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
              <Feather name="shopping-bag" size={38} color={C.ink} />
            </View>
            <Text style={[T.h2, { marginTop: SP.l, textTransform: 'uppercase', textAlign: 'center' }]}>Nothing in here yet</Text>
            <Text style={[T.caption, { color: C.dim, marginTop: 8, textAlign: 'center', maxWidth: 260 }]}>Fits you add land here — and reach your door in 60 minutes.</Text>
            <View style={{ alignSelf: 'stretch', marginTop: SP.xl }}>
              <Slab label="START SHOPPING" onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} />
            </View>
          </View>
          {(suggestedStatus === 'loading' || startWith.length > 0) && (
            <View style={{ marginTop: SP.huge }}>
              <View style={{ paddingHorizontal: SP.l, marginBottom: SP.m }}>
                <Text style={[T.h2, { textTransform: 'uppercase' }]}>Start with these</Text>
              </View>
              {suggestedStatus === 'loading' ? (
                <ProductRailSkeleton count={3} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
                  {startWith.map((p, i) => (
                    <FadeInUp key={p.id} delay={i * 30}>
                      <ProductCard p={p} onPress={goToProduct} />
                    </FadeInUp>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        /* Keyboard-aware: typing a coupon never hides the field — the page
           shrinks above the keyboard and stays scrollable. */
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView {...tabScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: SP.xl + checkoutBarOffset }}>
          {/* ── FREE-DELIVERY METER — yellow fill, unlocks at ₹999 ── */}
          <View style={[{ marginHorizontal: SP.l, marginTop: SP.l, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="truck" size={15} color={C.ink} />
              <Text style={[T.caption, { color: C.ink, flex: 1 }]}>
                {shipRemaining > 0 ? <>₹{shipRemaining} away from <Text style={{ fontFamily: HELV, fontWeight: '700' }}>free standard delivery</Text></> : 'Free standard delivery unlocked'}
              </Text>
              {shipRemaining === 0 && <Feather name="check-circle" size={15} color={C.ink} />}
            </View>
            <View style={[{ height: 8, backgroundColor: '#F4F4F4', marginTop: 10, overflow: 'hidden' }, BORDER(1)]}>
              <View style={{ width: `${shipProgress * 100}%`, height: '100%', backgroundColor: YELLOW, borderRightWidth: shipProgress < 1 ? 1 : 0, borderColor: C.ink }} />
            </View>
          </View>

          {/* ── DELIVERY BUCKETS — black method bar + white item card each ── */}
          {METHOD_ORDER.map(m => {
            const items = buckets[m];
            if (items.length === 0) return null;
            const meta = METHOD_META[m];
            const sub = bucketSubtotal(m);
            const fee = bucketFee(m);
            return (
              <View key={m} style={{ marginHorizontal: SP.l, marginTop: SP.l }}>
                {/* Method bar — black strip, yellow fee chip */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, paddingHorizontal: SP.m, paddingVertical: 10 }}>
                  <Feather name={meta.icon as any} size={14} color={C.white} />
                  <Text style={[T.caption, { color: C.white, fontFamily: HELV, fontWeight: '700', letterSpacing: 1 }]}>{meta.label.toUpperCase()}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[T.micro, { color: 'rgba(255,255,255,0.6)' }]}>
                    {m === 'express' ? `~${40 + (items.length % 4) * 5} min` : meta.time}
                  </Text>
                  <View style={{ backgroundColor: YELLOW, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={[T.micro, { color: C.ink, fontFamily: HELV, fontWeight: '700' }]}>{fee === 0 ? 'FREE' : `₹${fee}`}</Text>
                  </View>
                </View>

                {/* Items card */}
                <View style={[{ backgroundColor: C.white, borderTopWidth: 0 }, BORDER(1), { borderTopWidth: 0 }]}>
                  {items.map((it, i) => (
                    <View key={it.id + it.size + m} style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: C.hairline }}>
                      <View style={{ flexDirection: 'row', padding: SP.m, gap: SP.m }}>
                        {/* image */}
                        <View style={[{ width: 82, height: 102, overflow: 'hidden', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                          <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                        </View>
                        {/* details */}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <Text style={[T.micro, { color: C.dim, letterSpacing: 1, textTransform: 'uppercase', flex: 1 }]} numberOfLines={1}>{it.brand}</Text>
                            <Pressable onPress={() => removeFromCart(it.id)} hitSlop={10}>
                              <Feather name="x" size={14} color={C.dim} />
                            </Pressable>
                          </View>
                          <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={2}>{it.name}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                            <View style={[{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                              <Text style={[T.micro, { color: C.ink }]}>SIZE {it.size}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                            {/* qty stepper */}
                            <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
                              <Pressable onPress={() => updateQty(it.id, it.qty - 1)} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: C.hairline }}>
                                <Feather name="minus" size={13} color={C.ink} />
                              </Pressable>
                              <Text style={[T.bodyB, { paddingHorizontal: 14 }]}>{it.qty}</Text>
                              <Pressable onPress={() => updateQty(it.id, it.qty + 1)} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderColor: C.hairline }}>
                                <Feather name="plus" size={13} color={C.ink} />
                              </Pressable>
                            </View>
                            <Text style={[T.price]}>₹{it.price * it.qty}</Text>
                          </View>
                        </View>
                      </View>
                      {/* move-to chips */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingBottom: SP.s, gap: 6 }}>
                        <Feather name="corner-down-right" size={11} color={C.dim} />
                        <Text style={[T.micro, { color: C.dim }]}>Move to</Text>
                        {METHOD_ORDER.filter(x => x !== m).map(x => (
                          <Pressable key={x} onPress={() => updateMethod(it.id, x)} style={[{ paddingHorizontal: 9, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                            <Text style={[T.micro, { color: C.ink }]}>{METHOD_META[x].time}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}

                  {/* bucket footer — subtotal + slab checkout */}
                  <View style={{ borderTopWidth: 1, borderColor: C.hairline, padding: SP.m, paddingBottom: SP.m + 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SP.m }}>
                      <Text style={[T.micro, { color: C.dim }]}>SUBTOTAL · {items.length} ITEM{items.length > 1 ? 'S' : ''}{fee > 0 ? ` + ₹${fee} DELIVERY` : ''}</Text>
                      <Text style={[T.h2]}>₹{sub + fee}</Text>
                    </View>
                    <Slab small label={m === 'express' ? 'CHECKOUT · 60 MIN' : m === 'standard' ? 'CHECKOUT · STANDARD' : 'CHECKOUT · IN STORE'} onPress={() => checkoutBucket(m)} />
                  </View>
                </View>
              </View>
            );
          })}

          {/* ── COUPON ── */}
          <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SP.s }}>
              <View style={{ alignSelf: 'flex-start' }}>
                <View style={{ position: 'absolute', left: -2, right: -4, bottom: 1, height: 8, backgroundColor: YELLOW }} />
                <Text style={[T.h3, { textTransform: 'uppercase' }]}>Coupon</Text>
              </View>
              <Pressable onPress={() => nav.navigate('CouponWallet')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '600' }]}>View wallet</Text>
                <Feather name="chevron-right" size={13} color={C.ink} />
              </Pressable>
            </View>
            <View style={[{ flexDirection: 'row', alignItems: 'stretch', height: 48, overflow: 'hidden' }, BORDER(1)]}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, backgroundColor: C.white }}>
                <Feather name="tag" size={14} color={C.ink} />
                <TextInput
                  value={coupon}
                  onChangeText={setCoupon}
                  placeholder="Enter code"
                  placeholderTextColor={C.dim}
                  autoCapitalize="characters"
                  editable={!isApplied}
                  style={[T.monoB, { flex: 1, marginLeft: 8, letterSpacing: 1, padding: 0 }]}
                />
                {coupon.length > 0 && !isApplied && (
                  <Pressable onPress={() => setCoupon('')} hitSlop={10}>
                    <Feather name="x" size={12} color={C.dim} />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={isApplied ? undefined : apply}
                disabled={isApplied}
                style={{ paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isApplied ? C.faint : C.ink }}
              >
                <Text style={[T.button, { fontSize: rf(14) }]}>{isApplied ? 'Applied' : 'Apply'}</Text>
              </Pressable>
            </View>
            {isApplied && (
              <Pressable onPress={clearCoupon} style={{ marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="x" size={11} color={C.dim} />
                <Text style={[T.caption, { textDecorationLine: 'underline' }]}>Remove coupon</Text>
              </Pressable>
            )}
            {outcome.state === 'rejected' && (
              <Text style={[T.caption, { marginTop: 6, color: '#C1121F' }]}>{outcome.message}</Text>
            )}
          </View>

          {/* ── ORDER SUMMARY — receipt card with a ghost ₹ ── */}
          <View style={[{ marginHorizontal: SP.l, marginTop: SP.l, backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
            <Text style={{ position: 'absolute', right: -8, bottom: -24, fontFamily: 'Inter_900Black', fontSize: rf(110), color: 'rgba(0,0,0,0.03)' }}>₹</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
              <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '700', letterSpacing: 1.5 }]}>ORDER SUMMARY</Text>
              <Feather name="file-text" size={14} color={C.ink} />
            </View>
            <View style={{ padding: SP.m }}>
              {agg ? (
                <>
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Subtotal</Text><Text style={[T.bodyB]}>₹{toRupees(agg.itemsSubtotalPaise)}</Text></View>
                  {agg.discountPaise > 0 && <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Discount</Text><Text style={[T.bodyB, { color: C.green }]}>−₹{toRupees(agg.discountPaise)}</Text></View>}
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Delivery</Text><Text style={[T.bodyB]}>{agg.deliveryFeePaise === 0 ? 'Free' : `₹${toRupees(agg.deliveryFeePaise)}`}</Text></View>
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Tax · GST</Text><Text style={[T.bodyB]}>₹{toRupees(agg.taxPaise)}</Text></View>
                  <View style={{ height: 1, backgroundColor: C.hairline, marginVertical: 4 }} />
                  <View style={s.sumRow}>
                    <Text style={[T.h3, { textTransform: 'uppercase' }]}>Total</Text>
                    <View>
                      <View style={{ position: 'absolute', left: -4, right: -4, bottom: 2, height: 10, backgroundColor: YELLOW }} />
                      <Text style={[T.h1]}>₹{toRupees(agg.grandTotalPaise)}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Subtotal</Text><Text style={[T.bodyB]}>₹{cartTotal}</Text></View>
                  {METHOD_ORDER.map(m => buckets[m].length > 0 && bucketFee(m) > 0 ? (
                    <View key={m} style={s.sumRow}>
                      <Text style={[T.body, { color: C.dim }]}>{METHOD_META[m].label.split('·')[0].trim()} · {METHOD_META[m].time}</Text>
                      <Text style={[T.bodyB]}>₹{bucketFee(m)}</Text>
                    </View>
                  ) : null)}
                  {isApplied && <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>{`Coupon · ${outcome.state === 'applied' ? outcome.code : ''}`}</Text><Text style={[T.bodyB, { color: C.green }]}>−₹{appliedRupees}</Text></View>}
                  <View style={{ height: 1, backgroundColor: C.hairline, marginVertical: 4 }} />
                  <View style={s.sumRow}>
                    <Text style={[T.h3, { textTransform: 'uppercase' }]}>Total</Text>
                    <View>
                      <View style={{ position: 'absolute', left: -4, right: -4, bottom: 2, height: 10, backgroundColor: YELLOW }} />
                      <Text style={[T.h1]}>₹{total}</Text>
                    </View>
                  </View>
                </>
              )}
              <Text style={[T.micro, { color: C.dim, marginTop: 6 }]}>
                {activeBuckets.length > 1 ? `Split across ${activeBuckets.length} deliveries — each checks out on its own.` : 'Inclusive of all taxes.'}
              </Text>
            </View>
          </View>

          {/* ── COMPLETE THE FIT — upsell rail. Hidden when the catalog has
              nothing left to suggest, rather than padded with demo art. ── */}
          {(suggestedStatus === 'loading' || completeTheFit.length > 0) && (
            <View style={{ marginTop: SP.xl }}>
              <View style={{ paddingHorizontal: SP.l, marginBottom: SP.m, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={[T.h2, { textTransform: 'uppercase' }]}>Complete the fit</Text>
                <Text style={[T.micro, { color: C.dim }]}>Picked for your bag</Text>
              </View>
              {suggestedStatus === 'loading' ? (
                <ProductRailSkeleton count={3} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
                  {completeTheFit.map((p, i) => (
                    <FadeInUp key={p.id} delay={i * 30}>
                      <ProductCard p={p} onPress={goToProduct} />
                    </FadeInUp>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
});
