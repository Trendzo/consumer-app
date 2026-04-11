import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, FadeInUp, BrutalInput } from '../components/Brutal';
import { useApp } from '../state/AppState';

export default function CartScreen() {
  const nav = useNavigation<any>();
  const { cart, updateQty, removeFromCart, cartTotal, cartCount, night } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(0);

  const apply = () => {
    if (coupon.toUpperCase() === 'NEWVIBE') {
      setApplied(500);
      Alert.alert('Coupon applied', '₹500 off');
    } else {
      Alert.alert('Invalid code', 'Try NEWVIBE');
    }
  };

  const delivery = cart.length ? 49 : 0;
  const total = Math.max(0, cartTotal - applied) + delivery;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
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
          <ScrollView contentContainerStyle={{ paddingBottom: 240 }}>
            <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
              <Text style={[T.mono, { color: C.dim }]}>{`> ${cartCount} ITEMS · ARRIVING IN 60 MIN`}</Text>
              <AsciiDivider style={{ marginTop: 6 }} />
            </View>

            {cart.map((it, i) => (
              <FadeInUp key={it.id + it.size} delay={i * 30}>
                <View style={s.row}>
                  <View style={[s.imgBox, BORDER(1)]}>
                    <Image source={{ uri: it.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
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
                <View style={{ height: 1, backgroundColor: C.hairline, marginHorizontal: SP.l }} />
              </FadeInUp>
            ))}

            {/* COUPON */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              <Text style={[T.label, { marginBottom: 6 }]}>{'> APPLY COUPON'}</Text>
              <View style={{ flexDirection: 'row', gap: SP.s }}>
                <View style={{ flex: 1 }}>
                  <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12 }, BORDER(1)]}>
                    <Feather name="tag" size={14} color={C.ink} />
                    <Text style={[T.mono, { marginLeft: 8, color: C.dim }]}>TRY: NEWVIBE</Text>
                  </View>
                </View>
                <BrutalButton label={applied ? 'APPLIED' : 'APPLY'} onPress={apply} small />
              </View>
            </View>

            {/* SUMMARY */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              <AsciiDivider faint />
              <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>SUBTOTAL</Text><Text style={[T.bodyB]}>₹{cartTotal}</Text></View>
              <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>DELIVERY (60 MIN)</Text><Text style={[T.bodyB]}>₹{delivery}</Text></View>
              {applied > 0 && <View style={s.sumRow}><Text style={[T.body, { color: C.dim }]}>COUPON</Text><Text style={[T.bodyB]}>−₹{applied}</Text></View>}
              <AsciiDivider />
              <View style={s.sumRow}><Text style={{ fontFamily: 'Inter_900Black', fontSize: 18 }}>TOTAL</Text><Text style={{ fontFamily: 'Inter_900Black', fontSize: 24 }}>₹{total}</Text></View>
            </View>
          </ScrollView>

          {/* CHECKOUT BAR */}
          <View style={s.checkoutBar}>
            <AsciiDivider />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingTop: SP.m, paddingBottom: 28 }}>
              <View style={{ flex: 1 }}>
                <Text style={[T.mono, { color: C.dim }]}>TOTAL · {cartCount} ITEMS</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.ink }}>₹{total}</Text>
              </View>
              <BrutalButton label="Checkout" iconRight="arrow-right" onPress={() => nav.navigate('Checkout', { total })} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const makeS = () => StyleSheet.create({
  row: { flexDirection: 'row', padding: SP.l, alignItems: 'flex-start' },
  imgBox: { width: 90, height: 110, overflow: 'hidden', backgroundColor: '#f3f3f3' },
  qtyWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: C.ink },
  removeBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, marginLeft: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  checkoutBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg },
});
