import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalBox, CachedImage, FadeInUp, ProductCard, SectionHead } from '../components/Brutal';
import { useApp, DeliveryMethod } from '../state/AppState';
import { useTabBarScroll } from '../hooks/useTabBarScroll';
import { PRODUCTS } from '../data/mockData';
import { priceCart, toRupees, type CartPricing } from '../services/pricing';

const TAB_BAR_HEIGHT = 72;

const METHOD_META: Record<DeliveryMethod, { label: string; icon: string; time: string; fee: number; blurb: string }> = {
  express:  { label: 'Express · 60 min',     icon: 'zap',     time: '60 min',     fee: 99, blurb: 'From your block · in under an hour' },
  standard: { label: 'Standard · 2-3 days',  icon: 'package', time: '2-3 days',   fee: 49, blurb: 'Tracked shipping · door-to-door' },
  pickup:   { label: 'Instore pickup',       icon: 'map-pin', time: 'In store',   fee: 0,  blurb: 'Ready at your nearest store · free' },
};
const METHOD_ORDER: DeliveryMethod[] = ['express', 'standard', 'pickup'];

export default function CartScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { cart, updateQty, removeFromCart, updateMethod, cartTotal, cartCount, showToast, requireAuth } = useApp();
  const s = React.useMemo(() => makeS(), []);
  const tabScroll = useTabBarScroll();
  const checkoutBarOffset = TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom : 12);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(0);
  // Real server-computed totals when every line carries a backend variant id (guest-ok via
  // /pricing/cart). Falls back to the local math below for mock items or on failure.
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const allPriceable = cart.length > 0 && cart.every(it => !!it.variantId);
  useEffect(() => {
    if (!allPriceable) { setPricing(null); return; }
    let cancelled = false;
    const items = cart.map(it => ({ variantId: it.variantId as string, qty: it.qty }));
    priceCart(items).then(p => { if (!cancelled) setPricing(p); }).catch(() => { if (!cancelled) setPricing(null); });
    return () => { cancelled = true; };
  }, [cart, allPriceable]);
  const agg = pricing?.aggregate;

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
    // Route to the multi-step Checkout (address → delivery → payment → confirm).
    // Pre-select the bucket's delivery method so the flow opens on the right option.
    // Guests get the bottom-sheet login first — checkout only opens once signed in.
    requireAuth(() => nav.navigate('Checkout', { preMethod: m }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Bag" />

      {cart.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
          <Feather name="shopping-bag" size={40} color={C.dim} />
          <Text style={[T.h3, { marginTop: 14 }]}>Your bag is empty</Text>
          <Text style={[T.caption, { marginTop: 6, textAlign: 'center' }]}>Add some fits and they'll appear here.</Text>
          <BrutalButton label="Start shopping" iconRight="arrow-right" onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} style={{ marginTop: 18 }} />
        </View>
      ) : (
        <>
          <ScrollView {...tabScroll} contentContainerStyle={{ paddingBottom: SP.xl + checkoutBarOffset }}>
            {/* Top meta */}
            <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
              <Text style={[T.caption]}>{`${cartCount} items · ${METHOD_ORDER.filter(m => buckets[m].length > 0).length} delivery split${METHOD_ORDER.filter(m => buckets[m].length > 0).length > 1 ? 's' : ''}`}</Text>
            </View>

            {/* ═══ BUCKETED SECTIONS — one block per method ═══ */}
            {METHOD_ORDER.map(m => {
              const items = buckets[m];
              if (items.length === 0) return null;
              const meta = METHOD_META[m];
              const sub = bucketSubtotal(m);
              const fee = bucketFee(m);
              const bucketLabel =
                m === 'express' ? 'Checkout · 60 min' :
                m === 'standard' ? 'Checkout · Standard' :
                'Checkout · In store';
              return (
                <View key={m} style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
                  {/* Bucket header — block showing the method info */}
                  <BrutalBox style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.s }}>
                    <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }}>
                      <Feather name={meta.icon as any} size={16} color={C.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.bodyB, { color: C.ink }]}>{meta.label}</Text>
                      {m === 'express' ? (
                        <Text style={[T.micro, { color: C.dim, marginTop: 1 }]}>{`Get it by ~${40 + (items.length % 4) * 5} min`}</Text>
                      ) : (
                        <Text style={[T.micro, { color: C.dim, marginTop: 1 }]}>{`${items.length} item${items.length > 1 ? 's' : ''} · ${meta.blurb}`}</Text>
                      )}
                    </View>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F4F4F4' }}>
                      <Text style={[T.caption, { color: C.ink }]}>{fee === 0 ? 'Free' : `₹${fee}`}</Text>
                    </View>
                  </BrutalBox>

                  {/* Items in this bucket */}
                  <BrutalBox style={{ marginTop: 6 }}>
                    {items.map((it, i) => (
                      <View key={it.id + it.size + m} style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: C.hairline }}>
                        <View style={s.row}>
                          <View style={[s.imgBox, BORDER(1)]}>
                            <CachedImage source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          </View>
                          <View style={{ flex: 1, marginLeft: SP.m }}>
                            <Text style={[T.caption]}>{it.brand}</Text>
                            <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={2}>{it.name}</Text>
                            <Text style={[T.caption, { marginTop: 4 }]}>Size {it.size}</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                              <View style={[s.qtyWrap, BORDER(1)]}>
                                <Pressable onPress={() => updateQty(it.id, it.qty - 1)} style={s.qtyBtn}><Feather name="minus" size={12} color={C.ink} /></Pressable>
                                <Text style={[T.bodyB, { paddingHorizontal: 14 }]}>{it.qty}</Text>
                                <Pressable onPress={() => updateQty(it.id, it.qty + 1)} style={s.qtyBtn}><Feather name="plus" size={12} color={C.ink} /></Pressable>
                              </View>
                              <Text style={[T.price]}>₹{it.price * it.qty}</Text>
                            </View>
                          </View>
                          <Pressable onPress={() => removeFromCart(it.id)} style={[s.removeBtn, BORDER(1)]}>
                            <Feather name="x" size={12} color={C.ink} />
                          </Pressable>
                        </View>
                        {/* Inline method switcher — move this item to another bucket */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingBottom: 10, gap: 6 }}>
                          <Text style={[T.micro, { marginRight: 2 }]}>Move to</Text>
                          {METHOD_ORDER.filter(x => x !== m).map(x => (
                            <Pressable
                              key={x}
                              onPress={() => updateMethod(it.id, x)}
                              style={[{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.white }, BORDER(1)]}
                            >
                              <Text style={[T.caption, { color: C.ink }]}>{METHOD_META[x].time}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ))}

                    {/* Per-bucket checkout footer */}
                    <View style={{ borderTopWidth: 1, borderColor: C.hairline, padding: SP.m }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={[T.micro]}>Subtotal · {items.length} item{items.length > 1 ? 's' : ''}</Text>
                        <Text style={[T.h2]}>₹{sub + fee}</Text>
                      </View>
                      <BrutalButton label={bucketLabel} iconRight="arrow-right" block onPress={() => checkoutBucket(m)} />
                    </View>
                  </BrutalBox>
                </View>
              );
            })}

            {/* COUPON */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[T.caption]}>{'Apply coupon'}</Text>
                <Pressable onPress={() => nav.navigate('CouponWallet')} hitSlop={8}>
                  <Text style={[T.caption, { textDecorationLine: 'underline', color: C.ink }]}>{'View wallet'}</Text>
                </Pressable>
              </View>
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
                    style={[T.monoB, { flex: 1, marginLeft: 8, letterSpacing: 1, padding: 0 }]}
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
                  style={{ paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: applied ? '#666' : C.ink, borderLeftWidth: 1, borderColor: C.hairline }}
                >
                  <Text style={[T.button]}>
                    {applied ? 'Applied' : 'Apply'}
                  </Text>
                </Pressable>
              </View>
              {applied > 0 && (
                <Pressable onPress={() => { setApplied(0); setCoupon(''); }} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                  <Text style={[T.caption, { textDecorationLine: 'underline' }]}>× Remove coupon</Text>
                </Pressable>
              )}
            </View>

            {/* GRAND SUMMARY */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              {agg ? (
                <>
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Subtotal</Text><Text style={[T.bodyB]}>₹{toRupees(agg.itemsSubtotalPaise)}</Text></View>
                  {agg.discountPaise > 0 && <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Discount</Text><Text style={[T.bodyB]}>−₹{toRupees(agg.discountPaise)}</Text></View>}
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Delivery</Text><Text style={[T.bodyB]}>{agg.deliveryFeePaise === 0 ? 'Free' : `₹${toRupees(agg.deliveryFeePaise)}`}</Text></View>
                  <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Tax · GST</Text><Text style={[T.bodyB]}>₹{toRupees(agg.taxPaise)}</Text></View>
                  <View style={{ height: 1, backgroundColor: C.hairline }} />
                  <View style={s.sumRow}><Text style={[T.h2]}>Total</Text><Text style={[T.h1]}>₹{toRupees(agg.grandTotalPaise)}</Text></View>
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
                  {applied > 0 && <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>Coupon</Text><Text style={[T.bodyB]}>−₹{applied}</Text></View>}
                  <View style={{ height: 1, backgroundColor: C.hairline }} />
                  <View style={s.sumRow}><Text style={[T.h2]}>Total</Text><Text style={[T.h1]}>₹{total}</Text></View>
                </>
              )}
            </View>

            {/* YOU MIGHT ALSO LIKE */}
            <SectionHead title="You might" emphasis="Also like" />
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
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: C.hairline },
  removeBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, marginLeft: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
});
