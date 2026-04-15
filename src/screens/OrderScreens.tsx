import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, BrutalStatusBar, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';

// ─── ORDER SUCCESS ──────────────────────────────────────────
export function OrderSuccessScreen() {
  const nav = useNavigation<any>();
  const { lastOrder, night } = useApp();
  const method = lastOrder?.method || 'express';
  const store = lastOrder?.store;

  const headline =
    method === 'pickup' ? 'ORDER\nCONFIRMED.' :
    method === 'tryandbuy' ? 'TRIAL\nBOOKED.' :
    method === 'standard' ? 'ORDER\nPLACED.' :
    'ORDER\nPLACED.';

  const caption =
    method === 'pickup' ? `Ready at ${store?.name} in ~${store?.eta}` :
    method === 'tryandbuy' ? 'Courier arrives tomorrow · 15 min trial' :
    method === 'standard' ? 'Arriving in 2–3 days' :
    'Arriving in 47 minutes';

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#0a0a0a' : '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
      <BrutalStatusBar />
      <MotiView from={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 160 }}>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 64, color: C.ink }}>{'[✓]'}</Text>
      </MotiView>

      <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 250 }}>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 36, color: C.ink, marginTop: 18, textAlign: 'center', letterSpacing: -1 }}>{headline}</Text>
      </MotiView>

      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 450 }} style={{ marginTop: 24, alignItems: 'center' }}>
        <AsciiDivider />
        <Text style={[T.monoB, { marginTop: 10 }]}>{`> ORDER #${lastOrder?.id || 'CX' + Math.floor(Math.random() * 90000)}`}</Text>
        <Text style={[T.body, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>{caption}</Text>
        <AsciiDivider faint style={{ marginTop: 10 }} />
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
  { label: 'ORDER PLACED', sub: 'Just now', icon: 'check' },
  { label: 'STORE CONFIRMED', sub: '2 min', icon: 'shopping-bag' },
  { label: 'PACKED & DISPATCHED', sub: '8 min', icon: 'package' },
  { label: 'OUT FOR DELIVERY', sub: '24 min', icon: 'truck' },
  { label: 'DELIVERED', sub: '47 min · ETA', icon: 'home' },
];
const STEPS_STANDARD = [
  { label: 'ORDER PLACED', sub: 'Just now', icon: 'check' },
  { label: 'PAYMENT VERIFIED', sub: '3 min', icon: 'credit-card' },
  { label: 'PACKED AT WAREHOUSE', sub: '6 hrs', icon: 'package' },
  { label: 'SHIPPED', sub: 'Tomorrow', icon: 'send' },
  { label: 'OUT FOR DELIVERY', sub: 'Day 2', icon: 'truck' },
  { label: 'DELIVERED', sub: 'Day 2-3 · ETA', icon: 'home' },
];
const STEPS_PICKUP = [
  { label: 'ORDER PLACED', sub: 'Just now', icon: 'check' },
  { label: 'STORE RECEIVED ORDER', sub: '2 min', icon: 'shopping-bag' },
  { label: 'BEING PREPARED', sub: '18 min', icon: 'package' },
  { label: 'READY FOR PICKUP', sub: '45 min · ETA', icon: 'map-pin' },
  { label: 'COLLECTED', sub: 'Show QR at counter', icon: 'check-circle' },
];
const STEPS_TRYBUY = [
  { label: 'ORDER PLACED', sub: 'Just now', icon: 'check' },
  { label: 'PACKED', sub: '1 hr', icon: 'package' },
  { label: 'DISPATCHED', sub: 'Tomorrow 9am', icon: 'send' },
  { label: 'COURIER AT YOUR DOOR', sub: '15 min window', icon: 'home' },
  { label: 'TRIAL COMPLETE', sub: 'Keep what fits', icon: 'check-circle' },
];

export function OrderTrackingScreen() {
  const nav = useNavigation<any>();
  const { lastOrder, night } = useApp();
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
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#0a0a0a' : '#FFFFFF' }}>
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
          <Text style={[T.label]}>{'> TIMELINE'}</Text>
          <AsciiDivider faint style={{ marginTop: 4 }} />
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
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: done ? C.ink : C.dim, letterSpacing: 0.3 }}>{step.label}</Text>
                      <Text style={[T.mono, { color: current ? C.ink : C.dim, marginTop: 2 }]}>{step.sub}</Text>
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
      </ScrollView>
    </View>
  );
}

// ─── Method-specific headers ────────────────────────────────

function ExpressHeader({ order }: any) {
  return (
    <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
      <Text style={[T.monoB, { fontSize: 10 }]}>{`> ORDER #${order?.id || 'CX48201'} · EXPRESS`}</Text>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, marginTop: 6, letterSpacing: -0.5 }}>ARRIVING SOON</Text>
      <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>From NORTH. store · 2.4 km</Text>
      <AsciiDivider style={{ marginTop: SP.m }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
        <HeaderStat label="ETA" value="23 MIN" />
        <HeaderStat label="RIDER" value="RAVI K." />
        <HeaderStat label="BIKE" value="MH02" />
      </View>
    </View>
  );
}

function StandardHeader({ order }: any) {
  return (
    <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
      <Text style={[T.monoB, { fontSize: 10 }]}>{`> ORDER #${order?.id || 'CX48201'} · STANDARD`}</Text>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, marginTop: 6, letterSpacing: -0.5 }}>ON ITS WAY</Text>
      <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>Tracked shipping · signature on delivery</Text>
      <AsciiDivider style={{ marginTop: SP.m }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
        <HeaderStat label="ETA" value="2-3 DAYS" />
        <HeaderStat label="AWB" value="CX48201" />
        <HeaderStat label="CARRIER" value="DELHIVERY" />
      </View>
    </View>
  );
}

function TryBuyHeader({ order }: any) {
  return (
    <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
      <Text style={[T.monoB, { fontSize: 10 }]}>{`> ORDER #${order?.id || 'CX48201'} · TRY & BUY`}</Text>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, marginTop: 6, letterSpacing: -0.5 }}>TRIAL BOOKED</Text>
      <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>Courier will wait 15 min · keep what fits</Text>
      <AsciiDivider style={{ marginTop: SP.m }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
        <HeaderStat label="ARRIVES" value="TOMORROW" />
        <HeaderStat label="WINDOW" value="10-12 AM" />
        <HeaderStat label="TRIAL" value="15 MIN" />
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
      <View style={[{ padding: SP.l, backgroundColor: C.ink }, BORDER(1)]}>
        <Text style={[T.monoB, { fontSize: 10, color: C.white, opacity: 0.7 }]}>{`> ORDER #${order?.id || 'CX48201'} · PICKUP`}</Text>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.white, marginTop: 6, letterSpacing: -1, lineHeight: 34 }}>
          {ready ? 'READY AT STORE' : 'BEING PREPARED'}
        </Text>
        <Text style={[T.mono, { color: C.white, opacity: 0.7, marginTop: 6, fontSize: 10 }]}>{store?.name || 'NORTH. × ANDHERI'}</Text>
        <Text style={[T.mono, { color: C.white, opacity: 0.5, marginTop: 2, fontSize: 9 }]}>{store?.addr || 'Infiniti Mall, Level 2'}</Text>
        {slot && (
          <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.white }}>
              <Text style={[T.monoB, { fontSize: 9, color: C.ink }]}>{`SLOT · ${slot}`}</Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.white }}>
              <Text style={[T.monoB, { fontSize: 9, color: C.white }]}>{`ETA · ${store?.eta || '45 MIN'}`}</Text>
            </View>
          </View>
        )}
      </View>

      {/* QR CODE block — key difference from delivery flows */}
      <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: C.white, alignItems: 'center' }, BORDER(1)]}>
        <Text style={[T.monoB, { fontSize: 10 }]}>{'> SHOW_THIS_AT_COUNTER'}</Text>
        <View style={[{ marginTop: SP.m, width: 180, height: 180, backgroundColor: C.white, padding: 8 }, BORDER(2)]}>
          <PseudoQR seed={code} />
        </View>
        <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 22, color: C.ink, letterSpacing: 4, marginTop: 12 }}>{code}</Text>
        <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 4 }]}>PICKUP CODE</Text>
        {ready && (
          <View style={[{ marginTop: SP.m, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.ink }]}>
            <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>◆ READY NOW · HEAD TO STORE</Text>
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
      <Text style={[T.mono, { color: C.dim }]}>{label}</Text>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, marginTop: 2 }}>{value}</Text>
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

export function OrderHistoryScreen() {
  const nav = useNavigation<any>();
  const { night } = useApp();
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const filtered = HISTORY.filter(o => filter === 'ALL' || o.status === filter);
  const totalSpent = HISTORY.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.total, 0);

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#0a0a0a' : '#FFFFFF' }}>
      <BrutalStatusBar />
      <ScreenHeader title="My Orders" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 120 }}>
        {/* Hero */}
        <FadeInUp>
          <View style={[{ padding: SP.l, backgroundColor: C.ink }, BORDER(1)]}>
            <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{'> ORDER_HISTORY · LIFETIME'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 36, color: C.white, letterSpacing: -1.4, marginTop: 6, lineHeight: 38 }}>{'YOUR\nORDERS.'}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>Every order you've ever placed. Tap any one for details.</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: SP.m, flexWrap: 'wrap' }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.6, color: C.ink }}>{HISTORY.length} ORDERS</Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.white }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.6, color: C.white }}>₹{totalSpent.toLocaleString()} SPENT</Text>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Filters */}
        <View style={{ marginTop: SP.l }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[T.monoB, { fontSize: 10 }]}>{'> FILTER'}</Text>
            <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{filtered.length} RESULTS</Text>
          </View>
          <AsciiDivider faint style={{ marginTop: 4 }} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {(['ALL', 'DELIVERED', 'RETURNED', 'CANCELLED'] as StatusFilter[]).map(f => {
              const on = filter === f;
              return (
                <Pressable key={f} onPress={() => setFilter(f)} style={[{ paddingHorizontal: 12, paddingVertical: 7, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: on ? C.white : C.ink, letterSpacing: 0.5 }}>{f}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* List */}
        <View style={{ marginTop: SP.l, gap: SP.s }}>
          {filtered.map((o, i) => {
            const itemCount = o.items.reduce((s, it) => s + it.qty, 0);
            return (
              <FadeInUp key={o.id} delay={i * 50}>
                <Pressable onPress={() => nav.navigate('OrderTracking')} style={[{ backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
                  {/* Top bar: order id + status */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.monoB, { fontSize: 10 }]}>{`#${o.id}`}</Text>
                      <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{o.date} · {o.method.toUpperCase()}</Text>
                    </View>
                    <StatusBadge status={o.status} />
                  </View>

                  {/* Items */}
                  <View style={{ padding: SP.m, gap: 8 }}>
                    {o.items.map((it, j) => (
                      <View key={j} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
                          <Feather name="shopping-bag" size={12} color={C.ink} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[T.monoB, { fontSize: 8, color: C.dim }]}>{it.brand}</Text>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: C.ink, marginTop: 1 }} numberOfLines={1}>{it.name}</Text>
                        </View>
                        <Text style={[T.mono, { fontSize: 10, color: C.dim }]}>×{it.qty}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Footer: total + action */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, borderTopWidth: 1, borderColor: C.hairline }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{itemCount} ITEM{itemCount !== 1 ? 'S' : ''} · TOTAL</Text>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink, letterSpacing: -0.5, marginTop: 2 }}>₹{o.total.toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[T.monoB, { fontSize: 10 }]}>{o.status === 'DELIVERED' ? 'REORDER' : 'DETAILS'}</Text>
                      <Feather name="chevron-right" size={14} color={C.ink} />
                    </View>
                  </View>
                </Pressable>
              </FadeInUp>
            );
          })}

          {filtered.length === 0 && (
            <View style={[{ padding: SP.xl, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <Feather name="inbox" size={22} color={C.dim} />
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink, marginTop: 10 }}>NOTHING HERE</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>No orders match this filter.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatusBadge({ status }: { status: 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'SHIPPED' }) {
  const solid = status === 'DELIVERED';
  return (
    <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: solid ? C.ink : 'transparent' }, BORDER(1)]}>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.6, color: solid ? C.white : C.ink }}>{status}</Text>
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
