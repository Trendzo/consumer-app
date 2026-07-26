// Profile sub-screens — each page has a unique hero banner, structured
// body, and consistent brutalist treatment.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalStatusBar, FadeInUp, BrutalInput, Chip, OptionSheet } from '../components/Brutal';
import { useApp } from '../state/AppState';
import {
  listAddresses, createAddress, removeAddress, setDefaultAddress, formatAddress, type Address,
} from '../services/addresses';

// ═══════════════════════════════════════════════════════════
// SHARED PRIMITIVES — unique hero per screen, shared shell
// ═══════════════════════════════════════════════════════════

const TILE = '#F4F4F4'; // grey icon-tile / accent surface

// Turn an ALL-CAPS chip label into sentence case, while preserving short
// acronyms (PCI, DSS, UPI…) and tokens that contain digits or symbols.
function sentence(label: string) {
  return label
    .split(' ')
    .map(w => (/^[A-Z]{4,}$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />
      {children}
    </View>
  );
}

type HeroProps = {
  code?: string;          // legacy system-ID eyebrow — no longer rendered
  title: string;          // big display copy (can contain \n)
  intro?: string;         // one-line subhead
  chips?: { label: string; solid?: boolean }[];
  inverted?: boolean;     // legacy — heroes are always light now
};
function Hero({ title, intro, chips }: HeroProps) {
  return (
    <FadeInUp>
      <View style={[{ backgroundColor: C.white, padding: SP.l, overflow: 'hidden' }, BORDER(1)]}>
        <Text style={[T.h1, { textTransform: 'uppercase' }]}>
          {title}
        </Text>
        {intro && <Text style={[T.caption, { color: C.dim, marginTop: 8 }]}>{intro}</Text>}
        {chips && chips.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: SP.m, flexWrap: 'wrap' }}>
            {chips.map((ch, i) => (
              <ChipPill key={i} label={ch.label} solid={ch.solid} />
            ))}
          </View>
        )}
      </View>
    </FadeInUp>
  );
}

function ChipPill({ label, solid }: { label: string; solid?: boolean }) {
  return (
    <View
      style={[
        { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: solid ? C.ink : C.white },
        BORDER(1),
      ]}
    >
      <Text style={[T.caption, { color: solid ? C.white : C.ink }]}>{sentence(label)}</Text>
    </View>
  );
}

function SectionLabel({ label, right }: { label: string; right?: string }) {
  return (
    <View style={{ marginTop: SP.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={[T.h2, { textTransform: 'uppercase' }]}>{label}</Text>
        {right && <Text style={[T.caption, { color: C.dim }]}>{sentence(right)}</Text>}
      </View>
    </View>
  );
}

// New editorial section header — plain T.h3 uppercase, edge-to-edge, matching
// the flagship Loyalty / Style screens. Optional right-hand meta in micro.
function SectionHead({ title, right, style }: { title: string; right?: string; style?: any }) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.s }, style]}>
      <Text style={[T.h3, { textTransform: 'uppercase' }]}>{title}</Text>
      {right ? <Text style={[T.micro, { color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{right}</Text> : null}
    </View>
  );
}

// Reusable grey icon tile — grey square, hairline border, ink Feather glyph.
function IconTile({ icon, size = 40, on }: { icon: string; size?: number; on?: boolean }) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : TILE }, BORDER(1), on && { borderColor: C.white }]}>
      <Feather name={icon as any} size={Math.round(size * 0.42)} color={C.ink} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// SAVED ADDRESSES
// ═══════════════════════════════════════════════════════════
// lat/lng feed delivery routing + GST place-of-supply; without a map picker we approximate
// to a city centroid. Swap for a real map/geocode pin later.
const DEFAULT_COORDS = { lat: 19.076, lng: 72.8777 };
const EMPTY_ADDR_FORM = { label: '', line1: '', line2: '', city: '', pincode: '', stateCode: '' };

export function SavedAddressesScreen() {
  const nav = useNavigation<any>();
  const { showToast, showConfirm } = useApp();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDR_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listAddresses().then(setAddresses).catch(() => setAddresses([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const onDelete = (a: Address) => showConfirm({
    title: 'Delete address?', msg: formatAddress(a), confirmLabel: 'Delete', cancelLabel: 'Keep', danger: true, icon: 'trash-2',
    onConfirm: () => removeAddress(a.id)
      .then(() => { showToast('Deleted', a.label || 'Address removed', 'trash-2'); load(); })
      .catch((e: any) => showToast('Could not delete', e?.message || 'Try again', 'x')),
  });
  const onSetDefault = (a: Address) => setDefaultAddress(a.id)
    .then(() => { showToast('Default set', a.label || formatAddress(a), 'check'); load(); })
    .catch((e: any) => showToast('Failed', e?.message || 'Try again', 'x'));

  const canSave = !!form.line1.trim() && !!form.city.trim() && /^\d{6}$/.test(form.pincode.trim()) && form.stateCode.trim().length === 2;
  const onSave = () => {
    if (!canSave || saving) return;
    setSaving(true);
    createAddress({
      label: form.label.trim() || null,
      line1: form.line1.trim(), line2: form.line2.trim() || null,
      city: form.city.trim(), pincode: form.pincode.trim(), stateCode: form.stateCode.trim().toUpperCase(),
      lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng,
    })
      .then(() => { setFormOpen(false); setForm(EMPTY_ADDR_FORM); showToast('Address added', 'Saved to your account', 'check'); load(); })
      .catch((e: any) => showToast('Could not save', e?.message || 'Check details / sign in', 'x'))
      .finally(() => setSaving(false));
  };

  return (
    <PageShell>
      <ScreenHeader title="Addresses" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={`ADDRESSES · ${addresses.length} SAVED`}
          title={'Your\naddresses.'}
          intro="Deliver to home, office, or anywhere else. One tap to switch."
          chips={[{ label: 'DELIVERY' }]}
        />

        <SectionHead title="Saved" right={`${addresses.length} entries`} />
        <View style={{ paddingHorizontal: SP.l }}>
          {loading && addresses.length === 0 && <Text style={[T.body, { color: C.dim }]}>Loading…</Text>}
          {!loading && addresses.length === 0 && <Text style={[T.body, { color: C.dim }]}>No saved addresses yet. Add one below. (Sign in required.)</Text>}
          {addresses.map((a, i) => {
            const lbl = (a.label || '').toLowerCase();
            const icon = lbl.includes('home') ? 'home' : (lbl.includes('office') || lbl.includes('work')) ? 'briefcase' : 'map-pin';
            return (
              <FadeInUp key={a.id} delay={i * 60}>
                <View style={[{ marginTop: SP.s, backgroundColor: C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: SP.m }}>
                    <IconTile icon={icon} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={T.bodyB}>{a.label || 'Address'}</Text>
                        {a.isDefault && (
                          <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: C.ink }}>
                            <Text style={[T.micro, { color: C.white }]}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[T.caption, { color: C.dim, marginTop: 4 }]}>{formatAddress(a)}</Text>
                      <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{a.stateCode} · {a.pincode}</Text>
                    </View>
                    <Pressable onPress={() => onDelete(a)} hitSlop={8} style={{ padding: 4 }}>
                      <Feather name="trash-2" size={15} color={C.dim} />
                    </Pressable>
                  </View>
                  {!a.isDefault && (
                    <Pressable onPress={() => onSetDefault(a)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.m, paddingVertical: 11, borderTopWidth: 1, borderColor: C.hairline }}>
                      <Text style={[T.caption, { color: C.ink }]}>Set as default</Text>
                      <Feather name="chevron-right" size={14} color={C.ink} />
                    </Pressable>
                  )}
                </View>
              </FadeInUp>
            );
          })}
          <BrutalButton label="Add new address" icon="plus" variant="outline" block onPress={() => setFormOpen(true)} style={{ marginTop: SP.l }} />
        </View>
      </ScrollView>

      <OptionSheet visible={formOpen} title="New address" onClose={() => setFormOpen(false)}>
        <View style={{ padding: SP.l, paddingBottom: 40 }}>
          <BrutalInput label="Label (Home / Office)" value={form.label} onChangeText={(v: string) => setForm(f => ({ ...f, label: v }))} placeholder="Home" />
          <BrutalInput label="Address line 1" value={form.line1} onChangeText={(v: string) => setForm(f => ({ ...f, line1: v }))} placeholder="Flat, building, street" />
          <BrutalInput label="Address line 2" value={form.line2} onChangeText={(v: string) => setForm(f => ({ ...f, line2: v }))} placeholder="Area, landmark (optional)" />
          <BrutalInput label="City" value={form.city} onChangeText={(v: string) => setForm(f => ({ ...f, city: v }))} placeholder="Mumbai" />
          <View style={{ flexDirection: 'row', gap: SP.m }}>
            <View style={{ flex: 1 }}>
              <BrutalInput label="Pincode" value={form.pincode} onChangeText={(v: string) => setForm(f => ({ ...f, pincode: v }))} keyboardType="number-pad" placeholder="400050" />
            </View>
            <View style={{ width: 110 }}>
              <BrutalInput label="State (2)" value={form.stateCode} onChangeText={(v: string) => setForm(f => ({ ...f, stateCode: v.toUpperCase() }))} placeholder="MH" />
            </View>
          </View>
          <Text style={[T.micro, { marginTop: 4 }]}>Location approximated to your city — precise map pin coming soon.</Text>
          <BrutalButton label={saving ? 'Saving…' : 'Save address'} icon="check" block onPress={onSave} style={{ marginTop: SP.m, opacity: canSave && !saving ? 1 : 0.5 }} />
        </View>
      </OptionSheet>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// PAYMENT METHODS
// ═══════════════════════════════════════════════════════════
const PAYMENTS = [
  { id: '1', type: 'UPI', label: 'pay@okhdfcbank', sub: 'HDFC · linked Oct 2024', icon: 'smartphone' },
  { id: '2', type: 'CARD', label: '•••• •••• •••• 4242', sub: 'VISA · exp 08/28', icon: 'credit-card' },
  { id: '3', type: 'WALLET', label: 'Trendzo Pay', sub: 'Balance: ₹1,240', icon: 'briefcase' },
];

export function PaymentMethodsScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [selected, setSelected] = useState('1');
  return (
    <PageShell>
      <ScreenHeader title="Payment" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'PAYMENT_METHODS_v2'}
          title={'Your\nwallets.'}
          intro="UPI, cards, wallets. Pick your default — we remember for next time."
          chips={[{ label: 'SECURE' }, { label: '256-BIT' }, { label: 'PCI DSS' }]}
        />

        <SectionHead title="Methods" right={`${PAYMENTS.length} linked`} />
        <View style={{ paddingHorizontal: SP.l }}>
          {PAYMENTS.map((p, i) => {
            const on = selected === p.id;
            return (
              <FadeInUp key={p.id} delay={i * 60}>
                <Pressable onPress={() => setSelected(p.id)} style={[{ marginTop: i === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                  <IconTile icon={p.icon} size={44} on={on} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.6)' : C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{p.type}</Text>
                    <Text style={[T.bodyB, { color: on ? C.white : C.ink, marginTop: 2 }]}>{p.label}</Text>
                    <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.6)' : C.dim, marginTop: 2 }]}>{p.sub}</Text>
                  </View>
                  <View style={[{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : 'transparent' }, BORDER(1), on && { borderColor: C.white }]}>
                    {on && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.ink }} />}
                  </View>
                </Pressable>
              </FadeInUp>
            );
          })}
        </View>

        <SectionHead title="Add new" />
        <View style={{ flexDirection: 'row', gap: SP.s, paddingHorizontal: SP.l }}>
          {[
            { icon: 'smartphone', label: 'UPI' },
            { icon: 'credit-card', label: 'Card' },
            { icon: 'briefcase', label: 'Wallet' },
          ].map(o => (
            <Pressable key={o.label} onPress={() => showToast('Add ' + o.label, 'Coming soon', 'plus')} style={[{ flex: 1, paddingVertical: SP.l, alignItems: 'center', gap: 8, backgroundColor: C.white }, BORDER(1)]}>
              <IconTile icon={o.icon} size={36} />
              <Text style={[T.caption, { color: C.ink }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// LOYALTY REWARDS
// ═══════════════════════════════════════════════════════════
const TIERS = [
  { name: 'BRONZE', min: 0 },
  { name: 'SILVER', min: 1000 },
  { name: 'GOLD', min: 5000 },
  { name: 'PLATINUM', min: 10000 },
];

export function LoyaltyRewardsScreen() {
  const nav = useNavigation<any>();
  const points = 1240;
  const currentTier = TIERS.filter(t => points >= t.min).pop()!;
  const nextTier = TIERS[TIERS.indexOf(currentTier) + 1];
  const curIdx = TIERS.indexOf(currentTier);
  const progress = nextTier ? Math.min((points - currentTier.min) / (nextTier.min - currentTier.min), 1) : 1;
  const toNext = nextTier ? nextTier.min - points : 0;

  return (
    <PageShell>
      <ScreenHeader title="Rewards" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ─── PREMIUM MEMBERSHIP CARD — black, big points, faded wordmark ─── */}
        <FadeInUp>
          <View style={{ marginHorizontal: SP.l, marginTop: SP.m, backgroundColor: C.ink, overflow: 'hidden' }}>
            <Text numberOfLines={1} style={{ position: 'absolute', right: -8, top: -12, fontFamily: 'Inter_900Black', fontSize: rf(88), letterSpacing: -4, color: 'rgba(255,255,255,0.05)', textTransform: 'uppercase' }}>{currentTier.name}</Text>
            <View style={{ padding: SP.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="star" size={13} color="#F0C23C" />
                <Text style={[T.caption, { color: '#F0C23C', fontFamily: 'Inter_700Bold', letterSpacing: 1, textTransform: 'uppercase' }]}>{currentTier.name} Member</Text>
              </View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(52), color: '#fff', letterSpacing: -2.5, marginTop: SP.s, lineHeight: rf(54) }}>{points.toLocaleString()}</Text>
              <Text style={[T.caption, { color: 'rgba(255,255,255,0.6)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }]}>Loyalty points</Text>

              {nextTier ? (
                <View style={{ marginTop: SP.l }}>
                  <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                    <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#F0C23C' }} />
                  </View>
                  <Text style={[T.micro, { color: 'rgba(255,255,255,0.7)', marginTop: 8 }]}>
                    <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold' }}>{toNext.toLocaleString()} pts</Text> to {sentence(nextTier.name)}
                  </Text>
                </View>
              ) : (
                <Text style={[T.micro, { color: 'rgba(255,255,255,0.7)', marginTop: SP.l }]}>You've reached the top tier ✦</Text>
              )}
            </View>
            {/* redeem strip */}
            <Pressable onPress={() => nav.navigate('CouponWallet')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingVertical: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
              <Text style={[T.caption, { color: '#fff', fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 }]}>Redeem points</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </Pressable>
          </View>
        </FadeInUp>

        {/* ─── TIER LADDER — stepper with a connecting track ─── */}
        {/* The track is ONE pair of absolute lines behind the whole row (grey
            full track + black progress). The old per-column connectors used
            left:'-50%' to reach into the previous column, and because later
            columns render on top, each line drew OVER its neighbour's node —
            the overlapping-lines bug. A single behind-everything track can't
            overlap anything. First/last node centres sit at 12.5% / 87.5% of
            the row (4 equal columns), so the track spans exactly that. */}
        <Text style={[T.h3, { textTransform: 'uppercase', paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.m }]}>Your Journey</Text>
        <View style={{ paddingHorizontal: SP.l }}>
          <View>
            <View style={{ position: 'absolute', top: 13, left: '12.5%', right: '12.5%', height: 2, backgroundColor: C.hairline }} />
            <View style={{ position: 'absolute', top: 13, left: '12.5%', width: `${(curIdx / (TIERS.length - 1)) * 75}%`, height: 2, backgroundColor: C.ink }} />
            <View style={{ flexDirection: 'row' }}>
              {TIERS.map((t, i) => {
                const reached = i <= curIdx;
                const isCurrent = i === curIdx;
                return (
                  <View key={t.name} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: reached ? C.ink : '#fff' }, BORDER(1)]}>
                      {reached ? <Feather name={isCurrent ? 'star' : 'check'} size={13} color="#fff" /> : <Text style={[T.micro, { color: C.dim }]}>{i + 1}</Text>}
                    </View>
                    <Text numberOfLines={1} style={[T.micro, { color: reached ? C.ink : C.dim, fontFamily: isCurrent ? 'Inter_700Bold' : 'Inter_400Regular', marginTop: 6, textTransform: 'uppercase' }]}>{t.name}</Text>
                    <Text style={[T.micro, { color: C.dim, marginTop: 1 }]}>{t.min >= 1000 ? `${t.min / 1000}K` : t.min}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ─── PLAY & EARN — the arcade. One game, done properly: PUSH & WIN. ─── */}
        <Text style={[T.h3, { textTransform: 'uppercase', paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.s }]}>Play & Earn</Text>
        <View style={{ paddingHorizontal: SP.l }}>
          <FadeInUp>
            <Pressable onPress={() => nav.navigate('PushWin')} style={[{ backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
              {/* faded editorial wordmark — ink on white, like the app's heroes */}
              <Text numberOfLines={1} style={{ position: 'absolute', right: -6, bottom: -16, fontFamily: 'Inter_900Black', fontSize: rf(72), letterSpacing: -3, color: 'rgba(0,0,0,0.04)' }}>PUSH&WIN</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.l, gap: SP.m }}>
                {/* slot-machine tile — grey app tile, ink icon */}
                <View style={[{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: TILE }, BORDER(1)]}>
                  <MaterialCommunityIcons name="slot-machine-outline" size={32} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  {/* title with the Home highlighter bar */}
                  <View style={{ alignSelf: 'flex-start' }}>
                    <View style={{ position: 'absolute', left: -2, right: -4, bottom: 1, height: 8, backgroundColor: '#F2E63C' }} />
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(17), color: C.ink, letterSpacing: 0.5 }}>PUSH & WIN</Text>
                  </View>
                  <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>Match 3 on the machine · win up to ₹500</Text>
                  <Text style={[T.micro, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '600', marginTop: 2 }]}>3 free pushes today</Text>
                </View>
                {/* PLAY — black slab on a yellow offset shadow */}
                <View>
                  <View style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, backgroundColor: '#F2E63C', borderWidth: 1, borderColor: C.ink }} />
                  <View style={{ backgroundColor: C.ink, paddingHorizontal: 18, paddingVertical: 11 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(13), color: C.white, letterSpacing: 2 }}>PLAY</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </FadeInUp>
        </View>

        {/* ─── WAYS TO EARN — grey tiles, green points ─── */}
        <Text style={[T.h3, { textTransform: 'uppercase', paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.s }]}>Ways to Earn</Text>
        <View style={{ paddingHorizontal: SP.l, gap: SP.s }}>
          {[
            { label: 'Every ₹100 spent', pts: '+10', icon: 'shopping-bag' },
            { label: 'Daily login streak', pts: '+70', icon: 'zap' },
            { label: 'Write a product review', pts: '+50', icon: 'message-square' },
            { label: 'Refer a friend', pts: '+200', icon: 'users' },
            { label: 'Complete your style quiz', pts: '+100', icon: 'help-circle' },
          ].map((r, i) => (
            <FadeInUp key={i} delay={40 + i * 30}>
              <View style={[{ padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                <View style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: TILE }, BORDER(1)]}>
                  <Feather name={r.icon as any} size={17} color={C.ink} />
                </View>
                <Text style={[T.body, { flex: 1, marginLeft: 12, fontFamily: 'Inter_500Medium' }]}>{r.label}</Text>
                <Text style={[T.body, { color: C.green, fontFamily: 'Inter_700Bold' }]}>{r.pts}</Text>
              </View>
            </FadeInUp>
          ))}
        </View>

        {/* ─── PERKS ─── */}
        <Text style={[T.h3, { textTransform: 'uppercase', paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.s }]}>{sentence(currentTier.name)} Perks</Text>
        <View style={{ paddingHorizontal: SP.l }}>
          {['Early access to sales', 'Free shipping above ₹999', 'Birthday surprise gift', 'Priority customer support'].map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderColor: C.hairline }}>
              <View style={{ width: 20, height: 20, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="check" size={12} color="#fff" />
              </View>
              <Text style={[T.body, { flex: 1 }]}>{p}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// GIFT CARD
// ═══════════════════════════════════════════════════════════
export function GiftCardScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [amount, setAmount] = useState('1000');
  const [toEmail, setToEmail] = useState('');
  const [note, setNote] = useState('');
  const amounts = [500, 1000, 2000, 5000];

  return (
    <PageShell>
      <ScreenHeader title="Gift Card" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'GIFT_CARD · DIGITAL'}
          title={'Give the\ngift of fit.'}
          intro="Send a Trendzo gift card to anyone. Redeemable across the entire catalog."
          chips={[{ label: 'INSTANT DELIVERY', solid: true }, { label: 'NO EXPIRY' }]}
        />

        {/* Signature black gift-card — live preview, faded wordmark */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <FadeInUp>
            <View style={{ backgroundColor: C.ink, overflow: 'hidden', minHeight: 200 }}>
              <Text numberOfLines={1} style={{ position: 'absolute', right: -10, bottom: -22, fontFamily: 'Inter_900Black', fontSize: rf(96), color: 'rgba(255,255,255,0.05)', letterSpacing: -4, textTransform: 'uppercase' }}>GIFT</Text>
              <View style={{ padding: SP.l }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.caption, { color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }]}>Trendzo Gift Card</Text>
                  <Feather name="gift" size={16} color="rgba(255,255,255,0.85)" />
                </View>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(52), color: '#fff', letterSpacing: -2.5, marginTop: SP.l }}>₹{amount || '—'}</Text>
                <View style={{ marginTop: SP.l, gap: 4 }}>
                  <Text style={[T.micro, { color: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>TO — {toEmail || '—'}</Text>
                  <Text style={[T.micro, { color: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>NOTE — {note || '—'}</Text>
                </View>
              </View>
            </View>
          </FadeInUp>
        </View>

        <SectionHead title="Select amount" />
        <View style={{ flexDirection: 'row', gap: SP.s, paddingHorizontal: SP.l }}>
          {amounts.map(a => {
            const on = amount === String(a);
            return (
              <Pressable key={a} onPress={() => setAmount(String(a))} style={[{ flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                <Text style={[T.bodyB, { color: on ? C.white : C.ink }]}>₹{a}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHead title="Recipient" />
        <View style={{ paddingHorizontal: SP.l }}>
          <BrutalInput value={toEmail} onChangeText={setToEmail} placeholder="friend@example.com" label="Send to (email)" icon="mail" />
          <BrutalInput value={note} onChangeText={setNote} placeholder="You're the best. Go buy something good." label="Personal note" icon="message-square" />
          <BrutalButton label={`Buy gift card — ₹${amount || '0'}`} icon="gift" block onPress={() => showToast('Gift Card', 'Purchase coming soon', 'gift')} style={{ marginTop: SP.l }} />
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// REFERRAL REWARDS
// ═══════════════════════════════════════════════════════════
export function ReferralRewardsScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  return (
    <PageShell>
      <ScreenHeader title="Refer & Earn" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'REFERRAL · ₹200 EACH'}
          title={'Share the\ndrip.'}
          intro="Give ₹200, get ₹200 when your friend makes their first order."
          chips={[{ label: '7 INVITED' }, { label: '4 JOINED' }, { label: '₹800 EARNED', solid: true }]}
        />

        {/* Signature black referral-code card */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <FadeInUp delay={60}>
            <View style={{ backgroundColor: C.ink, overflow: 'hidden' }}>
              <Text numberOfLines={1} style={{ position: 'absolute', right: -8, top: -18, fontFamily: 'Inter_900Black', fontSize: rf(80), color: 'rgba(255,255,255,0.05)', letterSpacing: -3 }}>₹200</Text>
              <View style={{ padding: SP.xl, alignItems: 'center' }}>
                <Text style={[T.caption, { color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }]}>Your referral code</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(42), color: '#fff', marginTop: 10, letterSpacing: 4 }}>TRENDZO42</Text>
                <Text style={[T.micro, { color: 'rgba(255,255,255,0.55)', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 }]}>Give ₹200 · Get ₹200</Text>
              </View>
            </View>
          </FadeInUp>

          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.s }}>
            <BrutalButton label="Copy code" icon="copy" variant="outline" style={{ flex: 1 }} onPress={() => showToast('Copied', 'Code copied to clipboard', 'copy')} />
            <BrutalButton label="Share" icon="share-2" style={{ flex: 1 }} onPress={() => showToast('Share', 'Share sheet coming soon', 'share-2')} />
          </View>
        </View>

        <SectionHead title="Your stats" />
        <View style={{ paddingHorizontal: SP.l }}>
          <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
            {[{ label: 'INVITED', value: '7', green: false }, { label: 'JOINED', value: '4', green: false }, { label: 'EARNED', value: '₹800', green: true }].map((s, i) => (
              <View key={i} style={[{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white }, i > 0 && { borderLeftWidth: 1, borderColor: C.hairline }]}>
                <Text style={[T.h1, s.green && { color: C.green }]}>{s.value}</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <SectionHead title="How it works" />
        <View style={{ paddingHorizontal: SP.l }}>
          {[
            { i: 1, t: 'Share your code', sub: 'Send TRENDZO42 to your friends' },
            { i: 2, t: 'Friend signs up', sub: 'They apply the code at checkout' },
            { i: 3, t: 'They order', sub: 'First order of ₹499 or more unlocks it' },
            { i: 4, t: 'You both get ₹200', sub: 'Instantly credited to your wallet' },
          ].map(s => (
            <View key={s.i} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
              <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: TILE }, BORDER(1)]}>
                <Text style={[T.bodyB, { color: C.ink }]}>{s.i}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={T.bodyB}>{s.t}</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{s.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATION SETTINGS
// ═══════════════════════════════════════════════════════════
export function NotificationSettingsScreen() {
  const nav = useNavigation<any>();
  const [settings, setSettings] = useState<Record<string, boolean>>({
    orders: true, deals: true, rewards: true, social: false, marketing: false, email: true,
  });
  const toggle = (key: string) => setSettings(p => ({ ...p, [key]: !p[key] }));
  const activeCount = Object.values(settings).filter(Boolean).length;
  const total = Object.keys(settings).length;

  const groups = [
    {
      title: 'ESSENTIAL',
      items: [
        { key: 'orders', label: 'Order updates', sub: 'Shipping, delivery, returns', icon: 'package' },
      ],
    },
    {
      title: 'DEALS & REWARDS',
      items: [
        { key: 'deals', label: 'Deals & flash sales', sub: 'Price drops, limited offers', icon: 'tag' },
        { key: 'rewards', label: 'Rewards & streaks', sub: 'Points, daily rewards, spin', icon: 'gift' },
      ],
    },
    {
      title: 'OPTIONAL',
      items: [
        { key: 'social', label: 'Social activity', sub: 'Likes, follows, comments', icon: 'heart' },
        { key: 'marketing', label: 'Marketing', sub: 'New collections, brand drops', icon: 'megaphone' as any },
        { key: 'email', label: 'Email notifications', sub: 'Weekly digest, receipts', icon: 'mail' },
      ],
    },
  ];

  return (
    <PageShell>
      <ScreenHeader title="Notifications" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'PUSH_SETTINGS'}
          title={'Stay in\nthe loop.'}
          intro="Control exactly what pings your phone. Turn off the noise, keep what matters."
          chips={[{ label: `${activeCount}/${total} ACTIVE`, solid: true }]}
        />

        {groups.map(grp => (
          <View key={grp.title}>
            <SectionHead title={grp.title} />
            <View style={{ paddingHorizontal: SP.l }}>
              <View style={[{ backgroundColor: C.white }, BORDER(1)]}>
                {grp.items.map((item, i) => {
                  const on = settings[item.key];
                  return (
                    <Pressable key={item.key} onPress={() => toggle(item.key)} style={[{ padding: SP.m, flexDirection: 'row', alignItems: 'center' }, i < grp.items.length - 1 && { borderBottomWidth: 1, borderColor: C.hairline }]}>
                      <IconTile icon={item.icon as string} size={36} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={T.bodyB}>{item.label}</Text>
                        <Text style={[T.caption, { color: C.dim, marginTop: 2 }]}>{item.sub}</Text>
                      </View>
                      <View style={[{ width: 44, height: 24, justifyContent: 'center', padding: 2, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                        <View style={{ width: 16, height: 16, backgroundColor: on ? C.white : C.ink, alignSelf: on ? 'flex-end' : 'flex-start' }} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// LANGUAGE
// ═══════════════════════════════════════════════════════════
const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', region: 'GLOBAL' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', region: 'IN' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', region: 'IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', region: 'IN' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', region: 'IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', region: 'IN' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', region: 'IN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', region: 'IN' },
];

export function LanguageScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [selected, setSelected] = useState('en');
  return (
    <PageShell>
      <ScreenHeader title="Language" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'LOCALE · 8 LANGUAGES'}
          title={'Choose\nlanguage.'}
          intro="Switch the app interface to your preferred language. Changes apply immediately."
          chips={[{ label: 'Current: ' + (LANGUAGES.find(l => l.code === selected)?.label || 'English'), solid: true }]}
        />

        <SectionHead title="All languages" right={`${LANGUAGES.length} available`} />
        <View style={{ paddingHorizontal: SP.l }}>
          <View style={[{ backgroundColor: C.white }, BORDER(1)]}>
            {LANGUAGES.map((lang, i) => {
              const on = selected === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => { setSelected(lang.code); showToast('Language', `${lang.label} selected`, 'globe'); }}
                  style={[
                    { padding: SP.m, flexDirection: 'row', alignItems: 'center' },
                    i < LANGUAGES.length - 1 && { borderBottomWidth: 1, borderColor: C.hairline },
                  ]}
                >
                  <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: TILE }, BORDER(1)]}>
                    <Text style={[T.caption, { color: C.ink }]}>{lang.code.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[T.body, { color: C.ink, fontFamily: on ? 'Inter_700Bold' : undefined }]}>{lang.label}</Text>
                    <Text style={[T.caption, { color: C.dim, marginTop: 2 }]}>{lang.native}</Text>
                  </View>
                  <Text style={[T.micro, { color: C.dim, marginRight: 12 }]}>{lang.region}</Text>
                  <View style={[{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.ink : C.white }, BORDER(1), on && { borderColor: C.ink }]}>
                    {on && <Feather name="check" size={13} color={C.white} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// CUSTOMER SUPPORT
// ═══════════════════════════════════════════════════════════
const SUPPORT_CONTACTS = [
  { key: 'chat', label: 'Live chat', sub: 'Online now · avg 2 min', icon: 'message-circle', toast: ['Live chat', 'Connecting you to an agent', 'message-circle'] as const },
  { key: 'call', label: 'Call us', sub: 'Mon–Sun · 9am–9pm', icon: 'phone', toast: ['Call support', '1800-266-0000', 'phone'] as const },
  { key: 'email', label: 'Email', sub: 'care@trendzo.in · replies in 24h', icon: 'mail', toast: ['Email support', 'care@trendzo.in', 'mail'] as const },
];

const SUPPORT_TOPICS = [
  { label: 'Track my order', icon: 'package' },
  { label: 'Return or exchange', icon: 'rotate-ccw' },
  { label: 'Payment & refunds', icon: 'credit-card' },
  { label: 'Size & fit help', icon: 'maximize' },
];

const SUPPORT_FAQ = [
  { q: 'How long does delivery take?', a: 'Standard delivery lands in 3–5 days. Metro cities often get it next-day. Try & Buy orders are delivered the following day.' },
  { q: 'What is the return window?', a: 'You have 7 days from delivery to start a free return. We schedule a doorstep pickup and refund within 3–5 days of receiving the item.' },
  { q: 'When will I get my refund?', a: 'Refunds hit the original payment method 3–5 working days after we collect the return. Wallet refunds are instant.' },
  { q: 'How do I use a gift card or coupon?', a: 'Apply it at checkout under “Apply code”. Gift cards never expire and can be combined with most offers.' },
  { q: 'Can I change my delivery address?', a: 'Yes — as long as the order has not shipped. Head to Orders, open the order, and tap “Change address”.' },
];

export function CustomerSupportScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PageShell>
      <ScreenHeader title="Help Center" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'HELP_CENTER · 24×7'}
          title={'We got\nyou.'}
          intro="Browse answers or reach a human — support is online around the clock."
          chips={[{ label: 'ONLINE NOW', solid: true }, { label: 'AVG 2 MIN' }]}
        />

        <SectionHead title="Contact us" />
        <View style={{ paddingHorizontal: SP.l }}>
          {SUPPORT_CONTACTS.map((c, i) => (
            <Pressable key={c.key} onPress={() => showToast(c.toast[0], c.toast[1], c.toast[2])} style={[{ marginTop: i === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
              <IconTile icon={c.icon} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={T.bodyB}>{c.label}</Text>
                <Text style={[T.caption, { color: C.dim, marginTop: 2 }]}>{c.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={C.ink} />
            </Pressable>
          ))}
        </View>

        <SectionHead title="Popular topics" />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
          {SUPPORT_TOPICS.map(t => (
            <Pressable key={t.label} onPress={() => showToast(t.label, 'Opening help article', t.icon)} style={[{ width: '48.5%', padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', gap: 10 }, BORDER(1)]}>
              <Feather name={t.icon as any} size={16} color={C.ink} />
              <Text style={[T.caption, { color: C.ink, flex: 1 }]} numberOfLines={2}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <SectionHead title="FAQ" right={`${SUPPORT_FAQ.length} answers`} />
        <View style={{ paddingHorizontal: SP.l }}>
          <View style={[{ backgroundColor: C.white }, BORDER(1)]}>
            {SUPPORT_FAQ.map((f, i) => {
              const open = openFaq === i;
              return (
                <View key={i} style={i < SUPPORT_FAQ.length - 1 ? { borderBottomWidth: 1, borderColor: C.hairline } : undefined}>
                  <Pressable onPress={() => setOpenFaq(open ? null : i)} style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, gap: 12 }}>
                    <Text style={[T.body, { flex: 1, fontFamily: open ? 'Inter_700Bold' : undefined }]}>{f.q}</Text>
                    <Feather name={open ? 'minus' : 'plus'} size={16} color={C.ink} />
                  </Pressable>
                  {open && (
                    <View style={{ paddingHorizontal: SP.m, paddingBottom: SP.m, marginTop: -4 }}>
                      <Text style={[T.caption, { color: C.dim, lineHeight: rf(19) }]}>{f.a}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLE PREFERENCES
// ═══════════════════════════════════════════════════════════
export function StylePreferencesScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [vibes, setVibes] = useState<string[]>(['MINIMAL', 'STREET']);
  const [sizes, setSizes] = useState<string[]>(['M', 'L']);
  const [colors, setColors] = useState<number[]>([0, 3]);
  const allVibes = ['MINIMAL', 'STREET', 'PREPPY', 'Y2K', 'VINTAGE', 'GRUNGE', 'COTTAGECORE', 'DARK ACADEMIA'];
  const allSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const swatches = ['#000', '#fff', '#8B4513', '#1a1a2e', '#e8d5c4', '#ff6b6b'];

  const toggle = <T,>(arr: T[], setter: (v: T[]) => void, v: T) => setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const swatchNames = ['Black', 'White', 'Tan', 'Navy', 'Beige', 'Coral'];
  return (
    <PageShell>
      <ScreenHeader title="Style & Fit" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Hero
          title={'Your\nAesthetic'}
          intro="Pick your vibes, sizes and colours — your feed tunes itself to match."
          chips={[{ label: `${vibes.length} vibes` }, { label: `${sizes.length} sizes` }, { label: `${colors.length} colours` }]}
        />

        {/* ─── VIBES — selectable 2-col tiles ─── */}
        <Text style={[T.h3, { textTransform: 'uppercase', paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.s }]}>Your Vibe</Text>
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
          {allVibes.map(v => {
            const on = vibes.includes(v);
            return (
              <Pressable key={v} onPress={() => toggle(vibes, setVibes, v)} style={[{ width: '48.5%', paddingVertical: 16, paddingHorizontal: 14, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, BORDER(1)]}>
                <Text style={[T.body, { color: on ? '#fff' : C.ink, fontFamily: on ? 'Inter_700Bold' : 'Inter_400Regular' }]}>{sentence(v)}</Text>
                {on && <Feather name="check" size={16} color="#fff" />}
              </Pressable>
            );
          })}
        </View>

        {/* ─── COLOURS — labelled swatches ─── */}
        <Text style={[T.h3, { textTransform: 'uppercase', paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.s }]}>Colours You Love</Text>
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.m }}>
          {swatches.map((c, i) => {
            const on = colors.includes(i);
            const light = c === '#fff' || c === '#e8d5c4';
            return (
              <Pressable key={i} onPress={() => toggle(colors, setColors, i)} style={{ alignItems: 'center', width: 48 }}>
                <View style={[{ width: 48, height: 48, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }, BORDER(on ? 2 : 1)]}>
                  {on && <Feather name="check" size={16} color={light ? C.ink : '#fff'} />}
                </View>
                <Text style={[T.micro, { color: on ? C.ink : C.dim, marginTop: 5, fontFamily: on ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>{swatchNames[i]}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── SIZES ─── */}
        <Text style={[T.h3, { textTransform: 'uppercase', paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.s }]}>Your Sizes</Text>
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', gap: SP.s, flexWrap: 'wrap' }}>
          {allSizes.map(s => {
            const on = sizes.includes(s);
            return (
              <Pressable key={s} onPress={() => toggle(sizes, setSizes, s)} style={[{ width: 52, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                <Text style={[T.body, { color: on ? '#fff' : C.ink, fontFamily: on ? 'Inter_700Bold' : 'Inter_400Regular' }]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: SP.l }}>
          <BrutalButton label="Save preferences" icon="check" block onPress={() => { showToast('Saved', 'Style preferences updated', 'check'); nav.goBack(); }} style={{ marginTop: SP.xl }} />
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// MEASUREMENTS
// ═══════════════════════════════════════════════════════════
export function MeasurementScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [unit, setUnit] = useState<'CM' | 'IN'>('CM');
  const measurements = [
    { label: 'Height', valueCm: 175, icon: 'arrow-up' },
    { label: 'Chest', valueCm: 96, icon: 'maximize' },
    { label: 'Waist', valueCm: 82, icon: 'minus' },
    { label: 'Hips', valueCm: 98, icon: 'maximize-2' },
    { label: 'Shoulder', valueCm: 44, icon: 'move' },
    { label: 'Inseam', valueCm: 78, icon: 'arrow-down' },
    { label: 'Arm length', valueCm: 62, icon: 'git-commit' },
    { label: 'Neck', valueCm: 38, icon: 'circle' },
  ];
  const convert = (cm: number) => unit === 'CM' ? `${cm} cm` : `${(cm / 2.54).toFixed(1)} in`;

  return (
    <PageShell>
      <ScreenHeader title="Measurements" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'BODY_SCAN · 8 POINTS'}
          title={'Your\nmeasurements.'}
          intro="Accurate sizing means fewer returns. Update anytime — we use this to recommend fits."
          chips={[{ label: 'MALE · 28Y' }, { label: 'SIZE M / L' }]}
        />

        <SectionLabel label="UNIT" />
        <View style={[{ flexDirection: 'row', marginTop: 8, overflow: 'hidden' }, BORDER(1)]}>
          {(['CM', 'IN'] as const).map((u, i) => (
            <Pressable
              key={u}
              onPress={() => setUnit(u)}
              style={[
                { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: unit === u ? C.ink : C.white },
                i > 0 && { borderLeftWidth: 1, borderColor: C.hairline },
              ]}
            >
              <Text style={[T.caption, { color: unit === u ? C.white : C.ink }]}>{u}</Text>
            </Pressable>
          ))}
        </View>

        <SectionLabel label="POINTS" right={`${measurements.length} recorded`} />
        {/* Compact list — icon tile · label · value (no oversized numerals) */}
        <View style={[{ marginTop: 8 }, BORDER(1)]}>
          {measurements.map((m, i) => (
            <View key={m.label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 11, borderTopWidth: i > 0 ? 1 : 0, borderColor: C.hairline }}>
              <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: TILE }, BORDER(1)]}>
                <Feather name={m.icon as any} size={14} color={C.ink} />
              </View>
              <Text style={[T.body, { flex: 1, marginLeft: 10 }]}>{m.label}</Text>
              <Text style={[T.body, { fontFamily: 'Inter_700Bold' }]}>{convert(m.valueCm)}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l }}>
          <BrutalButton label="Edit" icon="edit-2" variant="outline" style={{ flex: 1 }} onPress={() => showToast('Edit', 'Measurement editor coming soon', 'edit-2')} />
          <BrutalButton label="Scan with AR" icon="camera" style={{ flex: 1 }} onPress={() => nav.navigate('TryOn')} />
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// FASHION CALENDAR
// ═══════════════════════════════════════════════════════════
export function FashionCalendarScreen() {
  const nav = useNavigation<any>();
  const events = [
    { date: 'APR 15', day: 'TUE', title: 'Summer Drop', sub: 'New arrivals from 12 brands', icon: 'sun', tag: 'NEW' },
    { date: 'APR 20', day: 'SUN', title: 'Flash Sale', sub: 'Up to 70% off · 24 hours only', icon: 'zap', tag: 'HOT' },
    { date: 'MAY 01', day: 'THU', title: 'Brand Collab', sub: 'NORTH. × AZUKI limited edition', icon: 'star', tag: 'EXCLUSIVE' },
    { date: 'MAY 10', day: 'SAT', title: 'Festival Edit', sub: 'Curated festive collection', icon: 'gift', tag: 'CURATED' },
    { date: 'MAY 25', day: 'SUN', title: 'End of Season', sub: 'Clearance sale starts', icon: 'tag', tag: 'SALE' },
    { date: 'JUN 01', day: 'SUN', title: 'Monsoon Ready', sub: 'Waterproof & layering essentials', icon: 'cloud', tag: 'PREVIEW' },
  ];

  return (
    <PageShell>
      <ScreenHeader title="Calendar" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'UPCOMING · 6 EVENTS'}
          title={'Fashion\ncalendar.'}
          intro="Drops, sales, collabs — everything we've got lined up."
          chips={[{ label: 'APR—JUN 2026', solid: true }]}
        />

        <SectionHead title="Upcoming" right={`${events.length} events`} />
        <View style={{ paddingHorizontal: SP.l }}>
          {events.map((e, i) => (
            <FadeInUp key={i} delay={i * 50}>
              <View style={{ flexDirection: 'row' }}>
                {/* Timeline rail — node + connecting line */}
                <View style={{ width: 28, alignItems: 'center' }}>
                  <View style={[{ width: 12, height: 12, backgroundColor: C.ink, marginTop: 4 }]} />
                  {i < events.length - 1 && <View style={{ flex: 1, width: 1, backgroundColor: C.hairline, marginTop: 2 }} />}
                </View>
                {/* Content card */}
                <View style={{ flex: 1, paddingBottom: SP.s }}>
                  <View style={[{ backgroundColor: C.white, padding: SP.m }, BORDER(1)]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: C.ink }}>
                        <Text style={[T.micro, { color: C.white, letterSpacing: 0.5 }]}>{e.tag}</Text>
                      </View>
                      <Text style={[T.micro, { color: C.dim }]}>{e.day} · {e.date}</Text>
                      <View style={{ flex: 1 }} />
                      <Feather name={e.icon as any} size={13} color={C.dim} />
                    </View>
                    <Text style={T.h3}>{e.title}</Text>
                    <Text style={[T.caption, { color: C.dim, marginTop: 3 }]}>{e.sub}</Text>
                  </View>
                </View>
              </View>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// SUSTAINABILITY
// ═══════════════════════════════════════════════════════════
export function SustainabilityScreen() {
  const nav = useNavigation<any>();
  const impact = [
    { label: 'TREES SAVED', value: '12' },
    { label: 'CO₂ OFFSET', value: '84kg' },
    { label: 'WATER SAVED', value: '1.2K L' },
  ];
  const pillars = [
    { title: 'Eco-friendly packaging', sub: '100% recyclable materials for all shipments', icon: 'package' },
    { title: 'Carbon neutral delivery', sub: 'We offset every delivery with verified carbon credits', icon: 'wind' },
    { title: 'Ethical sourcing', sub: 'Fair wages and safe conditions for all workers', icon: 'heart' },
    { title: 'Second life program', sub: 'Donate old clothes for Trendzo credits', icon: 'refresh-cw' },
    { title: 'Sustainable brands', sub: '40+ eco-conscious brands on the platform', icon: 'award' },
  ];
  return (
    <PageShell>
      <ScreenHeader title="Eco" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'ECO_MODE · IMPACT_2026'}
          title={'Fashion\nfor good.'}
          intro="Our commitment to sustainable fashion and ethical production — measurable, not marketing."
          chips={[{ label: 'CARBON NEUTRAL', solid: true }, { label: 'B-CORP' }]}
        />

        <SectionHead title="Your impact" right="this year" />
        <View style={{ paddingHorizontal: SP.l }}>
          <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
            {impact.map((s, i) => (
              <View key={i} style={[{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white }, i > 0 && { borderLeftWidth: 1, borderColor: C.hairline }]}>
                <Text style={[T.h2, { color: C.green }]}>{s.value}</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <SectionHead title="Pillars" />
        <View style={{ paddingHorizontal: SP.l }}>
          {pillars.map((item, i) => (
            <FadeInUp key={i} delay={i * 50}>
              <View style={[{ marginTop: i === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconTile icon={item.icon} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={T.bodyB}>{item.title}</Text>
                    <Text style={[T.caption, { color: C.dim, marginTop: 3 }]}>{item.sub}</Text>
                  </View>
                  <Text style={[T.micro, { color: C.dim }]}>{String(i + 1).padStart(2, '0')}</Text>
                </View>
              </View>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// ORDER RETURN
// ═══════════════════════════════════════════════════════════
const RETURNABLE_ORDERS = [
  {
    id: 'CX10442', date: '02 APR 2026', daysLeft: 3,
    items: [
      { id: 'i1', name: 'Oversized Wool Coat', brand: 'NORTH.', price: 4990 },
      { id: 'i2', name: 'Slim Fit Jeans', brand: 'YORK', price: 1500 },
    ],
  },
  {
    id: 'CX10388', date: '18 MAR 2026', daysLeft: 1,
    items: [
      { id: 'i3', name: 'Cotton Tee · Ecru', brand: 'AZUKI', price: 990 },
    ],
  },
  {
    id: 'CX10188', date: '25 JAN 2026', daysLeft: 0,
    items: [
      { id: 'i4', name: 'Leather Sneakers', brand: 'YORK', price: 4490 },
    ],
  },
];

type ReturnStep = 'order' | 'item' | 'reason';

export function OrderReturnScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [step, setStep] = useState<ReturnStep>('order');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const reasons = [
    { label: 'Wrong size', icon: 'maximize' },
    { label: 'Defective item', icon: 'alert-triangle' },
    { label: 'Not as described', icon: 'x-circle' },
    { label: 'Changed my mind', icon: 'rotate-ccw' },
    { label: 'Better price elsewhere', icon: 'tag' },
  ];

  const selectedOrder = RETURNABLE_ORDERS.find(o => o.id === orderId);
  const selectedItem = selectedOrder?.items.find(i => i.id === itemId);

  const pickOrder = (id: string) => {
    const o = RETURNABLE_ORDERS.find(x => x.id === id)!;
    if (o.daysLeft <= 0) {
      showToast('Return window closed', '7-day window has ended', 'alert-triangle');
      return;
    }
    setOrderId(id);
    setItemId(null);
    setStep('item');
  };

  const pickItem = (id: string) => {
    setItemId(id);
    setStep('reason');
  };

  const back = () => {
    if (step === 'reason') { setStep('item'); setReason(''); return; }
    if (step === 'item') { setStep('order'); setItemId(null); return; }
    nav.goBack();
  };

  const submit = () => {
    showToast('Return initiated', 'Pickup scheduled for tomorrow', 'rotate-ccw');
    nav.goBack();
  };

  // Progress bar — shows current step of 3
  const stepIndex = step === 'order' ? 0 : step === 'item' ? 1 : 2;
  const stepLabels = ['Order', 'Item', 'Reason'];

  return (
    <PageShell>
      <ScreenHeader title="Returns" onBack={back} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'RETURN_FLOW · 7D'}
          title={'Easy\nreturns.'}
          intro="7-day hassle-free returns. Pickup from your door. Refund in 3-5 days."
          chips={[{ label: `STEP ${stepIndex + 1}/3`, solid: true }, { label: 'FREE PICKUP' }]}
        />

        {/* Step progress — numbered nodes with a connecting track */}
        <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, marginTop: SP.l }}>
          {stepLabels.map((label, i) => {
            const active = i === stepIndex;
            const done = i < stepIndex;
            const reached = active || done;
            return (
              <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                {i > 0 && <View style={{ position: 'absolute', top: 13, right: '50%', left: '-50%', height: 2, backgroundColor: reached ? C.ink : C.hairline }} />}
                <View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: reached ? C.ink : '#fff' }, BORDER(1)]}>
                  {done ? <Feather name="check" size={13} color="#fff" /> : <Text style={[T.micro, { color: active ? '#fff' : C.dim }]}>{i + 1}</Text>}
                </View>
                <Text style={[T.micro, { color: reached ? C.ink : C.dim, fontFamily: active ? 'Inter_700Bold' : undefined, marginTop: 6, textTransform: 'uppercase' }]}>{label}</Text>
              </View>
            );
          })}
        </View>

        {/* ── STEP 1: PICK ORDER ── */}
        {step === 'order' && (
          <View style={{ paddingHorizontal: SP.l }}>
            <SectionHead title="Select order" right={`${RETURNABLE_ORDERS.length} eligible`} style={{ paddingHorizontal: 0 }} />
            {RETURNABLE_ORDERS.map((o, i) => {
              const expired = o.daysLeft <= 0;
              return (
                <FadeInUp key={o.id} delay={i * 40}>
                  <Pressable
                    onPress={() => pickOrder(o.id)}
                    style={[
                      { marginTop: SP.s, backgroundColor: expired ? C.white : C.white, opacity: expired ? 0.55 : 1 },
                      BORDER(1),
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[T.caption, { color: C.ink }]}>{`#${o.id}`}</Text>
                        <Text style={[T.micro, { marginTop: 2 }]}>{o.date} · {o.items.length} item{o.items.length !== 1 ? 's' : ''}</Text>
                      </View>
                      <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: expired ? C.white : C.ink }, BORDER(1)]}>
                        <Text style={[T.caption, { color: expired ? C.ink : C.white }]}>
                          {expired ? 'Window closed' : `${o.daysLeft}D LEFT`}
                        </Text>
                      </View>
                    </View>
                    <View style={{ padding: SP.m, gap: 6 }}>
                      {o.items.map(it => (
                        <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[T.micro, { color: C.dim, width: 48 }]}>{it.brand}</Text>
                          <Text style={[T.productName, { flex: 1 }]} numberOfLines={1}>{it.name}</Text>
                          <Text style={[T.caption, { color: C.ink }]}>₹{it.price}</Text>
                        </View>
                      ))}
                    </View>
                    {!expired && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', padding: SP.m, borderTopWidth: 1, borderColor: C.hairline, gap: 4 }}>
                        <Text style={[T.caption, { color: C.ink }]}>Choose item</Text>
                        <Feather name="chevron-right" size={14} color={C.ink} />
                      </View>
                    )}
                  </Pressable>
                </FadeInUp>
              );
            })}
          </View>
        )}

        {/* ── STEP 2: PICK ITEM ── */}
        {step === 'item' && selectedOrder && (
          <View style={{ paddingHorizontal: SP.l }}>
            <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: TILE }, BORDER(1)]}>
              <Text style={[T.micro, { color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{'Selected order'}</Text>
              <Text style={[T.h3, { color: C.ink, marginTop: 4 }]}>{`#${selectedOrder.id}`}</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{selectedOrder.date} · {selectedOrder.daysLeft}D left in window</Text>
            </View>

            <SectionHead title="Select item to return" right={`${selectedOrder.items.length} items`} style={{ paddingHorizontal: 0 }} />
            {selectedOrder.items.map((it, i) => {
              const on = itemId === it.id;
              return (
                <FadeInUp key={it.id} delay={i * 40}>
                  <Pressable onPress={() => pickItem(it.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                    <IconTile icon="shopping-bag" size={44} on={on} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.6)' : C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{it.brand}</Text>
                      <Text style={[T.bodyB, { color: on ? C.white : C.ink, marginTop: 2 }]}>{it.name}</Text>
                      <Text style={[T.caption, { color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 2 }]}>₹{it.price}</Text>
                    </View>
                    <Feather name={on ? 'check' : 'chevron-right'} size={16} color={on ? C.white : C.ink} />
                  </Pressable>
                </FadeInUp>
              );
            })}
          </View>
        )}

        {/* ── STEP 3: PICK REASON ── */}
        {step === 'reason' && selectedOrder && selectedItem && (
          <View style={{ paddingHorizontal: SP.l }}>
            <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: TILE }, BORDER(1)]}>
              <Text style={[T.micro, { color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{'Returning'}</Text>
              <Text style={[T.h3, { color: C.ink, marginTop: 4 }]}>{selectedItem.name}</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{selectedItem.brand} · ₹{selectedItem.price} · from #{selectedOrder.id}</Text>
            </View>

            <SectionHead title="Why are you returning?" style={{ paddingHorizontal: 0 }} />
            {reasons.map((r, i) => {
              const on = reason === r.label;
              return (
                <FadeInUp key={r.label} delay={i * 30}>
                  <Pressable onPress={() => setReason(r.label)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                    <IconTile icon={r.icon} size={36} on={on} />
                    <Text style={[T.body, { color: on ? C.white : C.ink, flex: 1, marginLeft: 12 }]}>{r.label}</Text>
                    {on && <Feather name="check" size={16} color={C.white} />}
                  </Pressable>
                </FadeInUp>
              );
            })}

            <BrutalButton label="Initiate return" icon="rotate-ccw" block disabled={!reason} onPress={submit} style={{ marginTop: SP.xl }} />
          </View>
        )}
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════
const MOCK_REVIEWS = [
  { id: '1', product: 'Oversized Wool Coat', brand: 'NORTH.', rating: 5, text: 'Absolutely love the quality. Fits perfectly!', date: '2 days ago', likes: 12 },
  { id: '2', product: 'Slim Fit Jeans', brand: 'YORK', rating: 4, text: 'Great denim, slightly long for my height.', date: '1 week ago', likes: 4 },
  { id: '3', product: 'Cotton Tee', brand: 'AZUKI', rating: 5, text: 'Super soft fabric, true to size.', date: '2 weeks ago', likes: 8 },
];

export function ReviewsScreen() {
  const nav = useNavigation<any>();
  const [filter, setFilter] = useState<'ALL' | '5' | '4' | '3'>('ALL');
  const filtered = MOCK_REVIEWS.filter(r => filter === 'ALL' || r.rating === Number(filter));
  const avg = (MOCK_REVIEWS.reduce((s, r) => s + r.rating, 0) / MOCK_REVIEWS.length).toFixed(1);

  return (
    <PageShell>
      <ScreenHeader title="Reviews" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'YOUR_REVIEWS'}
          title={'Your\nfeedback.'}
          intro="The reviews you've left. Brands listen — your words help others shop better."
          chips={[{ label: `${MOCK_REVIEWS.length} POSTED`, solid: true }, { label: `AVG ${avg}★` }, { label: 'HELPFUL' }]}
        />

        {/* Summary strip */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white }}>
              <Text style={T.h1}>{avg}</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Avg rating</Text>
            </View>
            <View style={{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white, borderLeftWidth: 1, borderColor: C.hairline }}>
              <Text style={T.h1}>{MOCK_REVIEWS.length}</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Reviews</Text>
            </View>
          </View>
        </View>

        <SectionHead title="Filter" />
        <View style={{ flexDirection: 'row', gap: SP.s, paddingHorizontal: SP.l }}>
          {(['ALL', '5', '4', '3'] as const).map(f => (
            <Chip key={f} label={f === 'ALL' ? 'ALL' : `${f} STAR`} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>

        <SectionHead title="Posted" right={`${filtered.length} results`} />
        <View style={{ paddingHorizontal: SP.l }}>
          {filtered.map((r, i) => (
            <FadeInUp key={r.id} delay={i * 50}>
              <View style={[{ marginTop: i === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.micro, { color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{r.brand}</Text>
                    <Text style={[T.bodyB, { marginTop: 2 }]}>{r.product}</Text>
                  </View>
                  <Text style={[T.micro, { color: C.dim }]}>{r.date}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 8 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Text key={s} style={[T.h3, { color: s <= r.rating ? C.ink : C.hairline }]}>★</Text>
                  ))}
                </View>
                <Text style={[T.body, { marginTop: 8 }]}>{r.text}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: C.hairline, gap: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Feather name="thumbs-up" size={12} color={C.ink} />
                    <Text style={[T.micro, { color: C.dim }]}>{r.likes} helpful</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Feather name="edit-2" size={12} color={C.dim} />
                    <Text style={[T.micro, { color: C.dim }]}>Edit</Text>
                  </View>
                </View>
              </View>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// STORE PICKUP
// ═══════════════════════════════════════════════════════════
const PICKUP_STORES = [
  { id: 's1', name: 'NORTH. × ANDHERI', addr: 'Infiniti Mall, Level 2', dist: '2.4 KM', eta: '45 MIN', open: 'Open · closes 10pm' },
  { id: 's2', name: 'YORK × BANDRA', addr: 'Linking Road, Bandra West', dist: '4.1 KM', eta: '55 MIN', open: 'Open · closes 11pm' },
  { id: 's3', name: 'KOH × BKC', addr: 'Jio World Drive, BKC', dist: '5.8 KM', eta: '65 MIN', open: 'Open · closes 10pm' },
  { id: 's4', name: 'AZUKI × POWAI', addr: 'Hiranandani Gardens', dist: '7.2 KM', eta: '75 MIN', open: 'Open · closes 9pm' },
];

export function StorePickupScreen() {
  const nav = useNavigation<any>();
  const [picked, setPicked] = useState('s1');

  return (
    <PageShell>
      <ScreenHeader title="Store Pickup" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Hero
          code={'PICKUP · ZERO_DELIVERY_FEE'}
          title={'Buy online.\nPick it up.'}
          intro="Skip delivery. Grab your order from your nearest store — usually ready in under an hour."
          chips={[{ label: 'FREE', solid: true }, { label: 'IN STORE' }, { label: '4 STORES' }]}
          inverted
        />

        <SectionHead title="How it works" />
        <View style={{ paddingHorizontal: SP.l }}>
          {[
            { i: 1, t: 'Shop as normal', sub: 'Add anything from the app to your bag' },
            { i: 2, t: 'Pick in-store pickup at checkout', sub: 'Choose your nearest store from the list' },
            { i: 3, t: "We ping you when it's ready", sub: 'Show the QR at the counter — walk out with it' },
          ].map((step, i) => (
            <View key={step.i} style={[{ marginTop: i === 0 ? 0 : SP.s, flexDirection: 'row', padding: SP.m, gap: 12, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: TILE }, BORDER(1)]}>
                <Text style={[T.bodyB, { color: C.ink }]}>{step.i}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.bodyB}>{step.t}</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{step.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <SectionHead title="Stores near you" right={`${PICKUP_STORES.length} found`} />
        <View style={{ paddingHorizontal: SP.l }}>
          {PICKUP_STORES.map((st, idx) => {
            const on = picked === st.id;
            return (
              <Pressable key={st.id} onPress={() => setPicked(st.id)} style={[{ marginTop: idx === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <IconTile icon="map-pin" size={44} on={on} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[T.bodyB, { color: on ? C.white : C.ink }]}>{st.name}</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: on ? C.white : C.ink }}>
                        <Text style={[T.micro, { color: on ? C.ink : C.white }]}>{st.dist}</Text>
                      </View>
                    </View>
                    <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 3 }]}>{st.addr}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center' }}>
                      <Text style={[T.caption, { color: on ? C.white : C.ink }]}>Ready in {st.eta}</Text>
                      <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.7)' : C.dim }]}>{st.open}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}

          <BrutalButton label="Shop now — pickup in store" iconRight="arrow-right" block onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} style={{ marginTop: SP.xl }} />
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// TRY & BUY
// ═══════════════════════════════════════════════════════════
export function TryAndBuyScreen() {
  const nav = useNavigation<any>();
  return (
    <PageShell>
      <ScreenHeader title="Try & Buy" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Hero
          code={'TRY_AT_HOME // FREE_RETURNS'}
          title={"Try it.\nKeep it.\nOr don't."}
          intro="Order up to 5 items. Courier waits 15 min at your door. Keep what fits — return the rest on the spot."
          chips={[{ label: '₹99', solid: true }, { label: '15 MIN TRIAL' }, { label: 'FREE RETURNS' }]}
          inverted
        />

        <SectionHead title="How it works" />
        <View style={{ paddingHorizontal: SP.l }}>
          {[
            { i: 1, t: 'Add up to 5 items to your bag' },
            { i: 2, t: 'Pick Try & Buy at checkout' },
            { i: 3, t: 'Courier delivers next day, waits 15 min at your door' },
            { i: 4, t: 'Try everything on — keep what fits' },
            { i: 5, t: 'Return the rest on the spot · zero hassle, zero fee' },
          ].map((step, i) => (
            <View key={step.i} style={{ flexDirection: 'row' }}>
              <View style={{ width: 28, alignItems: 'center' }}>
                <View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                  <Text style={[T.bodyB, { color: C.white }]}>{step.i}</Text>
                </View>
                {i < 4 && <View style={{ flex: 1, width: 1, backgroundColor: C.hairline, marginVertical: 2 }} />}
              </View>
              <View style={{ flex: 1, paddingBottom: i < 4 ? SP.m : 0, paddingLeft: 12, paddingTop: 4 }}>
                <Text style={[T.body, { flex: 1 }]}>{step.t}</Text>
              </View>
            </View>
          ))}
        </View>

        <SectionHead title="Good to know" />
        <View style={{ paddingHorizontal: SP.l }}>
          <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            {[
              'Only get charged for what you keep',
              'COD not available for Try & Buy orders',
              'Max trial slots per month: 3',
              'Must be home when the courier arrives',
            ].map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: i === 0 ? 0 : 10, alignItems: 'center' }}>
                <Feather name="check" size={14} color={C.ink} />
                <Text style={[T.body, { flex: 1 }]}>{t}</Text>
              </View>
            ))}
          </View>

          <BrutalButton label="Shop Try & Buy →" iconRight="arrow-right" block onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} style={{ marginTop: SP.xl }} />
        </View>
      </ScrollView>
    </PageShell>
  );
}
