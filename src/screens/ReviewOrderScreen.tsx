import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, LayoutAnimation, Platform, UIManager, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { MotiView } from 'moti';
import Animated, { useDerivedValue, useAnimatedStyle, withTiming, interpolateColor, Easing } from 'react-native-reanimated';
import { C, T, SP, BORDER, HEADER_TOP, rf } from '../theme/brutal';
import { BrutalStatusBar, CachedImage, BrutalButton, OptionSheet, useKeyboardHeight } from '../components/Brutal';
import { listRewards, type Reward } from '../services/spin';
import { DeliveryTermsSheet } from '../components/DeliveryTermsSheet';
import { useApp } from '../state/AppState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { updateMe } from '../services/auth';
import { getWallet } from '../services/wallet';
import { getLoyalty } from '../services/loyalty';
/**
 * Two tenders, because two is what checkout actually does: pay now through the gateway, or
 * pay on handover. `id` is the value the backend takes.
 *
 * The old list had four rows and three of them misrepresented the flow. "UPI" advertised a
 * specific VPA (`pay@okhdfcbank`) that belongs to nobody, and "Credit / Debit Card" showed
 * `•••• 4242` — a Stripe test number, as if a card were on file. Neither did what it said:
 * both post the same `upi` tender and land in the same Razorpay sheet, which offers UPI,
 * cards and netbanking itself. The Trendzo wallet was listed as a tender too, but the backend
 * requires a wallet-only order to be covered in full and rejects it otherwise — as a partial
 * amount alongside another tender it already has its own toggle above.
 */
const PAYMENTS = [
  { id: 'upi', icon: 'smartphone', label: 'Pay online', sub: 'UPI, card or netbanking' },
  { id: 'cod', icon: 'rupee', label: 'Cash on Delivery', sub: 'Pay when it arrives' },
] as const;

type PayId = (typeof PAYMENTS)[number]['id'];
// Wallet balance and reward points are fetched, never assumed. These were the
// literals ₹1,240 and 240 pts — shown to every customer as if they were theirs,
// and the reward toggle then discounted the DISPLAYED total by an amount the
// server had never agreed to.

// Delivery methods — mirrors the Bag's buckets so a per-bucket checkout shows the same
// labels. Try & Buy is a first-class method here, not an add-on toggle on express.
type BagMethod = 'express' | 'standard' | 'pickup';
/** What the backend prices and places. Try & Buy is its own method, not a flag on express. */
type DeliveryChoice = 'express' | 'standard' | 'pickup' | 'try_and_buy';
/**
 * Copy only — deliberately no `fee`.
 *
 * The fee for every method comes from the price quote (`stores[].deliveryOptions`), computed by
 * the same engine that places the order. This used to also carry a config-derived fee, which
 * meant two independent numbers for the same charge and a screen that could show one while
 * being billed the other.
 */
type DeliveryMeta = { label: string; sub: string; icon: string };

/** Same source as the Bag — see methodMetaFrom there. */
const deliveryMetaFrom = (cfg: AppConfig): Record<DeliveryChoice, DeliveryMeta> => {
  // Defensive: the hook merges over defaults, but a screen must not crash if
  // an older backend (or a bad cache entry) ever yields a partial config.
  const by = new Map((cfg.delivery?.methods ?? []).map((m) => [m.id, m]));
  const one = (id: DeliveryChoice, fallback: DeliveryMeta): DeliveryMeta => {
    const m = by.get(id);
    if (!m) return fallback;
    return { label: `${m.label} · ${m.etaLabel}`, sub: m.blurb, icon: m.icon };
  };
  return {
    express: one('express', { label: 'Express · 60 min', sub: 'From your nearest store', icon: 'zap' }),
    standard: one('standard', { label: 'Standard · 2-3 days', sub: 'Tracked shipping · door-to-door', icon: 'package' }),
    pickup: one('pickup', { label: 'Instore pickup', sub: 'Collect at your nearest store', icon: 'map-pin' }),
    // Not one of the Bag's buckets, so config may not describe it.
    try_and_buy: one('try_and_buy', {
      label: 'Try & Buy',
      sub: 'Try at home, keep what you love, pay-back for the rest',
      icon: 'home',
    }),
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
  const { cart, placeOrder, showToast, token, getToken, user, applyConsumer, requireAuth } = useApp();
  const rInsets = useSafeAreaInsets();
  const kbH = useKeyboardHeight();
  // Launched from a Bag bucket → only that bucket's items + its delivery
  // method. Launched from Buy Now (no param) → whole bag, express.
  const preMethod = route.params?.preMethod as BagMethod | undefined;
  /**
   * Chosen here, not inherited read-only from the Bag.
   *
   * The bucket the shopper came from is the starting point, but the method is theirs to change
   * on the summary — and changing it re-prices against the server, so the fee, tax and total on
   * screen always belong to the method that is selected.
   *
   * Note this does NOT change which items are in the order: `items` stays filtered by the
   * bucket that launched the screen.
   */
  const [method, setMethod] = useState<DeliveryChoice>(preMethod ?? 'express');
  // Charges/terms bottom sheet — opened from the ⓘ next to the bill's delivery
  // line and the note under the method cards.
  const [showTerms, setShowTerms] = useState(false);
  /**
   * Express, Try & Buy and store pickup. Standard is offered only when the shopper arrived on
   * it, so an existing standard bag is never silently switched to a different fee.
   */
  const methodChoices = useMemo<DeliveryChoice[]>(
    () => (preMethod === 'standard'
      ? ['standard', 'express', 'try_and_buy', 'pickup']
      : ['express', 'try_and_buy', 'pickup']),
    [preMethod],
  );
  // MUST be memoised. `items` is an effect dependency of the pricing call below;
  // computing it inline made a new array identity on every render, so priceCart →
  // setPricing → re-render → new `items` → priceCart looped a POST /pricing/cart
  // for as long as this screen was open.
  // Buy Now hands its ONE line in via params — the bag is not consulted and
  // not touched. Bucket checkouts filter the bag; plain checkout takes it all.
  const buyNow = route.params?.buyNow as any | undefined;
  const items = useMemo(
    () => (buyNow ? [buyNow] : preMethod ? cart.filter((it: any) => ((it.method || 'express') as BagMethod) === preMethod) : cart),
    [cart, preMethod, buyNow],
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
  // Myntra-style one-tap apply: every held coupon in a sheet with its own Apply,
  // instead of copy → navigate → paste. The manual input stays for typed codes.
  const [couponSheet, setCouponSheet] = useState(false);
  const [heldCoupons, setHeldCoupons] = useState<Reward[]>([]);
  const openCouponSheet = () => {
    setCouponSheet(true);
    if (!getToken()) return; // sheet shows the sign-in hint
    listRewards()
      .then((rs) => setHeldCoupons(rs.filter((r) => r.state === 'available' && !!r.code)))
      .catch(() => { /* keep whatever list is showing */ });
  };
  const [useReward, setUseReward] = useState(false);
  // Payment is picked INLINE on the page (was a bottom-sheet modal).
  const [payId, setPayId] = useState<PayId>('upi');
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  // Distinguishes "the quote hasn't come back yet" from "the server refused to price this".
  // Money is never invented locally, so both states have to be visible rather than papered
  // over with a guess — and Pay stays disabled until a real quote exists.
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingErr, setPricingErr] = useState<string | null>(null);
  const [quoteNonce, setQuoteNonce] = useState(0);
  // Name + email, collected here when the profile has neither and an order needs both.
  const [profileOpen, setProfileOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  /**
   * Whether the profile is complete, readable synchronously.
   *
   * The sheet saves the details and then resumes the placement in the same tick — before React
   * has committed the new consumer — so a `user?.profileComplete` read there would still be
   * false and would reopen the sheet it just closed, forever. Mirrored on every render and
   * written directly by the save. (Same reason AppState keeps a tokenRef for requireAuth.)
   */
  const profileCompleteRef = useRef(false);
  profileCompleteRef.current = !!user?.profileComplete;
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

  // The selection IS the server method now; nothing to derive.
  const apiMethod: DeliveryChoice = method;

  /**
   * Try & Buy is prepaid only — the shopper pays up front and is refunded for whatever they
   * send back at the door, so there is no "pay on arrival" amount to collect.
   *
   * This was enforced only at the Pay button, which meant COD sat there selectable, the price
   * quote went out with paymentMethod: 'cod', and the shopper was refused at the last step.
   * Take the tender out of reach and say why instead.
   */
  const codBlocked = apiMethod === 'try_and_buy';
  /**
   * The tender actually sent to the server. Derived rather than read straight from state
   * because state settles one render late: switching to Try & Buy with COD still selected
   * would otherwise fire a quote for a pair the backend rejects, flashing a pricing error
   * before the reset below lands. This keeps every request valid; the reset then makes the
   * UI agree with it.
   */
  const effectivePayId: PayId = codBlocked && payId === 'cod' ? 'upi' : payId;
  useEffect(() => {
    if (codBlocked && payId === 'cod') setPayId('upi');
  }, [codBlocked, payId]);

  // Server totals for the cart (guest-ok). There is no local fallback: every figure shown on
  // this screen — line prices, promo and coupon discounts, loyalty, delivery, GST, total — is
  // whatever this quote says, produced by the same engine that will place the order. The
  // chosen method + tender are passed so the shown total is the charged total.
  const allPriceable = items.length > 0 && items.every((it) => !!it.variantId);
  useEffect(() => {
    if (!allPriceable) { setPricing(null); setPricingErr(null); setPricingLoading(false); return; }
    let cancelled = false;
    setPricingLoading(true);
    setPricingErr(null);
    priceCart(
      items.map((it) => ({ variantId: it.variantId as string, qty: it.qty })),
      couponCode ?? undefined,
      {
        deliveryMethod: apiMethod,
        paymentMethod: effectivePayId,
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
      .catch((e: any) => {
        if (cancelled) return;
        setPricing(null);
        setCouponOutcome({ state: 'none' });
        // Surfaced verbatim: the server's reason is usually actionable ("out of stock",
        // "store closed", a rejected method/tender combination).
        setPricingErr(e?.message ?? "Couldn't price this order. Please try again.");
      })
      .finally(() => { if (!cancelled) setPricingLoading(false); });
    return () => { cancelled = true; };
  }, [items, allPriceable, apiMethod, effectivePayId, couponCode, useReward, rewardPoints, applyWallet, quoteNonce]);

  // Pickup: load the store's upcoming windows. A pickup cart is single-store by
  // backend rule, so the first bucket's store is the one to ask about.
  const pickupStoreId = apiMethod === 'pickup' ? pricing?.stores[0]?.storeId : undefined;
  useEffect(() => {
    if (apiMethod !== 'pickup' || !pickupStoreId) { setSlots([]); setSlotId(null); return; }
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
  }, [apiMethod, pickupStoreId]);

  const addr = addresses.find((a) => a.id === addrId) || null;

  const agg = pricing?.aggregate ?? null;
  const couponApplied = couponOutcome.state === 'applied';

  /**
   * The receipt, entirely from the quote.
   *
   * Every one of these used to have an `agg ? server : localMath` fallback, and the fallbacks
   * disagreed with the server in ways the shopper could see: a hardcoded ₹99 Try & Buy fee, a
   * local `Math.min` for loyalty the backend would have clamped differently, a config-derived
   * delivery fee, and zero tax. Worse, "Item total" added a locally-computed MRP saving on top
   * of `itemsSubtotalPaise` — which is already the GROSS line subtotal — so the first row of
   * the receipt did not agree with the last one.
   *
   * Now there is one source. No quote means no numbers, not invented ones.
   */
  const subtotal = agg ? toRupees(agg.itemsSubtotalPaise) : 0;
  /** Retailer + platform promo discount, i.e. the saving off MRP. Server-split. */
  const mrpSavings = agg ? toRupees(agg.mrpPromoPaise) : 0;
  const couponOff = agg ? toRupees(agg.couponPaise) : 0;
  const rewardOff = agg ? toRupees(agg.pointsRedeemedPaise) : 0;
  // Wallet is a tender, so it reduces what the gateway collects rather than the
  // order total. Shown as its own line for that reason.
  const walletApplied = agg ? toRupees(agg.walletAppliedPaise) : 0;
  const deliveryFee = agg ? toRupees(agg.deliveryFeePaise) : 0;
  const taxAmt = agg ? toRupees(agg.taxPaise) : 0;
  const total = agg ? toRupees(agg.grandTotalPaise) : 0;
  const totalSavings = agg ? toRupees(agg.discountPaise) : 0;
  /** grandTotal minus the wallet portion — what the gateway actually collects. */
  const amountDue = agg ? toRupees(agg.amountDuePaise) : 0;

  /**
   * Per-line prices from the quote, keyed by variant so a line can be matched regardless of
   * which store bucket it landed in. The cart's own `price` is a stale client-side copy; the
   * engine's `netLinePaise` is what the shopper is charged.
   */
  const lineByVariant = useMemo(() => {
    const m = new Map<string, { unitPricePaise: number; netLinePaise: number }>();
    for (const st of pricing?.stores ?? []) {
      for (const l of st.lines) m.set(l.variantId, { unitPricePaise: l.unitPricePaise, netLinePaise: l.netLinePaise });
    }
    return m;
  }, [pricing]);

  /**
   * What each delivery method would cost for this cart, straight from the quote —
   * `deliveryOptions` is per store, so a multi-store cart sums its buckets exactly the way
   * `deliveryFeePaise` aggregates. `null` while no quote exists, so the selector shows a
   * placeholder instead of a number nobody has agreed to.
   */
  const optionFee = (m: DeliveryChoice): number | null =>
    pricing ? toRupees(pricing.stores.reduce((s, st) => s + (st.deliveryOptions?.[m] ?? 0), 0)) : null;

  /** A quote must exist before anything can be paid. */
  const canPay = !!agg && allPriceable && items.length > 0;


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
    // Live token: requireAuth replays placeIt itself, and the replayed closure captured
    // `token` while signed out — reading it would bounce the shopper back to the sign-in
    // sheet at the moment they finally have a session.
    if (!getToken()) { requireAuth(() => placeIt()); return; }
    /**
     * The backend snapshots a buyer name and email onto every order, so it refuses to place one
     * for a profile that has neither — and a phone-OTP signup starts with neither.
     *
     * This used to surface as "Order failed — add your name and email to your profile" at the
     * very end, after the shopper had chosen a method, a tender and pressed Pay. `profileComplete`
     * was already on the session the whole time and simply never consulted. Ask for the two
     * fields here and carry on into the same placement, rather than sending them to a different
     * screen and losing the order.
     */
    if (!profileCompleteRef.current) { setProfileOpen(true); return; }
    // Pickup collects at the counter — no delivery address involved.
    if (apiMethod !== 'pickup' && !addr) {
      showToast('Add an address', 'Add a delivery address', 'map-pin');
      nav.navigate('SavedAddresses', { pickReturn: true });
      return;
    }
    if (!allPriceable || items.length === 0) { showToast('Cart issue', "Some items can't be checked out", 'x'); return; }
    // No quote, no payment. Placing against a total the server never produced is how a shopper
    // ends up charged something other than what they read.
    if (!agg) {
      showToast('Prices not confirmed', pricingErr ?? 'Fetching the latest prices — try again in a moment', 'x');
      return;
    }
    if (apiMethod === 'try_and_buy' && payId === 'cod') { showToast('Not allowed', "Try & Buy can't be Cash on Delivery", 'x'); return; }
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
        paymentMethod: effectivePayId,
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
      placeOrder({ method: apiMethod === 'try_and_buy' ? 'tryandbuy' : apiMethod, id: firstOrderId, total, items: count, keepCart: !!buyNow });
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
      <View style={{ paddingTop: HEADER_TOP, paddingHorizontal: SP.l, paddingBottom: SP.m, flexDirection: 'row', alignItems: 'center', gap: SP.m, backgroundColor: C.bg }}>
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
            {apiMethod === 'pickup' ? (
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
                    <Text style={[T.caption, { color: C.white, fontSize: rf(9) }]}>{addr?.label || 'Address'}</Text>
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

            {/* DELIVERY — selectable here. Each row's fee is the quote's own figure for that
                method, so switching shows the real difference rather than a guess, and
                re-prices tax and total with it. */}
            <Text style={[T.h3, { textTransform: 'uppercase', marginTop: SP.xl, marginBottom: 8 }]}>Delivery</Text>
            <View style={{ gap: SP.s }}>
              {methodChoices.map((m) => {
                const meta = DELIVERY_META[m];
                const sel = m === apiMethod;
                const fee = optionFee(m);
                return (
                  <Pressable
                    key={m}
                    onPress={() => { if (sel) return; animateNext(); setMethod(m); }}
                    style={[
                      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: sel ? C.ink : C.white },
                      BORDER(1),
                    ]}
                  >
                    <Feather name={meta.icon as any} size={16} color={sel ? C.white : C.ink} />
                    <View style={{ flex: 1 }}>
                      <Text style={[T.bodyB, { color: sel ? C.white : C.ink }]}>{meta.label}</Text>
                      <Text style={[T.micro, { color: sel ? C.white : C.dim, marginTop: 2 }]}>{meta.sub}</Text>
                    </View>
                    {/* No fee on the card (Zomato pattern) — the charge appears in Price
                        details below, with the full terms behind its ⓘ. Free stays a
                        selling point worth surfacing here. */}
                    {fee === 0 ? (
                      <Text style={[T.price, { color: sel ? C.white : C.ink }]}>Free</Text>
                    ) : (
                      <Feather name={sel ? 'check-circle' : 'circle'} size={16} color={sel ? C.white : C.dim} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            {apiMethod === 'try_and_buy' && (
              <Text style={[T.micro, { color: C.dim, marginTop: SP.s }]}>
                Try & Buy is prepaid — you're refunded for whatever you send back at the door.
              </Text>
            )}
            {/* Charges live in the bill, not on the cards — this line says so and
                opens the full terms for every method. */}
            <Pressable onPress={() => setShowTerms(true)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.s }}>
              <Feather name="info" size={12} color={C.dim} />
              <Text style={[T.micro, { color: C.dim, flex: 1 }]}>
                Delivery & Try-at-home charges are added in the bill below · <Text style={{ textDecorationLine: 'underline' }}>Terms & policies</Text>
              </Text>
            </Pressable>

            {/* ITEMS — read-only, no qty controls */}
            <Text style={[T.h3, { marginTop: SP.xl, marginBottom: 8, textTransform: 'uppercase' }]}>{`Your items · ${items.length}`}</Text>
            <View style={[{ backgroundColor: C.white }, BORDER(1)]}>
              {items.map((it, i) => (
                <View key={it.id + '-' + i} style={{ flexDirection: 'row', gap: SP.m, padding: SP.m, borderTopWidth: i > 0 ? 1 : 0, borderColor: C.hairline }}>
                  <View style={[{ width: 64, height: 80, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
                    <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.caption]} numberOfLines={1}>{it.brand}</Text>
                    <Text style={[T.productName, { marginTop: 1 }]} numberOfLines={1}>{it.name}</Text>
                    <Text style={[T.caption, { marginTop: 4 }]}>{`Size ${it.size}  ·  Qty ${it.qty}`}</Text>
                    {/* Line price from the quote when it has arrived. The cart's own `price` is
                        a client-side copy captured when the item was added and can be stale;
                        `netLinePaise` is what this line is actually charged. The struck-out MRP
                        stays a display-only figure from the catalogue — the engine returns no
                        per-line MRP — and is hidden unless it is a real, finite number. */}
                    {(() => {
                      const q = it.variantId ? lineByVariant.get(it.variantId) : undefined;
                      const linePaise = q?.netLinePaise;
                      const mrp = it.original;
                      const showMrp = Number.isFinite(mrp) && mrp > it.price;
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                          <Text style={[T.price]}>
                            {linePaise != null ? `₹${toRupees(linePaise)}` : pricingLoading ? '—' : `₹${it.price * it.qty}`}
                          </Text>
                          {showMrp && <Text style={[T.mrp]}>₹{mrp * it.qty}</Text>}
                        </View>
                      );
                    })()}
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
              {/* One-tap path — opens the held-coupons sheet. */}
              {!couponCode && (
                <Pressable onPress={openCouponSheet} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
                  <Feather name="tag" size={12} color={C.ink} />
                  <Text style={[T.caption, { color: C.ink, textDecorationLine: 'underline' }]}>View your coupons</Text>
                </Pressable>
              )}
            </View>

            {/* COUPON SHEET — every held code, one Apply per row (Myntra-style). */}
            <OptionSheet visible={couponSheet} title="Your coupons" onClose={() => setCouponSheet(false)}>
              <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: SP.l, gap: SP.s }}>
                {!token ? (
                  <Text style={[T.body, { color: C.dim, textAlign: 'center', paddingVertical: SP.l }]}>
                    Sign in to see the coupons you hold.
                  </Text>
                ) : heldCoupons.length === 0 ? (
                  <Text style={[T.body, { color: C.dim, textAlign: 'center', paddingVertical: SP.l }]}>
                    No coupons yet — win them in Spin & Win and Push & Win.
                  </Text>
                ) : (
                  heldCoupons.map((r) => (
                    <View key={r.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                      <Feather name="tag" size={16} color={C.ink} />
                      <View style={{ flex: 1 }}>
                        <Text style={[T.monoB, { letterSpacing: 1 }]}>{r.code}</Text>
                        <Text style={[T.micro, { color: C.dim, marginTop: 1 }]} numberOfLines={1}>{r.name}</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          animateNext();
                          setCouponInput(r.code);
                          setCouponCode(r.code); // repriced server-side, same as a typed code
                          setCouponSheet(false);
                        }}
                        style={[{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.ink }, BORDER(1)]}
                      >
                        <Text style={[T.caption, { color: C.white }]}>Apply</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>
            </OptionSheet>

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
            {walletPaise > 0 && (
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                <Feather name="package" size={16} color={C.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.bodyB]}>Use Trendzo Wallet</Text>
                  <Text style={[T.caption, { marginTop: 1 }]}>
                    {`₹${Math.round(walletPaise / 100).toLocaleString()} available · the rest goes on ${payId === 'cod' ? 'cash' : 'your online payment'}`}
                  </Text>
                </View>
                <Toggle on={applyWallet} onPress={() => { animateNext(); setApplyWallet((v) => !v); }} />
              </View>
            )}

            {/* PAYMENT — inline selectable rows (was a bottom-sheet modal) */}
            <Text style={[T.h3, { marginTop: SP.xl, marginBottom: 8, textTransform: 'uppercase' }]}>Payment method</Text>
            <View style={{ gap: SP.s }}>
              {PAYMENTS.map((p) => {
                // Shown but not selectable, with the reason in place of the usual subtitle.
                // Hiding the row would leave the shopper wondering where COD went.
                const blocked = p.id === 'cod' && codBlocked;
                const sel = p.id === payId && !blocked;
                // Pickup is collected at the counter, so "on delivery" would be wrong copy for
                // the same tender. Same value posted either way — only the wording changes.
                const label = p.id === 'cod' && apiMethod === 'pickup' ? 'Pay at the store' : p.label;
                const sub = blocked
                  ? 'Not available on Try & Buy — prepaid only'
                  : p.id === 'cod' && apiMethod === 'pickup'
                    ? 'Cash or card at the counter when you collect'
                    : p.sub;
                return (
                  <Pressable
                    key={p.id}
                    disabled={blocked}
                    onPress={() => { animateNext(); setPayId(p.id); }}
                    style={[
                      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SP.m, backgroundColor: sel ? C.ink : C.white },
                      BORDER(1),
                      blocked ? { opacity: 0.45 } : null,
                    ]}
                  >
                    {p.icon === 'rupee' ? <Text style={{ fontSize: rf(17), fontWeight: '700', color: sel ? C.white : C.ink }}>₹</Text> : <Feather name={p.icon as any} size={18} color={sel ? C.white : C.ink} />}
                    <View style={{ flex: 1 }}>
                      <Text style={[T.bodyB, { color: sel ? C.white : C.ink }]}>{label}</Text>
                      <Text style={[T.caption, { color: sel ? C.white : C.dim, marginTop: 2 }]}>{sub}</Text>
                    </View>
                    <Feather name={sel ? 'check-circle' : 'circle'} size={16} color={sel ? C.white : C.dim} />
                  </Pressable>
                );
              })}
            </View>

            {/* PRICE DETAILS */}
            <Text style={[T.h3, { marginTop: SP.xl, marginBottom: 8, textTransform: 'uppercase' }]}>Price details</Text>
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              {agg ? (
                <>
                  {/* `itemsSubtotalPaise` is the GROSS line subtotal; the promo/coupon/loyalty
                      rows below subtract from it, and the arithmetic on screen adds up to the
                      Total. It used to have the MRP saving added back onto it, which made the
                      first row disagree with the last. */}
                  <Row k="Item total" v={`₹${subtotal}`} />
                  {mrpSavings > 0 && <Row k="Discount on MRP" v={`− ₹${mrpSavings}`} neg />}
                  {couponOff > 0 && <Row k={`Coupon (${couponCode})`} v={`− ₹${couponOff}`} neg />}
                  {rewardOff > 0 && <Row k="MyTrendz Rewards" v={`− ₹${rewardOff}`} neg />}
                  {walletApplied > 0 && <Row k="Trendzo Wallet" v={`− ₹${walletApplied}`} neg />}
                  {/* Try & Buy is priced INTO deliveryFeePaise by the engine, so it is never a
                      separate line — listing it again would bill it twice on screen.
                      The ⓘ opens the full charges/terms sheet for every method. */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 }}>
                    <Pressable onPress={() => setShowTerms(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={[T.body, { color: C.dim }]}>
                        {apiMethod === 'try_and_buy' ? 'Delivery & Try at home' : 'Delivery'}
                      </Text>
                      <Feather name="info" size={13} color={C.dim} />
                    </Pressable>
                    <Text style={[T.bodyB]}>{deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}</Text>
                  </View>
                  {taxAmt > 0 && <Row k="Taxes · GST" v={`₹${taxAmt}`} />}
                  <View style={{ height: 1, backgroundColor: C.hairline, marginVertical: 4 }} />
                  <Row k="Total amount" v={`₹${total}`} bold />
                </>
              ) : pricingErr ? (
                <View style={{ alignItems: 'center', gap: SP.s }}>
                  <Feather name="alert-circle" size={18} color="#c1121f" />
                  <Text style={[T.caption, { color: '#c1121f', textAlign: 'center' }]}>{pricingErr}</Text>
                  <Pressable onPress={() => setQuoteNonce((n) => n + 1)} hitSlop={10}>
                    <Text style={[T.bodyB, { textDecorationLine: 'underline' }]}>Retry</Text>
                  </Pressable>
                </View>
              ) : !allPriceable ? (
                <Text style={[T.caption, { color: C.dim, textAlign: 'center' }]}>
                  {items.length === 0
                    ? 'Nothing to price yet.'
                    : "Some items can't be priced — remove them from your bag to continue."}
                </Text>
              ) : (
                <Text style={[T.caption, { color: C.dim, textAlign: 'center' }]}>
                  {pricingLoading ? 'Getting the latest prices…' : 'Prices not confirmed yet.'}
                </Text>
              )}
            </View>

            {/* SAVINGS BANNER */}
            {totalSavings > 0 && (
              <View style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                <Text style={[T.bodyB, { color: C.green }]}>{`You're saving ₹${totalSavings} on this order`}</Text>
              </View>
            )}
          </ScrollView>

          {/* STICKY PAY BAR — pays directly from the page (no modal step) */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: SP.m, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.hairline, paddingHorizontal: SP.l, paddingTop: SP.m, paddingBottom: Platform.OS === 'ios' ? 28 : rInsets.bottom + SP.m }}>
            <View>
              {/* What the CARD/UPI is actually charged. With wallet applied this
                  is less than the order total, and showing the total here would
                  overstate the charge on the button next to it. */}
              {/* No quote, no amount — a placeholder rather than ₹0, which reads as free. */}
              <Text style={[T.h2]}>{agg ? `₹${amountDue}` : '—'}</Text>
              {walletApplied > 0
                ? <Text style={[T.micro]}>{`₹${walletApplied} from wallet`}</Text>
                : totalSavings > 0 ? <Text style={[T.micro]}>saved ₹{totalSavings}</Text> : null}
            </View>
            <BrutalButton
              label={
                placing ? 'Placing…'
                  : !canPay ? (pricingLoading ? 'Pricing…' : 'Prices unavailable')
                  : payId === 'cod' ? (apiMethod === 'pickup' ? 'Place order · pay at store' : 'Place order · pay on delivery')
                  : 'Pay now'
              }
              iconRight="arrow-right"
              // Disabled until the server has priced this order, so Pay can never send a total
              // the shopper never saw agreed.
              disabled={placing || !canPay}
              onPress={placeIt}
              style={{ flex: 1 }}
            />
          </View>

          {/* NAME + EMAIL — asked for only when the order cannot be placed without them, and
              the placement continues straight afterwards so the shopper never loses their
              basket or their choices. */}
          <Modal transparent visible={profileOpen} animationType="slide" statusBarTranslucent onRequestClose={() => setProfileOpen(false)}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
              {/* Lifted by the measured keyboard height — the name/email inputs
                  sat hidden behind the keyboard (Modal windows never resize). */}
              <View style={[{ backgroundColor: C.white, padding: SP.l, paddingBottom: SP.xl + kbH }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[T.h3, { textTransform: 'uppercase' }]}>One last thing</Text>
                  <Pressable onPress={() => setProfileOpen(false)} hitSlop={12}>
                    <Feather name="x" size={18} color={C.ink} />
                  </Pressable>
                </View>
                <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>
                  Your order and invoice are made out to a name and an email. We'll save them to
                  your profile so this is the only time you're asked.
                </Text>
                <View style={{ marginTop: SP.m, gap: SP.s }}>
                  <TextInput
                    value={pName}
                    onChangeText={setPName}
                    placeholder="Full name"
                    placeholderTextColor={C.dim}
                    autoCapitalize="words"
                    style={[{ padding: SP.m, color: C.ink }, BORDER(1)]}
                  />
                  <TextInput
                    value={pEmail}
                    onChangeText={setPEmail}
                    placeholder="Email for the invoice"
                    placeholderTextColor={C.dim}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[{ padding: SP.m, color: C.ink }, BORDER(1)]}
                  />
                </View>
                {profileErr && (
                  <Text style={[T.micro, { color: '#c1121f', marginTop: 8 }]}>{profileErr}</Text>
                )}
                <BrutalButton
                  label={savingProfile ? 'Saving…' : 'Save & continue'}
                  iconRight="arrow-right"
                  disabled={savingProfile}
                  block
                  style={{ marginTop: SP.m }}
                  onPress={async () => {
                    if (savingProfile) return;
                    const name = pName.trim();
                    const email = pEmail.trim();
                    // Validated here as well as server-side: a 400 from the PATCH would read as
                    // "order failed" again, which is the exact dead end this replaces.
                    if (name.length < 2) { setProfileErr('Enter your full name'); return; }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setProfileErr('Enter a valid email'); return; }
                    setProfileErr(null);
                    setSavingProfile(true);
                    try {
                      const updated = await updateMe({ name, email });
                      await applyConsumer(updated);
                      // Written before resuming: see the note on profileCompleteRef.
                      profileCompleteRef.current = !!updated.profileComplete;
                      setProfileOpen(false);
                      // Straight back into the placement the shopper already asked for.
                      placeIt();
                    } catch (e: any) {
                      setProfileErr(e?.message ?? 'Could not save your details. Try again.');
                    } finally {
                      setSavingProfile(false);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        </>
      )}

      <DeliveryTermsSheet open={showTerms} onClose={() => setShowTerms(false)} />
    </View>
  );
}
