import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';

const ADDRESSES = [
  { id: 'a1', label: 'HOME', name: 'You', addr: 'D-204, Block A, Andheri West, Mumbai 400058', phone: '+91 98xxx xxx21' },
  { id: 'a2', label: 'OFFICE', name: 'You', addr: '12 Floor, Bandra Kurla Complex, Mumbai 400051', phone: '+91 98xxx xxx21' },
];

const PAYMENTS = [
  { id: 'p1', icon: 'smartphone', label: 'UPI', sub: 'pay@okhdfcbank' },
  { id: 'p2', icon: 'credit-card', label: 'Card', sub: '•••• 4242' },
  { id: 'p3', icon: 'dollar-sign', label: 'COD', sub: 'Cash on delivery' },
  { id: 'p4', icon: 'package', label: 'Wallet', sub: '₹1,240 balance' },
];

export default function CheckoutScreen() {
  const nav = useNavigation<any>();
  const { cart, cartTotal, placeOrder, night } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const [addr, setAddr] = useState('a1');
  const [pay, setPay] = useState('p1');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const total = cartTotal || 2499;

  const handlePlace = () => {
    placeOrder();
    nav.replace('OrderSuccess');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title={`Checkout · 0${step}/03`} onBack={() => nav.goBack()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: SP.l, paddingBottom: 200, paddingTop: SP.l }}>
        {/* PROGRESS */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[{ flex: 1, height: 8, backgroundColor: i <= step ? C.ink : C.white }, BORDER(1)]} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={[T.mono, { fontSize: 9 }]}>ADDRESS</Text>
          <Text style={[T.mono, { fontSize: 9 }]}>PAYMENT</Text>
          <Text style={[T.mono, { fontSize: 9 }]}>CONFIRM</Text>
        </View>

        {step === 1 && (
          <FadeInUp>
            <Text style={[T.h2, { marginTop: SP.xl }]}>{'▌ DELIVERY ADDRESS'}</Text>
            <AsciiDivider faint style={{ marginTop: 4 }} />
            {ADDRESSES.map(a => (
              <Pressable key={a.id} onPress={() => setAddr(a.id)} style={[{ marginTop: SP.m, padding: SP.m, backgroundColor: addr === a.id ? C.ink : C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.monoB, { fontSize: 10, color: addr === a.id ? C.white : C.ink }]}>{`[${a.label}]`}</Text>
                  {addr === a.id && <Feather name="check" size={14} color={C.white} />}
                </View>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: addr === a.id ? C.white : C.ink, marginTop: 6 }}>{a.name}</Text>
                <Text style={[T.body, { color: addr === a.id ? C.white : C.dim, marginTop: 2 }]}>{a.addr}</Text>
                <Text style={[T.mono, { color: addr === a.id ? C.white : C.dim, marginTop: 4 }]}>{a.phone}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => Alert.alert('Add address', 'Coming soon')} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }, BORDER(1)]}>
              <Feather name="plus" size={14} color={C.ink} />
              <Text style={[T.monoB]}>ADD NEW ADDRESS</Text>
            </Pressable>
          </FadeInUp>
        )}

        {step === 2 && (
          <FadeInUp>
            <Text style={[T.h2, { marginTop: SP.xl }]}>{'▌ PAYMENT METHOD'}</Text>
            <AsciiDivider faint style={{ marginTop: 4 }} />
            {PAYMENTS.map(p => (
              <Pressable key={p.id} onPress={() => setPay(p.id)} style={[{ marginTop: SP.m, padding: SP.m, flexDirection: 'row', alignItems: 'center', backgroundColor: pay === p.id ? C.ink : C.white }, BORDER(1)]}>
                <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, BORDER(1), { borderColor: pay === p.id ? C.white : C.ink }]}>
                  <Feather name={p.icon as any} size={16} color={pay === p.id ? C.white : C.ink} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: pay === p.id ? C.white : C.ink }}>{p.label.toUpperCase()}</Text>
                  <Text style={[T.mono, { color: pay === p.id ? C.white : C.dim, fontSize: 10 }]}>{p.sub}</Text>
                </View>
                {pay === p.id && <Feather name="check" size={16} color={C.white} />}
              </Pressable>
            ))}
          </FadeInUp>
        )}

        {step === 3 && (
          <FadeInUp>
            <Text style={[T.h2, { marginTop: SP.xl }]}>{'▌ CONFIRM ORDER'}</Text>
            <AsciiDivider faint style={{ marginTop: 4 }} />
            <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={[T.monoB, { fontSize: 10 }]}>{'> ORDER SUMMARY'}</Text>
              <AsciiDivider style={{ marginTop: 6 }} />
              <View style={s.row}><Text style={[T.body, { color: C.dim }]}>ITEMS ({cart.length || 1})</Text><Text style={T.bodyB}>₹{total}</Text></View>
              <View style={s.row}><Text style={[T.body, { color: C.dim }]}>DELIVERY (60 MIN)</Text><Text style={T.bodyB}>₹49</Text></View>
              <View style={s.row}><Text style={[T.body, { color: C.dim }]}>TAX</Text><Text style={T.bodyB}>₹{Math.round(total * 0.05)}</Text></View>
              <AsciiDivider />
              <View style={s.row}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16 }}>TOTAL</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22 }}>₹{total + 49 + Math.round(total * 0.05)}</Text>
              </View>
            </View>

            <View style={[{ marginTop: SP.m, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 12 }, BORDER(1)]}>
              <Feather name="zap" size={18} color={C.ink} />
              <View>
                <Text style={T.bodyB}>ARRIVES IN 47 MINUTES</Text>
                <Text style={[T.mono, { color: C.dim }]}>FROM NORTH. STORE · 2.4 KM</Text>
              </View>
            </View>
          </FadeInUp>
        )}
      </ScrollView>

      {/* BOTTOM */}
      <View style={s.bottom}>
        <View style={{ height: 1, backgroundColor: C.ink }} />
        <View style={{ padding: SP.m, paddingBottom: 28, flexDirection: 'row', gap: SP.s }}>
          {step > 1 && <BrutalButton label="Back" icon="arrow-left" variant="outline" onPress={() => setStep((step - 1) as any)} />}
          {step < 3 ? (
            <BrutalButton label="Continue" iconRight="arrow-right" onPress={() => setStep((step + 1) as any)} style={{ flex: 1 }} />
          ) : (
            <BrutalButton label="Place order" iconRight="check" onPress={handlePlace} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </View>
  );
}

const makeS = () => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg },
});
