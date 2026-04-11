import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';

const MENU_GROUPS = [
  {
    title: 'ORDERS & DELIVERY',
    items: [
      { icon: 'package', label: 'My orders', sub: '3 active', screen: 'OrderTracking' },
      { icon: 'map-pin', label: 'Saved addresses', sub: '2 saved' },
      { icon: 'credit-card', label: 'Payment methods', sub: 'UPI · Cards · Wallets' },
      { icon: 'rotate-ccw', label: 'Returns', sub: 'Easy 7-day returns' },
    ],
  },
  {
    title: 'YOUR FIT',
    items: [
      { icon: 'sliders', label: 'Style preferences' },
      { icon: 'maximize', label: 'Body measurements' },
      { icon: 'camera', label: 'Virtual try-on', screen: 'TryOn' },
      { icon: 'help-circle', label: 'Style quiz', screen: 'StyleQuiz' },
    ],
  },
  {
    title: 'REWARDS',
    items: [
      { icon: 'star', label: 'Loyalty points', sub: '1,240 pts' },
      { icon: 'gift', label: 'Daily reward', sub: 'Day 7 streak', screen: 'DailyReward' },
      { icon: 'rotate-cw', label: 'Spin & win', screen: 'SpinWheel' },
      { icon: 'users', label: 'Refer & earn', sub: '₹200 per friend' },
    ],
  },
  {
    title: 'APP',
    items: [
      { icon: 'bell', label: 'Notifications', screen: 'Notifications' },
      { icon: 'globe', label: 'Language', sub: 'English' },
      { icon: 'message-square', label: 'Support' },
      { icon: 'info', label: 'About Closet×', sub: 'v4.26' },
    ],
  },
];

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const { user, signOut, favorites, cartCount, night, toggleNight } = useApp();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* USER CARD */}
        <FadeInUp>
          <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
            <View style={[{ padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
                <View style={[{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                  <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 24 }}>{(user?.name?.[0] || 'G').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.monoB, { fontSize: 9 }]}>USER_001</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.ink, marginTop: 2 }}>{(user?.name || 'Guest').toUpperCase()}</Text>
                  <Text style={[T.body, { color: C.dim, fontSize: 11 }]}>{user?.email || 'guest@closetx.app'}</Text>
                </View>
                <Pressable onPress={() => Alert.alert('Edit profile', 'Coming soon')}>
                  <Feather name="edit-2" size={16} color={C.ink} />
                </Pressable>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* STATS */}
        <FadeInUp delay={80}>
          <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, marginTop: SP.m, gap: 0 }}>
            <Stat label="ORDERS" value="12" />
            <Stat label="LOVED" value={String(favorites.length || 8)} />
            <Stat label="POINTS" value="1.2K" />
            <Stat label="STREAK" value="D7" last />
          </View>
        </FadeInUp>

        {/* MENU */}
        {MENU_GROUPS.map((g, gi) => (
          <View key={g.title} style={{ marginTop: SP.xl, paddingHorizontal: SP.l }}>
            <Text style={[T.monoB, { fontSize: 10, color: C.dim, letterSpacing: 1 }]}>{`> ${g.title}`}</Text>
            <AsciiDivider faint style={{ marginTop: 4 }} />
            <View style={[{ marginTop: 8, backgroundColor: C.white }, BORDER(1)]}>
              {g.items.map((it: any, i) => (
                <Pressable
                  key={it.label}
                  onPress={() => it.screen ? nav.navigate(it.screen) : Alert.alert(it.label, 'Coming soon')}
                  style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.m }, i < g.items.length - 1 && { borderBottomWidth: 1, borderColor: C.hairline }]}
                >
                  <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
                    <Feather name={it.icon} size={14} color={C.ink} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink }}>{it.label}</Text>
                    {it.sub && <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 1 }]}>{it.sub}</Text>}
                  </View>
                  <Feather name="chevron-right" size={16} color={C.ink} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* NIGHT MODE TOGGLE */}
        <View style={{ marginTop: SP.xl, paddingHorizontal: SP.l }}>
          <Text style={[T.monoB, { fontSize: 10, color: C.dim, letterSpacing: 1 }]}>{`> APPEARANCE`}</Text>
          <AsciiDivider faint style={{ marginTop: 4 }} />
          <Pressable
            onPress={toggleNight}
            style={[{ marginTop: 8, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', padding: SP.m }, BORDER(1)]}
          >
            <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
              <Feather name={night ? 'moon' : 'sun'} size={14} color={C.ink} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink }}>Night mode</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 1 }]}>{night ? 'On — UI dimmed' : 'Off'}</Text>
            </View>
            <View style={[{ width: 44, height: 24, justifyContent: 'center', padding: 2, backgroundColor: night ? C.ink : C.white }, BORDER(1)]}>
              <View style={{ width: 16, height: 16, backgroundColor: night ? C.white : C.ink, alignSelf: night ? 'flex-end' : 'flex-start' }} />
            </View>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          {user ? (
            <BrutalButton label="Sign out" icon="log-out" variant="outline" block onPress={() => Alert.alert('Sign out?', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Yes', onPress: signOut }])} />
          ) : (
            <BrutalButton label="Log in / Sign up" icon="log-in" block onPress={() => nav.navigate('Login')} />
          )}
          <Text style={[T.mono, { color: C.dim, textAlign: 'center', marginTop: SP.l, fontSize: 9 }]}>{'// CLOSET× · v4.26 · BUILT FOR GEN-Z'}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[{ flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.ink }, !last && { borderRightWidth: 0 }]}>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.ink, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={[T.monoB, { fontSize: 9, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}
