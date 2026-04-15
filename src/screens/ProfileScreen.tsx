import React from 'react';
import { View, Text, ScrollView, Pressable, StatusBar, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, BrutalBox, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';

const QUICK = [
  { icon: 'package', label: 'ORDERS', sub: 'HISTORY', screen: 'OrderHistory' },
  { icon: 'home', label: 'TRY&BUY', sub: '15-MIN', screen: 'TryAndBuy' },
  { icon: 'map', label: 'PICKUP', sub: '3 NEAR', screen: 'StorePickup' },
  { icon: 'rotate-ccw', label: 'RETURNS', sub: '7-DAY', screen: 'OrderReturn' },
];

const MENU_GROUPS = [
  {
    code: '01',
    title: 'ORDERS & DELIVERY',
    intro: 'Track, return, pickup or try at home.',
    items: [
      { icon: 'package', label: 'My orders', sub: '6 total · tap to view history', screen: 'OrderHistory' },
      { icon: 'map-pin', label: 'Saved addresses', sub: '2 saved · HOME · OFFICE', screen: 'SavedAddresses' },
      { icon: 'credit-card', label: 'Payment methods', sub: 'UPI · Cards · Wallets', screen: 'PaymentMethods' },
      { icon: 'rotate-ccw', label: 'Returns & exchanges', sub: 'Easy 7-day returns · pickup from door', screen: 'OrderReturn' },
      { icon: 'map', label: 'Store pickup', sub: '3 stores nearby · zero delivery fee', screen: 'StorePickup' },
      { icon: 'home', label: 'Try & Buy', sub: 'Courier waits 15 min · pay for what fits', screen: 'TryAndBuy' },
    ],
  },
  {
    code: '02',
    title: 'YOUR FIT · STYLE DNA',
    intro: 'Personalize your feed, your fit, your vibe.',
    items: [
      { icon: 'sliders', label: 'Style preferences', sub: 'MINIMAL · STREET · +1 more', screen: 'StylePreferences' },
      { icon: 'maximize', label: 'Body measurements', sub: 'H 175 · C 96 · W 82', screen: 'Measurement' },
      { icon: 'camera', label: 'Virtual try-on', sub: 'AR mirror · works on photos too', screen: 'TryOn' },
      { icon: 'help-circle', label: 'Style quiz', sub: 'Refresh your Style DNA in 60 sec', screen: 'StyleQuiz' },
    ],
  },
  {
    code: '03',
    title: 'REWARDS & STREAKS',
    intro: 'The more you shop, the more you earn.',
    items: [
      { icon: 'star', label: 'Loyalty points', sub: '1,240 pts · BRONZE tier', screen: 'LoyaltyRewards' },
      { icon: 'gift', label: 'Daily reward', sub: 'Day 7 streak · keep it going', screen: 'DailyReward' },
      { icon: 'rotate-cw', label: 'Spin & win', sub: '1 free spin today', screen: 'SpinWheel' },
      { icon: 'users', label: 'Refer & earn', sub: '₹200 per friend · CLOSETX42', screen: 'ReferralRewards' },
    ],
  },
  {
    code: '04',
    title: 'MORE FROM CLOSET×',
    intro: 'Extras, insights, and the bigger picture.',
    items: [
      { icon: 'gift', label: 'Gift card', sub: 'Buy, send, redeem', screen: 'GiftCard' },
      { icon: 'calendar', label: 'Fashion calendar', sub: 'Upcoming drops & sales', screen: 'FashionCalendar' },
      { icon: 'wind', label: 'Sustainability', sub: 'Our eco-mode · carbon neutral', screen: 'Sustainability' },
      { icon: 'message-square', label: 'Your reviews', sub: '6 posted · rank: HELPFUL', screen: 'Reviews' },
    ],
  },
  {
    code: '05',
    title: 'APP & ACCOUNT',
    intro: 'Preferences, alerts, and the fine print.',
    items: [
      { icon: 'bell', label: 'Notifications', sub: 'Tap to see inbox', screen: 'Notifications' },
      { icon: 'settings', label: 'Notification settings', sub: 'Push, email, deals', screen: 'NotificationSettings' },
      { icon: 'globe', label: 'Language', sub: 'English · 8 languages', screen: 'Language' },
      { icon: 'message-square', label: 'Customer support', sub: '24×7 chat · CX-Bot v2', screen: 'CustomerSupport' },
      { icon: 'info', label: 'About Closet×', sub: 'v4.26 · build 1442' },
    ],
  },
];

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const { user, signOut, cartCount, night, toggleNight, showToast, showConfirm } = useApp();
  const initials = ((user?.name || 'Guest').split(' ').map(s => s[0]).join('').slice(0, 2) || 'G').toUpperCase();

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
              <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.55 }]}>{`> CLOSETX // PROFILE_v4.26`}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m, marginTop: SP.m }}>
                <BrutalBox maxRadius={36} style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Inter_900Black', color: C.ink, fontSize: 26, letterSpacing: -1 }}>{initials}</Text>
                </BrutalBox>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 24, color: C.white, letterSpacing: -0.8, lineHeight: 26 }}>
                    {(user?.name || 'GUEST USER').toUpperCase()}
                  </Text>
                  <Text style={[T.mono, { color: C.white, fontSize: 10, opacity: 0.7, marginTop: 2 }]}>{user?.email || 'guest@closetx.app'}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <BrutalBox maxRadius={10} border={0} style={{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.white }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: C.ink, letterSpacing: 0.6 }}>BRONZE</Text>
                    </BrutalBox>
                    <BrutalBox maxRadius={10} transparent style={{ paddingHorizontal: 6, paddingVertical: 3, borderColor: C.white }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: C.white, letterSpacing: 0.6 }}>D7 STREAK</Text>
                    </BrutalBox>
                  </View>
                </View>
                <Pressable onPress={() => showToast('Edit profile', 'Coming soon', 'edit-2')}>
                  <BrutalBox maxRadius={18} border={0} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="edit-2" size={14} color={C.ink} />
                  </BrutalBox>
                </Pressable>
              </View>

              {/* Progress strip */}
              <View style={{ marginTop: SP.l }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.7 }]}>BRONZE → SILVER</Text>
                  <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.7 }]}>1,240 / 5,000</Text>
                </View>
                <View style={{ marginTop: 6, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                  <View style={{ width: '24%', height: '100%', backgroundColor: C.white }} />
                </View>
              </View>
            </BrutalBox>
          </View>
        </FadeInUp>

        {/* ─── STATS ROW (bento) — single curved container, internal dividers ─── */}
        <FadeInUp delay={80}>
          <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
            <BrutalBox maxRadius={14} style={{ flexDirection: 'row' }}>
              <Stat label="ORDERS" value="12" sub="LIFETIME" />
              <Stat label="POINTS" value="1.2K" sub="BRONZE" />
              <Stat label="STREAK" value="D7" sub="DAILY" />
              <Stat label="REVIEWS" value="6" sub="POSTED" last />
            </BrutalBox>
          </View>
        </FadeInUp>

        {/* ─── QUICK ACTIONS — single curved container, internal dividers ─── */}
        <FadeInUp delay={120}>
          <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
            <Text style={[T.monoB, { fontSize: 10, color: C.dim, letterSpacing: 1 }]}>{`> QUICK ACCESS`}</Text>
            <AsciiDivider faint style={{ marginTop: 4 }} />
            <BrutalBox maxRadius={14} style={{ flexDirection: 'row', marginTop: 8 }}>
              {QUICK.map((q, i) => (
                <Pressable
                  key={q.label}
                  onPress={() => nav.navigate(q.screen)}
                  style={[
                    { flex: 1, paddingVertical: 14, alignItems: 'center' },
                    i < QUICK.length - 1 && { borderRightWidth: 1, borderColor: C.ink },
                  ]}
                >
                  <Feather name={q.icon as any} size={18} color={C.ink} />
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: C.ink, marginTop: 6, letterSpacing: 0.5 }}>{q.label}</Text>
                  <Text style={[T.mono, { color: C.dim, fontSize: 8, marginTop: 1 }]}>{q.sub}</Text>
                </Pressable>
              ))}
            </BrutalBox>
          </View>
        </FadeInUp>

        {/* ─── WALLET + REFERRAL HIGHLIGHT ─── */}
        <FadeInUp delay={160}>
          <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, marginTop: SP.m, gap: SP.s }}>
            <Pressable onPress={() => nav.navigate('GiftCard')} style={{ flex: 1 }}>
              <BrutalBox maxRadius={14} style={{ padding: SP.m }}>
                <Feather name="gift" size={16} color={C.ink} />
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.ink, marginTop: 6, letterSpacing: -0.5 }}>₹750</Text>
                <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>WALLET + GIFT CARD</Text>
              </BrutalBox>
            </Pressable>
            <Pressable onPress={() => nav.navigate('ReferralRewards')} style={{ flex: 1 }}>
              <BrutalBox solid maxRadius={14} style={{ padding: SP.m }}>
                <Feather name="users" size={16} color={C.white} />
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.white, marginTop: 6, letterSpacing: -0.5 }}>₹200</Text>
                <Text style={[T.mono, { fontSize: 9, color: C.white, opacity: 0.7, marginTop: 2 }]}>PER FRIEND REFERRED</Text>
              </BrutalBox>
            </Pressable>
          </View>
        </FadeInUp>

        {/* ─── MENU GROUPS ─── */}
        {MENU_GROUPS.map((g, gi) => (
          <FadeInUp key={g.title} delay={200 + gi * 40}>
            <View style={{ marginTop: SP.xl, paddingHorizontal: SP.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[T.mono, { fontSize: 9, color: C.dim, letterSpacing: 1 }]}>{`// GROUP_${g.code}`}</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink, letterSpacing: -0.5, marginTop: 2 }}>{g.title}</Text>
                  <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{g.intro}</Text>
                </View>
                <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{`${g.items.length} ITEMS`}</Text>
              </View>
              <AsciiDivider style={{ marginTop: 8 }} />
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
            <Text style={[T.mono, { fontSize: 9, color: C.dim, letterSpacing: 1 }]}>{`// GROUP_06`}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink, letterSpacing: -0.5, marginTop: 2 }}>APPEARANCE</Text>
            <AsciiDivider style={{ marginTop: 8 }} />
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
          <View style={{ marginTop: SP.l, alignItems: 'center' }}>
            <Text style={[T.mono, { color: C.dim, fontSize: 9, textAlign: 'center' }]}>{'// CLOSET× · BUILT FOR GEN-Z'}</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 9, textAlign: 'center', marginTop: 2 }]}>{'v4.26 · build 1442 · ' + ASCII.caret}</Text>
          </View>
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
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.ink, letterSpacing: -0.8 }}>{value}</Text>
      <Text style={[T.monoB, { fontSize: 9, marginTop: 2 }]}>{label}</Text>
      {sub && <Text style={[T.mono, { fontSize: 8, color: C.dim, marginTop: 1 }]}>{sub}</Text>}
    </View>
  );
}
