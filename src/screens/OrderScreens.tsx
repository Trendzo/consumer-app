import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Linking, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf, HELV} from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalStatusBar, FadeInUp, CachedImage } from '../components/Brutal';
import { useApp } from '../state/AppState';
import {
  listOrders, getOrder, cancelOrder, retryPayment, verifyPayment, reportPaymentFailed,
  type OrderListRow, type OrderDetail,
} from '../services/orders';
import { openRazorpayCheckout } from '../services/razorpay-checkout';
import { listReturns, type ReturnRow } from '../services/returns';
import {
  activeStep, bucketOf, canCancel, canOpenReturn, canRetryPayment, exceptionFor,
  handoverProof, isLive, METHOD_LABEL, returnDaysLeftFor, statusLabel, stepsFor, toApiMethod,
  type Method,
} from '../services/orderLifecycle';

const rupees = (paise?: number | null) => Math.round((paise ?? 0) / 100);

// ─── ORDER SUCCESS ──────────────────────────────────────────
export function OrderSuccessScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { lastOrder } = useApp();
  // The placement screen passes the real order id; lastOrder is the fallback for
  // the legacy (mock) path so the screen still renders something sane.
  const orderId: string | undefined = route.params?.orderId ?? lastOrder?.id;
  const method = toApiMethod(route.params?.method ?? lastOrder?.method);

  const headline =
    method === 'pickup' ? 'Order confirmed.' :
    method === 'try_and_buy' ? 'Trial booked.' :
    'Order placed.';

  const caption =
    method === 'pickup' ? 'We will tell you the moment it is ready to collect.' :
    method === 'try_and_buy' ? 'Try everything at the door — the rider waits.' :
    method === 'standard' ? 'Tracked shipping, door to door.' :
    'Your store is packing it now.';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
      <BrutalStatusBar />
      <MotiView from={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 160 }}>
        <Feather name="check-circle" size={56} color={C.ink} />
      </MotiView>

      <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 250 }}>
        <Text style={[T.h1, { marginTop: 18, textAlign: 'center', textTransform: 'uppercase' }]}>{headline}</Text>
      </MotiView>

      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 450 }} style={{ marginTop: 24, alignItems: 'center' }}>
        {!!orderId && (
          <Text style={[T.caption, { color: C.ink }]}>
            {'Order '}
            <Text style={[T.monoB]}>{`#${orderId.slice(-8).toUpperCase()}`}</Text>
          </Text>
        )}
        <Text style={[T.body, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>{caption}</Text>
      </MotiView>

      <View style={{ marginTop: 36, gap: 10, width: '100%' }}>
        <BrutalButton
          label={method === 'pickup' ? 'View pickup details' : 'Track order'}
          iconRight="arrow-right"
          onPress={() => nav.replace('OrderTracking', orderId ? { orderId } : undefined)}
          block
        />
        <BrutalButton label="Continue shopping" variant="outline" onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} block />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// ORDER TRACKING — one screen, four order types, real state
// ═══════════════════════════════════════════════════════════

/** Live orders are re-fetched on this cadence while the screen has focus. */
const POLL_MS = 20000;

export function OrderTrackingScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { lastOrder, showToast, showConfirm, user } = useApp();
  const orderId: string | undefined = route.params?.orderId ?? lastOrder?.id;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!orderId) { setLoading(false); setErr('missing'); return; }
    try {
      const o = await getOrder(orderId);
      if (mounted.current) { setOrder(o); setErr(null); }
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'Could not load this order');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [orderId]);

  // Fetch on focus, then poll only while the order is still moving. A delivered or
  // cancelled order never changes again, so polling it is pure battery burn.
  useFocusEffect(useCallback(() => {
    mounted.current = true;
    load();
    const t = setInterval(() => {
      setOrder((cur) => { if (!cur || isLive(cur.status)) load(); return cur; });
    }, POLL_MS);
    return () => { mounted.current = false; clearInterval(t); };
  }, [load]));

  const method: Method = toApiMethod(order?.deliveryMethod ?? lastOrder?.method);
  const status = order?.status ?? '';
  const steps = useMemo(() => stepsFor(method), [method]);
  const active = activeStep(steps, status);
  // Refund copy is gated on the server's authoritative "was the shopper charged"
  // (amountPaidPaise) plus whether a refund row exists — never on status alone.
  const amountPaidPaise = order?.amountPaidPaise ?? 0;
  const hasRefund = (order?.refunds?.length ?? 0) > 0;
  const exception = exceptionFor(status, method, { amountPaidPaise, hasRefund });
  const proof = order ? handoverProof(order, method) : null;

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  /* ── Actions ─────────────────────────────────────────────── */

  const doCancel = () => {
    if (!order) return;
    // "Nothing to refund" when COD OR when no money was ever captured (a prepaid
    // order still awaiting/with a failed payment). Only promise a refund when the
    // shopper has actually paid.
    const wasCharged = (order.amountPaidPaise ?? 0) > 0;
    showConfirm({
      title: 'Cancel this order?',
      msg: !wasCharged
        ? 'Nothing was charged, so there is nothing to refund.'
        : 'Anything already charged is refunded — your order page shows where it goes.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep it',
      danger: true,
      icon: 'x-circle',
      onConfirm: async () => {
        setBusy(true);
        try {
          await cancelOrder(order.id);
          // Don't claim a refund is starting when nothing was captured.
          showToast(
            'Order cancelled',
            wasCharged ? 'Your refund has started' : 'Nothing was charged',
            'check',
          );
          await load();
        } catch (e: any) {
          showToast('Could not cancel', e?.message || 'The store may have already packed it', 'x');
          await load();
        } finally { setBusy(false); }
      },
    });
  };

  const doRetryPayment = async () => {
    if (!order) return;
    setBusy(true);
    // Held outside the try so a dismissed/failed sheet can still be reported —
    // otherwise the attempt stays 'pending' server-side and blocks the next retry.
    let gatewayOrderId: string | null = null;
    try {
      const { payment } = await retryPayment(order.id);
      gatewayOrderId = payment.gatewayOrderId;
      const res = await openRazorpayCheckout({
        payment,
        ...(user?.name ? { name: user.name } : {}),
        ...(user?.email ? { email: user.email } : {}),
        ...(user?.phone ? { phone: user.phone } : {}),
      });
      await verifyPayment({
        razorpayOrderId: res.razorpay_order_id,
        razorpayPaymentId: res.razorpay_payment_id,
        razorpaySignature: res.razorpay_signature,
      });
      showToast('Payment received', 'Your order is on its way', 'check');
    } catch (e: any) {
      if (gatewayOrderId) await reportPaymentFailed(gatewayOrderId, e?.message || 'dismissed').catch(() => {});
      showToast('Payment not completed', e?.message || 'Try again', 'x');
    } finally {
      setBusy(false);
      await load();
    }
  };

  const openMaps = () => {
    if (!order) return;
    const q = order.storeLat != null && order.storeLng != null
      ? `${order.storeLat},${order.storeLng}`
      : encodeURIComponent(order.storeAddressSnap || order.storeNameSnap || '');
    if (!q) { showToast('No location', 'This store has no address on file', 'map-pin'); return; }
    const url = Platform.select({
      ios: `maps://?daddr=${q}`,
      default: `geo:0,0?q=${q}`,
    })!;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`).catch(() => {}),
    );
  };

  const callStore = () => {
    if (!order?.storePhone) return;
    Linking.openURL(`tel:${order.storePhone}`).catch(() => {});
  };

  /* ── Render ──────────────────────────────────────────────── */

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <BrutalStatusBar />
        <ScreenHeader title="Order" onBack={() => nav.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.ink} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <BrutalStatusBar />
        <ScreenHeader title="Order" onBack={() => nav.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}>
          <Feather name="alert-circle" size={26} color={C.dim} />
          <Text style={[T.h3, { marginTop: 12, textAlign: 'center' }]}>
            {err === 'missing' ? 'No order selected' : 'Could not load this order'}
          </Text>
          <Text style={[T.caption, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>
            {err === 'missing' ? 'Open it from your order history.' : err}
          </Text>
          <BrutalButton label="View orders" variant="outline" onPress={() => nav.replace('OrderHistory')} style={{ marginTop: SP.l }} />
        </View>
      </View>
    );
  }

  const showCancel = canCancel(status);
  const showRetry = canRetryPayment(status, order.paymentMethod);
  const showReturn = canOpenReturn(order);
  const daysLeft = returnDaysLeftFor(order);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />
      <ScreenHeader title={method === 'pickup' ? 'Pickup' : 'Order tracking'} onBack={() => nav.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: SP.l, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {/* ═══ HEADER CARD ═══ */}
        <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
          <Text style={[T.monoB, { fontSize: 10, color: C.dim }]}>
            {`ORDER #${order.id.slice(-8).toUpperCase()} · ${METHOD_LABEL[method].toUpperCase()}`}
          </Text>
          <Text style={[T.h1, { marginTop: 6, textTransform: 'uppercase' }]}>{statusLabel(status)}</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>{order.storeNameSnap || 'Your store'}</Text>
          {!!order.storeAddressSnap && method === 'pickup' && (
            <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{order.storeAddressSnap}</Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.m }}>
            <HeaderStat label="Items" value={String((order.items ?? []).reduce((s, it) => s + it.qty, 0))} />
            <HeaderStat label="Total" value={`₹${rupees(order.grandTotalPaise).toLocaleString()}`} />
            <HeaderStat label="Paid by" value={order.paymentMethodLabel || (order.paymentMethod || '').toUpperCase()} />
          </View>
          {method === 'pickup' && !!order.pickupSlotStart && (
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.ink }}>
                <Text style={[T.caption, { color: C.white }]}>{`Slot · ${fmtSlot(order.pickupSlotStart, order.pickupSlotEnd)}`}</Text>
              </View>
            </View>
          )}
          {method === 'try_and_buy' && !!order.doorWindowExpiresAt && status === 'at_door' && (
            <View style={[{ marginTop: 12, padding: SP.s, backgroundColor: '#FFF8E1' }, BORDER(1)]}>
              <Text style={[T.caption, { color: C.ink }]}>
                {`Trial window closes at ${fmtTime(order.doorWindowExpiresAt)}`}
              </Text>
            </View>
          )}
        </View>

        {/* ═══ EXCEPTION BANNER ═══ */}
        {exception && (
          <View style={[{ marginTop: SP.m, padding: SP.m, backgroundColor: exception.tone === 'bad' ? '#FDECEC' : '#FFF8E1' }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name={exception.icon as any} size={16} color={exception.tone === 'bad' ? '#C1121F' : '#B0740A'} />
              <Text style={[T.bodyB, { color: exception.tone === 'bad' ? '#C1121F' : '#B0740A' }]}>{exception.title}</Text>
            </View>
            <Text style={[T.caption, { color: C.ink, marginTop: 4 }]}>{exception.body}</Text>
          </View>
        )}

        {/* ═══ REFUNDS — including cancellation refunds ═══ */}
        <RefundBlock refunds={order.refunds ?? []} />

        {/* ═══ HANDOVER PROOF — OTP (door) or pickup code (counter) ═══ */}
        {proof && (
          <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: C.white, alignItems: 'center' }, BORDER(1)]}>
            <Text style={[T.caption]}>{proof.title}</Text>
            {proof.kind === 'pickup' && (
              <View style={[{ marginTop: SP.m, width: 180, height: 180, backgroundColor: C.white, padding: 8 }, BORDER(2)]}>
                <PseudoQR seed={proof.code} />
              </View>
            )}
            <Text style={[T.monoB, { fontSize: rf(28), letterSpacing: 6, marginTop: 12 }]}>{proof.code}</Text>
            <Text style={[T.micro, { marginTop: 6, textAlign: 'center', color: C.dim }]}>{proof.hint}</Text>
          </View>
        )}

        {/* ═══ TIMELINE ═══ */}
        {status !== 'cancelled' && (
          <View style={{ marginTop: SP.xl }}>
            <Text style={[T.label]}>{'Timeline'}</Text>
            <View style={{ marginTop: SP.m }}>
              {steps.map((step, i) => {
                const done = i <= active;
                const current = i === active;
                return (
                  <FadeInUp key={step.label} delay={i * 60}>
                    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                      <View style={{ alignItems: 'center', width: 36 }}>
                        <View style={[{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? C.ink : C.white }, BORDER(1)]}>
                          <Feather name={step.icon as any} size={13} color={done ? C.white : C.ink} />
                        </View>
                        {i < steps.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: done ? C.ink : C.hairline, marginTop: 2 }} />}
                      </View>
                      <View style={{ flex: 1, paddingLeft: 12, paddingBottom: 18 }}>
                        <Text style={[T.caption, { color: done ? C.ink : C.dim }]}>{step.label}</Text>
                        <Text style={[T.micro, { color: current ? C.ink : C.dim, marginTop: 2 }]}>
                          {current ? step.hint : stampFor(order, step.at)}
                        </Text>
                      </View>
                    </View>
                  </FadeInUp>
                );
              })}
            </View>
          </View>
        )}

        {/* ═══ ITEMS — with per-item outcome once the door visit has happened ═══ */}
        {!!order.items?.length && (
          <View style={{ marginTop: SP.l }}>
            <Text style={[T.label]}>{`Items · ${order.items.length}`}</Text>
            <View style={[{ marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              {order.items.map((it, i) => (
                <View key={it.id} style={{ flexDirection: 'row', gap: SP.m, padding: SP.m, borderTopWidth: i > 0 ? 1 : 0, borderColor: C.hairline }}>
                  <View style={[{ width: 52, height: 66, backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
                    {it.galleryImageSnap
                      ? <CachedImage source={{ uri: it.galleryImageSnap }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Feather name="shopping-bag" size={18} color={C.dim} /></View>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.caption, { color: C.dim }]} numberOfLines={1}>{it.brandSnap}</Text>
                    <Text style={[T.productName, { marginTop: 1 }]} numberOfLines={2}>{it.listingNameSnap}</Text>
                    <Text style={[T.micro, { color: C.dim, marginTop: 3 }]}>{`${it.attributesLabelSnap} · Qty ${it.qty}`}</Text>
                    <OutcomeChip outcome={it.outcome} />
                  </View>
                  <Text style={[T.price]}>{`₹${rupees(it.netLinePaise).toLocaleString()}`}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══ ACTIONS ═══ */}
        <View style={{ marginTop: SP.l, gap: SP.s }}>
          {method === 'pickup' && (
            <>
              <BrutalButton label="Get directions" icon="navigation" block onPress={openMaps} />
              {!!order.storePhone && <BrutalButton label="Call store" icon="phone" variant="outline" block onPress={callStore} />}
            </>
          )}

          {showRetry && (
            <BrutalButton label={busy ? 'Opening…' : 'Retry payment'} icon="credit-card" block disabled={busy} onPress={doRetryPayment} />
          )}

          {showReturn && (
            <BrutalButton
              label={`Return items · ${daysLeft}d left`}
              icon="rotate-ccw"
              variant="outline"
              block
              onPress={() => nav.navigate('OrderReturn', { orderId: order.id })}
            />
          )}

          {showCancel && (
            <BrutalButton label={busy ? 'Working…' : 'Cancel order'} icon="x-circle" variant="outline" block disabled={busy} onPress={doCancel} />
          )}

          <BrutalButton label="Need help with this order" icon="life-buoy" variant="ghost" block onPress={() => nav.navigate('CustomerSupport')} />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Refund copy is split in two: the STATUS gives the headline, the DESTINATION gives
 * the note.
 *
 * It used to be one map keyed on status alone, so every completed refund claimed
 * "Back on your original payment method" — wrong for a wallet credit, and outright
 * false for a COD refund, which is handed over as physical cash.
 */
const REFUND_COPY: Record<string, { label: string; color: string }> = {
  pending: { label: 'Refund initiated', color: '#B0740A' },
  processing: { label: 'Refund processing', color: '#B0740A' },
  partially_disbursed: { label: 'Refund partly paid', color: '#B0740A' },
  succeeded: { label: 'Refund complete', color: '#1B8A5A' },
  failed: { label: 'Refund failed', color: '#C1121F' },
};

/** Where the money goes, and whether that leg has landed yet. */
const DESTINATION_NOTE: Record<string, { done: string; pending: string }> = {
  original_tender: {
    done: 'Back on your original payment method.',
    pending: 'On its way back to your original payment method — usually 3-5 working days.',
  },
  wallet: {
    done: 'Added to your ClosetX Wallet.',
    pending: 'Being added to your ClosetX Wallet.',
  },
  cash: {
    done: 'Paid to you in cash.',
    pending: 'Cash — handed to you when your return is collected.',
  },
  manual_payout: {
    done: 'Paid out by our team.',
    pending: 'Our team is arranging your payout and will be in touch.',
  },
};

/** Cash is the one destination where WHO hands it over matters. */
const CASH_NOTE: Record<string, { done: string; pending: string }> = {
  driver_reverse_pickup: {
    done: 'Cash handed to you by the driver at pickup.',
    pending: 'Cash from the driver when they collect your return.',
  },
  store_counter: {
    done: 'Cash paid at the store counter.',
    pending: 'Collect your cash at the store counter.',
  },
};

/** Short per-leg label for a split refund. */
const DESTINATION_LABEL: Record<string, string> = {
  original_tender: 'To your card / UPI',
  wallet: 'To your wallet',
  cash: 'In cash',
  manual_payout: 'Paid out by our team',
};

function refundNote(r: NonNullable<OrderDetail['refunds']>[number]): string {
  const landed = r.status === 'succeeded';
  const key = landed ? 'done' : 'pending';
  if (r.primaryDestination === 'cash' && r.primaryCashChannel) {
    return CASH_NOTE[r.primaryCashChannel]?.[key] ?? CASH_NOTE.store_counter![key];
  }
  // Falls back to the original-tender wording so an older backend (which sends no
  // destination at all) still reads exactly as it always did.
  const dest = r.primaryDestination ?? 'original_tender';
  return (DESTINATION_NOTE[dest] ?? DESTINATION_NOTE.original_tender!)[key];
}

/**
 * Refunds raised against this order.
 *
 * Cancelling a prepaid order raises a real refund row, but nothing in the app
 * ever showed it — refunds were only visible attached to a RETURN. So a customer
 * who cancelled saw "you will be refunded" and then had no way to check whether
 * it had happened, for how much, or whether it failed.
 */
function RefundBlock({ refunds }: { refunds: NonNullable<OrderDetail['refunds']> }) {
  if (!refunds.length) return null;
  return (
    <View style={{ marginTop: SP.l }}>
      <Text style={[T.label]}>{refunds.length > 1 ? 'Refunds' : 'Refund'}</Text>
      <View style={[{ marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
        {refunds.map((r, i) => {
          const meta = REFUND_COPY[r.status] ?? { label: r.status, color: C.dim };
          const note = refundNote(r);
          // Only break the amount down when it genuinely splits across tenders —
          // e.g. part back to the wallet, part as cash.
          const legs = (r.disbursements ?? []).length > 1 ? r.disbursements! : [];
          return (
            <View key={r.id} style={{ padding: SP.m, borderTopWidth: i > 0 ? 1 : 0, borderColor: C.hairline }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} />
                  <Text style={[T.bodyB, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={[T.price]}>{`₹${rupees(r.amountPaise).toLocaleString()}`}</Text>
              </View>
              {!!note && <Text style={[T.caption, { color: C.dim, marginTop: 4 }]}>{note}</Text>}
              {legs.map((d) => (
                <View
                  key={d.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 4,
                  }}
                >
                  <Text style={[T.micro, { color: C.dim }]}>
                    {DESTINATION_LABEL[d.destination] ?? d.destination}
                    {d.status === 'succeeded' ? '' : ' · pending'}
                  </Text>
                  <Text style={[T.micro, { color: C.dim }]}>
                    {`₹${rupees(d.amountPaise).toLocaleString()}`}
                  </Text>
                </View>
              ))}
              <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>
                {r.completedAt ? `Completed ${fmtTime(r.completedAt)}` : `Raised ${fmtTime(r.createdAt)}`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Server timestamps for the milestones that actually carry one. */
function stampFor(o: OrderDetail, at: number): string {
  const src =
    at <= 0 ? o.placedAt :
    at === 2 ? o.acceptedAt :
    at === 3 ? o.packedAt :
    at === 6 ? o.deliveredAt :
    null;
  return src ? fmtTime(src) : '';
}

const fmtTime = (iso?: string | null) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const fmtSlot = (start?: string | null, end?: string | null) => {
  if (!start) return '';
  try {
    const s = new Date(start);
    const day = s.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    const from = s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const to = end ? new Date(end).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
    return to ? `${day} ${from}–${to}` : `${day} ${from}`;
  } catch { return ''; }
};

/**
 * Per-item outcome, shown only once it stops being the default. Try & Buy orders
 * are the reason this exists: after the door visit, some lines are kept and some
 * went straight back, and only the item row can say which.
 */
const OUTCOME_COPY: Record<string, { label: string; color: string }> = {
  delivered_kept: { label: 'Kept', color: '#1B8A5A' },
  at_door_kept: { label: 'Kept at door', color: '#1B8A5A' },
  at_door_returned: { label: 'Returned at door', color: '#B0740A' },
  at_door_refused: { label: 'Refused', color: '#B0740A' },
  at_door_return_rejected: { label: 'Return refused by rider', color: '#C1121F' },
  at_store_pending_verification: { label: 'Being checked at store', color: '#B0740A' },
  store_accepted_return: { label: 'Return accepted', color: '#1B8A5A' },
  store_rejected_held: { label: 'Return rejected · held at store', color: '#C1121F' },
  held_collected_at_counter: { label: 'Collected at counter', color: '#1B8A5A' },
  held_redelivered: { label: 'Redelivered', color: '#1B8A5A' },
  held_abandoned: { label: 'Abandoned', color: '#C1121F' },
  held_window_expired: { label: 'Hold window expired', color: '#C1121F' },
  dispute_open: { label: 'Dispute open', color: '#C1121F' },
};

function OutcomeChip({ outcome }: { outcome: string }) {
  const meta = OUTCOME_COPY[outcome];
  if (!meta) return null; // pending_delivery + anything new — nothing worth saying yet
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} />
      <Text style={{ fontFamily: HELV, fontWeight: '700', fontSize: rf(10), letterSpacing: 0.3, color: meta.color }}>
        {meta.label.toUpperCase()}
      </Text>
    </View>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={[T.micro]}>{label}</Text>
      <Text style={[T.bodyB, { marginTop: 2 }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// ORDER HISTORY
// ═══════════════════════════════════════════════════════════

type StatusFilter = 'ALL' | 'ACTIVE' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';

const fmtOrderDate = (iso?: string) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(); }
  catch { return ''; }
};

export function OrderHistoryScreen() {
  const nav = useNavigation<any>();
  const { token, requireAuth } = useApp();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    // Returns are fetched alongside because RETURNED is not an order status — an
    // order with items sent back is still 'delivered' server-side.
    const [o, r] = await Promise.all([
      listOrders().catch(() => [] as OrderListRow[]),
      listReturns().catch(() => [] as ReturnRow[]),
    ]);
    setOrders(o);
    setReturns(r);
    setLoading(false);
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const returnedOrderIds = useMemo(() => new Set(returns.map((r) => r.orderId)), [returns]);

  /**
   * Orders with a return the store has NOT yet decided on.
   *
   * The row badge used to read "RETURN OPEN" for any order that had a return row at
   * all, so it stayed on screen after the store accepted the goods and the refund
   * had already landed — and it also lit up for door-returns handed back at
   * delivery, which were never "open" in the first place. Split the two states so
   * the badge says what is actually true.
   */
  const openReturnOrderIds = useMemo(
    () => new Set(returns.filter((r) => r.storeDecision === 'pending').map((r) => r.orderId)),
    [returns],
  );

  const filtered = useMemo(() => orders.filter((o) => {
    if (filter === 'ALL') return true;
    if (filter === 'RETURNED') return returnedOrderIds.has(o.id);
    return bucketOf(o.status) === filter;
  }), [orders, filter, returnedOrderIds]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!token) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <BrutalStatusBar />
        <ScreenHeader title="Orders" onBack={() => nav.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}>
          <Feather name="user" size={26} color={C.dim} />
          <Text style={[T.h3, { marginTop: 12 }]}>Sign in to see your orders</Text>
          <BrutalButton label="Sign in" onPress={() => requireAuth()} style={{ marginTop: SP.l }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />
      <ScreenHeader title="Orders" onBack={() => nav.goBack()} />

      <View style={{ borderBottomWidth: 1, borderColor: C.hairline }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: SP.l, paddingHorizontal: SP.l, paddingTop: SP.s, paddingBottom: SP.m }}>
          {(['ALL', 'ACTIVE', 'DELIVERED', 'RETURNED', 'CANCELLED'] as StatusFilter[]).map((f) => {
            const on = filter === f;
            return (
              <Pressable key={f} onPress={() => setFilter(f)} hitSlop={6} style={{ paddingBottom: 6, borderBottomWidth: 2, borderColor: on ? C.ink : 'transparent' }}>
                <Text style={{ fontFamily: HELV, fontWeight: '700', fontSize: rf(12), letterSpacing: 0.3, color: on ? C.ink : C.dim }}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.ink} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
        >
          {filtered.map((o, i) => {
            const primary = o.items?.[0];
            const extra = Math.max(0, (o.items?.length ?? 0) - 1);
            const count = o.itemCount ?? o.items?.reduce((s, it) => s + it.qty, 0) ?? 0;
            const wasReturned = returnedOrderIds.has(o.id);
            const returnPending = openReturnOrderIds.has(o.id);
            return (
              <FadeInUp key={o.id} delay={Math.min(i, 8) * 40}>
                <Pressable
                  onPress={() => nav.navigate('OrderTracking', { orderId: o.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingVertical: 18, borderBottomWidth: 1, borderColor: C.hairline }}
                >
                  <View style={[{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
                    {primary?.image
                      ? <CachedImage source={{ uri: primary.image }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      : <Feather name="shopping-bag" size={20} color={C.dim} />}
                  </View>

                  <View style={{ flex: 1, marginLeft: SP.m }}>
                    <Text style={[T.h3, { color: C.ink }]} numberOfLines={1}>
                      {primary?.name || o.storeName || 'Order'}{extra > 0 ? `  +${extra} more` : ''}
                    </Text>
                    <Text style={[T.caption, { color: C.dim, marginTop: 3 }]} numberOfLines={1}>
                      {`${fmtOrderDate(o.placedAt)} · ${count} item${count !== 1 ? 's' : ''} · ${METHOD_LABEL[toApiMethod(o.deliveryMethod)]}`}
                    </Text>
                    <View style={{ marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <StatusBadge status={o.status} />
                      {wasReturned && (
                        <Text style={{ fontFamily: HELV, fontWeight: '700', fontSize: rf(10), color: returnPending ? '#B0740A' : '#1B8A5A' }}>
                          {returnPending ? 'RETURN OPEN' : 'RETURNED'}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', marginLeft: SP.s }}>
                    <Text style={T.price}>₹{rupees(o.grandTotalPaise).toLocaleString()}</Text>
                    <Feather name="chevron-right" size={18} color={C.dim} style={{ marginTop: 10 }} />
                  </View>
                </Pressable>
              </FadeInUp>
            );
          })}

          {filtered.length === 0 && (
            <View style={{ padding: SP.xl, alignItems: 'center', marginTop: SP.xl }}>
              <Feather name="inbox" size={26} color={C.dim} />
              <Text style={[T.h3, { marginTop: 12 }]}>{orders.length === 0 ? 'No orders yet' : 'Nothing here'}</Text>
              <Text style={[T.caption, { color: C.dim, marginTop: 4 }]}>
                {orders.length === 0 ? 'Your orders will show up here.' : 'No orders match this filter.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const bucket = bucketOf(status);
  const color =
    bucket === 'DELIVERED' ? '#1B8A5A' :
    bucket === 'CANCELLED' ? '#C1121F' :
    status === 'payment_failed' || status === 'undelivered' ? '#B0740A' :
    C.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: HELV, fontWeight: '700', fontSize: rf(11), letterSpacing: 0.3, color }}>
        {statusLabel(status).toUpperCase()}
      </Text>
    </View>
  );
}

// Fake QR code — 13×13 grid of squares derived from the seed string, plus
// the 3 corner finder patterns that make it look like a real QR. Good enough
// to render a convincing brutalist pickup code without pulling in a QR lib.
// NOTE: the counter flow is code-entry, not scan — the code below it is the
// thing that actually works.
function PseudoQR({ seed }: { seed: string }) {
  const SIZE = 13;
  const cells: boolean[][] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let r = 0; r < SIZE; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < SIZE; c++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      row.push(((h >> (c % 32)) & 1) === 1);
    }
    cells.push(row);
  }
  const markFinder = (rr: number, cc: number) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells[rr + r]![cc + c] = true;
    cells[rr + 1]![cc + 1] = false;
  };
  markFinder(0, 0); markFinder(0, SIZE - 3); markFinder(SIZE - 3, 0);

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {cells.map((row, r) => (
        <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
          {row.map((on, c) => (
            <View key={c} style={{ flex: 1, backgroundColor: on ? C.ink : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
