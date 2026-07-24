import React from 'react';
import { View, Text, ScrollView, Pressable, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, SP, BORDER } from '../theme/brutal';
import { useApp } from '../state/AppState';

const APP_VERSION = '1.0.0';
const BAND = '#F4F4F4';       // light grey separator band
const CREAM = '#F7F1E5';      // insider banner background
const GOLD = '#B58A2E';       // insider accent
const NEW = '#F1315B';        // "NEW" badge

// Everything is Helvetica — weight carries the hierarchy. `H` builds a text style.
const HELV = 'Helvetica Neue';
const H = (size: number, weight: '400' | '500' | '600' | '700' | '800' | '900', color: string, extra: object = {}) =>
  ({ fontFamily: HELV, fontWeight: weight, fontSize: size, color, ...extra } as any);

// Bottom text links (both states).
const LINKS: { label: string; screen?: string }[] = [
  { label: 'FAQs', screen: 'CustomerSupport' },
  { label: 'About Us', screen: 'About' },
  { label: 'Terms of Use' },
  { label: 'Privacy Policy' },
  { label: 'Grievance Redressal' },
];

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, signOut, showToast, showConfirm, requireAuth } = useApp();

  const go = (screen?: string, label?: string) =>
    screen ? nav.navigate(screen) : showToast(label || 'Coming soon', 'Coming soon');

  const name = user?.name || 'Guest';
  const initials = (name.trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2) || 'G').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />

      {/* ─── Header: back · Profile · rewards pill ─── */}
      <View style={{ paddingTop: insets.top + 6, paddingBottom: SP.s, paddingHorizontal: SP.s, flexDirection: 'row', alignItems: 'center' }}>
        {nav.canGoBack() && (
          <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="arrow-left" size={22} color={C.ink} />
          </Pressable>
        )}
        <Text style={H(20, '700', C.ink, { marginLeft: nav.canGoBack() ? 2 : SP.s })}>Profile</Text>
        <View style={{ flex: 1 }} />
        {user && (
          <Pressable
            onPress={() => go('LoyaltyRewards')}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, marginRight: SP.s }, BORDER(1), { borderRadius: 22 }]}
          >
            <Feather name="star" size={13} color={GOLD} />
            <Text style={H(13, '700', C.ink)}>1,240</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {user ? (
          <>
            {/* ─── Insider promo banner ─── */}
            <Pressable
              onPress={() => go('LoyaltyRewards')}
              style={{ marginHorizontal: SP.l, marginTop: SP.s, backgroundColor: CREAM, borderRadius: 14, padding: SP.l, overflow: 'hidden' }}
            >
              <Text style={{ position: 'absolute', right: 14, top: 10, fontSize: 46 }}>👑</Text>
              <Text style={H(20, '800', C.ink, { letterSpacing: -0.3 })} numberOfLines={1}>{name.split(' ')[0]}, go Insider!</Text>
              <Text style={H(13, '400', '#6a5f47', { marginTop: 6, maxWidth: '70%' })}>
                Unlock extra rewards and better discounts.
              </Text>
              <View style={{ alignSelf: 'flex-start', marginTop: 14, backgroundColor: GOLD, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22 }}>
                <Text style={H(13, '800', '#fff', { letterSpacing: 0.3 })}>Know More</Text>
              </View>
            </Pressable>

            {/* ─── Shopping for + avatar row ─── */}
            <Text style={H(18, '800', C.ink, { paddingHorizontal: SP.l, marginTop: SP.xl })}>Shopping for {name.split(' ')[0]}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.l, paddingHorizontal: SP.l, marginTop: SP.m }}>
              <View style={{ alignItems: 'center', width: 72 }}>
                <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: NEW, alignItems: 'center', justifyContent: 'center', backgroundColor: BAND }}>
                  <Text style={H(24, '800', C.ink)}>{initials}</Text>
                </View>
                <Text style={H(12, '600', C.ink, { marginTop: 6 })} numberOfLines={1}>{name.split(' ')[0]}</Text>
              </View>
              <Pressable onPress={() => nav.navigate('EditProfile')} style={{ alignItems: 'center', width: 72 }}>
                <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: C.hairline, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="plus" size={26} color={C.dim} />
                </View>
                <Text style={H(12, '400', C.dim, { marginTop: 6 })}>Add</Text>
              </Pressable>
            </View>

            {/* ─── Section pills ─── */}
            <View style={{ backgroundColor: BAND, marginTop: SP.l, paddingVertical: SP.m }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s }}>
                {[
                  { label: 'Basics', screen: 'CompleteProfile' },
                  { label: 'Size Details', screen: 'Measurement' },
                  { label: 'Style', screen: 'StylePreferences' },
                ].map(p => (
                  <Pressable key={p.label} onPress={() => go(p.screen)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: '#fff' }, BORDER(1), { borderRadius: 24 }]}>
                    <Text style={H(13, '700', C.ink)}>{p.label}</Text>
                    <Feather name="chevron-right" size={14} color={C.ink} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* ─── 2×2 card grid ─── */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l, gap: SP.s }}>
              <View style={{ flexDirection: 'row', gap: SP.s }}>
                <GridCard icon="package" label="Orders" onPress={() => go('OrderHistory')} />
                <GridCard icon="award" label="Insider" onPress={() => go('LoyaltyRewards')} />
              </View>
              <View style={{ flexDirection: 'row', gap: SP.s }}>
                <GridCard icon="headphones" label="Help Center" onPress={() => go('CustomerSupport')} />
                <GridCard icon="percent" label="Coupons" onPress={() => go('CouponWallet')} />
              </View>
            </View>

            {/* ─── Feature list rows ─── */}
            <View style={{ marginTop: SP.l }}>
              <ListRow icon="star" title="Glam Clan" isNew sub="Trendzo creator program for shoppers" onPress={() => go('CommunityFeed')} />
              <ListRow icon="gift" title="Refer & Earn" isNew sub="Invite friends, get shopping credit" onPress={() => go('ReferralRewards')} />
              <ListRow icon="credit-card" title="Payments" sub="Balance and saved payment methods" onPress={() => go('PaymentMethods')} />
              <ListRow icon="award" title="Earn & Redeem" sub="View prizes and earn rewards" onPress={() => go('LoyaltyRewards')} />
              <ListRow icon="edit-3" title="Manage Account" sub="Account and saved addresses" onPress={() => go('SavedAddresses')} />
              <ListRow icon="settings" title="Settings" sub="Manage notifications" onPress={() => go('NotificationSettings')} />
            </View>
          </>
        ) : (
          // ─── Guest state — simple centered login ───
          <View style={{ alignItems: 'center', paddingTop: SP.m, paddingBottom: SP.xl }}>
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: BAND, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.hairline }}>
              <Feather name="user" size={46} color={C.dim} />
            </View>
            <Text style={H(24, '800', C.ink, { letterSpacing: -0.4, marginTop: SP.m })}>Guest</Text>
            <Pressable
              onPress={() => requireAuth()}
              style={[{ marginTop: SP.l, paddingHorizontal: SP.xl, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }, BORDER(1)]}
            >
              <Text style={H(14, '800', C.white, { letterSpacing: 0.5 })}>LOG IN / SIGN UP</Text>
            </Pressable>

            {/* Essentials for guests */}
            <View style={{ height: 10, backgroundColor: BAND, alignSelf: 'stretch', marginTop: SP.xl }} />
            <View style={{ alignSelf: 'stretch' }}>
              <ListRow icon="package" title="Orders" sub="Check your order status" onPress={() => go('OrderHistory')} />
              <ListRow icon="headphones" title="Help Center" sub="Help with your purchases" onPress={() => go('CustomerSupport')} />
            </View>
          </View>
        )}

        {/* ─── Text links (shared) ─── */}
        <View style={{ height: 10, backgroundColor: BAND, marginTop: SP.l }} />
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.s }}>
          {LINKS.map(l => (
            <Pressable key={l.label} onPress={() => go(l.screen, l.label)} style={{ paddingVertical: 15 }}>
              <Text style={H(14, '700', C.dim, { letterSpacing: 0.3 })}>{l.label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {/* ─── Log out (only when logged in) ─── */}
        {user && (
          <View style={{ backgroundColor: BAND, paddingHorizontal: SP.l, paddingTop: SP.l, paddingBottom: SP.xl, marginTop: SP.s }}>
            <Pressable
              onPress={() => showConfirm({
                title: 'Log out?',
                msg: "You'll need to log in again to access your bag and orders.",
                confirmLabel: 'Log out', cancelLabel: 'Stay', danger: true, icon: 'log-out',
                onConfirm: signOut,
              })}
              style={{ height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: NEW, borderRadius: 6, backgroundColor: '#fff' }}
            >
              <Text style={H(15, '800', NEW, { letterSpacing: 0.5 })}>LOG OUT</Text>
            </Pressable>
            <Text style={H(12, '400', C.dim, { letterSpacing: 0.5, textAlign: 'center', marginTop: SP.xl })}>APP VERSION {APP_VERSION}</Text>
          </View>
        )}

        {!user && (
          <View style={{ backgroundColor: BAND, paddingVertical: SP.xl, alignItems: 'center', marginTop: SP.s }}>
            <Text style={H(12, '400', C.dim, { letterSpacing: 0.5 })}>APP VERSION {APP_VERSION}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── 2×2 grid card ───
function GridCard({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 16 }, BORDER(1), { borderRadius: 10 }]}>
      <Feather name={icon} size={20} color={C.ink} />
      <Text style={H(15, '700', C.ink, { flex: 1, marginLeft: 10 })} numberOfLines={1}>{label}</Text>
      <Feather name="chevron-right" size={18} color={C.dim} />
    </Pressable>
  );
}

// ─── Feature list row ───
function ListRow({ icon, title, sub, isNew, onPress }: { icon: any; title: string; sub?: string; isNew?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingVertical: 16, borderBottomWidth: 1, borderColor: C.hairline }}>
      <Feather name={icon} size={22} color={C.ink} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={H(16, '700', C.ink)}>{title}</Text>
          {isNew && (
            <View style={{ backgroundColor: NEW, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={H(9, '800', '#fff', { letterSpacing: 0.5 })}>NEW</Text>
            </View>
          )}
        </View>
        {sub ? <Text style={H(12, '400', C.dim, { marginTop: 3 })} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Feather name="chevron-right" size={20} color={C.dim} />
    </Pressable>
  );
}
