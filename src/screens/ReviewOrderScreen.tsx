import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { MotiView } from 'moti';
import Animated, { useDerivedValue, useAnimatedStyle, withTiming, interpolateColor, Easing } from 'react-native-reanimated';
import { C, T, SP, BORDER } from '../theme/brutal';
import { BrutalStatusBar, CachedImage, BrutalButton } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { priceCart, toRupees, type CartPricing } from '../services/pricing';
import {
  placeGroupOrder, newIdempotencyKey, listPickupSlots, verifyPayment, reportPaymentFailed,
  type PickupSlot,
} from '../services/orders';
import { openRazorpayCheckout } from '../services/razorpay-checkout';
import { readCouponOutcome, type CouponOutcome } from '../services/coupons';
import { listAddresses, formatAddress, type Address } from '../services/addresses';
import { useAppConfig } from '../hooks/useAppConfig';
import { pointsToRupees, type AppConfig } from '../services/appConfig';
import { getWallet } from '../services/wallet';
import { getLoyalty } from '../services/loyalty';
const PAYMENTS = [
  { id: 'upi', icon: 'smartphone', label: 'UPI', sub: 'pay@okhdfcbank' },
  { id: 'card', icon: 'credit-card', label: 'Credit / Debit Card', sub: '•••• 4242' },
  { id: 'cod', icon: 'dollar-sign', label: 'Cash on Delivery', sub: 'Pay when it arrives' },
  { id: 'wallet', icon: 'package', label: 'Trendzo Wallet', sub: '' }, // sub filled from the live balance
];
// Wallet balance and reward points are fetched, never assumed. These were the
// literals ₹1,240 and 240 pts — shown to every customer as if they were theirs,
// and the reward toggle then discounted the DISPLAYED total by an amount the
// server had never agreed to.

// Delivery methods — mirrors the Bag's buckets so a per-bucket checkout shows
// the same label/fee here. Try & Buy stays an express-only add-on.
type BagMethod = 'express' | 'standard' | 'pickup';
type DeliveryMeta = { label: string; sub: string; icon: string; fee: number };

/** Same source as the Bag — see methodMetaFrom there. Fallback only. */
const deliveryMetaFrom = (cfg: AppConfig): Record<BagMethod, DeliveryMeta> => {
  // Defensive: the hook merges over defaults, but a screen must not crash if
  // an older backend (or a bad cache entry) ever yields a partial config.
  const by = new Map((cfg.delivery?.methods ?? []).map((m) => [m.id, m]));
  const one = (id: BagMethod, fallback: DeliveryMeta): DeliveryMeta => {
    const m = by.get(id);
    if (!m) return fallback;
    return { label: `${m.label} · ${m.etaLabel}`, sub: m.blurb, icon: m.icon, fee: Math.round(m.feePaise / 100) };
  };
  return {
    express: one('express', { label: 'Express · 60 min', sub: 'From your nearest store', icon: 'zap', fee: 99 }),
    standard: one('standard', { label: 'Standard · 2-3 days', sub: 'Tracked shipping · door-to-door', icon: 'package', fee: 49 }),
    pickup: one('pickup', { label: 'Instore pickup', sub: 'Ready at your nearest store', icon: 'map-pin', fee: 0 }),
  };
};

const fmtSlotDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return 'TODAY';
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.toDateString() === tomorrow.toDateString()) return 'TOMORROW';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
};

const fmtSlotRange = (startIso: string, endIso: string) => {
  const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${t(startIso)}–${t(endIso)}`;
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
// Call right BEFORE a setState that changes layout (expand a box, apply a
// coupon, update the price rows) so the change eases in/out instead of jumping.
const animateNext = () =>
  LayoutAnimation.configureNext({
    duration: 240,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'easeInEaseOut' },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });

// Standard pill switch — green track = ON, grey track = OFF. The knob slides
// and the track colour crossfades smoothly (spring-y timing) on toggle.
function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const p = useDerivedValue(() => withTiming(on ? 1 : 0, { duration: 220, easing: Easing.inOut(Easing.cubic) }), [on]);
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], ['#CFCFCF', '#1D9E63']),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * 20 }], // 50 − padding*2 − knob(24) = 20
  }));
  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Animated.View style={[{ width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center', alignItems: 'flex-start' }, trackStyle]}>
        <Animated.View
          style={[{
            width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF',
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }, knobStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function ReviewOrderScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { cart, placeOrder, showToast, token, user, requireAuth } = useApp();
  // Launched from a Bag bucket → only that bucket's items + its delivery
  // method. Launched from Buy Now (no param) → whole bag, express.
  const preMethod = route.params?.preMethod as BagMethod | undefined;
  const delivery: BagMethod = preMethod ?? 'express';
  // MUST be memoised. `items` is an effect dependency of the pricing call below;
  // computing it inline made a new array identity on every render, so priceCart →
  // setPricing → re-render → new `items` → priceCart looped a POST /pricing/cart
  // for as long as this screen was open.
  const items = useMemo(
    () => (preMethod ? cart.filter((it: any) => ((it.method || 'express') as BagMethod) === preMethod) : cart),
    [cart, preMethod],
  );

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrId, setAddrId] = useState<string | null>(null);
  const [addrOpen, setAddrOpen] = useState(false);
  // A real code, typed by the customer and validated by the server. This was a
  // BOOLEAN that toggled a hardcoded 'TRENDZO50' worth ₹50 — and `placeIt` never
  // transmitted it, so the discount appeared on screen but not on the charge.
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponOutcome, setCouponOutcome] = useState<CouponOutcome>({ state: 'none' });
  const [useReward, setUseReward] = useState(false);
  const [tryBuy, setTryBuy] = useState(false);
  // Payment is picked INLINE on the page (was a bottom-sheet modal).
  const [payId, setPayId] = useState('upi');
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const [placing, setPlacing] = useState(false);
  // Pickup only: the store's upcoming windows, and the one the customer picked.
  // The backend rejects a multi-store pickup cart, so there is exactly one store.
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const cfg = useAppConfig();
  const DELIVERY_META = useMemo(() => deliveryMetaFrom(cfg), [cfg]);
  // Live balances. Both endpoints are consumer-scoped, so guests simply get 0.
  const [walletPaise, setWalletPaise] = useState(0);
  // Wallet as a PARTIAL tender alongside a card/UPI payment. Distinct from
  // paymentMethod==='wallet', which the backend requires to cover the order in
  // full and rejects outright otherwise.
  const [applyWallet, setApplyWallet] = useState(false);
  const [rewardPoints, setRewardPoints] = useState(0);
  useEffect(() => {
    if (!token) { setWalletPaise(0); setRewardPoints(0); return; }
    let cancelled = false;
    Promise.allSettled([getWallet({ limit: 1 }), getLoyalty({ limit: 1 })]).then(([w, l]) => {
      if (cancelled) return;
      if (w.status === 'fulfilled') setWalletPaise(w.value.balancePaise);
      if (l.status === 'fulfilled') setRewardPoints(l.value.balancePoints);
    });
    return () => { cancelled = true; };
  }, [token]);

  // Load saved addresses on EVERY focus (not just mount) — an address added on
  // the SavedAddresses screen appears here immediately on return. Preselect the
  // default when nothing valid is selected yet.
  useFocusEffect(React.useCallback(() => {
    listAddresses().then((list) => {
      setAddresses(list);
      setAddrId((cur) => (cur && list.some((a) => a.id === cur))
        ? cur
        : (list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null));
    }).catch(() => {});
  }, []));

  // An address tapped on the SavedAddresses screen ("Deliver here") arrives as
  // a route param — apply it and clear the param.
  useEffect(() => {
    const picked = route.params?.pickedAddressId;
    if (picked) {
      setAddrId(picked);
      setAddrOpen(false);
      nav.setParams({ pickedAddressId: undefined });
    }
  }, [route.params?.pickedAddressId]);

  // Server delivery method for this placement — Try & Buy rides on express.
  const apiMethod: 'express' | 'standard' | 'pickup' | 'try_and_buy' =
    tryBuy && delivery === 'express' ? 'try_and_buy' : delivery;

  // Real server totals for the cart (guest-ok); falls back to local math. The
  // chosen method + tender are passed so the shown total is the charged total.
  const allPriceable = items.length > 0 && items.every((it) => !!it.variantId);
  useEffect(() => {
    if (!allPriceable) { setPricing(null); return; }
    let cancelled = false;
    priceCart(
      items.map((it) => ({ variantId: it.variantId as string, qty: it.qty })),
      couponCode ?? undefined,
      {
        deliveryMethod: apiMethod,
        paymentMethod: payId as any,
        // Quote with the same points the placement will redeem. Without this the
        // quote and the charge disagree — the exact failure mode this section is
        // about. The server clamps to the real balance and to the order total.
        ...(useReward && rewardPoints > 0 ? { pointsToRedeem: rewardPoints } : {}),
        // Same for wallet: it is a partial TENDER, not a discount, so the quote
        // must know about it or the "amount due" line is wrong.
        ...(applyWallet ? { applyWallet: true } : {}),
      },
    )
      .then((p) => {
        if (cancelled) return;
        setPricing(p);
        setCouponOutcome(readCouponOutcome(couponCode, p.aggregate.couponPaise, p.rejectedCodes));
      })
      .catch(() => { if (!cancelled) { setPricing(null); setCouponOutcome({ state: 'none' }); } });
    return () => { cancelled = true; };
  }, [items, allPriceable, apiMethod, payId, couponCode, useReward, rewardPoints, applyWallet]);

  // Pickup: load the store's upcoming windows. A pickup cart is single-store by
  // backend rule, so the first bucket's store is the one to ask about.
  const pickupStoreId = delivery === 'pickup' ? pricing?.stores[0]?.storeId : undefined;
  useEffect(() => {
    if (delivery !== 'pickup' || !pickupStoreId) { setSlots([]); setSlotId(null); return; }
    let cancelled = false;
    setSlotsLoading(true);
    listPickupSlots(pickupStoreId)
      .then((res) => {
        if (cancelled) return;
        setSlots(res.slots);
        setSlotId((cur) => (cur && res.slots.some((s) => s.slotId === cur) ? cur : res.slots[0]?.slotId ?? null));
      })
      .catch(() => { if (!cancelled) { setSlots([]); setSlotId(null); } })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [delivery, pickupStoreId]);

  const addr = addresses.find((a) => a.id === addrId) || null;
  const pay = PAYMENTS.find((p) => p.id === payId)!;

  const agg = pricing?.aggregate;
  const mrpSavings = items.reduce((s, it) => s + Math.max(0, it.original - it.price) * it.qty, 0);
  // Items-based (NOT cartTotal) so a filtered bucket prices only its own lines.
  const subtotal = agg ? toRupees(agg.itemsSubtotalPaise) : items.reduce((s, it) => s + it.price * it.qty, 0);
  // Wallet is a tender, so it reduces what the gateway collects rather than the
  // order total. Shown as its own line for that reason.
  const walletApplied = agg ? toRupees(agg.walletAppliedPaise) : 0;
  const couponApplied = couponOutcome.state === 'applied';
  // Server-computed, not a local constant.
  const couponOff = agg ? toRupees(agg.couponPaise) : 0;
  // Server-decided. The old local Math.min could differ from what the backend
  // would allow, so the customer saw one saving and was charged another.
  const rewardOff = agg
    ? toRupees(agg.pointsRedeemedPaise)
    : (useReward ? Math.min(rewardPoints, Math.max(0, subtotal - couponOff)) : 0);
  const deliveryFee = agg ? toRupees(agg.deliveryFeePaise) : DELIVERY_META[delivery].fee;
  const taxAmt = agg ? toRupees(agg.taxPaise) : 0;
  const tryBuyFee = tryBuy ? 99 : 0;
  const total = agg ? toRupees(agg.grandTotalPaise) : Math.max(0, subtotal - couponOff - rewardOff + deliveryFee + tryBuyFee);
  const totalSavings = mrpSavings + (agg ? toRupees(agg.discountPaise) : couponOff + rewardOff);
  /** grandTotal minus the wallet portion — what the gateway actually collects. */
  const amountDue = agg ? toRupees(agg.amountDuePaise) : total;


  /**
   * Place the whole cart in ONE call. `/consumer/checkout/group` opens one order
   * group with a child order per store, all-or-nothing — the old per-store loop
   * could leave half a cart placed when the second store ran out of stock.
   *
   * Gateway tenders come back with a `payment` block instead of a settled order:
   * the Razorpay sheet opens, and the signed triplet is verified server-side. A
   * dismissed sheet MUST be reported or the attempt stays pending and blocks retry.
   */
  const placeIt = async () => {
    if (placing) return;
    if (!token) { requireAuth(() => placeIt()); return; }
    // Pickup collects at the counter — no delivery address involved.
    if (apiMethod !== 'pickup' && !addr) {
      showToast('Add an address', 'Add a delivery address', 'map-pin');
      nav.navigate('SavedAddresses', { pickReturn: true });
      return;
    }
    if (!allPriceable || items.length === 0) { showToast('Cart issue', "Some items can't be checked out", 'x'); return; }
    if (apiMethod === 'try_and_buy' && payId === 'cod') { showToast('Not allowed', "Try & Buy can't be Cash on Delivery", 'x'); return; }
    // Wallet-only must cover the whole order — the server throws "Insufficient
    // wallet balance" otherwise, and the app used to let the customer get all
    // the way to Pay before finding out.
    if (payId === 'wallet' && walletPaise < (agg?.grandTotalPaise ?? total * 100)) {
      showToast('Not enough balance', 'Pick another method, or use your wallet alongside it', 'x');
      return;
    }
    if (apiMethod === 'pickup' && (pricing?.stores.length ?? 0) > 1) {
      showToast('One store at a time', 'A pickup slot belongs to a single store — split the bag', 'x');
      return;
    }
    const slot = slots.find((s) => s.slotId === slotId) ?? null;
    if (apiMethod === 'pickup' && slots.length > 0 && !slot) {
      showToast('Pick a slot', 'Choose when you will collect', 'clock');
      return;
    }

    setPlacing(true);
    let gatewayOrderId: string | null = null;
    try {
      const res = await placeGroupOrder({
        items: items.map((it) => ({ variantId: it.variantId as string, qty: it.qty })),
        deliveryMethod: apiMethod,
        paymentMethod: payId as any,
        ...(apiMethod === 'pickup' ? {} : { addressId: addr!.id }),
        ...(slot ? { pickupSlotId: slot.slotId, pickupSlotStart: slot.startsAt, pickupSlotEnd: slot.endsAt } : {}),
        // THE fix for this screen: the code now reaches placement. Only sent when
        // the quote actually applied it, so we never ask the server to honour
        // something it already rejected. Placement re-validates independently —
        // if the coupon lapsed between quoting and paying, the order is priced
        // without it rather than at a total we invented.
        ...(couponApplied && couponCode ? { couponCode } : {}),
        // Redeem points only when the customer opted in AND has a balance.
        ...(useReward && rewardPoints > 0 ? { pointsToRedeem: rewardPoints } : {}),
        ...(applyWallet ? { applyWallet: true } : {}),
        idempotencyKey: newIdempotencyKey(),
      });

      const firstOrderId = res.orders[0]?.orderId ?? '';

      if (res.payment) {
        gatewayOrderId = res.payment.gatewayOrderId;
        const paid = await openRazorpayCheckout({
          payment: res.payment,
          ...(user?.name ? { name: user.name } : {}),
          ...(user?.email ? { email: user.email } : {}),
          ...(user?.phone ? { phone: user.phone } : {}),
        });
        await verifyPayment({
          razorpayOrderId: paid.razorpay_order_id,
          razorpayPaymentId: paid.razorpay_payment_id,
          razorpaySignature: paid.razorpay_signature,
        });
      }

      const count = items.reduce((s, it) => s + it.qty, 0);
      placeOrder({ method: tryBuy && delivery === 'express' ? 'tryandbuy' : delivery, id: firstOrderId, total, items: count });
      setTimeout(() => nav.navigate('OrderSuccess', { orderId: firstOrderId, method: apiMethod }), 200);
    } catch (e: any) {
      if (gatewayOrderId) {
        // The order exists but is unpaid — fail the attempt, then send the customer
        // to tracking where "Retry payment" lives, rather than dropping them here.
        await reportPaymentFailed(gatewayOrderId, e?.message || 'dismissed').catch(() => {});
        showToast('Payment not completed', 'Your order is saved — retry from tracking', 'credit-card');
        nav.navigate('OrderHistory');
      } else {
        showToast('Order failed', e?.message || 'Please try again', 'x');
      }
    } finally {
      setPlacing(false);
    }
  };

  const Row = ({ k, v, neg, bold }: { k: string; v: string; neg?: boolean; bold?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 }}>
      <Text style={bold ? [T.bodyB] : [T.body, { color: C.dim }]}>{k}</Text>
      <Text style={bold ? [T.price] : [T.bodyB]}>{v}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />

      {/* HEADER */}
      <View style={{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.m, flexDirection: 'row', alignItems: 'center', gap: SP.m, backgroundColor: C.bg }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={C.ink} />
        </Pressable>
        <Text style={[T.h1, { textTransform: 'uppercase' }]}>Review order</Text>
      </View>
      <View style={{ height: 1, backgroundColor: C.hairline }} />

      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}>
          <Feather name="shopping-bag" size={40} color={C.dim} />
          <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>Your bag is empty.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
            {/* COLLECTION POINT (pickup) — no delivery address is involved, so the
                address block is replaced by the store and its available windows. */}
            {delivery === 'pickup' ? (
              <>
                <Text style={[T.h3, { marginBottom: 8, textTransform: 'uppercase' }]}>Collect from</Text>
                <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.bodyB]}>{pricing?.stores[0]?.storeName || 'Your store'}</Text>
                  <Text style={[T.caption, { color: C.dim, marginTop: 4 }]}>
                    Pay now, collect at the counter with the code we give you.
                  </Text>
                </View>

                <Text style={[T.h3, { marginTop: SP.xl, marginBottom: 8, textTransform: 'uppercase' }]}>Pickup window</Text>
                {slotsLoading ? (
                  <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                    <Text style={[T.caption, { color: C.dim }]}>Loading windows…</Text>
                  </View>
                ) : slots.length === 0 ? (
                  <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                    <Text style={[T.caption, { color: C.dim }]}>
                      This store has not published pickup windows. We will tell you the moment your order is ready.
                    </Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s }}>
                    {slots.slice(0, 12).map((s) => {
                      const sel = s.slotId === slotId;
                      return (
                        <Pressable key={`${s.slotId}-${s.startsAt}`} onPress={() => { animateNext(); setSlotId(s.slotId); }} style={[{ paddingHorizontal: SP.m, paddingVertical: SP.s, backgroundColor: sel ? C.ink : C.white }, BORDER(1)]}>
                          <Text style={[T.caption, { color: sel ? C.white : C.dim }]}>{fmtSlotDay(s.startsAt)}</Text>
                          <Text style={[T.bodyB, { color: sel ? C.white : C.ink, marginTop: 2 }]}>{fmtSlotRange(s.startsAt, s.endsAt)}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            ) : (
              <>
            {/* DELIVERY ADDRESS */}
            <Text style={[T.h3, { marginBottom: 8, textTransform: 'uppercase' }]}>Deliver to</Text>
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: C.ink }}>
                    <Text style={[T.caption, { color: C.white, fontSize: 9 }]}>{addr?.label || 'Address'}</Text>
                  </View>
                  <Text style={[T.bodyB]}>{user?.name || 'You'}</Text>
                </View>
                <Pressable onPress={() => { animateNext(); setAddrOpen((v) => !v); }} hitSlop={8}>
                  <Text style={[T.caption, { color: C.ink }]}>{addrOpen ? 'Close' : 'Change'}</Text>
                </Pressable>
              </View>
              <Text style={[T.body, { color: C.inkSoft, marginTop: 6 }]}>{addr ? formatAddress(addr) : 'No delivery address — tap Change to add one'}</Text>
              {!!user?.phone && <Text style={[T.caption, { marginTop: 4 }]}>{user.phone}</Text>}
            </View>
            {/* Inline address picker */}
            {addrOpen && (
              <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }} style={{ marginTop: SP.s, gap: SP.s }}>
                {addresses.map((a) => {
                  const sel = a.id === addrId;
                  return (
                    <Pressable key={a.id} onPress={() => { animateNext(); setAddrId(a.id); setAddrOpen(false); }} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: sel ? C.ink : C.white }, BORDER(1)]}>
                      <Feather name={sel ? 'check-circle' : 'circle'} size={16} color={sel ? C.white : C.dim} />
                      <View style={{ flex: 1 }}>
                        <Text style={[T.bodyB, { color: sel ? C.white : C.ink }]}>{a.label || 'Address'}</Text>
                        <Text style={[T.caption, { color: sel ? C.white : C.dim, marginTop: 2 }]} numberOfLines={1}>{formatAddress(a)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => { setAddrOpen(false); nav.navigate('SavedAddresses', { pickReturn: true }); }} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                  <Feather name="plus" size={16} color={C.ink} />
                  <Text style={[T.bodyB]}>{addresses.length ? 'Add another address' : 'Add a delivery address'}</Text>
                </Pressable>
              </MotiView>
            )}
              </>
            )}

            {/* DELIVERY — the bucket's method (from the Bag), shown inline.
                Try & Buy stays an express-only add-on. */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SP.xl, marginBottom: 8 }}>
              <Text style={[T.h3, { textTransform: 'uppercase' }]}>Delivery</Text>
              {preMethod && (
                <Pressable onPress={() => nav.goBack()} hitSlop={8}>
                  <Text style={[T.caption, { color: C.ink, textDecorationLine: 'underline' }]}>Change in bag</Text>
                </Pressable>
              )}
            </View>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }}>
                <Feather name={DELIVERY_META[delivery].icon as any} size={16} color={C.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyB]}>{DELIVERY_META[delivery].label}</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{DELIVERY_META[delivery].sub}</Text>
              </View>
              <Text style={[T.price]}>{DELIVERY_META[delivery].fee === 0 ? 'Free' : `₹${DELIVERY_META[delivery].fee}`}</Text>
            </View>
            {delivery === 'express' && (
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.s, backgroundColor: C.white }, BORDER(1)]}>
                <Feather name="home" size={16} color={C.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.bodyB]}>Try & Buy</Text>
                  <Text style={[T.caption, { marginTop: 1 }]}>Try at home first · keep what you love · +₹99</Text>
                </View>
                <Toggle on={tryBuy} onPress={() => { animateNext(); setTryBuy((v) => !v); }} />
              </View>
            )}

            {/* ITEMS — read-only, no qty controls */}
            <Text style={[T.h3, { marginTop: SP.xl, marginBottom: 8, textTransform: 'uppercase' }]}>{`Your items · ${items.length}`}</Text>
            <View style={[{ backgroundColor: C.white }, BORDER(1)]}>
              {items.map((it, i) => (
                <View key={it.id + '-' + i} style={{ flexDirection: 'row', gap: SP.m, padding: SP.m, borderTopWidth: i > 0 ? 1 : 0, borderColor: C.hairline }}>
                  <View style={[{ width: 64, height: 80, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
                    <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.caption]} numberOfLines={1}>{it.brand}</Text>
                    <Text style={[T.productName, { marginTop: 1 }]} numberOfLines={1}>{it.name}</Text>
                    <Text style={[T.caption, { marginTop: 4 }]}>{`Size ${it.size}  ·  Qty ${it.qty}`}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                      <Text style={[T.price]}>₹{it.price * it.qty}</Text>
                      {it.original > it.price && <Text style={[T.mrp]}>₹{it.original * it.qty}</Text>}
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* COUPON — a real code, validated server-side when the cart re-prices */}
            <View style={[{ padding: SP.m, marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Feather name="tag" size={16} color={C.ink} />
                {couponApplied ? (
                  <>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.bodyB]}>{`${couponCode} applied`}</Text>
                      {/* A code that discounts shipping rather than the items saves a
                          real amount but contributes ₹0 to the coupon line — say
                          "applied" and let the totals speak, never "You saved ₹0". */}
                      <Text style={[T.caption, { marginTop: 1, color: C.green }]}>
                        {couponOff > 0 ? `You saved ₹${couponOff}` : 'Discount applied to your total'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => { animateNext(); setCouponCode(null); setCouponInput(''); setCouponOutcome({ state: 'none' }); }}
                      style={[{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.ink }, BORDER(1)]}
                    >
                      <Text style={[T.caption, { color: C.white }]}>Remove</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <TextInput
                      value={couponInput}
                      onChangeText={setCouponInput}
                      placeholder="Enter coupon code"
                      placeholderTextColor={C.dim}
                      autoCapitalize="characters"
                      style={[T.bodyB, { flex: 1, padding: 0, letterSpacing: 1 }]}
                    />
                    <Pressable
                      onPress={() => {
                        const code = couponInput.trim().toUpperCase();
                        if (!code) return;
                        animateNext();
                        setCouponCode(code);
                      }}
                      style={[{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.white }, BORDER(1)]}
                    >
                      <Text style={[T.caption, { color: C.ink }]}>Apply</Text>
                    </Pressable>
                  </>
                )}
              </View>
              {couponOutcome.state === 'rejected' && (
                <Text style={[T.caption, { marginTop: 6, color: '#C1121F' }]}>{couponOutcome.message}</Text>
              )}
            </View>

            {/* MYTRENDZ REWARDS */}
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Feather name="award" size={16} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyB]}>MyTrendz Rewards</Text>
                {/* The rupee value comes from the server's pointValuePaise. Saying
                    "240 pts saves ₹240" assumed a 1:1 rate the app had no way to know. */}
                <Text style={[T.caption, { marginTop: 1 }]}>
                  {rewardPoints < cfg.loyalty.minRedeemablePoints
                    ? `Earn ${cfg.loyalty.minRedeemablePoints} pts to start redeeming`
                    : `Use ${rewardPoints} pts · saves ₹${pointsToRupees(rewardPoints, cfg)}`}
                </Text>
              </View>
              <Toggle
                on={useReward}
                onPress={() => { if (rewardPoints >= cfg.loyalty.minRedeemablePoints) { animateNext(); setUseReward((v) => !v); } }}
              />
            </View>

            {/* WALLET — a partial tender on top of the chosen method. Hidden when
                the balance is zero, and irrelevant when paying by wallet alone. */}
            {walletPaise > 0 && payId !== 'wallet' && (
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                <Feather name="package" size={16} color={C.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.bodyB]}>Use Trendzo Wallet</Text>
                  <Text style={[T.caption, { marginTop: 1 }]}>
                    {`₹${Math.round(walletPaise / 100).toLocaleString()} available · the rest goes on ${pay.label.split(' ')[0]}`}
                  </Text>
                </View>
                <Toggle on={applyWallet} onPress={() => { animateNext(); setApplyWallet((v) => !v); }} />
              </View>
            )}

            {/* PAYMENT — inline selectable rows (was a bottom-sheet modal) */}
            <Text style={[T.h3, { marginTop: SP.xl, marginBottom: 8, textTransform: 'uppercase' }]}>Payment method</Text>
            <View style={{ gap: SP.s }}>
              {PAYMENTS.map((p) => {
                const sel = p.id === payId;
                return (
                  <Pressable key={p.id} onPress={() => { animateNext(); setPayId(p.id); }} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: SP.m, backgroundColor: sel ? C.ink : C.white }, BORDER(1)]}>
                    <Feather name={p.icon as any} size={18} color={sel ? C.white : C.ink} />
                    <View style={{ flex: 1 }}>
                      <Text style={[T.bodyB, { color: sel ? C.white : C.ink }]}>{p.label}</Text>
                      <Text style={[T.caption, { color: sel ? C.white : C.dim, marginTop: 2 }]}>
                        {p.id === 'wallet' ? `₹${Math.round(walletPaise / 100).toLocaleString()} balance` : p.sub}
                      </Text>
                    </View>
                    <Feather name={sel ? 'check-circle' : 'circle'} size={16} color={sel ? C.white : C.dim} />
                  </Pressable>
                );
              })}
            </View>

            {/* PRICE DETAILS */}
            <Text style={[T.h3, { marginTop: SP.xl, marginBottom: 8, textTransform: 'uppercase' }]}>Price details</Text>
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Row k="Item total" v={`₹${subtotal + mrpSavings}`} />
              {mrpSavings > 0 && <Row k="Discount on MRP" v={`− ₹${mrpSavings}`} neg />}
              {couponOff > 0 && <Row k={`Coupon (${couponCode})`} v={`− ₹${couponOff}`} neg />}
              {rewardOff > 0 && <Row k="MyTrendz Rewards" v={`− ₹${rewardOff}`} neg />}
              {walletApplied > 0 && <Row k="Trendzo Wallet" v={`− ₹${walletApplied}`} neg />}
              <Row k={deliveryFee === 0 ? 'Delivery' : 'Delivery'} v={deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`} />
              {taxAmt > 0 && <Row k="Taxes · GST" v={`₹${taxAmt}`} />}
              {/* Only in the offline fallback — the server quote already prices Try & Buy
                  INTO deliveryFeePaise, so showing it again would bill it twice on screen. */}
              {!agg && tryBuyFee > 0 && <Row k="Try & Buy" v={`₹${tryBuyFee}`} />}
              <View style={{ height: 1, backgroundColor: C.hairline, marginVertical: 4 }} />
              <Row k="Total amount" v={`₹${total}`} bold />
            </View>

            {/* SAVINGS BANNER */}
            {totalSavings > 0 && (
              <View style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                <Text style={[T.bodyB, { color: C.green }]}>{`You're saving ₹${totalSavings} on this order`}</Text>
              </View>
            )}
          </ScrollView>

          {/* STICKY PAY BAR — pays directly from the page (no modal step) */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: SP.m, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.hairline, paddingHorizontal: SP.l, paddingTop: SP.m, paddingBottom: 28 }}>
            <View>
              {/* What the CARD/UPI is actually charged. With wallet applied this
                  is less than the order total, and showing the total here would
                  overstate the charge on the button next to it. */}
              <Text style={[T.h2]}>₹{amountDue}</Text>
              {walletApplied > 0
                ? <Text style={[T.micro]}>{`₹${walletApplied} from wallet`}</Text>
                : totalSavings > 0 ? <Text style={[T.micro]}>saved ₹{totalSavings}</Text> : null}
            </View>
            <BrutalButton
              label={placing ? 'Placing…' : pay.id === 'cod' ? 'Place order' : `Pay via ${pay.label.split(' ')[0]}`}
              iconRight="arrow-right"
              disabled={placing}
              onPress={placeIt}
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </View>
  );
}
