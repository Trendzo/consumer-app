import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalStatusBar, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { listOrders, type OrderListRow } from '../services/orders';

// ─── ORDER SUCCESS ──────────────────────────────────────────
export function OrderSuccessScreen() {
  const nav = useNavigation<any>();
  const { lastOrder } = useApp();
  const method = lastOrder?.method || 'express';
  const store = lastOrder?.store;

  const headline =
    method === 'pickup' ? 'Order confirmed.' :
    method === 'tryandbuy' ? 'Trial booked.' :
    'Order placed.';

  const caption =
    method === 'pickup' ? `Ready at ${store?.name} in ~${store?.eta}` :
    method === 'tryandbuy' ? 'Courier arrives tomorrow · 15 min trial' :
    method === 'standard' ? 'Arriving in 2–3 days' :
    'Arriving in 47 minutes';

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
        <Text style={[T.caption, { color: C.ink }]}>
          {'Order '}
          <Text style={[T.monoB]}>{`#${lastOrder?.id || 'CX' + Math.floor(Math.random() * 90000)}`}</Text>
        </Text>
        <Text style={[T.body, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>{caption}</Text>
      </MotiView>

      <View style={{ marginTop: 36, gap: 10, width: '100%' }}>
        <BrutalButton
          label={method === 'pickup' ? 'View pickup details' : 'Track order'}
          iconRight="arrow-right"
          onPress={() => nav.replace('OrderTracking')}
          block
        />
        <BrutalButton label="Continue shopping" variant="outline" onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} block />
      </View>
    </View>
  );
}

// ─── TRACKING STEPS — different flow per method ────────────
const STEPS_EXPRESS = [
  { label: 'Order placed', sub: 'Just now', icon: 'check' },
  { label: 'Store confirmed', sub: '2 min', icon: 'shopping-bag' },
  { label: 'Packed & dispatched', sub: '8 min', icon: 'package' },
  { label: 'Out for delivery', sub: '24 min', icon: 'truck' },
  { label: 'Delivered', sub: '47 min · ETA', icon: 'home' },
];
const STEPS_STANDARD = [
  { label: 'Order placed', sub: 'Just now', icon: 'check' },
  { label: 'Payment verified', sub: '3 min', icon: 'credit-card' },
  { label: 'Packed at warehouse', sub: '6 hrs', icon: 'package' },
  { label: 'Shipped', sub: 'Tomorrow', icon: 'send' },
  { label: 'Out for delivery', sub: 'Day 2', icon: 'truck' },
  { label: 'Delivered', sub: 'Day 2-3 · ETA', icon: 'home' },
];
const STEPS_PICKUP = [
  { label: 'Order placed', sub: 'Just now', icon: 'check' },
  { label: 'Store received order', sub: '2 min', icon: 'shopping-bag' },
  { label: 'Being prepared', sub: '18 min', icon: 'package' },
  { label: 'Ready for pickup', sub: '45 min · ETA', icon: 'map-pin' },
  { label: 'Collected', sub: 'Show QR at counter', icon: 'check-circle' },
];
const STEPS_TRYBUY = [
  { label: 'Order placed', sub: 'Just now', icon: 'check' },
  { label: 'Packed', sub: '1 hr', icon: 'package' },
  { label: 'Dispatched', sub: 'Tomorrow 9am', icon: 'send' },
  { label: 'Courier at your door', sub: '15 min window', icon: 'home' },
  { label: 'Trial complete', sub: 'Keep what fits', icon: 'check-circle' },
];

export function OrderTrackingScreen() {
  const nav = useNavigation<any>();
  const { lastOrder } = useApp();
  const method = lastOrder?.method || 'express';
  const store = lastOrder?.store;

  const STEPS =
    method === 'pickup' ? STEPS_PICKUP :
    method === 'standard' ? STEPS_STANDARD :
    method === 'tryandbuy' ? STEPS_TRYBUY :
    STEPS_EXPRESS;

  const [active, setActive] = useState(method === 'pickup' ? 2 : method === 'standard' ? 1 : 2);

  useEffect(() => {
    const t = setInterval(() => setActive(a => Math.min(STEPS.length - 1, a + 1)), 4000);
    return () => clearInterval(t);
  }, [STEPS.length]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />
      <ScreenHeader title={method === 'pickup' ? 'Pickup' : 'Order Tracking'} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 120 }}>
        {/* ═══ METHOD-SPECIFIC HEADER CARD ═══ */}
        {method === 'pickup' ? <PickupHeader order={lastOrder} store={store} active={active} stepCount={STEPS.length} /> :
         method === 'standard' ? <StandardHeader order={lastOrder} /> :
         method === 'tryandbuy' ? <TryBuyHeader order={lastOrder} /> :
         <ExpressHeader order={lastOrder} />}

        {/* ═══ TIMELINE (always shown, steps vary by method) ═══ */}
        <View style={{ marginTop: SP.xl }}>
          <Text style={[T.label]}>{'Timeline'}</Text>
          <View style={{ marginTop: SP.m }}>
            {STEPS.map((step, i) => {
              const done = i <= active;
              const current = i === active;
              return (
                <FadeInUp key={i} delay={i * 80}>
                  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                    <View style={{ alignItems: 'center', width: 36 }}>
                      <View style={[{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? C.ink : C.white }, BORDER(1)]}>
                        <Feather name={step.icon as any} size={13} color={done ? C.white : C.ink} />
                      </View>
                      {i < STEPS.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: done ? C.ink : C.hairline, marginTop: 2 }} />}
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12, paddingBottom: 18 }}>
                      <Text style={[T.caption, { color: done ? C.ink : C.dim }]}>{step.label}</Text>
                      <Text style={[T.micro, { color: current ? C.ink : C.dim, marginTop: 2 }]}>{step.sub}</Text>
                    </View>
                  </View>
                </FadeInUp>
              );
            })}
          </View>
        </View>

        {/* ═══ METHOD-SPECIFIC ACTION ═══ */}
        {method === 'pickup' && <PickupActions store={store} />}
        {method === 'express' && <BrutalButton label="Contact rider" icon="phone" variant="outline" block onPress={() => {}} style={{ marginTop: SP.l }} />}
        {method === 'standard' && <BrutalButton label="Get shipping updates" icon="bell" variant="outline" block onPress={() => {}} style={{ marginTop: SP.l }} />}
        {method === 'tryandbuy' && <BrutalButton label="Reschedule trial" icon="calendar" variant="outline" block onPress={() => {}} style={{ marginTop: SP.l }} />}

        {/* Return / exchange — available once an order exists */}
        <BrutalButton label="Return or exchange" icon="rotate-ccw" variant="outline" block onPress={() => nav.navigate('OrderReturn')} style={{ marginTop: SP.s }} />
      </ScrollView>
    </View>
  );
}

// ─── Method-specific headers ────────────────────────────────

function ExpressHeader({ order }: any) {
  return (
    <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
      <Text style={[T.monoB, { fontSize: 10 }]}>{`ORDER #${order?.id || 'CX48201'} · EXPRESS`}</Text>
      <Text style={[T.h1, { marginTop: 6, textTransform: 'uppercase' }]}>Arriving soon</Text>
      <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>From NORTH. store · 2.4 km</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
        <HeaderStat label="ETA" value="23 min" />
        <HeaderStat label="Rider" value="Ravi K." />
        <HeaderStat label="Bike" value="MH02" />
      </View>
    </View>
  );
}

function StandardHeader({ order }: any) {
  return (
    <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
      <Text style={[T.monoB, { fontSize: 10 }]}>{`ORDER #${order?.id || 'CX48201'} · STANDARD`}</Text>
      <Text style={[T.h1, { marginTop: 6, textTransform: 'uppercase' }]}>On its way</Text>
      <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>Tracked shipping · signature on delivery</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
        <HeaderStat label="ETA" value="2-3 days" />
        <HeaderStat label="AWB" value="CX48201" />
        <HeaderStat label="Carrier" value="Delhivery" />
      </View>
    </View>
  );
}

function TryBuyHeader({ order }: any) {
  return (
    <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
      <Text style={[T.monoB, { fontSize: 10 }]}>{`ORDER #${order?.id || 'CX48201'} · TRY & BUY`}</Text>
      <Text style={[T.h1, { marginTop: 6, textTransform: 'uppercase' }]}>Trial booked</Text>
      <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>Courier will wait 15 min · keep what fits</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
        <HeaderStat label="Arrives" value="Tomorrow" />
        <HeaderStat label="Window" value="10-12 AM" />
        <HeaderStat label="Trial" value="15 min" />
      </View>
    </View>
  );
}

function PickupHeader({ order, store, active, stepCount }: any) {
  const ready = active >= stepCount - 2; // "ready for pickup" state
  const code = store?.code || order?.id || 'CX48201';
  const slot = store?.slot;
  return (
    <View>
      <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
        <Text style={[T.monoB, { fontSize: 10, color: C.dim }]}>{`ORDER #${order?.id || 'CX48201'} · PICKUP`}</Text>
        <Text style={[T.h1, { marginTop: 6, textTransform: 'uppercase' }]}>
          {ready ? 'Ready at store' : 'Being prepared'}
        </Text>
        <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>{store?.name || 'NORTH. × ANDHERI'}</Text>
        <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{store?.addr || 'Infiniti Mall, Level 2'}</Text>
        {slot && (
          <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.ink }}>
              <Text style={[T.caption, { color: C.white }]}>{`Slot · ${slot}`}</Text>
            </View>
            <View style={[{ paddingHorizontal: 8, paddingVertical: 3 }, BORDER(1)]}>
              <Text style={[T.caption, { color: C.ink }]}>{`ETA · ${store?.eta || '45 min'}`}</Text>
            </View>
          </View>
        )}
      </View>

      {/* QR CODE block — key difference from delivery flows */}
      <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: C.white, alignItems: 'center' }, BORDER(1)]}>
        <Text style={[T.caption]}>{'Show this at counter'}</Text>
        <View style={[{ marginTop: SP.m, width: 180, height: 180, backgroundColor: C.white, padding: 8 }, BORDER(2)]}>
          <PseudoQR seed={code} />
        </View>
        <Text style={[T.monoB, { fontSize: rf(22), letterSpacing: 4, marginTop: 12 }]}>{code}</Text>
        <Text style={[T.micro, { marginTop: 4 }]}>Pickup code</Text>
        {ready && (
          <View style={[{ marginTop: SP.m, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.ink }]}>
            <Text style={[T.caption, { color: C.white }]}>Ready now · Head to store</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PickupActions({ store }: any) {
  return (
    <View style={{ marginTop: SP.l, gap: SP.s }}>
      <BrutalButton label="Get directions" icon="navigation" block onPress={() => {}} />
      <BrutalButton label={`Call ${store?.name?.split(' ')[0] || 'store'}`} icon="phone" variant="outline" block onPress={() => {}} />
    </View>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={[T.micro]}>{label}</Text>
      <Text style={[T.bodyB, { marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// ORDER HISTORY — list of past & active orders (not live tracking)
// ═══════════════════════════════════════════════════════════
const HISTORY: {
  id: string;
  date: string;
  items: { name: string; brand: string; qty: number }[];
  total: number;
  status: 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'SHIPPED';
  method: 'express' | 'standard' | 'pickup' | 'tryandbuy';
}[] = [
  {
    id: 'CX10442', date: '02 APR 2026',
    items: [
      { name: 'Oversized Wool Coat', brand: 'NORTH.', qty: 1 },
      { name: 'Slim Fit Jeans', brand: 'YORK', qty: 1 },
    ],
    total: 6490, status: 'DELIVERED', method: 'standard',
  },
  {
    id: 'CX10388', date: '18 MAR 2026',
    items: [
      { name: 'Cotton Tee · Ecru', brand: 'AZUKI', qty: 2 },
    ],
    total: 1980, status: 'DELIVERED', method: 'express',
  },
  {
    id: 'CX10301', date: '27 FEB 2026',
    items: [
      { name: 'Cargo Trousers', brand: 'KOH', qty: 1 },
      { name: 'Canvas Belt', brand: 'KOH', qty: 1 },
    ],
    total: 3340, status: 'RETURNED', method: 'tryandbuy',
  },
  {
    id: 'CX10277', date: '11 FEB 2026',
    items: [
      { name: 'Knit Beanie', brand: 'NORTH.', qty: 1 },
    ],
    total: 790, status: 'CANCELLED', method: 'standard',
  },
  {
    id: 'CX10188', date: '25 JAN 2026',
    items: [
      { name: 'Leather Sneakers', brand: 'YORK', qty: 1 },
      { name: 'Crew Socks · 3pk', brand: 'YORK', qty: 1 },
    ],
    total: 5480, status: 'DELIVERED', method: 'pickup',
  },
  {
    id: 'CX10112', date: '08 JAN 2026',
    items: [
      { name: 'Wool Scarf', brand: 'AZUKI', qty: 1 },
    ],
    total: 1490, status: 'DELIVERED', method: 'standard',
  },
];

type StatusFilter = 'ALL' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';

// Map a backend order row to the history-card display shape. The list row is slim
// (no line items), so we show the store as the summary line.
const fmtOrderDate = (iso?: string) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(); }
  catch { return ''; }
};
const mapOrderStatus = (s: string): 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'SHIPPED' =>
  s === 'delivered' ? 'DELIVERED' : s === 'cancelled' ? 'CANCELLED' : s === 'returned' ? 'RETURNED' : 'SHIPPED';
const mapOrderMethod = (m?: string): 'express' | 'standard' | 'pickup' | 'tryandbuy' =>
  m === 'standard' ? 'standard' : m === 'pickup' ? 'pickup' : m === 'try_and_buy' ? 'tryandbuy' : 'express';
function mapOrderRow(o: OrderListRow): typeof HISTORY[number] {
  return {
    id: o.id,
    date: fmtOrderDate(o.placedAt),
    items: [{ name: o.storeName || 'Order', brand: '', qty: 1 }],
    total: Math.round((o.grandTotalPaise ?? 0) / 100),
    status: mapOrderStatus(o.status),
    method: mapOrderMethod(o.deliveryMethod),
  };
}

export function OrderHistoryScreen() {
  const nav = useNavigation<any>();
  const { token } = useApp();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  // Real orders when logged in; mock HISTORY as the fallback.
  const [orders, setOrders] = useState(HISTORY);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listOrders().then((rows) => { if (!cancelled && rows.length) setOrders(rows.map(mapOrderRow)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const filtered = orders.filter(o => filter === 'ALL' || o.status === filter);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />
      <ScreenHeader title="Orders" onBack={() => nav.goBack()} />

      {/* Filter tabs — clean underline row */}
      <View style={{ flexDirection: 'row', gap: SP.l, paddingHorizontal: SP.l, paddingTop: SP.s, paddingBottom: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
        {(['ALL', 'DELIVERED', 'RETURNED', 'CANCELLED'] as StatusFilter[]).map(f => {
          const on = filter === f;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} hitSlop={6} style={{ paddingBottom: 6, borderBottomWidth: 2, borderColor: on ? C.ink : 'transparent' }}>
              <Text style={{ fontFamily: 'Helvetica Neue', fontWeight: '700', fontSize: rf(12), letterSpacing: 0.3, color: on ? C.ink : C.dim }}>{f}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {filtered.map((o, i) => {
          const itemCount = o.items.reduce((s, it) => s + it.qty, 0);
          const primary = o.items[0];
          const extra = o.items.length - 1;
          return (
            <FadeInUp key={o.id} delay={i * 40}>
              <Pressable
                onPress={() => nav.navigate('OrderTracking')}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingVertical: 18, borderBottomWidth: 1, borderColor: C.hairline }}
              >
                {/* Thumbnail */}
                <View style={[{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                  <Feather name="shopping-bag" size={20} color={C.dim} />
                </View>

                {/* Middle — item + meta + status */}
                <View style={{ flex: 1, marginLeft: SP.m }}>
                  <Text style={[T.h3, { color: C.ink }]} numberOfLines={1}>
                    {primary?.name || 'Order'}{extra > 0 ? `  +${extra} more` : ''}
                  </Text>
                  <Text style={[T.caption, { color: C.dim, marginTop: 3 }]} numberOfLines={1}>
                    {o.date} · {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </Text>
                  <View style={{ marginTop: 7 }}>
                    <StatusBadge status={o.status} />
                  </View>
                </View>

                {/* Right — total + chevron */}
                <View style={{ alignItems: 'flex-end', marginLeft: SP.s }}>
                  <Text style={T.price}>₹{o.total.toLocaleString()}</Text>
                  <Feather name="chevron-right" size={18} color={C.dim} style={{ marginTop: 10 }} />
                </View>
              </Pressable>
            </FadeInUp>
          );
        })}

        {filtered.length === 0 && (
          <View style={{ padding: SP.xl, alignItems: 'center', marginTop: SP.xl }}>
            <Feather name="inbox" size={26} color={C.dim} />
            <Text style={[T.h3, { marginTop: 12 }]}>No orders yet</Text>
            <Text style={[T.caption, { color: C.dim, marginTop: 4 }]}>No orders match this filter.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatusBadge({ status }: { status: 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'SHIPPED' }) {
  const color =
    status === 'DELIVERED' ? '#1B8A5A' :
    status === 'SHIPPED' ? C.ink :
    status === 'RETURNED' ? '#B0740A' :
    '#C1121F';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: 'Helvetica Neue', fontWeight: '700', fontSize: rf(11), letterSpacing: 0.3, color }}>{status}</Text>
    </View>
  );
}

// Fake QR code — 13×13 grid of squares derived from the seed string, plus
// the 3 corner finder patterns that make it look like a real QR. Good enough
// to render a convincing brutalist pickup code without pulling in a QR lib.
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
  // Force finder squares at 3 corners
  const markFinder = (rr: number, cc: number) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells[rr + r][cc + c] = true;
    cells[rr + 1][cc + 1] = false;
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
