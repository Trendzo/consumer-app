import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalStatusBar } from '../components/Brutal';

// Informational sections — how Trendzo works (delivery, returns, refunds, try & buy, etc.)
const INFO = [
  { icon: 'zap', title: '60-Minute Delivery', body: 'Order from your nearest store and get it in under an hour. Express delivery is ₹99 — fast, tracked, door-to-door.' },
  { icon: 'rotate-ccw', title: 'Returns & Exchanges', body: 'Easy 7-day returns on everything. Request a return from your order and we pick it up from your door — no questions asked.' },
  { icon: 'credit-card', title: 'Refunds', body: 'Refunds are processed within 3–5 business days to your original payment method. Trendzo Wallet refunds are instant.' },
  { icon: 'home', title: 'Try & Buy', body: 'The courier waits up to 15 minutes while you try your order on. Keep what fits, hand back the rest on the spot — pay only for what you keep.' },
  { icon: 'map', title: 'Store Pickup', body: 'Reserve online and collect from a store near you in ~45 minutes, with zero delivery fee.' },
  { icon: 'wind', title: 'Sustainability', body: 'Every order is carbon-neutral. We use recycled packaging and partner with eco-conscious brands.' },
  { icon: 'shield', title: 'Secure Payments', body: 'UPI, cards, wallets, and Cash on Delivery — all encrypted and protected.' },
  { icon: 'message-square', title: '24×7 Support', body: 'Our CX-Bot and human team are available round the clock via chat to help with anything.' },
];

export default function AboutScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="About Trendzo" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[{ padding: SP.l, backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
          {/* faded oversized wordmark accent */}
          <Text
            ellipsizeMode="clip"
            numberOfLines={1}
            style={{ position: 'absolute', bottom: -14, right: -10, fontFamily: 'Inter_900Black', fontSize: rf(72), color: C.ink, opacity: 0.06, letterSpacing: -3 }}
          >
            TRENDZO
          </Text>
          <Text style={[T.h1, { textTransform: 'uppercase' }]}>TRENDZO</Text>
          <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>Gen-Z fashion, delivered in 60 minutes.</Text>
          <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>Everything you need to know about how Trendzo works — delivery, returns, refunds, Try & Buy and more.</Text>
        </View>

        {/* Info cards */}
        {INFO.map((it) => (
          <View key={it.title} style={[{ flexDirection: 'row', gap: 12, padding: SP.m, marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            <View style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
              <Feather name={it.icon as any} size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>{it.title}</Text>
              <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>{it.body}</Text>
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={{ alignItems: 'center', marginTop: SP.xl }}>
          <Text style={T.micro}>Trendzo · Build 1442</Text>
        </View>
      </ScrollView>
    </View>
  );
}
