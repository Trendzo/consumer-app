// ABOUT — editorial redesign. A faded oversized TRENDZO wordmark + tagline hero,
// then the "how Trendzo works" info as clean grey #F4F4F4 tiles with hairline
// borders and ink Feather icons — sharp corners, token typography, matching the
// new Profile / Home language. All copy and content are preserved.
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalStatusBar } from '../components/Brutal';
import { useAppConfig } from '../hooks/useAppConfig';
import { formatWindow } from '../services/appConfig';

const TILE = '#F4F4F4';

// Informational sections — how Trendzo works (delivery, returns, refunds, try & buy, etc.)
const buildInfo = (windowLabel: string, returnDays: number) => [
  { icon: 'zap', title: '60-Minute Delivery', body: 'Order from your nearest store and get it in under an hour. Express delivery is ₹99 — fast, tracked, door-to-door.' },
  { icon: 'rotate-ccw', title: 'Returns & Refunds', body: `Easy ${returnDays}-day returns on everything. Request a return from your order and we pick it up from your door — no questions asked.` },
  { icon: 'credit-card', title: 'Refunds', body: 'Refunds are processed within 3–5 business days to your original payment method. Trendzo Wallet refunds are instant.' },
  { icon: 'home', title: 'Try & Buy', body: `The courier waits up to ${windowLabel} while you try your order on. Keep what fits, hand back the rest on the spot — pay only for what you keep.` },
  { icon: 'map', title: 'Store Pickup', body: 'Reserve online and collect from a store near you in ~45 minutes, with zero delivery fee.' },
  { icon: 'wind', title: 'Sustainability', body: 'Every order is carbon-neutral. We use recycled packaging and partner with eco-conscious brands.' },
  { icon: 'shield', title: 'Secure Payments', body: 'UPI, cards, wallets, and Cash on Delivery — all encrypted and protected.' },
  { icon: 'message-square', title: '24×7 Support', body: 'Our CX-Bot and human team are available round the clock via chat to help with anything.' },
];

export default function AboutScreen() {
  const cfg = useAppConfig();
  // Trial + return windows are server config, not copy. See services/appConfig.ts.
  const INFO = React.useMemo(
    () => buildInfo(formatWindow(cfg.tryAndBuy.windowSeconds), cfg.returns.windowDays),
    [cfg],
  );
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="About Trendzo" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* ─── HERO — faded oversized wordmark + tagline ─── */}
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l, paddingBottom: SP.xl, overflow: 'hidden' }}>
          <Text
            ellipsizeMode="clip"
            numberOfLines={1}
            style={{ position: 'absolute', top: rf(8), left: 0, right: 0, fontFamily: 'Inter_900Black', fontSize: rf(72), letterSpacing: -3, color: '#F1F1F1', textTransform: 'uppercase' }}
          >
            TRENDZO
          </Text>
          <View style={{ marginTop: rf(56) }}>
            <Text style={[T.h1, { textTransform: 'uppercase' }]}>Trendzo</Text>
            <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>Gen-Z fashion, delivered in 60 minutes.</Text>
            <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>Everything you need to know about how Trendzo works — delivery, returns, refunds, Try & Buy and more.</Text>
          </View>
        </View>

        {/* ─── INFO TILES — grey #F4F4F4, ink icons ─── */}
        <View style={{ paddingHorizontal: SP.l, gap: SP.s }}>
          {INFO.map((it) => (
            <View key={it.title} style={[{ flexDirection: 'row', gap: SP.m, padding: SP.l, backgroundColor: TILE }, BORDER(1)]}>
              <Feather name={it.icon as any} size={22} color={C.ink} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[T.h3, { textTransform: 'uppercase' }]}>{it.title}</Text>
                <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>{it.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── FOOTER ─── */}
        <View style={{ alignItems: 'center', marginTop: SP.xl }}>
          <Text style={[T.micro, { color: C.dim }]}>Trendzo · Build 1442</Text>
        </View>
      </ScrollView>
    </View>
  );
}
