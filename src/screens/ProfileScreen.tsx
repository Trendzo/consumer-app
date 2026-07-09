import React from 'react';
import { View, Text, ScrollView, Pressable, StatusBar, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, BrutalBox, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';

const MENU_GROUPS = [
  {
    code: '01',
    title: 'ORDERS & DELIVERY',
    intro: 'Track your orders, returns and addresses.',
    items: [
      { icon: 'package', label: 'My orders', sub: 'View + track your order history', screen: 'OrderHistory' },
      { icon: 'rotate-ccw', label: 'Returns', sub: 'Return an item · reverse pickup', screen: 'OrderReturn' },
      { icon: 'map-pin', label: 'Addresses', sub: 'Manage delivery addresses', screen: 'SavedAddresses' },
    ],
  },
  {
    code: '02',
    title: 'MONEY & REWARDS',
    intro: 'Wallet, loyalty, referrals.',
    items: [
      { icon: 'briefcase', label: 'Wallet', sub: 'Balance + redeem gift cards', screen: 'Wallet' },
      { icon: 'award', label: 'Loyalty & rewards', sub: 'Your points and tier', screen: 'LoyaltyRewards' },
      { icon: 'users', label: 'Refer & earn', sub: 'Share your code, earn points', screen: 'ReferralRewards' },
      { icon: 'gift', label: 'Gift cards', sub: 'Redeem a gift card', screen: 'GiftCard' },
    ],
  },
  {
    code: '03',
    title: 'APP & ACCOUNT',
    intro: 'Preferences and support.',
    items: [
      { icon: 'settings', label: 'Notification settings', sub: 'Push, email, deals', screen: 'NotificationSettings' },
      { icon: 'message-square', label: 'Customer support', sub: 'Get help with an order', screen: 'CustomerSupport' },
      { icon: 'info', label: 'About Trendzo', sub: 'Delivery, returns, refunds & more', screen: 'About' },
    ],
  },
];

const PROFILE_TIERS: Array<{ name: string; min: number }> = [
  { name: 'BRONZE', min: 0 },
  { name: 'SILVER', min: 1000 },
  { name: 'GOLD', min: 5000 },
  { name: 'PLATINUM', min: 10000 },
];

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const { user, loyalty, signOut, cartCount, night, toggleNight, showToast, showConfirm } = useApp();
  const initials = ((user?.name || 'Guest').split(' ').map(s => s[0]).join('').slice(0, 2) || 'G').toUpperCase();
  const points = loyalty?.balancePoints ?? 0;
  const tier = PROFILE_TIERS.filter(t => points >= t.min).pop()!;
  const nextTier = PROFILE_TIERS[PROFILE_TIERS.indexOf(tier) + 1];
  const tierPct = nextTier ? Math.min(100, Math.round((points / nextTier.min) * 100)) : 100;
  const pointsShort = points >= 1000 ? `${(points / 1000).toFixed(1)}K` : String(points);

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#000000' : '#FFFFFF' }}>
      <StatusBar barStyle={night ? 'light-content' : 'dark-content'} />
      <ScreenHeader title="Profile" right={
        <Pressable onPress={() => nav.navigate('Notifications')}>
          <BrutalBox maxRadius={18} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="bell" size={14} color={C.ink} />
          </BrutalBox>
        </Pressable>
      } />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>

        {/* ─── HERO CARD ─── */}
        <FadeInUp>
          <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
            <BrutalBox solid padded maxRadius={20}>
              <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.55 }]}>{`TRENDZO`}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m, marginTop: SP.m }}>
                <BrutalBox maxRadius={36} style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Inter_900Black', color: C.ink, fontSize: rf(26), letterSpacing: -1 }}>{initials}</Text>
                </BrutalBox>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(24), color: C.white, letterSpacing: -0.8, lineHeight: rf(26) }}>
                    {(user?.name || 'GUEST USER').toUpperCase()}
                  </Text>
                  <Text style={[T.mono, { color: C.white, fontSize: 10, opacity: 0.7, marginTop: 2 }]}>{user?.email || 'guest@trendzo.app'}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <BrutalBox maxRadius={10} border={0} style={{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.white }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: C.ink, letterSpacing: 0.6 }}>{tier.name}</Text>
                    </BrutalBox>
                    <BrutalBox maxRadius={10} transparent style={{ paddingHorizontal: 6, paddingVertical: 3, borderColor: C.white }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: C.white, letterSpacing: 0.6 }}>{points.toLocaleString('en-IN')} PTS</Text>
                    </BrutalBox>
                  </View>
                </View>
                <Pressable onPress={() => nav.navigate('EditProfile')}>
                  <BrutalBox maxRadius={18} border={0} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="edit-2" size={14} color={C.ink} />
                  </BrutalBox>
                </Pressable>
              </View>

              {/* Progress strip */}
              <View style={{ marginTop: SP.l }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.7 }]}>{nextTier ? `${tier.name} → ${nextTier.name}` : `${tier.name} · MAX`}</Text>
                  <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.7 }]}>{nextTier ? `${points.toLocaleString('en-IN')} / ${nextTier.min.toLocaleString('en-IN')}` : `${points.toLocaleString('en-IN')} PTS`}</Text>
                </View>
                <View style={{ marginTop: 6, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                  <View style={{ width: `${tierPct}%`, height: '100%', backgroundColor: C.white }} />
                </View>
              </View>
            </BrutalBox>
          </View>
        </FadeInUp>

        {/* ─── STATS ROW (bento) — single curved container, internal dividers ─── */}
        <FadeInUp delay={80}>
          <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
            <BrutalBox maxRadius={14} style={{ flexDirection: 'row' }}>
              <Stat label="POINTS" value={pointsShort} sub={tier.name} />
              <Stat label="TIER" value={tier.name.slice(0, 4)} sub={nextTier ? `${tierPct}%` : 'MAX'} />
              <Stat label="ORDERS" value="—" sub="HISTORY" last />
            </BrutalBox>
          </View>
        </FadeInUp>

        {/* ─── MENU GROUPS ─── */}
        {MENU_GROUPS.map((g, gi) => (
          <FadeInUp key={g.title} delay={200 + gi * 40}>
            <View style={{ marginTop: SP.xl, paddingHorizontal: SP.l }}>
              <Text style={[T.label, { fontSize: 11, color: C.dim }]}>{g.title}</Text>
              <AsciiDivider faint style={{ marginTop: 6 }} />
              <BrutalBox maxRadius={16} style={{ marginTop: 8 }}>
                {g.items.map((it: any, i) => (
                  <Pressable
                    key={it.label}
                    onPress={() => it.screen ? nav.navigate(it.screen) : showToast(it.label, 'Coming soon')}
                    style={[
                      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: SP.m },
                      i < g.items.length - 1 && { borderBottomWidth: 1, borderColor: C.hairline },
                    ]}
                  >
                    <BrutalBox maxRadius={18} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name={it.icon} size={14} color={C.ink} />
                    </BrutalBox>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink }}>{it.label}</Text>
                      {it.sub && <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 2 }]}>{it.sub}</Text>}
                    </View>
                    <Text style={[T.mono, { color: C.dim, fontSize: 9, marginRight: 8 }]}>{String(i + 1).padStart(2, '0')}</Text>
                    <Feather name="chevron-right" size={16} color={C.ink} />
                  </Pressable>
                ))}
              </BrutalBox>
            </View>
          </FadeInUp>
        ))}

        {/* ─── APPEARANCE ─── */}
        <FadeInUp delay={400}>
          <View style={{ marginTop: SP.xl, paddingHorizontal: SP.l }}>
            <Text style={[T.label, { fontSize: 11, color: C.dim }]}>APPEARANCE</Text>
            <AsciiDivider faint style={{ marginTop: 6 }} />
            <Pressable onPress={toggleNight}>
              <BrutalBox maxRadius={16} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', padding: SP.m, backgroundColor: C.white }}>
                <BrutalBox maxRadius={18} solid={night} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={night ? 'moon' : 'sun'} size={14} color={night ? C.white : C.ink} />
                </BrutalBox>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink }}>Night mode</Text>
                  <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 2 }]}>{night ? 'ON · UI dimmed, easy on eyes' : 'OFF · bright & brutal'}</Text>
                </View>
                <BrutalBox maxRadius={12} solid={night} style={{ width: 44, height: 24, justifyContent: 'center', padding: 2 }}>
                  <BrutalBox maxRadius={8} border={0} style={{ width: 16, height: 16, backgroundColor: night ? C.white : C.ink, alignSelf: night ? 'flex-end' : 'flex-start' }} />
                </BrutalBox>
              </BrutalBox>
            </Pressable>
          </View>
        </FadeInUp>

        {/* ─── SIGN OUT / LOG IN ─── */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          {user ? (
            <BrutalButton
              label="Sign out"
              icon="log-out"
              variant="outline"
              block
              onPress={() => showConfirm({
                title: 'Sign out?',
                msg: "You'll need to log in again to access your bag and orders.",
                confirmLabel: 'Sign out', cancelLabel: 'Stay', danger: true, icon: 'log-out',
                onConfirm: signOut,
              })}
            />
          ) : (
            <BrutalButton label="Log in / Sign up" icon="log-in" block onPress={() => nav.navigate('Login')} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, sub, last }: { label: string; value: string; sub?: string; last?: boolean }) {
  return (
    <View
      style={[
        { flex: 1, paddingVertical: SP.m, alignItems: 'center' },
        !last && { borderRightWidth: 1, borderColor: C.ink },
      ]}
    >
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(22), color: C.ink, letterSpacing: -0.8 }}>{value}</Text>
      <Text style={[T.monoB, { fontSize: 9, marginTop: 2 }]}>{label}</Text>
      {sub && <Text style={[T.mono, { fontSize: 8, color: C.dim, marginTop: 1 }]}>{sub}</Text>}
    </View>
  );
}
