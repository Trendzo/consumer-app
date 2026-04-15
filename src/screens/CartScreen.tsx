import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, BrutalBox, CachedImage, FadeInUp, ProductCard, SectionHead } from '../components/Brutal';
import { useApp, DeliveryMethod } from '../state/AppState';
import { PRODUCTS } from '../data/mockData';

const TAB_BAR_HEIGHT = 72;

const METHOD_META: Record<DeliveryMethod, { label: string; icon: string; time: string; fee: number; blurb: string }> = {
  express:  { label: 'EXPRESS · 60 MIN',     icon: 'zap',     time: '60 MIN',     fee: 99, blurb: 'From your block · in under an hour' },
  standard: { label: 'STANDARD · 2-3 DAYS',  icon: 'package', time: '2-3 DAYS',   fee: 49, blurb: 'Tracked shipping · door-to-door' },
  pickup:   { label: 'INSTORE PICKUP',       icon: 'map-pin', time: 'IN STORE',   fee: 0,  blurb: 'Ready at your nearest store · free' },
};
const METHOD_ORDER: DeliveryMethod[] = ['express', 'standard', 'pickup'];

export default function CartScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { cart, updateQty, removeFromCart, updateMethod, cartTotal, cartCount, night, theme, showToast } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const checkoutBarOffset = TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom : 12);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(0);

  const apply = () => {
    if (coupon.toUpperCase() === 'NEWVIBE') {
      setApplied(500);
      showToast('Coupon applied', '₹500 off · NEWVIBE', 'tag');
    } else {
      showToast('Invalid code', 'Try NEWVIBE', 'x');
    }
  };

  // Group cart items by delivery method
  const buckets: Record<DeliveryMethod, typeof cart> = { express: [], standard: [], pickup: [] };
  cart.forEach(it => {
    const m: DeliveryMethod = (it as any).method || 'express';
    buckets[m].push(it);
  });

  // Per-bucket subtotal + fee
  const bucketSubtotal = (m: DeliveryMethod) =>
    buckets[m].reduce((s, it) => s + it.price * it.qty, 0);
  const bucketFee = (m: DeliveryMethod) => (buckets[m].length > 0 ? METHOD_META[m].fee : 0);

  // Grand totals — fees sum only for non-empty buckets
  const allFees = METHOD_ORDER.reduce((s, m) => s + bucketFee(m), 0);
  const total = Math.max(0, cartTotal - applied) + allFees;

  const checkoutBucket = (m: DeliveryMethod) => {
    // Per-bucket coupon share: discount applied proportional to this bucket's subtotal.
    const sub = bucketSubtotal(m);
    const fee = bucketFee(m);
    const couponShare = cartTotal > 0 ? Math.round((sub / cartTotal) * applied) : 0;
    const bucketTotal = Math.max(0, sub - couponShare) + fee;
    nav.navigate('Checkout', { total: bucketTotal, preMethod: m });
  };

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#000000' : '#FFFFFF' }}>
      <StatusBar barStyle={night ? 'light-content' : 'dark-content'} />
      <ScreenHeader title="Bag" />

      {cart.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
          <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 56, color: C.ink, letterSpacing: -2 }}>{'[ ]'}</Text>
          <Text style={[T.h2, { marginTop: 12 }]}>YOUR BAG IS EMPTY</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 6, textAlign: 'center' }]}>Add some fits and they'll appear here.</Text>
          <BrutalButton label="Start shopping" iconRight="arrow-right" onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} style={{ marginTop: 18 }} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: SP.xl + checkoutBarOffset }}>
            {/* Top meta */}
            <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
              <Text style={[T.mono, { color: C.dim }]}>{`> ${cartCount} ITEMS · ${METHOD_ORDER.filter(m => buckets[m].length > 0).length} DELIVERY SPLIT${METHOD_ORDER.filter(m => buckets[m].length > 0).length > 1 ? 'S' : ''}`}</Text>
              <AsciiDivider style={{ marginTop: 6 }} />
            </View>

            {/* ═══ BUCKETED SECTIONS — one block per method ═══ */}
            {METHOD_ORDER.map(m => {
              const items = buckets[m];
              if (items.length === 0) return null;
              const meta = METHOD_META[m];
              const sub = bucketSubtotal(m);
              const fee = bucketFee(m);
              const bucketLabel =
                m === 'express' ? 'Checkout · 60 MIN' :
                m === 'standard' ? 'Checkout · STANDARD' :
                'Checkout · IN STORE';
              return (
                <View key={m} style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
                  {/* Bucket header — brutalist block showing the method info */}
                  <BrutalBox solid maxRadius={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.s }}>
                    <BrutalBox maxRadius={10} border={0} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }}>
                      <Feather name={meta.icon as any} size={16} color={C.ink} />
                    </BrutalBox>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.white, letterSpacing: 0.5 }}>{meta.label}</Text>
                      <Text style={[T.mono, { fontSize: 9, color: C.white, opacity: 0.65, marginTop: 1 }]}>{`${items.length} ITEM${items.length > 1 ? 'S' : ''} · ${meta.blurb}`}</Text>
                    </View>
                    <BrutalBox maxRadius={10} border={0} style={{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.white }}>
                      <Text style={[T.monoB, { color: C.ink, fontSize: 9 }]}>{fee === 0 ? 'FREE' : `₹${fee}`}</Text>
                    </BrutalBox>
                  </BrutalBox>

                  {/* Items in this bucket */}
                  <BrutalBox maxRadius={14} style={{ marginTop: 6 }}>
                    {items.map((it, i) => (
                      <View key={it.id + it.size + m} style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: C.hairline }}>
                        <View style={s.row}>
                          <View style={[s.imgBox, BORDER(1)]}>
                            <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          </View>
                          <View style={{ flex: 1, marginLeft: SP.m }}>
                            <Text style={[T.monoB, { fontSize: 9 }]}>{it.brand}</Text>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink, marginTop: 2 }} numberOfLines={2}>{it.name}</Text>
                            <Text style={[T.mono, { color: C.dim, marginTop: 4 }]}>SIZE: {it.size}</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                              <View style={[s.qtyWrap, BORDER(1)]}>
                                <Pressable onPress={() => updateQty(it.id, it.qty - 1)} style={s.qtyBtn}><Feather name="minus" size={12} color={C.ink} /></Pressable>
                                <Text style={[T.monoB, { paddingHorizontal: 14 }]}>{it.qty}</Text>
                                <Pressable onPress={() => updateQty(it.id, it.qty + 1)} style={s.qtyBtn}><Feather name="plus" size={12} color={C.ink} /></Pressable>
                              </View>
                              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink }}>₹{it.price * it.qty}</Text>
                            </View>
                          </View>
                          <Pressable onPress={() => removeFromCart(it.id)} style={[s.removeBtn, BORDER(1)]}>
                            <Feather name="x" size={12} color={C.ink} />
                          </Pressable>
                        </View>
                        {/* Inline method switcher — move this item to another bucket */}
                        <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, paddingBottom: 10, gap: 4 }}>
                          <Text style={[T.mono, { color: C.dim, fontSize: 9, alignSelf: 'center', marginRight: 4 }]}>MOVE TO:</Text>
                          {METHOD_ORDER.filter(x => x !== m).map(x => (
                            <Pressable
                              key={x}
                              onPress={() => updateMethod(it.id, x)}
                              style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}
                            >
                              <Text style={[T.monoB, { fontSize: 8, color: C.ink, letterSpacing: 0.5 }]}>{METHOD_META[x].time}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ))}

                    {/* Per-bucket checkout footer */}
                    <View style={{ borderTopWidth: 1, borderColor: C.ink, flexDirection: 'row', alignItems: 'stretch' }}>
                      <View style={{ flex: 1, paddingHorizontal: SP.m, paddingVertical: 10, justifyContent: 'center' }}>
                        <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>SUBTOTAL · {items.length} ITEM{items.length > 1 ? 'S' : ''}</Text>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink, marginTop: 2 }}>₹{sub + fee}</Text>
                      </View>
                      <Pressable
                        onPress={() => checkoutBucket(m)}
                        style={{ paddingHorizontal: SP.l, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, borderLeftWidth: 1, borderColor: C.ink, flexDirection: 'row', gap: 6 }}
                      >
                        <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 12, letterSpacing: 0.5 }}>{bucketLabel.toUpperCase()}</Text>
                        <Feather name="arrow-right" size={14} color={C.white} />
                      </Pressable>
                    </View>
                  </BrutalBox>
                </View>
              );
            })}

            {/* COUPON */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
              <Text style={[T.label, { marginBottom: 6 }]}>{'> APPLY COUPON'}</Text>
              <View style={[{ flexDirection: 'row', alignItems: 'stretch', height: 46, overflow: 'hidden' }, BORDER(1)]}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, backgroundColor: C.white }}>
                  <Feather name="tag" size={14} color={C.ink} />
                  <TextInput
                    value={coupon}
                    onChangeText={setCoupon}
                    placeholder="TRY: NEWVIBE"
                    placeholderTextColor={C.dim}
                    autoCapitalize="characters"
                    editable={!applied}
                    style={{ flex: 1, marginLeft: 8, fontFamily: 'SpaceMono_700Bold', fontSize: 12, letterSpacing: 1, color: C.ink, padding: 0 }}
                  />
                  {coupon.length > 0 && !applied && (
                    <Pressable onPress={() => setCoupon('')} hitSlop={10}>
                      <Feather name="x" size={12} color={C.dim} />
                    </Pressable>
                  )}
                </View>
                <Pressable
                  onPress={applied ? undefined : apply}
                  disabled={!!applied}
                  style={{ paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: applied ? '#666' : C.ink, borderLeftWidth: 1, borderColor: C.ink }}
                >
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.white, letterSpacing: 0.5 }}>
                    {applied ? 'APPLIED' : 'APPLY'}
                  </Text>
                </Pressable>
              </View>
              {applied > 0 && (
                <Pressable onPress={() => { setApplied(0); setCoupon(''); }} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                  <Text style={[T.mono, { color: C.dim, textDecorationLine: 'underline', fontSize: 10 }]}>× Remove coupon</Text>
                </Pressable>
              )}
            </View>

            {/* GRAND SUMMARY */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              <AsciiDivider faint />
              <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>SUBTOTAL</Text><Text style={[T.bodyB]}>₹{cartTotal}</Text></View>
              {METHOD_ORDER.map(m => buckets[m].length > 0 && bucketFee(m) > 0 ? (
                <View key={m} style={s.sumRow}>
                  <Text style={[T.body, { color: C.dim }]}>{METHOD_META[m].label.split('·')[0].trim()} · {METHOD_META[m].time}</Text>
                  <Text style={[T.bodyB]}>₹{bucketFee(m)}</Text>
                </View>
              ) : null)}
              {applied > 0 && <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>COUPON</Text><Text style={[T.bodyB]}>−₹{applied}</Text></View>}
              <AsciiDivider />
              <View style={s.sumRow}><Text style={{ fontFamily: 'Inter_900Black', fontSize: 18 }}>TOTAL</Text><Text style={{ fontFamily: 'Inter_900Black', fontSize: 24 }}>₹{total}</Text></View>
            </View>

            {/* YOU MIGHT ALSO LIKE */}
            <SectionHead title="YOU MIGHT" emphasis="ALSO LIKE" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
              {PRODUCTS.filter(p => !cart.find(c => c.id === p.id)).slice(0, 6).map((p, i) => (
                <FadeInUp key={p.id} delay={i * 30}>
                  <ProductCard p={p} onPress={() => nav.navigate('ProductDetail', { product: p })} />
                </FadeInUp>
              ))}
            </ScrollView>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const makeS = () => StyleSheet.create({
  row: { flexDirection: 'row', padding: SP.l, alignItems: 'flex-start' },
  imgBox: { width: 90, height: 110, overflow: 'hidden', backgroundColor: C.hairline },
  qtyWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, overflow: 'hidden' },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: C.ink },
  removeBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, marginLeft: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
});
