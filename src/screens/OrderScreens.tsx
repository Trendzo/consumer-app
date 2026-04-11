import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';

export function OrderSuccessScreen() {
  const nav = useNavigation<any>();
  const { lastOrder } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
      <StatusBar barStyle="dark-content" />
      <MotiView from={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 160 }}>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 64, color: C.ink }}>{'[✓]'}</Text>
      </MotiView>

      <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 250 }}>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 36, color: C.ink, marginTop: 18, textAlign: 'center', letterSpacing: -1 }}>ORDER{'\n'}PLACED.</Text>
      </MotiView>

      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 450 }} style={{ marginTop: 24, alignItems: 'center' }}>
        <AsciiDivider />
        <Text style={[T.monoB, { marginTop: 10 }]}>{`> ORDER #${lastOrder?.id || 'CX' + Math.floor(Math.random() * 90000)}`}</Text>
        <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>Arriving in 47 minutes</Text>
        <AsciiDivider faint style={{ marginTop: 10 }} />
      </MotiView>

      <View style={{ marginTop: 36, gap: 10, width: '100%' }}>
        <BrutalButton label="Track order" iconRight="arrow-right" onPress={() => nav.replace('OrderTracking')} block />
        <BrutalButton label="Continue shopping" variant="outline" onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} block />
      </View>
    </View>
  );
}

const STEPS = [
  { label: 'ORDER PLACED', sub: 'Just now', icon: 'check' },
  { label: 'STORE CONFIRMED', sub: '2 min', icon: 'shopping-bag' },
  { label: 'PACKED & DISPATCHED', sub: '8 min', icon: 'package' },
  { label: 'OUT FOR DELIVERY', sub: '24 min', icon: 'truck' },
  { label: 'DELIVERED', sub: '47 min · ETA', icon: 'home' },
];

export function OrderTrackingScreen() {
  const nav = useNavigation<any>();
  const [active, setActive] = useState(2);

  useEffect(() => {
    const t = setInterval(() => setActive(a => Math.min(STEPS.length - 1, a + 1)), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Order Tracking" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
          <Text style={[T.monoB, { fontSize: 10 }]}>{'> ORDER #CX48201'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, marginTop: 6, letterSpacing: -0.5 }}>ARRIVING SOON</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>From NORTH. store · 2.4 km</Text>
          <AsciiDivider style={{ marginTop: SP.m }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
            <View>
              <Text style={[T.mono, { color: C.dim }]}>ETA</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, marginTop: 2 }}>23 MIN</Text>
            </View>
            <View>
              <Text style={[T.mono, { color: C.dim }]}>RIDER</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, marginTop: 2 }}>RAVI K.</Text>
            </View>
            <View>
              <Text style={[T.mono, { color: C.dim }]}>BIKE</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, marginTop: 2 }}>MH02</Text>
            </View>
          </View>
        </View>

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

        <BrutalButton label="Contact rider" icon="phone" variant="outline" block onPress={() => {}} style={{ marginTop: SP.l }} />
      </ScrollView>
    </View>
  );
}
