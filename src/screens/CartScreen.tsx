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
import { useApp, cartLineKey, DeliveryMethod } from '../state/AppState';
import { useTabBarScroll } from '../hooks/useTabBarScroll';
import { ProductRailSkeleton } from '../components/CatalogState';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { priceCart, toRupees, type CartPricing } from '../services/pricing';
import { useAppConfig } from '../hooks/useAppConfig';
import type { AppConfig } from '../services/appConfig';
import {
  readCouponOutcome, mergeCouponOutcomes, codeFields,
  type CouponOutcome, type CodeSource,
} from '../services/coupons';

const TAB_BAR_HEIGHT = 72;
const YELLOW = '#F2E63C'; // the Home highlighter — the one accent

type MethodMeta = { label: string; icon: string; time: string; blurb: string };

/**
 * Delivery labels come from GET /app-config; the FEES do not come from here at all.
 *
 * This used to carry a `fee` per method, written twice with the same numbers —
 * once here, once in ReviewOrderScreen — while the real charge is computed by
 * the pricing engine per store, per method, with surge and store overrides on
 * top. The Bag showed one number and Review Order showed another for the same
 * bag. Every rupee on this screen is now read from a quote (see `quotes` below);
 * this shape is copy only.
 *
 * `standard` is gone with it: the storefront sells express, the doorstep trial
 * and store collection. See DeliveryMethod in AppState.
 */
const methodMetaFrom = (cfg: AppConfig): Record<DeliveryMethod, MethodMeta> => {
  // Defensive: the hook merges over defaults, but a screen must not crash if
  // an older backend (or a bad cache entry) ever yields a partial config.
  const by = new Map((cfg.delivery?.methods ?? []).map((m) => [m.id, m]));
  const one = (id: DeliveryMethod, fallback: MethodMeta): MethodMeta => {
    const m = by.get(id);
    if (!m) return fallback;
    return {
      // Try & Buy deliberately carries NO eta. The config ships "Next day" for it
      // and the app printed that everywhere, which is a delivery promise the
      // doorstep-trial flow does not make.
      label: id === 'try_and_buy' || !m.etaLabel ? m.label : `${m.label} · ${m.etaLabel}`,
      icon: m.icon,
      time: id === 'try_and_buy' ? 'At your door' : m.etaLabel || fallback.time,
      blurb: m.blurb,
    };
  };
  return {
    express: one('express', { label: 'Express · 60 min', icon: 'zap', time: '60 min', blurb: 'From your block · in under an hour' }),
    try_and_buy: one('try_and_buy', { label: 'Try & Buy', icon: 'home', time: 'At your door', blurb: 'Try it on at your door · keep what fits' }),
    pickup: one('pickup', { label: 'Instore pickup', icon: 'map-pin', time: 'In store', blurb: 'Ready at your nearest store · free' }),
  };
};
const METHOD_ORDER: DeliveryMethod[] = ['express', 'try_and_buy', 'pickup'];
/** What each bucket's checkout slab says. */
const CHECKOUT_LABEL: Record<DeliveryMethod, string> = {
  express: 'CHECKOUT · 60 MIN',
  try_and_buy: 'CHECKOUT · TRY & BUY',
  pickup: 'CHECKOUT · IN STORE',
};

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
  const { cart, updateQty, removeFromCart, updateMethod, cartCount, showToast, requireAuth, gender, token } = useApp();
  const tabScroll = useTabBarScroll();
  const cfg = useAppConfig();
  const METHOD_META = useMemo(() => methodMetaFrom(cfg), [cfg]);
  const checkoutBarOffset = TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom : 12);
  const [coupon, setCoupon] = useState('');
  // `submitted` is the code currently being priced WITH the cart; `outcome` is
  // the server's verdict on it. The old `applied` was a locally-invented rupee
  // amount that never reached the backend.
  const [submitted, setSubmitted] = useState<string | null>(null);
  /**
   * Where the code came from, which decides which field(s) it is sent in.
   *
   * A code typed into the box is 'unknown' and goes out as BOTH `couponCode` and
   * `voucherCode`: the two are separate namespaces and nothing about the string
   * says which one it belongs to. Sending it as a coupon and retrying as a
   * voucher would cost a second debounce plus a second quote before the
   * shopper's own code appeared to work. See codeFields / readCouponOutcome.
   */
  const [codeSource, setCodeSource] = useState<CodeSource>('unknown');
  const [outcome, setOutcome] = useState<CouponOutcome>({ state: 'none' });
  /**
   * The verdict PER BUCKET, not just the merged one.
   *
   * A code can apply to one delivery and not another (store scope, minimum
   * order). The merged verdict is what the coupon row shows; this is what
   * decides whether a given bucket's Checkout is allowed to carry the code
   * across to Review Order — handing it to a bucket that rejected it would open
   * checkout with a code that bounces the moment the page prices itself.
   */
  const [bucketOutcomes, setBucketOutcomes] = useState<Partial<Record<DeliveryMethod, CouponOutcome>>>({});

  // Group cart items by delivery method. Bucketing depends ONLY on `cart`, but
  // used to run on every render — including once per keystroke in the coupon
  // field, which has nothing to do with the bag's contents.
  const { buckets, activeBuckets } = useMemo(() => {
    const b: Record<DeliveryMethod, typeof cart> = { express: [], try_and_buy: [], pickup: [] };
    cart.forEach(it => {
      const m: DeliveryMethod = (it as any).method || 'express';
      (b[m] ?? b.express).push(it);
    });
    return { buckets: b, activeBuckets: METHOD_ORDER.filter(m => b[m].length > 0) };
  }, [cart]);

  /**
   * ONE QUOTE PER BUCKET, priced with that bucket's own delivery method.
   *
   * The Bag used to call /pricing/cart once, for the WHOLE cart, with no
   * `deliveryMethod` — so the server priced the default method — and then drew
   * each bucket's delivery charge from a hardcoded table in this file. Review
   * Order, opened from a bucket, priced that bucket with its real method. The
   * two screens therefore showed different delivery charges and different totals
   * for the same items, which is exactly what a shopper notices.
   *
   * A bucket is what checks out, so a bucket is what gets quoted: same items,
   * same method, same code, same engine as the Review Order it opens. Nothing on
   * this screen is computed locally any more.
   */
  const [quotes, setQuotes] = useState<Partial<Record<DeliveryMethod, CartPricing>>>({});
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** The server's own words when a quote fails — usually actionable. */
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoteNonce, setQuoteNonce] = useState(0);
  const allPriceable = cart.length > 0 && cart.every(it => !!it.variantId);
  // Debounced. Every quantity tap used to fire an immediate, un-abortable
  // POST /pricing/cart; holding the + button put several in flight at once and
  // their results applied in arrival order, so the displayed total could settle
  // on a stale response. 400 ms is below the threshold where the delay reads as
  // lag but well above a rapid tap-tap-tap.
  useEffect(() => {
    if (!allPriceable) { setQuotes({}); setQuoteStatus('idle'); setQuoteErr(null); return; }
    let cancelled = false;
    const jobs = activeBuckets.map((m) => ({
      m,
      items: buckets[m].map(it => ({ variantId: it.variantId as string, qty: it.qty })),
    }));
    setQuoteStatus('loading');
    setQuoteErr(null);
    const fields = codeFields(submitted, codeSource);
    const t = setTimeout(() => {
      Promise.allSettled(jobs.map(({ m, items }) =>
        priceCart(items, fields.couponCode, {
          ...(fields.voucherCode ? { voucherCode: fields.voucherCode } : {}),
          deliveryMethod: m,
        }).then((p) => [m, p] as const),
      )).then((results) => {
        if (cancelled) return;
        const next: Partial<Record<DeliveryMethod, CartPricing>> = {};
        const perBucket: Partial<Record<DeliveryMethod, CouponOutcome>> = {};
        let failure: string | null = null;
        for (const r of results) {
          if (r.status === 'rejected') {
            // A dropped quote is NOT "prices not confirmed yet". It used to be
            // swallowed here, which left the summary stuck on a loading line
            // with no error and nothing to retry — indistinguishable from a slow
            // network, forever.
            failure = failure ?? ((r.reason as any)?.message ?? "Couldn't price your bag. Please try again.");
            continue;
          }
          const [m, p] = r.value;
          next[m] = p;
          // TOP-LEVEL rejectedCodes only. The per-store arrays report a rejection
          // for any store the coupon's apportioned subtotal did not reach, so
          // reading them shows "coupon invalid" on a bag that was discounted.
          perBucket[m] = readCouponOutcome(submitted, codeSource, p.aggregate.couponPaise, p.rejectedCodes, { signedIn: !!token });
        }
        setQuotes(next);
        setQuoteErr(failure);
        setQuoteStatus(failure ? 'error' : 'ready');
        // A code can legitimately apply to one bucket and not another (store
        // scope, minimum order). It has only FAILED if every bucket refused it.
        setBucketOutcomes(perBucket);
        setOutcome(mergeCouponOutcomes(Object.values(perBucket) as CouponOutcome[]));
      });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [cart, allPriceable, submitted, codeSource, activeBuckets, buckets, token, quoteNonce]);

  /** The quote for one bucket, or null while it has not arrived. */
  const aggOf = (m: DeliveryMethod) => quotes[m]?.aggregate ?? null;
  /** Sum one field of the quote across every bucket that has one. */
  const sumAgg = (pick: (a: NonNullable<ReturnType<typeof aggOf>>) => number) =>
    activeBuckets.reduce((s, m) => { const a = aggOf(m); return a ? s + pick(a) : s; }, 0);
  /** True once every active bucket has a quote — nothing is shown until then. */
  const quotesReady = allPriceable && activeBuckets.length > 0 && activeBuckets.every(m => !!quotes[m]);

  /**
   * Per-line price from the quote, keyed by variant.
   *
   * The cart's own `price` is a client-side copy captured when the item was
   * added; `netLinePaise` is what the engine charges for that line, discounts
   * included. Falls back to the local figure only while no quote exists.
   */
  const lineByVariant = useMemo(() => {
    const m = new Map<string, { netLinePaise: number; attributesLabel: string }>();
    for (const q of Object.values(quotes)) {
      for (const st of q?.stores ?? []) {
        for (const l of st.lines) m.set(l.variantId, { netLinePaise: l.netLinePaise, attributesLabel: l.attributesLabel });
      }
    }
    return m;
  }, [quotes]);
  const lineTotal = (it: { variantId?: string; price: number; qty: number }) => {
    const q = it.variantId ? lineByVariant.get(it.variantId) : undefined;
    return q ? toRupees(q.netLinePaise) : it.price * it.qty;
  };
  /**
   * What the line is, in the retailer's own words.
   *
   * A line added from a product page carries the size the shopper chose; a line
   * added from a reel or a Flash Fit look carries nothing, because the grid
   * projection does not know. `attributesLabel` on the quote is the variant's
   * real label ("M", "32 / Blue", "One size"), so the chip fills in the moment
   * the bag is priced instead of showing an invented "M" from the first frame.
   */
  const variantLabel = (it: { variantId?: string; size?: string }) =>
    it.size || (it.variantId ? lineByVariant.get(it.variantId)?.attributesLabel ?? '' : '');

  const subtotalPaise = sumAgg(a => a.itemsSubtotalPaise);
  const discountPaise = sumAgg(a => a.discountPaise);
  const deliveryPaise = sumAgg(a => a.deliveryFeePaise);
  const taxPaise = sumAgg(a => a.taxPaise);
  const grandTotalPaise = sumAgg(a => a.grandTotalPaise);

  // Submitting re-prices the cart with the code attached; the server decides.
  const apply = () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    if (!allPriceable) {
      showToast('Cannot apply yet', 'Some items in your bag are not checkout-ready', 'x');
      return;
    }
    setCodeSource('unknown'); // typed — could be either namespace
    setSubmitted(code);
  };
  const clearCoupon = () => {
    setSubmitted(null); setCodeSource('unknown');
    setOutcome({ state: 'none' }); setBucketOutcomes({}); setCoupon('');
  };
  /** Buckets this code actually landed in — drives the multi-delivery caveat. */
  const appliedBuckets = activeBuckets.filter((m) => bucketOutcomes[m]?.state === 'applied').length;

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
    //
    // The applied code rides along too. It used to be left behind, so a shopper
    // who applied a coupon in the Bag reached Review Order with an empty coupon
    // field and a total that had quietly gone back up — and had to find and type
    // the same code again.
    //
    // The RESOLVED kind travels with it, not the guess. The quote already told
    // us which field the code landed in, so Review Order re-prices in one call
    // instead of rediscovering it.
    const applied = bucketOutcomes[m];
    requireAuth(() => nav.navigate('ReviewOrder', {
      preMethod: m,
      ...(applied?.state === 'applied' ? { code: applied.code, codeKind: applied.kind } : {}),
    }));
  };

  // Stable so the upsell rails' ProductCard memo can hold.
  const goToProduct = useCallback((p: any) => nav.navigate('ProductDetail', { product: p }), [nav]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* ── HEADER — editorial: kicker, highlighter headline, and a legible
             strip of what is actually in the bag. The preview used to be three
             thumbnails overlapping by 10px with a "+N" tile welded on the end:
             at 34x42, half-covered, it read as one smudged image rather than as
             the items. It is now a full-width scroller — every item, upright,
             with its size and its quantity — so the bag can be recognised at a
             glance without scrolling the page. ── */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: SP.l, paddingBottom: SP.m, backgroundColor: C.white }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[T.micro, { color: C.dim, letterSpacing: 3 }]}>TRENDZO · YOUR BAG</Text>
            <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <View style={{ position: 'absolute', left: -3, right: -6, bottom: 2, height: 11, backgroundColor: YELLOW }} />
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(30), lineHeight: rf(34), color: C.ink, letterSpacing: -1 }}>IN THE BAG.</Text>
            </View>
          </View>
          {cart.length > 0 && (
            <View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.ink, marginBottom: 3 }]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(16), color: C.white, textAlign: 'center' }}>{cartCount}</Text>
              <Text style={[T.micro, { color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }]}>ITEM{cartCount === 1 ? '' : 'S'}</Text>
            </View>
          )}
        </View>
        {cart.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SP.s, paddingTop: SP.m, paddingRight: SP.l }}
          >
            {cart.map((it) => (
              <View key={cartLineKey(it)} style={{ width: 52 }}>
                <View style={[{ width: 52, height: 64, backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
                  <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {it.qty > 1 && (
                    <View style={{ position: 'absolute', top: 0, right: 0, minWidth: 17, paddingHorizontal: 3, paddingVertical: 1, backgroundColor: C.ink }}>
                      <Text style={[T.micro, { color: C.white, fontFamily: HELV, fontWeight: '700', textAlign: 'center' }]}>{`x${it.qty}`}</Text>
                    </View>
                  )}
                </View>
                {!!variantLabel(it) && (
                  <Text style={[T.micro, { color: C.dim, marginTop: 3, textAlign: 'center' }]} numberOfLines={1}>{variantLabel(it)}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        )}
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
          {/* The hardcoded "free delivery at ₹999" meter is gone. It measured the
              bag against a constant in this file that no pricing rule backs, so
              it promised a discount the engine never applies — and it advertised
              "standard delivery", a method the storefront does not sell. What
              the order actually saves is in the summary below, from the quote. */}

          {/* ── DELIVERY BUCKETS — black method bar + white item card each.
                 Every figure below comes from that bucket's own quote, priced
                 with that bucket's delivery method — the same call Review Order
                 makes when this bucket's Checkout is tapped. ── */}
          {METHOD_ORDER.map(m => {
            const items = buckets[m];
            if (items.length === 0) return null;
            const meta = METHOD_META[m];
            const agg = aggOf(m);
            const fee = agg ? toRupees(agg.deliveryFeePaise) : null;
            const bucketTotal = agg ? toRupees(agg.grandTotalPaise) : null;
            return (
              <View key={m} style={{ marginHorizontal: SP.l, marginTop: SP.l }}>
                {/* Method bar — black strip, yellow fee chip */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, paddingHorizontal: SP.m, paddingVertical: 10 }}>
                  <Feather name={meta.icon as any} size={14} color={C.white} />
                  <Text style={[T.caption, { color: C.white, fontFamily: HELV, fontWeight: '700', letterSpacing: 1 }]}>{meta.label.toUpperCase()}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[T.micro, { color: 'rgba(255,255,255,0.6)' }]}>{meta.time}</Text>
                  {/* No fee until the server has quoted one. This chip used to
                      print a constant from this file, which is how the Bag and
                      Review Order came to disagree. */}
                  <View style={{ backgroundColor: fee == null ? 'rgba(255,255,255,0.25)' : YELLOW, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={[T.micro, { color: fee == null ? C.white : C.ink, fontFamily: HELV, fontWeight: '700' }]}>
                      {fee == null ? '···' : fee === 0 ? 'FREE' : `₹${fee}`}
                    </Text>
                  </View>
                </View>

                {/* Items card */}
                <View style={[{ backgroundColor: C.white, borderTopWidth: 0 }, BORDER(1), { borderTopWidth: 0 }]}>
                  {items.map((it, i) => {
                    // The LINE, not the product: two sizes of the same shirt are two
                    // rows and must be removed and re-counted independently.
                    const key = cartLineKey(it);
                    return (
                    <View key={key} style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: C.hairline }}>
                      <View style={{ flexDirection: 'row', padding: SP.m, gap: SP.m }}>
                        {/* image */}
                        <View style={[{ width: 82, height: 102, overflow: 'hidden', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                          <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        </View>
                        {/* details */}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <Text style={[T.micro, { color: C.dim, letterSpacing: 1, textTransform: 'uppercase', flex: 1 }]} numberOfLines={1}>{it.brand}</Text>
                            <Pressable onPress={() => removeFromCart(key)} hitSlop={10}>
                              <Feather name="x" size={14} color={C.dim} />
                            </Pressable>
                          </View>
                          <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={2}>{it.name}</Text>
                          {!!variantLabel(it) && (
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                              <View style={[{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                                <Text style={[T.micro, { color: C.ink }]} numberOfLines={1}>{variantLabel(it).toUpperCase()}</Text>
                              </View>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                            {/* qty stepper */}
                            <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
                              {/* At one, minus REMOVES the line — so it says so with a
                                  bin rather than a dead minus that looks broken. */}
                              <Pressable onPress={() => updateQty(key, it.qty - 1)} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: C.hairline }}>
                                <Feather name={it.qty > 1 ? 'minus' : 'trash-2'} size={13} color={C.ink} />
                              </Pressable>
                              <Text style={[T.bodyB, { paddingHorizontal: 14 }]}>{it.qty}</Text>
                              <Pressable onPress={() => updateQty(key, it.qty + 1)} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderColor: C.hairline }}>
                                <Feather name="plus" size={13} color={C.ink} />
                              </Pressable>
                            </View>
                            <Text style={[T.price]}>₹{lineTotal(it)}</Text>
                          </View>
                        </View>
                      </View>
                      {/* move-to chips */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingBottom: SP.s, gap: 6 }}>
                        <Feather name="corner-down-right" size={11} color={C.dim} />
                        <Text style={[T.micro, { color: C.dim }]}>Move to</Text>
                        {METHOD_ORDER.filter(x => x !== m).map(x => (
                          <Pressable key={x} onPress={() => updateMethod(key, x)} style={[{ paddingHorizontal: 9, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                            <Text style={[T.micro, { color: C.ink }]}>{METHOD_META[x].time}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    );
                  })}

                  {/* bucket footer — the quote's grand total for this bucket, i.e.
                      exactly what Review Order will ask for. */}
                  <View style={{ borderTopWidth: 1, borderColor: C.hairline, padding: SP.m, paddingBottom: SP.m + 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SP.m }}>
                      <Text style={[T.micro, { color: C.dim }]}>
                        {`TOTAL · ${items.length} ITEM${items.length > 1 ? 'S' : ''}${fee ? ` INCL. ₹${fee} DELIVERY` : ''}`}
                      </Text>
                      <Text style={[T.h2]}>{bucketTotal == null ? '—' : `₹${bucketTotal}`}</Text>
                    </View>
                    {/* Only where the server actually applied it. A bucket the code
                        did not reach must not advertise it. */}
                    {bucketOutcomes[m]?.state === 'applied' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: SP.s }}>
                        <Feather name="tag" size={11} color={C.green} />
                        <Text style={[T.micro, { color: C.green }]} numberOfLines={1}>
                          {`${submitted} applied to this delivery`}
                        </Text>
                      </View>
                    )}
                    <Slab small label={CHECKOUT_LABEL[m]} onPress={() => checkoutBucket(m)} />
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
            {/* APPLIED is a state, not a greyed-out button. It used to keep the
                input and swap the black Apply button for a #bdbdbd slab with
                WHITE text on it — unreadable, and it read as disabled rather
                than as "your code is on". Now the whole row becomes the receipt
                for the code, with the saving on it and one obvious way out. */}
            {isApplied ? (
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green }}>
                  <Feather name="check" size={16} color={C.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.bodyB]} numberOfLines={1}>{`${outcome.state === 'applied' ? outcome.code : ''} applied`}</Text>
                  <Text style={[T.micro, { color: C.green, marginTop: 1 }]}>
                    {appliedRupees > 0 ? `You save ₹${appliedRupees} on this order` : 'Discount applied to your total'}
                  </Text>
                </View>
                <Pressable onPress={clearCoupon} hitSlop={8} style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.caption, { color: C.ink }]}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[{ flexDirection: 'row', alignItems: 'stretch', height: 48, overflow: 'hidden' }, BORDER(1)]}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, backgroundColor: C.white }}>
                  <Feather name="tag" size={14} color={C.ink} />
                  <TextInput
                    value={coupon}
                    onChangeText={setCoupon}
                    placeholder="Enter code"
                    placeholderTextColor={C.dim}
                    autoCapitalize="characters"
                    style={[T.monoB, { flex: 1, marginLeft: 8, letterSpacing: 1, padding: 0 }]}
                  />
                  {coupon.length > 0 && (
                    <Pressable onPress={() => setCoupon('')} hitSlop={10}>
                      <Feather name="x" size={12} color={C.dim} />
                    </Pressable>
                  )}
                </View>
                <Pressable
                  onPress={apply}
                  disabled={!coupon.trim()}
                  style={{ paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: coupon.trim() ? C.ink : C.faint }}
                >
                  <Text style={[T.button, { fontSize: rf(14) }]}>Apply</Text>
                </Pressable>
              </View>
            )}
            {outcome.state === 'rejected' && (
              <Text style={[T.caption, { marginTop: 6, color: '#C1121F' }]}>{outcome.message}</Text>
            )}
            {/* Each bucket is priced, and checks out, as its own order — so a code
                that fits more than one is quoted into each of their totals. Almost
                every code is redeemable once, so say plainly that only the first
                order placed will keep it, rather than letting the shopper add up
                two discounts that will not both survive. */}
            {isApplied && appliedBuckets > 1 && (
              <Text style={[T.micro, { marginTop: 6, color: C.dim }]}>
                {`This code fits ${appliedBuckets} of your deliveries. Most codes can be used once, so it will be honoured on whichever you check out first.`}
              </Text>
            )}
          </View>

          {/* ── ORDER SUMMARY — receipt card with a ghost ₹. Every line is the
                 sum of the bucket quotes; there is no local arithmetic left to
                 disagree with the server. ── */}
          <View style={[{ marginHorizontal: SP.l, marginTop: SP.l, backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
            <Text style={{ position: 'absolute', right: -8, bottom: -24, fontFamily: 'Inter_900Black', fontSize: rf(110), color: 'rgba(0,0,0,0.03)' }}>₹</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
              <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '700', letterSpacing: 1.5 }]}>ORDER SUMMARY</Text>
              <Feather name="file-text" size={14} color={C.ink} />
            </View>
            <View style={{ padding: SP.m }}>
              {quotesReady ? (
                <>
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Subtotal</Text><Text style={[T.bodyB]}>₹{toRupees(subtotalPaise)}</Text></View>
                  {discountPaise > 0 && <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Discount</Text><Text style={[T.bodyB, { color: C.green }]}>−₹{toRupees(discountPaise)}</Text></View>}
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Delivery</Text><Text style={[T.bodyB]}>{deliveryPaise === 0 ? 'Free' : `₹${toRupees(deliveryPaise)}`}</Text></View>
                  {taxPaise > 0 && <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Tax · GST</Text><Text style={[T.bodyB]}>₹{toRupees(taxPaise)}</Text></View>}
                  <View style={{ height: 1, backgroundColor: C.hairline, marginVertical: 4 }} />
                  <View style={s.sumRow}>
                    <Text style={[T.h3, { textTransform: 'uppercase' }]}>Total</Text>
                    <View>
                      <View style={{ position: 'absolute', left: -4, right: -4, bottom: 2, height: 10, backgroundColor: YELLOW }} />
                      <Text style={[T.h1]}>₹{toRupees(grandTotalPaise)}</Text>
                    </View>
                  </View>
                </>
              ) : (
                /* No quote, no numbers. The old fallback did the arithmetic here
                   with the config's delivery table and no tax, so an offline bag
                   showed a total the checkout would never charge. */
                <View style={{ paddingVertical: SP.m, alignItems: 'center', gap: SP.s }}>
                  {quoteStatus === 'error' ? (
                    <>
                      <Feather name="alert-circle" size={18} color="#C1121F" />
                      <Text style={[T.caption, { color: '#C1121F', textAlign: 'center' }]}>{quoteErr}</Text>
                      <Pressable onPress={() => setQuoteNonce((n) => n + 1)} hitSlop={10}>
                        <Text style={[T.bodyB, { textDecorationLine: 'underline' }]}>Retry</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={[T.caption, { color: C.dim, textAlign: 'center' }]}>
                      {!allPriceable
                        ? "Some items in your bag can't be priced yet — remove them to check out."
                        : quoteStatus === 'loading' ? 'Getting the latest prices…' : 'Prices not confirmed yet.'}
                    </Text>
                  )}
                </View>
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
