import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StatusBar, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, SP, BORDER, rf } from '../theme/brutal';
import { useApp } from '../state/AppState';
import { getLoyalty } from '../services/loyalty';
import { deleteAccount, DeletionUnsupportedError, deletionMailto, ACCOUNT_DELETION_EMAIL } from '../services/account';

const APP_VERSION = '1.0.0';
const BAND = '#F4F4F4';       // light grey separator band
const GOLD = '#B58A2E';       // rewards accent
const NEW = '#F1315B';        // avatar ring / "NEW" badge

// Everything is Helvetica — weight carries the hierarchy. `H` builds a text style.
// Sizes route through rf() — this helper used to take raw sizes, which is why
// THIS page alone ignored the small-screen shrink and the OS font-scale cap
// while home/category scaled correctly.
const HELV = 'Helvetica Neue';
const H = (size: number, weight: '400' | '500' | '600' | '700' | '800' | '900', color: string, extra: object = {}) =>
  ({ fontFamily: HELV, fontWeight: weight, fontSize: rf(size), color, ...extra } as any);

// Bottom text links (both states).
const LINKS: { label: string; screen?: string }[] = [
  { label: 'FAQs', screen: 'CustomerSupport' },
  { label: 'About Us', screen: 'About' },
  { label: 'Terms of Use' },
  { label: 'Privacy Policy' },
  { label: 'Grievance Redressal' },
];

const PROFILE_TIERS: Array<{ name: string; min: number }> = [
  { name: 'BRONZE', min: 0 },
  { name: 'SILVER', min: 1000 },
  { name: 'GOLD', min: 5000 },
  { name: 'PLATINUM', min: 10000 },
];

export default function ProfileScreen() {
  // Real points from GET /consumer/loyalty — this chip showed the literal 1,240
  // to every customer, including signed-out ones.
  const [points, setPoints] = useState(0);
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, signOut, showToast, showConfirm, requireAuth } = useApp();
  useEffect(() => {
    if (!user) { setPoints(0); return; }
    let cancelled = false;
    getLoyalty({ limit: 1 })
      .then((l) => { if (!cancelled) setPoints(l.balancePoints); })
      .catch(() => { /* offline — show 0 rather than a fabricated balance */ });
    return () => { cancelled = true; };
  }, [user]);

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
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, marginRight: SP.s }, BORDER(1), { borderRadius: 0 }]}
          >
            <Feather name="star" size={13} color={GOLD} />
            <Text style={H(13, '700', C.ink)}>{points.toLocaleString()}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {user ? (
          <>
            {/* ─── Centered avatar + name (same as the guest layout) ─── */}
            <View style={{ alignItems: 'center', paddingTop: SP.m, paddingBottom: SP.l }}>
              <View style={{ width: 100, height: 100, borderRadius: 0, borderWidth: 2, borderColor: NEW, alignItems: 'center', justifyContent: 'center', backgroundColor: BAND }}>
                <Text style={H(32, '800', C.ink)}>{initials}</Text>
              </View>
              <Text style={H(24, '800', C.ink, { letterSpacing: -0.4, marginTop: SP.m })} numberOfLines={1}>{name}</Text>
              {user.email ? <Text style={H(13, '400', C.dim, { marginTop: 3 })} numberOfLines={1}>{user.email}</Text> : null}
              <Pressable onPress={() => nav.navigate('EditProfile')} hitSlop={6} style={{ marginTop: SP.s }}>
                <Text style={H(12, '600', C.ink, { textDecorationLine: 'underline' })}>Edit profile</Text>
              </Pressable>
            </View>


            {/* ─── 2×2 card grid ─── */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l, gap: SP.s }}>
              <View style={{ flexDirection: 'row', gap: SP.s }}>
                <GridCard icon="package" label="Orders" onPress={() => go('OrderHistory')} />
                <GridCard icon="award" label="Rewards" onPress={() => go('LoyaltyRewards')} />
              </View>
              <View style={{ flexDirection: 'row', gap: SP.s }}>
                <GridCard icon="headphones" label="Help Center" onPress={() => go('CustomerSupport')} />
                <GridCard icon="percent" label="Coupons" onPress={() => go('CouponWallet')} />
              </View>
            </View>

            {/* ─── Feature list rows — the app's real features ─── */}
            <View style={{ marginTop: SP.l }}>
              {/* Exchanges are NOT a backend concept — there is no endpoint or order
                  state for one. Returning for a refund is the whole of it. */}
              <ListRow icon="rotate-ccw" title="Returns & Refunds" sub="7-day window, free pickup" onPress={() => go('OrderReturn')} />
              <ListRow icon="map-pin" title="Saved Addresses" sub="Home, office & more" onPress={() => go('SavedAddresses')} />
              <ListRow icon="credit-card" title="Payment Methods" sub="UPI, cards, wallet & COD" onPress={() => go('PaymentMethods')} />
              <ListRow icon="gift" title="Refer & Earn" sub="Invite friends, get shopping credit" onPress={() => go('ReferralRewards')} />
              <ListRow icon="sliders" title="Style & Fit" sub="Preferences, sizes & measurements" onPress={() => go('StylePreferences')} />
              <ListRow icon="bell" title="Notifications" sub="Push, email & deal alerts" onPress={() => go('NotificationSettings')} />
            </View>
          </>
        ) : (
          // ─── Guest state — simple centered login ───
          <View style={{ alignItems: 'center', paddingTop: SP.m, paddingBottom: SP.xl }}>
            <View style={{ width: 100, height: 100, borderRadius: 0, backgroundColor: BAND, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.hairline }}>
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
              style={{ height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: NEW, borderRadius: 0, backgroundColor: '#fff' }}
            >
              <Text style={H(15, '800', NEW, { letterSpacing: 0.5 })}>LOG OUT</Text>
            </Pressable>
            {/* ─── Delete account ───────────────────────────────────────────
                REQUIRED by App Store Review Guideline 5.1.1(v): an app that
                creates accounts must let you delete one from inside the app.
                Deliberately two-step and plain about what is lost — this is
                irreversible and must never be a single stray tap. */}
            <Pressable
              onPress={() => showConfirm({
                title: 'Delete your account?',
                msg: 'This permanently deletes your account, saved addresses, bag and order history. It cannot be undone.',
                confirmLabel: 'Delete account',
                cancelLabel: 'Keep my account',
                danger: true,
                icon: 'trash-2',
                onConfirm: async () => {
                  try {
                    await deleteAccount();
                    showToast('Account deleted', 'Your account has been permanently removed', 'check');
                    signOut();
                  } catch (e: any) {
                    // The backend has no deletion route yet. Never claim success
                    // for a deletion that did not happen — hand the shopper the
                    // hosted flow instead.
                    if (e instanceof DeletionUnsupportedError) {
                      // Email, NOT the hosted page: that page has no form and
                      // simply tells the reader to use this screen, so linking
                      // to it from here would be a loop that deletes nothing.
                      showConfirm({
                        title: 'Request deletion by email',
                        msg: `We'll open a prefilled email to ${ACCOUNT_DELETION_EMAIL}. Send it and your account will be deleted. You stay signed in until it is actioned.`,
                        confirmLabel: 'Open email',
                        cancelLabel: 'Cancel',
                        icon: 'mail',
                        onConfirm: () => {
                          Linking.openURL(deletionMailto(user?.phone)).catch(() =>
                            showToast('No mail app', `Email ${ACCOUNT_DELETION_EMAIL} to delete your account`, 'mail'),
                          );
                        },
                      });
                      return;
                    }
                    showToast("Couldn't delete account", e?.message || 'Please try again', 'x');
                  }
                },
              })}
              style={{ height: 52, alignItems: 'center', justifyContent: 'center', marginTop: SP.s }}
            >
              <Text style={H(13, '700', C.dim, { letterSpacing: 0.5, textDecorationLine: 'underline' })}>DELETE ACCOUNT</Text>
            </Pressable>

            <Text style={H(12, '400', C.dim, { letterSpacing: 0.5, textAlign: 'center', marginTop: SP.l })}>APP VERSION {APP_VERSION}</Text>
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
    <Pressable onPress={onPress} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 16 }, BORDER(1), { borderRadius: 0 }]}>
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
            <View style={{ backgroundColor: NEW, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 0 }}>
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
