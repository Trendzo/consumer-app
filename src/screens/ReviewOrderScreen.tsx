import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { BrutalStatusBar, CachedImage } from '../components/Brutal';
import { useApp } from '../state/AppState';

const ADDRESSES = [
  { id: 'a1', label: 'HOME', name: 'You', addr: 'D-204, Block A, Andheri West, Mumbai 400058', phone: '+91 98xxx xxx21' },
  { id: 'a2', label: 'OFFICE', name: 'You', addr: '12th Floor, Bandra Kurla Complex, Mumbai 400051', phone: '+91 98xxx xxx21' },
];
const PAYMENTS = [
  { id: 'upi', icon: 'smartphone', label: 'UPI', sub: 'pay@okhdfcbank' },
  { id: 'card', icon: 'credit-card', label: 'Credit / Debit Card', sub: '•••• 4242' },
  { id: 'cod', icon: 'dollar-sign', label: 'Cash on Delivery', sub: 'Pay when it arrives' },
  { id: 'wallet', icon: 'package', label: 'Trendzo Wallet', sub: '₹1,240 balance' },
];
const REWARD_BALANCE = 240; // MyTrendz reward points (₹1 = 1 pt)

// Small monochrome on/off switch
function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  // Knob is absolutely positioned so it visibly slides left↔right (flex didn't move it)
  return (
    <Pressable onPress={onPress} hitSlop={12} style={[{ width: 50, height: 28, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
      <View style={{ position: 'absolute', top: 3, left: on ? 26 : 2, width: 20, height: 20, backgroundColor: on ? C.white : C.ink }} />
    </Pressable>
  );
}

export default function ReviewOrderScreen() {
  const nav = useNavigation<any>();
  const { cart, cartTotal, placeOrder, showToast } = useApp();
  const items = cart;

  const [addrId, setAddrId] = useState('a1');
  const [addrOpen, setAddrOpen] = useState(false);
  const [coupon, setCoupon] = useState(false);
  const [useReward, setUseReward] = useState(false);
  const [tryBuy, setTryBuy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState('upi');

  const addr = ADDRESSES.find((a) => a.id === addrId)!;
  const pay = PAYMENTS.find((p) => p.id === payId)!;

  const subtotal = cartTotal || items.reduce((s, it) => s + it.price * it.qty, 0);
  const mrpSavings = items.reduce((s, it) => s + Math.max(0, it.original - it.price) * it.qty, 0);
  const couponOff = coupon ? 50 : 0;
  const rewardOff = useReward ? Math.min(REWARD_BALANCE, Math.max(0, subtotal - couponOff)) : 0;
  const deliveryFee = 99; // Express delivery — paid
  const tryBuyFee = tryBuy ? 99 : 0; // Try & Buy add-on (toggle)
  const total = Math.max(0, subtotal - couponOff - rewardOff + deliveryFee + tryBuyFee);
  const totalSavings = mrpSavings + couponOff + rewardOff;

  const placeIt = () => {
    placeOrder({ method: tryBuy ? 'tryandbuy' : 'express' });
    setPayOpen(false);
    setTimeout(() => nav.navigate('OrderSuccess'), 240);
  };

  const Row = ({ k, v, neg, bold }: { k: string; v: string; neg?: boolean; bold?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 }}>
      <Text style={bold ? { fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink } : [T.body, { color: C.dim }]}>{k}</Text>
      <Text style={bold ? { fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink } : { fontFamily: 'Inter_700Bold', fontSize: 13, color: neg ? C.ink : C.ink }}>{v}</Text>
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
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(20), color: C.ink, letterSpacing: -0.5 }}>REVIEW ORDER</Text>
      </View>
      <View style={{ height: 1, backgroundColor: C.ink }} />

      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}>
          <Feather name="shopping-bag" size={40} color={C.dim} />
          <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>Your bag is empty.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
            {/* DELIVERY ADDRESS */}
            <Text style={[T.label, { marginBottom: 8 }]}>DELIVER TO</Text>
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: C.ink }}>
                    <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{addr.label}</Text>
                  </View>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink }}>{addr.name}</Text>
                </View>
                <Pressable onPress={() => setAddrOpen((v) => !v)} hitSlop={8}>
                  <Text style={[T.monoB, { fontSize: 10 }]}>{addrOpen ? 'CLOSE' : 'CHANGE'}</Text>
                </Pressable>
              </View>
              <Text style={[T.body, { color: C.inkSoft, marginTop: 6 }]}>{addr.addr}</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>{addr.phone}</Text>
            </View>
            {/* Inline address picker */}
            {addrOpen && (
              <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }} style={{ marginTop: SP.s, gap: SP.s }}>
                {ADDRESSES.map((a) => {
                  const sel = a.id === addrId;
                  return (
                    <Pressable key={a.id} onPress={() => { setAddrId(a.id); setAddrOpen(false); }} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: sel ? C.ink : C.white }, BORDER(1)]}>
                      <Feather name={sel ? 'check-circle' : 'circle'} size={16} color={sel ? C.white : C.dim} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: sel ? C.white : C.ink }}>{a.label}</Text>
                        <Text style={[T.mono, { fontSize: 9, color: sel ? C.white : C.dim, marginTop: 2 }]} numberOfLines={1}>{a.addr}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </MotiView>
            )}

            {/* DELIVERY — Express by default; Try & Buy is an optional add-on */}
            <Text style={[T.label, { marginTop: SP.xl, marginBottom: 8 }]}>DELIVERY</Text>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.ink }, BORDER(1)]}>
              <Feather name="zap" size={16} color={C.white} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.white }}>Express · 60 min</Text>
                <Text style={[T.mono, { color: C.white, fontSize: 9, marginTop: 2, opacity: 0.8 }]}>From your nearest store</Text>
              </View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.white }}>₹99</Text>
            </View>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.s, backgroundColor: C.white }, BORDER(1)]}>
              <Feather name="home" size={16} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyB, { fontSize: 13 }]}>Try & Buy</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 1 }]}>Try at home first · keep what you love · +₹99</Text>
              </View>
              <Toggle on={tryBuy} onPress={() => setTryBuy((v) => !v)} />
            </View>

            {/* ITEMS — read-only, no qty controls */}
            <Text style={[T.label, { marginTop: SP.xl, marginBottom: 8 }]}>{`YOUR ITEMS · ${items.length}`}</Text>
            <View style={[{ backgroundColor: C.white }, BORDER(1)]}>
              {items.map((it, i) => (
                <View key={it.id + '-' + i} style={{ flexDirection: 'row', gap: SP.m, padding: SP.m, borderTopWidth: i > 0 ? 1 : 0, borderColor: C.hairline }}>
                  <View style={[{ width: 64, height: 80, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
                    <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.monoB, { fontSize: 9 }]} numberOfLines={1}>{it.brand}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink, marginTop: 1 }} numberOfLines={1}>{it.name}</Text>
                    <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>{`Size ${it.size}  ·  Qty ${it.qty}`}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>₹{it.price * it.qty}</Text>
                      {it.original > it.price && <Text style={[T.body, { color: C.dim, textDecorationLine: 'line-through', fontSize: 11 }]}>₹{it.original * it.qty}</Text>}
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* COUPON */}
            <Pressable onPress={() => setCoupon((v) => !v)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Feather name="tag" size={16} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyB, { fontSize: 13 }]}>{coupon ? 'TRENDZO50 applied' : 'Apply coupon'}</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 1 }]}>{coupon ? 'You saved ₹50' : 'Save ₹50 with TRENDZO50'}</Text>
              </View>
              <View style={[{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: coupon ? C.ink : C.white }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: coupon ? C.white : C.ink }}>{coupon ? 'REMOVE' : 'APPLY'}</Text>
              </View>
            </Pressable>

            {/* MYTRENDZ REWARDS */}
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Feather name="award" size={16} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyB, { fontSize: 13 }]}>MyTrendz Rewards</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 1 }]}>{`Use ${REWARD_BALANCE} pts · saves ₹${REWARD_BALANCE}`}</Text>
              </View>
              <Toggle on={useReward} onPress={() => setUseReward((v) => !v)} />
            </View>

            {/* PRICE DETAILS */}
            <Text style={[T.label, { marginTop: SP.xl, marginBottom: 4 }]}>PRICE DETAILS</Text>
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Row k="Item total" v={`₹${subtotal + mrpSavings}`} />
              {mrpSavings > 0 && <Row k="Discount on MRP" v={`− ₹${mrpSavings}`} neg />}
              {couponOff > 0 && <Row k="Coupon (TRENDZO50)" v={`− ₹${couponOff}`} neg />}
              {rewardOff > 0 && <Row k="MyTrendz Rewards" v={`− ₹${rewardOff}`} neg />}
              <Row k="Delivery (Express)" v={`₹${deliveryFee}`} />
              {tryBuyFee > 0 && <Row k="Try & Buy" v={`₹${tryBuyFee}`} />}
              <View style={{ height: 1, backgroundColor: C.ink, marginVertical: 4 }} />
              <Row k="Total amount" v={`₹${total}`} bold />
            </View>

            {/* SAVINGS BANNER */}
            {totalSavings > 0 && (
              <View style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: C.ink }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.white, letterSpacing: 0.3 }}>{`You're saving ₹${totalSavings} on this order`}</Text>
              </View>
            )}
          </ScrollView>

          {/* STICKY CONFIRM & PAY */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: SP.m, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.ink, paddingHorizontal: SP.l, paddingTop: SP.m, paddingBottom: 28 }}>
            <View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(20), color: C.ink }}>₹{total}</Text>
              {totalSavings > 0 && <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>saved ₹{totalSavings}</Text>}
            </View>
            <Pressable onPress={() => setPayOpen(true)} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.white, letterSpacing: 0.5 }}>CONFIRM & PAY</Text>
              <Feather name="arrow-right" size={16} color={C.white} />
            </Pressable>
          </View>
        </>
      )}

      {/* PAYMENT POPUP — change COD / card / UPI here, then pay */}
      <Modal transparent visible={payOpen} animationType="none" onRequestClose={() => setPayOpen(false)}>
        <Pressable onPress={() => setPayOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <MotiView
            from={{ translateY: 500 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            onStartShouldSetResponder={() => true}
            style={{ backgroundColor: C.bg, paddingTop: SP.m, paddingHorizontal: SP.l, paddingBottom: 32, borderTopWidth: 2, borderColor: C.ink }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 4, backgroundColor: C.ink, marginBottom: SP.m }} />
            <Text style={[T.monoB, { fontSize: 10, color: C.dim }]}>PAYMENT METHOD</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(22), color: C.ink, letterSpacing: -0.5, marginTop: 2 }}>How are you paying?</Text>

            <View style={{ marginTop: SP.m, gap: SP.s }}>
              {PAYMENTS.map((p) => {
                const sel = p.id === payId;
                return (
                  <Pressable key={p.id} onPress={() => setPayId(p.id)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: SP.m, backgroundColor: sel ? C.ink : C.white }, BORDER(1)]}>
                    <Feather name={p.icon as any} size={18} color={sel ? C.white : C.ink} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: sel ? C.white : C.ink }}>{p.label}</Text>
                      <Text style={[T.mono, { fontSize: 9, color: sel ? C.white : C.dim, marginTop: 2 }]}>{p.sub}</Text>
                    </View>
                    <Feather name={sel ? 'check-circle' : 'circle'} size={16} color={sel ? C.white : C.dim} />
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={placeIt} style={[{ marginTop: SP.l, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.white, letterSpacing: 0.5 }}>{pay.id === 'cod' ? `PLACE ORDER · ₹${total}` : `PAY ₹${total}`}</Text>
              <Feather name="arrow-right" size={17} color={C.white} />
            </Pressable>
          </MotiView>
        </Pressable>
      </Modal>
    </View>
  );
}
