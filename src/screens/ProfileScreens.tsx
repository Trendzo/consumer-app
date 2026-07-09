// Profile sub-screens — each page has a unique hero banner, structured
// body, and consistent brutalist treatment.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, ASCII, rf } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, BrutalStatusBar, BrutalBox, FadeInUp, BrutalInput, Chip } from '../components/Brutal';
import { useApp } from '../state/AppState';
import {
  listAddresses, createAddress, updateAddress, removeAddress, setDefaultAddress, formatAddress, type Address,
} from '../services/addresses';
import { getLoyalty, type LoyaltyTxn } from '../services/loyalty';
import { getWallet, type WalletTxn } from '../services/wallet';
import { redeemGiftCard, listGiftCards, type GiftCard } from '../services/giftCards';
import { getReferral, redeemReferral, type Referral } from '../services/referrals';
import { listOrders, getOrder, type OrderListRow, type OrderDetailItem } from '../services/orders';
import { listReturns, createReturn, type ReturnRow, type ReasonCategory } from '../services/returns';
import { listIssues, getIssue, createIssue, addIssueMessage, type IssueRow, type IssueDetail } from '../services/issues';

// ═══════════════════════════════════════════════════════════
// SHARED PRIMITIVES — unique hero per screen, shared shell
// ═══════════════════════════════════════════════════════════

function PageShell({ children }: { children: React.ReactNode }) {
  const { night } = useApp();
  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#0a0a0a' : '#FFFFFF' }}>
      <BrutalStatusBar />
      {children}
    </View>
  );
}

type HeroProps = {
  code: string;           // e.g. "ADDRESSES_v1"
  title: string;          // big display copy (can contain \n)
  intro?: string;         // one-line subhead
  chips?: { label: string; solid?: boolean }[];
  inverted?: boolean;     // black bg instead of white
};
function Hero({ code, title, intro, chips, inverted }: HeroProps) {
  const fg = inverted ? C.white : C.ink;
  const bg = inverted ? C.ink : C.white;
  const dim = inverted ? 'rgba(255,255,255,0.6)' : C.dim;
  return (
    <FadeInUp>
      <BrutalBox padded solid={inverted} maxRadius={18}>
        <Text style={[T.mono, { color: dim, fontSize: 9, letterSpacing: 0.6 }]}>{code}</Text>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(36), color: fg, letterSpacing: -1.4, marginTop: 6, lineHeight: rf(38) }}>
          {title}
        </Text>
        {intro && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: inverted ? 'rgba(255,255,255,0.75)' : C.dim, marginTop: 8, lineHeight: 17 }}>{intro}</Text>}
        {chips && chips.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: SP.m, flexWrap: 'wrap' }}>
            {chips.map((ch, i) => (
              <ChipPill key={i} label={ch.label} solid={ch.solid} fg={fg} bg={bg} />
            ))}
          </View>
        )}
      </BrutalBox>
    </FadeInUp>
  );
}

function ChipPill({ label, solid, fg, bg }: { label: string; solid?: boolean; fg: string; bg: string }) {
  return (
    <BrutalBox
      maxRadius={10}
      style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: solid ? fg : 'transparent', borderColor: fg }}
    >
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.6, color: solid ? bg : fg }}>{label}</Text>
    </BrutalBox>
  );
}

function SectionLabel({ label, right }: { label: string; right?: string }) {
  return (
    <View style={{ marginTop: SP.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[T.monoB, { fontSize: 10 }]}>{`${label.toUpperCase()}`}</Text>
        {right && <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{right}</Text>}
      </View>
      <AsciiDivider faint style={{ marginTop: 4 }} />
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_ADDR_FORM); setFormOpen(true); };
  const openEdit = (a: Address) => {
    setEditingId(a.id);
    setForm({ label: a.label ?? '', line1: a.line1, line2: a.line2 ?? '', city: a.city, pincode: a.pincode, stateCode: a.stateCode });
    setFormOpen(true);
  };

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
    const payload = {
      label: form.label.trim() || null,
      line1: form.line1.trim(), line2: form.line2.trim() || null,
      city: form.city.trim(), pincode: form.pincode.trim(), stateCode: form.stateCode.trim().toUpperCase(),
      lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng,
    };
    const req = editingId ? updateAddress(editingId, payload) : createAddress(payload);
    req
      .then(() => { setFormOpen(false); setForm(EMPTY_ADDR_FORM); setEditingId(null); showToast(editingId ? 'Address updated' : 'Address added', 'Saved to your account', 'check'); load(); })
      .catch((e: any) => showToast('Could not save', e?.message || 'Check details / sign in', 'x'))
      .finally(() => setSaving(false));
  };

  return (
    <PageShell>
      <ScreenHeader title="Addresses" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={`ADDRESSES · ${addresses.length} SAVED`}
          title={'YOUR\nADDRESSES.'}
          intro="Deliver to home, office, or anywhere else. One tap to switch."
          chips={[{ label: 'DELIVERY' }]}
        />

        <SectionLabel label="SAVED" right={`${addresses.length} ENTRIES`} />
        {loading && addresses.length === 0 && <Text style={[T.mono, { color: C.dim, marginTop: SP.m }]}>Loading…</Text>}
        {!loading && addresses.length === 0 && <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>No saved addresses yet. Add one below. (Sign in required.)</Text>}
        {addresses.map((a, i) => (
          <FadeInUp key={a.id} delay={i * 60}>
            <View style={[{ marginTop: SP.s, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.ink }}>
                  <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{a.label || 'ADDRESS'}</Text>
                </View>
                {a.isDefault ? (
                  <View style={[{ paddingHorizontal: 6, paddingVertical: 3, marginLeft: 6 }, BORDER(1)]}>
                    <Text style={[T.monoB, { fontSize: 8 }]}>DEFAULT</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => onSetDefault(a)} style={{ marginLeft: 6 }}>
                    <Text style={[T.mono, { fontSize: 9, color: C.dim, textDecorationLine: 'underline' }]}>Set default</Text>
                  </Pressable>
                )}
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => openEdit(a)} style={{ padding: 6, marginLeft: 4 }}>
                  <Feather name="edit-2" size={13} color={C.ink} />
                </Pressable>
                <Pressable onPress={() => onDelete(a)} style={{ padding: 6, marginLeft: 4 }}>
                  <Feather name="trash-2" size={13} color={C.ink} />
                </Pressable>
              </View>
              <View style={{ padding: SP.m }}>
                <Text style={[T.body, { color: C.dim, lineHeight: 18 }]}>{formatAddress(a)}</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>{a.stateCode} · {a.pincode}</Text>
              </View>
            </View>
          </FadeInUp>
        ))}
        <BrutalButton label="Add new address" icon="plus" variant="outline" block onPress={openAdd} style={{ marginTop: SP.l }} />
      </ScrollView>

      <Modal transparent visible={formOpen} animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={[{ backgroundColor: C.bg, padding: SP.l, paddingBottom: 40 }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.m }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(22), color: C.ink }}>{editingId ? 'EDIT ADDRESS' : 'NEW ADDRESS'}</Text>
              <Pressable onPress={() => setFormOpen(false)} hitSlop={10}><Feather name="x" size={22} color={C.ink} /></Pressable>
            </View>
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
            <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 4 }]}>Location approximated to your city — precise map pin coming soon.</Text>
            <BrutalButton label={saving ? 'Saving…' : 'Save address'} icon="check" block onPress={onSave} style={{ marginTop: SP.m, opacity: canSave && !saving ? 1 : 0.5 }} />
          </View>
        </View>
      </Modal>
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
  const { showToast, wallet } = useApp();
  const [selected, setSelected] = useState('1');
  // Real wallet balance on the wallet row; tapping it opens the Wallet screen.
  const methods = PAYMENTS.map((p) =>
    p.type === 'WALLET'
      ? { ...p, sub: `Balance: ₹${((wallet?.balancePaise ?? 0) / 100).toLocaleString('en-IN')}` }
      : p,
  );
  return (
    <PageShell>
      <ScreenHeader title="Payment" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'PAYMENT_METHODS_v2'}
          title={'YOUR\nWALLETS.'}
          intro="UPI, cards, wallets. Pick your default — we remember for next time."
          chips={[{ label: 'SECURE' }, { label: '256-BIT' }, { label: 'PCI DSS' }]}
        />

        <SectionLabel label="METHODS" right={`${methods.length} LINKED`} />
        {methods.map((p, i) => {
          const on = selected === p.id;
          return (
            <FadeInUp key={p.id} delay={i * 60}>
              <Pressable onPress={() => p.type === 'WALLET' ? nav.navigate('Wallet') : setSelected(p.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : C.ink }]}>
                  <Feather name={p.icon as any} size={18} color={on ? C.ink : C.white} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[T.monoB, { fontSize: 9, color: on ? 'rgba(255,255,255,0.7)' : C.dim }]}>{p.type}</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: on ? C.white : C.ink, marginTop: 2 }}>{p.label}</Text>
                  <Text style={[T.mono, { fontSize: 9, color: on ? 'rgba(255,255,255,0.6)' : C.dim, marginTop: 2 }]}>{p.sub}</Text>
                </View>
                <View style={[{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : 'transparent' }, BORDER(1), on && { borderColor: C.white }]}>
                  {on && <Feather name="check" size={13} color={C.ink} />}
                </View>
              </Pressable>
            </FadeInUp>
          );
        })}

        <SectionLabel label="ADD NEW" />
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
          {[
            { icon: 'smartphone', label: 'UPI' },
            { icon: 'credit-card', label: 'CARD' },
            { icon: 'briefcase', label: 'WALLET' },
          ].map(o => (
            <Pressable key={o.label} onPress={() => showToast('Add ' + o.label, 'Coming soon', 'plus')} style={[{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <Feather name={o.icon as any} size={18} color={C.ink} />
              <Text style={[T.monoB, { fontSize: 10, marginTop: 6 }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// WALLET — ledger-backed balance + transactions + gift-card redeem
// ═══════════════════════════════════════════════════════════
export function WalletScreen() {
  const nav = useNavigation<any>();
  const { wallet, refreshWallet, showToast } = useApp();
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const balance = wallet?.balancePaise ?? 0;

  const load = useCallback(() => {
    refreshWallet();
    getWallet({ limit: 30 }).then((w) => setTxns(w.transactions)).catch(() => {});
  }, [refreshWallet]);
  useEffect(() => { load(); }, [load]);

  const redeem = () => {
    const c = code.trim().toUpperCase();
    if (!c || redeeming) return;
    setRedeeming(true);
    redeemGiftCard(c)
      .then((r) => { showToast('Gift card redeemed', `₹${(r.creditedPaise / 100).toFixed(0)} added`, 'gift'); setCode(''); load(); })
      .catch((e: any) => showToast('Could not redeem', e?.message || 'Check the code', 'x'))
      .finally(() => setRedeeming(false));
  };

  return (
    <PageShell>
      <ScreenHeader title="Wallet" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <View style={[{ padding: SP.l, backgroundColor: C.ink }, BORDER(1)]}>
            <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{'TRENDZO WALLET · BALANCE'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(56), color: C.white, letterSpacing: -2, marginTop: 6, lineHeight: rf(58) }}>₹{(balance / 100).toLocaleString('en-IN')}</Text>
            <Text style={[T.mono, { color: C.white, opacity: 0.6, marginTop: 4, fontSize: 10 }]}>Used automatically at checkout</Text>
          </View>
        </FadeInUp>

        <SectionLabel label="ADD FUNDS · REDEEM A GIFT CARD" />
        <View style={{ marginTop: 8, flexDirection: 'row', gap: SP.s, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <BrutalInput value={code} onChangeText={(v: string) => setCode(v.toUpperCase())} placeholder="GIFT CARD CODE" label="Code" icon="gift" autoCapitalize="characters" />
          </View>
          <BrutalButton label={redeeming ? '…' : 'Redeem'} icon="download" onPress={redeem} style={{ marginBottom: 2 }} />
        </View>

        <SectionLabel label="TRANSACTIONS" right={`${txns.length}`} />
        {txns.length === 0 && <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>No wallet activity yet.</Text>}
        {txns.map((t) => (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: SP.s, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.hairline }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyB, { fontSize: 13 }]}>{t.note || t.kind.replace(/_/g, ' ')}</Text>
              <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 1 }]}>{new Date(t.at).toLocaleDateString()}</Text>
            </View>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: t.amountPaise >= 0 ? C.ink : C.dim }}>
              {t.amountPaise >= 0 ? '+' : '−'}₹{Math.abs(t.amountPaise / 100).toFixed(0)}
            </Text>
          </View>
        ))}
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
  const { loyalty, refreshLoyalty } = useApp();
  const points = loyalty?.balancePoints ?? 0;
  const [history, setHistory] = useState<LoyaltyTxn[]>([]);
  useEffect(() => {
    refreshLoyalty();
    getLoyalty({ limit: 20 }).then((l) => setHistory(l.transactions)).catch(() => {});
  }, [refreshLoyalty]);
  const currentTier = TIERS.filter(t => points >= t.min).pop()!;
  const nextTier = TIERS[TIERS.indexOf(currentTier) + 1];
  const progress = nextTier ? points / nextTier.min : 1;

  return (
    <PageShell>
      <ScreenHeader title="Loyalty" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <View style={[{ padding: SP.l, backgroundColor: C.ink }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{'LOYALTY · TIER: ' + currentTier.name}</Text>
              <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{new Date().toLocaleDateString()}</Text>
            </View>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(72), color: C.white, letterSpacing: -3, marginTop: 6, lineHeight: rf(72) }}>{points.toLocaleString()}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.white, letterSpacing: 1, marginTop: 4 }}>LOYALTY POINTS</Text>

            {nextTier && (
              <View style={{ marginTop: SP.l }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{currentTier.name}</Text>
                  <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{nextTier.name}</Text>
                </View>
                <View style={{ marginTop: 6, height: 6, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <View style={{ width: `${Math.min(progress * 100, 100)}%`, height: '100%', backgroundColor: C.white }} />
                </View>
                <Text style={[T.mono, { color: C.white, opacity: 0.7, marginTop: 6, fontSize: 10 }]}>{nextTier.min - points} pts to {nextTier.name}</Text>
              </View>
            )}
          </View>
        </FadeInUp>

        <SectionLabel label="TIERS" />
        <View style={[{ flexDirection: 'row', marginTop: 8, overflow: 'hidden' }, BORDER(1)]}>
          {TIERS.map((t, i) => {
            const reached = points >= t.min;
            const isCurrent = t.name === currentTier.name;
            return (
              <View
                key={t.name}
                style={[
                  { flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: isCurrent ? C.ink : C.white },
                  i > 0 && { borderLeftWidth: 1, borderColor: C.ink },
                ]}
              >
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: isCurrent ? C.white : reached ? C.ink : C.dim, letterSpacing: 0.6 }}>{t.name}</Text>
                <Text style={[T.mono, { fontSize: 8, color: isCurrent ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 2 }]}>{t.min >= 1000 ? `${t.min / 1000}K+` : t.min + '+'}</Text>
              </View>
            );
          })}
        </View>

        <SectionLabel label="HOW TO EARN" />
        {[
          { label: 'Every ₹100 spent', pts: '+10', icon: 'shopping-bag' },
          { label: 'Daily login streak', pts: '+10-70', icon: 'zap' },
          { label: 'Write a product review', pts: '+50', icon: 'message-square' },
          { label: 'Refer a friend (on first order)', pts: '+200', icon: 'users' },
          { label: 'Complete your style quiz', pts: '+100', icon: 'help-circle' },
        ].map((r, i) => (
          <FadeInUp key={i} delay={60 + i * 30}>
            <View style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
              <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
                <Feather name={r.icon as any} size={14} color={C.ink} />
              </View>
              <Text style={[T.bodyB, { flex: 1, marginLeft: 12 }]}>{r.label}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink }}>
                <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{r.pts} PTS</Text>
              </View>
            </View>
          </FadeInUp>
        ))}

        <SectionLabel label="PERKS · BRONZE" />
        {[
          'Early access to sales',
          'Free shipping above ₹999',
          'Birthday surprise gift',
        ].map((p, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Text style={[T.monoB, { fontSize: 12 }]}>▸</Text>
            <Text style={[T.body, { flex: 1 }]}>{p}</Text>
          </View>
        ))}

        {history.length > 0 && (
          <>
            <SectionLabel label="RECENT ACTIVITY" right={`${history.length}`} />
            {history.slice(0, 10).map((t) => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: SP.s, paddingVertical: 6, borderBottomWidth: 1, borderColor: C.hairline }}>
                <View style={{ flex: 1 }}>
                  <Text style={[T.bodyB, { fontSize: 13 }]}>{t.note || t.kind}</Text>
                  <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 1 }]}>{new Date(t.at).toLocaleDateString()}</Text>
                </View>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: t.points >= 0 ? C.ink : C.dim }}>{t.points >= 0 ? '+' : ''}{t.points}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// GIFT CARD
// ═══════════════════════════════════════════════════════════
export function GiftCardScreen() {
  const nav = useNavigation<any>();
  const { showToast, refreshWallet } = useApp();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [totalPaise, setTotalPaise] = useState(0);

  const load = useCallback(() => {
    listGiftCards().then((r) => { setCards(r.cards); setTotalPaise(r.totalPaise); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const redeem = () => {
    const c = code.trim().toUpperCase();
    if (!c || redeeming) return;
    setRedeeming(true);
    redeemGiftCard(c)
      .then((r) => {
        showToast('Gift card redeemed', `₹${(r.creditedPaise / 100).toFixed(0)} added to your wallet`, 'gift');
        setCode('');
        refreshWallet();
        load();
      })
      .catch((e: any) => showToast('Could not redeem', e?.message || 'Check the code', 'x'))
      .finally(() => setRedeeming(false));
  };

  return (
    <PageShell>
      <ScreenHeader title="Gift Card" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'GIFT_CARD · REDEEM'}
          title={'REDEEM A\nGIFT CARD.'}
          intro="Have a Trendzo gift card code? Redeem it straight into your wallet."
          chips={[{ label: 'INSTANT', solid: true }, { label: 'TO WALLET' }]}
        />

        <SectionLabel label="ENTER CODE" />
        <View style={{ marginTop: 8 }}>
          <BrutalInput value={code} onChangeText={(v: string) => setCode(v.toUpperCase())} placeholder="XXXX-XXXX-XXXX" label="Gift card code" icon="gift" autoCapitalize="characters" />
        </View>
        <BrutalButton label={redeeming ? 'Redeeming…' : 'Redeem to wallet'} icon="download" block disabled={redeeming} onPress={redeem} style={{ marginTop: SP.m }} />

        {cards.length > 0 && (
          <>
            <SectionLabel label="YOUR CARDS" right={`₹${(totalPaise / 100).toFixed(0)}`} />
            {cards.map((g) => (
              <View key={g.id} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                <Feather name="gift" size={16} color={C.ink} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[T.monoB, { fontSize: 12 }]}>{g.code}</Text>
                  <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>Expires {g.expiresOn}</Text>
                </View>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink }}>₹{(g.balancePaise / 100).toFixed(0)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// REFERRAL REWARDS
// ═══════════════════════════════════════════════════════════
export function ReferralRewardsScreen() {
  const nav = useNavigation<any>();
  const { user, showToast, refreshLoyalty } = useApp();
  const [ref, setRef] = useState<Referral | null>(null);
  const [friendCode, setFriendCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const code = ref?.code || user?.referralCode || '—';
  const shareLink = ref?.shareLink || (ref?.code ? `https://closetx.app/invite/${ref.code}` : '');

  useEffect(() => { getReferral().then(setRef).catch(() => {}); }, []);

  const copy = async () => {
    try { await Clipboard.setStringAsync(code); showToast('Copied', 'Referral code copied', 'copy'); } catch { /* ignore */ }
  };
  const share = async () => {
    try {
      await Share.share({ message: `Join me on Trendzo — use my code ${code}. ${shareLink}`.trim() });
    } catch { /* user dismissed */ }
  };
  const redeemFriend = () => {
    const c = friendCode.trim();
    if (!c || redeeming) return;
    setRedeeming(true);
    redeemReferral(c)
      .then((r) => {
        showToast('Code applied', `You earned ${r.refereePointsGranted} points`, 'gift');
        setFriendCode('');
        refreshLoyalty();
        getReferral().then(setRef).catch(() => {});
      })
      .catch((e: any) => showToast('Could not apply', e?.message || 'Check the code', 'x'))
      .finally(() => setRedeeming(false));
  };

  return (
    <PageShell>
      <ScreenHeader title="Refer & Earn" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'REFERRAL'}
          title={'SHARE THE\nDRIP.'}
          intro="Give your friends points, earn points when they join with your code."
          chips={[{ label: `${ref?.referredCount ?? 0} JOINED` }, { label: `${ref?.pointsEarned ?? 0} PTS EARNED`, solid: true }]}
        />

        <FadeInUp delay={60}>
          <Pressable onPress={copy} style={[{ marginTop: SP.l, padding: SP.xl, alignItems: 'center', backgroundColor: C.ink }, BORDER(1)]}>
            <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{'YOUR CODE'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(44), color: C.white, marginTop: 8, letterSpacing: 4 }}>{code}</Text>
            <Text style={[T.mono, { color: C.white, opacity: 0.6, marginTop: 6, fontSize: 10 }]}>TAP TO COPY</Text>
          </Pressable>
        </FadeInUp>

        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l }}>
          <BrutalButton label="Copy code" icon="copy" variant="outline" style={{ flex: 1 }} onPress={copy} />
          <BrutalButton label="Share" icon="share-2" style={{ flex: 1 }} onPress={share} />
        </View>

        {!ref?.redeemed && (
          <>
            <SectionLabel label="HAVE A FRIEND'S CODE?" />
            <View style={{ marginTop: 8 }}>
              <BrutalInput value={friendCode} onChangeText={(v: string) => setFriendCode(v.toUpperCase())} placeholder="THEIRCODE" label="Enter a referral code" icon="users" autoCapitalize="characters" />
            </View>
            <BrutalButton label={redeeming ? 'Applying…' : 'Apply code'} icon="check" block disabled={redeeming} onPress={redeemFriend} style={{ marginTop: SP.m }} />
          </>
        )}

        <SectionLabel label="HOW IT WORKS" />
        {[
          { i: 1, t: 'Share your code', sub: `Send ${code} to your friends` },
          { i: 2, t: 'Friend applies it', sub: 'They enter your code in the app' },
          { i: 3, t: 'You both earn points', sub: 'Credited to your loyalty balance' },
        ].map(s => (
          <View key={s.i} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
            <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.white }}>{s.i}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[T.bodyB]}>{s.t}</Text>
              <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{s.sub}</Text>
            </View>
          </View>
        ))}

        <SectionLabel label="YOUR STATS" />
        <View style={[{ flexDirection: 'row', marginTop: 8, overflow: 'hidden' }, BORDER(1)]}>
          {[{ label: 'JOINED', value: String(ref?.referredCount ?? 0) }, { label: 'PTS EARNED', value: String(ref?.pointsEarned ?? 0) }].map((s, i) => (
            <View key={i} style={[{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white }, i > 0 && { borderLeftWidth: 1, borderColor: C.ink }]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(26), color: C.ink, letterSpacing: -0.8 }}>{s.value}</Text>
              <Text style={[T.monoB, { fontSize: 9, marginTop: 4 }]}>{s.label}</Text>
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
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'PUSH_SETTINGS'}
          title={'STAY IN\nTHE LOOP.'}
          intro="Control exactly what pings your phone. Turn off the noise, keep what matters."
          chips={[{ label: `${activeCount}/${total} ACTIVE`, solid: true }]}
        />

        {groups.map(grp => (
          <View key={grp.title}>
            <SectionLabel label={grp.title} />
            <View style={[{ marginTop: 8, backgroundColor: C.white }, BORDER(1)]}>
              {grp.items.map((item, i) => (
                <Pressable key={item.key} onPress={() => toggle(item.key)} style={[{ padding: SP.m, flexDirection: 'row', alignItems: 'center' }, i < grp.items.length - 1 && { borderBottomWidth: 1, borderColor: C.hairline }]}>
                  <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
                    <Feather name={item.icon as any} size={14} color={C.ink} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[T.bodyB]}>{item.label}</Text>
                    <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 2 }]}>{item.sub}</Text>
                  </View>
                  <View style={[{ width: 44, height: 24, justifyContent: 'center', padding: 2, backgroundColor: settings[item.key] ? C.ink : C.white }, BORDER(1)]}>
                    <View style={{ width: 16, height: 16, backgroundColor: settings[item.key] ? C.white : C.ink, alignSelf: settings[item.key] ? 'flex-end' : 'flex-start' }} />
                  </View>
                </Pressable>
              ))}
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
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'LOCALE · 8 LANGUAGES'}
          title={'CHOOSE\nLANGUAGE.'}
          intro="Switch the app interface to your preferred language. Changes apply immediately."
          chips={[{ label: 'CURRENT: ' + (LANGUAGES.find(l => l.code === selected)?.label || 'English').toUpperCase(), solid: true }]}
        />

        <SectionLabel label="ALL LANGUAGES" right={`${LANGUAGES.length} AVAILABLE`} />
        <View style={[{ marginTop: 8, backgroundColor: C.white }, BORDER(1)]}>
          {LANGUAGES.map((lang, i) => {
            const on = selected === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => { setSelected(lang.code); showToast('Language', `${lang.label} selected`, 'globe'); }}
                style={[
                  { padding: SP.m, flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.ink : 'transparent' },
                  i < LANGUAGES.length - 1 && { borderBottomWidth: 1, borderColor: on ? C.ink : C.hairline },
                ]}
              >
                <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : C.white }, BORDER(1), on && { borderColor: C.white }]}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.ink }}>{lang.code.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: on ? C.white : C.ink }}>{lang.label}</Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 2 }}>{lang.native}</Text>
                </View>
                <Text style={[T.mono, { fontSize: 9, color: on ? 'rgba(255,255,255,0.6)' : C.dim, marginRight: 10 }]}>{lang.region}</Text>
                {on && <Feather name="check" size={16} color={C.white} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// CUSTOMER SUPPORT
// ═══════════════════════════════════════════════════════════
const ISSUE_STATUS_LABEL: Record<string, string> = {
  open: 'OPEN', requested_evidence: 'NEEDS INFO', decided: 'RESOLVED', escalated: 'ESCALATED',
};
const ISSUE_KINDS: { kind: 'query' | 'complaint' | 'dispute'; label: string; hint: string }[] = [
  { kind: 'query', label: 'Question', hint: 'Ask about an order' },
  { kind: 'complaint', label: 'Complaint', hint: 'Something went wrong' },
  { kind: 'dispute', label: 'Dispute', hint: 'Charge / refund issue' },
];

export function CustomerSupportScreen() {
  const nav = useNavigation<any>();
  const { showToast, user } = useApp();
  const [view, setView] = useState<'list' | 'new' | 'thread'>('list');

  // list
  const [tickets, setTickets] = useState<IssueRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const loadTickets = useCallback(() => {
    setLoadingTickets(true);
    listIssues().then(setTickets).catch(() => {}).finally(() => setLoadingTickets(false));
  }, []);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  // thread
  const [active, setActive] = useState<IssueDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const openThread = (id: string) => {
    setView('thread'); setActive(null); setLoadingThread(true);
    getIssue(id).then(setActive).catch((e: any) => showToast('Could not open ticket', e?.message || 'Try again', 'x')).finally(() => setLoadingThread(false));
  };
  const sendReply = () => {
    if (!active || !reply.trim() || sending) return;
    const body = reply.trim();
    setSending(true);
    addIssueMessage(active.id, { body })
      .then(() => { setReply(''); return getIssue(active.id).then(setActive); })
      .catch((e: any) => showToast('Message failed', e?.message || 'Try again', 'x'))
      .finally(() => setSending(false));
  };

  // new ticket
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [nOrderId, setNOrderId] = useState<string | null>(null);
  const [nKind, setNKind] = useState<'query' | 'complaint' | 'dispute'>('query');
  const [nSubject, setNSubject] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const startNew = () => {
    setNOrderId(null); setNKind('query'); setNSubject(''); setNDesc(''); setView('new');
    listOrders().then(setOrders).catch(() => {});
  };
  const submitNew = () => {
    if (creating) return;
    if (!nOrderId) { showToast('Pick an order', 'Choose which order this is about', 'x'); return; }
    if (!nSubject.trim() || !nDesc.trim()) { showToast('Add details', 'Subject and description are required', 'x'); return; }
    setCreating(true);
    createIssue({ kind: nKind, orderId: nOrderId, subject: nSubject.trim(), description: nDesc.trim() })
      .then((r) => { showToast('Ticket created', 'Our team will respond soon', 'check'); loadTickets(); openThread(r.issueId); })
      .catch((e: any) => showToast('Could not create ticket', e?.message || 'Try again', 'x'))
      .finally(() => setCreating(false));
  };

  const back = () => {
    if (view === 'thread' || view === 'new') { setView('list'); loadTickets(); return; }
    nav.goBack();
  };

  return (
    <PageShell>
      <ScreenHeader title="Support" onBack={back} />
      <View style={{ flex: 1 }}>
        {/* ═══ TICKET LIST ═══ */}
        {view === 'list' && (
          <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 40 }}>
            <Hero
              code={'SUPPORT · TICKETS'}
              title={'WE GOT\nYOU.'}
              intro="Open a ticket about any order. Our team replies right here — track every conversation."
              chips={[{ label: 'HUMAN SUPPORT', solid: true }, { label: 'ORDER-LINKED' }]}
            />
            <BrutalButton label="New ticket" icon="plus" block onPress={startNew} style={{ marginTop: SP.l }} />
            <SectionLabel label="YOUR TICKETS" right={loadingTickets ? '…' : `${tickets.length}`} />
            {loadingTickets && <Text style={[T.mono, { fontSize: 11, color: C.dim, marginTop: 8 }]}>LOADING…</Text>}
            {!loadingTickets && tickets.length === 0 && (
              <View style={[{ marginTop: SP.s, padding: SP.l, alignItems: 'center' }, BORDER(1)]}>
                <Feather name="message-circle" size={22} color={C.dim} />
                <Text style={[T.monoB, { fontSize: 11, marginTop: 8 }]}>NO TICKETS YET</Text>
                <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 4, textAlign: 'center' }]}>Need help with an order? Open a ticket above.</Text>
              </View>
            )}
            {tickets.map((t, i) => (
              <FadeInUp key={t.id} delay={i * 40}>
                <Pressable onPress={() => openThread(t.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink }} numberOfLines={1}>{t.subject}</Text>
                      <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{t.kind.toUpperCase()} · {new Date(t.lastMessageAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                    </View>
                    <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: t.status === 'decided' ? C.ink : C.white }, BORDER(1)]}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.5, color: t.status === 'decided' ? C.white : C.ink }}>{ISSUE_STATUS_LABEL[t.status] || t.status.toUpperCase()}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={C.ink} style={{ marginLeft: 8 }} />
                  </View>
                </Pressable>
              </FadeInUp>
            ))}
          </ScrollView>
        )}

        {/* ═══ NEW TICKET ═══ */}
        {view === 'new' && (
          <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
            <SectionLabel label="WHAT IS THIS ABOUT?" />
            <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
              {ISSUE_KINDS.map((k) => {
                const on = nKind === k.kind;
                return (
                  <Pressable key={k.kind} onPress={() => setNKind(k.kind)} style={[{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: on ? C.white : C.ink }}>{k.label}</Text>
                    <Text style={[T.mono, { fontSize: 8, color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 3, textAlign: 'center' }]}>{k.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            <SectionLabel label="WHICH ORDER?" right={`${orders.length}`} />
            {orders.length === 0 && <Text style={[T.mono, { fontSize: 10, color: C.dim, marginTop: 8 }]}>No orders found — a ticket must be linked to an order.</Text>}
            {orders.map((o) => {
              const on = nOrderId === o.id;
              return (
                <Pressable key={o.id} onPress={() => setNOrderId(o.id)} style={[{ marginTop: SP.s, padding: SP.m, flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                  <Feather name={on ? 'check-circle' : 'circle'} size={16} color={on ? C.white : C.dim} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: on ? C.white : C.ink }} numberOfLines={1}>{o.storeName}</Text>
                    <Text style={[T.mono, { fontSize: 9, color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 2 }]}>{o.status.toUpperCase()}{o.grandTotalPaise != null ? ` · ₹${(o.grandTotalPaise / 100).toFixed(0)}` : ''}</Text>
                  </View>
                </Pressable>
              );
            })}

            <SectionLabel label="SUBJECT" />
            <TextInput value={nSubject} onChangeText={setNSubject} placeholder="Short summary" placeholderTextColor={C.dim} style={[{ marginTop: 6, paddingHorizontal: SP.m, paddingVertical: 12, fontFamily: 'Inter_700Bold', fontSize: 14, color: C.ink, backgroundColor: C.white }, BORDER(1)]} />

            <SectionLabel label="DESCRIPTION" />
            <TextInput value={nDesc} onChangeText={setNDesc} placeholder="Tell us what happened…" placeholderTextColor={C.dim} multiline style={[{ marginTop: 6, paddingHorizontal: SP.m, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink, backgroundColor: C.white, minHeight: 96, textAlignVertical: 'top' }, BORDER(1)]} />

            <BrutalButton label={creating ? 'Creating…' : 'Create ticket'} icon="send" block disabled={creating} onPress={submitNew} style={{ marginTop: SP.xl }} />
          </ScrollView>
        )}

        {/* ═══ THREAD ═══ */}
        {view === 'thread' && (
          <>
            <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 20 }}>
              {loadingThread && <Text style={[T.mono, { fontSize: 11, color: C.dim }]}>LOADING…</Text>}
              {active && (
                <>
                  <View style={[{ padding: SP.m, backgroundColor: C.ink }, BORDER(1)]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.6)' }]}>{active.kind.toUpperCase()}</Text>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.5, color: C.white }}>{ISSUE_STATUS_LABEL[active.status] || active.status.toUpperCase()}</Text>
                    </View>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.white, marginTop: 6 }}>{active.subject}</Text>
                    <Text style={[T.body, { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 6 }]}>{active.description}</Text>
                    {active.decision && <Text style={[T.mono, { fontSize: 10, color: C.white, marginTop: 8 }]}>DECISION: {active.decision.toUpperCase()}{active.decisionNote ? ` — ${active.decisionNote}` : ''}</Text>}
                  </View>

                  <SectionLabel label="CONVERSATION" right={`${active.messages.length}`} />
                  {active.messages.map((m, i) => {
                    const mine = m.senderType === 'consumer';
                    return (
                      <FadeInUp key={m.id} delay={i * 30}>
                        <View style={{ marginTop: SP.s, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                          <Text style={[T.mono, { color: C.dim, fontSize: 9, marginBottom: 4 }]}>{mine ? 'YOU' : m.senderType.toUpperCase()}</Text>
                          <View style={[{ padding: SP.m, maxWidth: '85%', backgroundColor: mine ? C.ink : C.white }, BORDER(1)]}>
                            <Text style={[T.body, { color: mine ? C.white : C.ink, fontSize: 13 }]}>{m.body}</Text>
                          </View>
                        </View>
                      </FadeInUp>
                    );
                  })}
                  {active.messages.length === 0 && <Text style={[T.mono, { fontSize: 10, color: C.dim, marginTop: 8 }]}>No replies yet — our team will respond soon.</Text>}
                </>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', padding: SP.m, gap: SP.s, borderTopWidth: 1, borderColor: C.ink, backgroundColor: C.white }}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Type your message…"
                placeholderTextColor={C.dim}
                style={[{ flex: 1, padding: SP.m, fontFamily: 'Inter_400Regular', fontSize: 14, color: C.ink }, BORDER(1)]}
              />
              <BrutalButton label={sending ? '…' : 'Send'} icon="send" small disabled={sending || !reply.trim()} onPress={sendReply} />
            </View>
          </>
        )}
      </View>
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

  return (
    <PageShell>
      <ScreenHeader title="Style Prefs" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'STYLE_DNA'}
          title={'YOUR\nAESTHETIC.'}
          intro="Pick your vibes, sizes, and colors. Your feed tunes itself to match."
          chips={[{ label: `${vibes.length} VIBES` }, { label: `${sizes.length} SIZES` }, { label: `${colors.length} COLORS` }]}
        />

        <SectionLabel label="SELECT VIBES" right={`${vibes.length} / ${allVibes.length}`} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, marginTop: 8 }}>
          {allVibes.map(v => (
            <Chip key={v} label={v} active={vibes.includes(v)} onPress={() => toggle(vibes, setVibes, v)} />
          ))}
        </View>

        <SectionLabel label="PREFERRED COLORS" right={`${colors.length} / ${swatches.length}`} />
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
          {swatches.map((c, i) => {
            const on = colors.includes(i);
            return (
              <Pressable key={i} onPress={() => toggle(colors, setColors, i)} style={[{ width: 48, height: 48, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }, BORDER(on ? 2 : 1)]}>
                {on && <Feather name="check" size={16} color={c === '#fff' || c === '#e8d5c4' ? C.ink : C.white} />}
              </Pressable>
            );
          })}
        </View>

        <SectionLabel label="SIZE RANGE" right={`${sizes.length} selected`} />
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8, flexWrap: 'wrap' }}>
          {allSizes.map(s => (
            <Chip key={s} label={s} active={sizes.includes(s)} onPress={() => toggle(sizes, setSizes, s)} />
          ))}
        </View>

        <SectionLabel label="SHOPPING FOR" />
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
          {['WOMEN', 'MEN', 'UNISEX'].map(g => (
            <Chip key={g} label={g} active={g === 'UNISEX'} />
          ))}
        </View>

        <BrutalButton label="Save preferences" icon="check" block onPress={() => { showToast('Saved', 'Style preferences updated', 'check'); nav.goBack(); }} style={{ marginTop: SP.xl }} />
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
          title={'YOUR\nMEASUREMENTS.'}
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
                i > 0 && { borderLeftWidth: 1, borderColor: C.ink },
              ]}
            >
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: unit === u ? C.white : C.ink, letterSpacing: 0.6 }}>{u}</Text>
            </Pressable>
          ))}
        </View>

        <SectionLabel label="POINTS" right={`${measurements.length} RECORDED`} />
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
          {measurements.map((m, i) => (
            <FadeInUp key={m.label} delay={i * 40} style={{ width: '48.5%' }}>
              <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name={m.icon as any} size={12} color={C.dim} />
                  <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{m.label.toUpperCase()}</Text>
                </View>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(22), color: C.ink, letterSpacing: -0.8, marginTop: 6 }}>{convert(m.valueCm)}</Text>
              </View>
            </FadeInUp>
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
    { date: 'APR 15', day: 'TUE', title: 'SUMMER DROP', sub: 'New arrivals from 12 brands', icon: 'sun', tag: 'NEW' },
    { date: 'APR 20', day: 'SUN', title: 'FLASH SALE', sub: 'Up to 70% off · 24 hours only', icon: 'zap', tag: 'HOT' },
    { date: 'MAY 01', day: 'THU', title: 'BRAND COLLAB', sub: 'NORTH. × AZUKI limited edition', icon: 'star', tag: 'EXCLUSIVE' },
    { date: 'MAY 10', day: 'SAT', title: 'FESTIVAL EDIT', sub: 'Curated festive collection', icon: 'gift', tag: 'CURATED' },
    { date: 'MAY 25', day: 'SUN', title: 'END OF SEASON', sub: 'Clearance sale starts', icon: 'tag', tag: 'SALE' },
    { date: 'JUN 01', day: 'SUN', title: 'MONSOON READY', sub: 'Waterproof & layering essentials', icon: 'cloud', tag: 'PREVIEW' },
  ];

  return (
    <PageShell>
      <ScreenHeader title="Calendar" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'UPCOMING · 6 EVENTS'}
          title={'FASHION\nCALENDAR.'}
          intro="Drops, sales, collabs — everything we've got lined up."
          chips={[{ label: 'APR—JUN 2026', solid: true }]}
        />

        <SectionLabel label="UPCOMING" />
        <View style={{ marginTop: 8, gap: SP.s }}>
          {events.map((e, i) => (
            <FadeInUp key={i} delay={i * 50}>
              <View style={[{ flexDirection: 'row', backgroundColor: C.white }, BORDER(1)]}>
                {/* Date column */}
                <View style={{ width: 80, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', padding: SP.s }}>
                  <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{e.day}</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.white, letterSpacing: 0.5, marginTop: 2 }}>{e.date}</Text>
                </View>
                {/* Content */}
                <View style={{ flex: 1, padding: SP.m }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <View style={[{ paddingHorizontal: 6, paddingVertical: 2 }, BORDER(1)]}>
                      <Text style={[T.monoB, { fontSize: 8 }]}>{e.tag}</Text>
                    </View>
                    <Feather name={e.icon as any} size={12} color={C.dim} />
                  </View>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.ink, letterSpacing: -0.3 }}>{e.title}</Text>
                  <Text style={[T.body, { color: C.dim, marginTop: 3 }]}>{e.sub}</Text>
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
    { title: 'ECO-FRIENDLY PACKAGING', sub: '100% recyclable materials for all shipments', icon: 'package' },
    { title: 'CARBON NEUTRAL DELIVERY', sub: 'We offset every delivery with verified carbon credits', icon: 'wind' },
    { title: 'ETHICAL SOURCING', sub: 'Fair wages and safe conditions for all workers', icon: 'heart' },
    { title: 'SECOND LIFE PROGRAM', sub: 'Donate old clothes for Trendzo credits', icon: 'refresh-cw' },
    { title: 'SUSTAINABLE BRANDS', sub: '40+ eco-conscious brands on the platform', icon: 'award' },
  ];
  return (
    <PageShell>
      <ScreenHeader title="Eco" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'ECO_MODE · IMPACT_2026'}
          title={'FASHION\nFOR GOOD.'}
          intro="Our commitment to sustainable fashion and ethical production — measurable, not marketing."
          chips={[{ label: 'CARBON NEUTRAL', solid: true }, { label: 'B-CORP' }]}
        />

        <SectionLabel label="YOUR IMPACT" />
        <View style={[{ flexDirection: 'row', marginTop: 8, overflow: 'hidden' }, BORDER(1)]}>
          {impact.map((s, i) => (
            <View key={i} style={[{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white }, i > 0 && { borderLeftWidth: 1, borderColor: C.ink }]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.ink, letterSpacing: -0.5 }}>{s.value}</Text>
              <Text style={[T.monoB, { fontSize: 8, marginTop: 4 }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <SectionLabel label="PILLARS" />
        {pillars.map((item, i) => (
          <FadeInUp key={i} delay={i * 50}>
            <View style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
                  <Feather name={item.icon as any} size={16} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, letterSpacing: 0.3 }}>{item.title}</Text>
                  <Text style={[T.body, { color: C.dim, marginTop: 2 }]}>{item.sub}</Text>
                </View>
                <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>{String(i + 1).padStart(2, '0')}</Text>
              </View>
            </View>
          </FadeInUp>
        ))}
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// ORDER RETURN
// ═══════════════════════════════════════════════════════════
const RETURN_REASONS: { label: string; icon: string; category: ReasonCategory }[] = [
  { label: "Doesn't fit", icon: 'maximize', category: 'doesnt_fit' },
  { label: 'Damaged / defective', icon: 'alert-triangle', category: 'damaged' },
  { label: 'Wrong item sent', icon: 'shuffle', category: 'wrong_item' },
  { label: 'Not as described', icon: 'x-circle', category: 'not_as_described' },
  { label: 'Other reason', icon: 'more-horizontal', category: 'other' },
];

// 7-day post-delivery return window → whole days remaining (0 = closed).
function returnDaysLeft(deliveredAt?: string | null): number {
  if (!deliveredAt) return 0;
  const elapsed = (Date.now() - new Date(deliveredAt).getTime()) / 86400000;
  return Math.max(0, Math.ceil(7 - elapsed));
}

const DECISION_LABEL: Record<string, string> = {
  pending: 'UNDER REVIEW', accepted: 'ACCEPTED', rejected: 'REJECTED', rejected_at_door: 'REJECTED AT DOOR',
};
const PICKUP_LABEL: Record<string, string> = {
  pending: 'PICKUP PENDING', assigned: 'PARTNER ASSIGNED', collected: 'COLLECTED', delivered_to_store: 'BACK AT STORE', cancelled: 'CANCELLED',
};

type ReturnStep = 'order' | 'item' | 'reason';

export function OrderReturnScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [tab, setTab] = useState<'new' | 'my'>('new');

  // data
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);

  // new-return wizard
  const [step, setStep] = useState<ReturnStep>('order');
  const [order, setOrder] = useState<OrderListRow | null>(null);
  const [items, setItems] = useState<OrderDetailItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReasonCategory | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadOrders = useCallback(() => {
    setLoadingOrders(true);
    listOrders()
      .then((rows) => setOrders(rows.filter((o) => o.status === 'delivered')))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, []);
  const loadReturns = useCallback(() => {
    setLoadingReturns(true);
    listReturns().then(setReturns).catch(() => {}).finally(() => setLoadingReturns(false));
  }, []);
  useEffect(() => { loadOrders(); loadReturns(); }, [loadOrders, loadReturns]);

  const selectedItem = items.find((i) => i.id === itemId) || null;

  const pickOrder = (o: OrderListRow) => {
    if (returnDaysLeft(o.deliveredAt) <= 0) { showToast('Return window closed', '7-day window has ended', 'alert-triangle'); return; }
    setOrder(o); setItemId(null); setItems([]); setStep('item'); setLoadingItems(true);
    getOrder(o.id)
      .then((d) => setItems(d.items ?? []))
      .catch((e: any) => { showToast('Could not load items', e?.message || 'Try again', 'x'); setStep('order'); })
      .finally(() => setLoadingItems(false));
  };

  const back = () => {
    if (step === 'reason') { setStep('item'); setReason(null); setNote(''); return; }
    if (step === 'item') { setStep('order'); setItemId(null); setItems([]); return; }
    nav.goBack();
  };

  const submit = () => {
    if (!order || !itemId || !reason || submitting) return;
    setSubmitting(true);
    createReturn({ orderId: order.id, items: [{ orderItemId: itemId, reasonCategory: reason, ...(note.trim() ? { reasonText: note.trim() } : {}) }] })
      .then((r) => {
        showToast('Return requested', r.reversePickupId ? 'Pickup scheduled — see My Returns for the code' : 'The store will review your request', 'rotate-ccw');
        setStep('order'); setOrder(null); setItemId(null); setReason(null); setNote(''); setItems([]);
        setTab('my'); loadReturns(); loadOrders();
      })
      .catch((e: any) => {
        const msg = e?.code === 'return_window_expired' ? '7-day window has ended'
          : e?.code === 'return_invalid_state' ? 'This item is not eligible for return'
          : e?.message || 'Please try again';
        showToast('Return failed', msg, 'x');
      })
      .finally(() => setSubmitting(false));
  };

  const stepIndex = step === 'order' ? 0 : step === 'item' ? 1 : 2;
  const stepLabels = ['ORDER', 'ITEM', 'REASON'];

  return (
    <PageShell>
      <ScreenHeader title="Returns" onBack={tab === 'new' && step !== 'order' ? back : () => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'RETURN_FLOW · 7D'}
          title={'EASY\nRETURNS.'}
          intro="7-day returns. Pickup from your door — give the partner the collect code shown under My Returns."
          chips={[{ label: 'FREE PICKUP', solid: true }, { label: '7-DAY WINDOW' }]}
        />

        {/* Tabs: new return | my returns */}
        <View style={[{ flexDirection: 'row', marginTop: SP.l, overflow: 'hidden' }, BORDER(1)]}>
          {(['new', 'my'] as const).map((t, i) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={[{ flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: on ? C.ink : C.white }, i > 0 && { borderLeftWidth: 1, borderColor: C.ink }]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: on ? C.white : C.ink, letterSpacing: 0.6 }}>{t === 'new' ? 'NEW RETURN' : `MY RETURNS${returns.length ? ` · ${returns.length}` : ''}`}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ═══════════ MY RETURNS ═══════════ */}
        {tab === 'my' && (
          <>
            {loadingReturns && <Text style={[T.mono, { fontSize: 11, color: C.dim, marginTop: SP.l }]}>LOADING…</Text>}
            {!loadingReturns && returns.length === 0 && (
              <View style={[{ marginTop: SP.l, padding: SP.l, alignItems: 'center' }, BORDER(1)]}>
                <Feather name="package" size={22} color={C.dim} />
                <Text style={[T.monoB, { fontSize: 11, marginTop: 8 }]}>NO RETURNS YET</Text>
                <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 4, textAlign: 'center' }]}>Returns you open will show here with pickup status and refund.</Text>
              </View>
            )}
            {returns.map((r, i) => {
              const rp = r.reversePickup;
              const showOtp = !!rp && !!rp.collectOtp && (rp.status === 'pending' || rp.status === 'assigned');
              return (
                <FadeInUp key={r.id} delay={i * 40}>
                  <View style={[{ marginTop: SP.s, backgroundColor: C.white }, BORDER(1)]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[T.monoB, { fontSize: 9, color: C.dim }]}>{r.itemBrand}</Text>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink, marginTop: 2 }} numberOfLines={1}>{r.itemName}</Text>
                      </View>
                      <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: r.storeDecision === 'accepted' ? C.ink : C.white }, BORDER(1)]}>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.5, color: r.storeDecision === 'accepted' ? C.white : C.ink }}>{DECISION_LABEL[r.storeDecision] || r.storeDecision.toUpperCase()}</Text>
                      </View>
                    </View>

                    {/* Collect OTP — the code the customer reads to the pickup partner */}
                    {showOtp && (
                      <View style={[{ margin: SP.m, padding: SP.m, backgroundColor: C.ink }, BORDER(1)]}>
                        <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.6)' }]}>GIVE THIS CODE TO THE PICKUP PARTNER</Text>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(34), letterSpacing: 6, color: C.white, marginTop: 6 }}>{rp!.collectOtp}</Text>
                        <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4 }]}>{PICKUP_LABEL[rp!.status] || rp!.status}</Text>
                      </View>
                    )}

                    <View style={{ padding: SP.m, gap: 4 }}>
                      {rp && !showOtp && (
                        <Row2 k="PICKUP" v={PICKUP_LABEL[rp.status] || rp.status} />
                      )}
                      {r.refund && (
                        <Row2 k="REFUND" v={`₹${(r.refund.amountPaise / 100).toFixed(0)} · ${r.refund.status.toUpperCase()}`} />
                      )}
                      <Row2 k="OPENED" v={new Date(r.openedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                    </View>
                  </View>
                </FadeInUp>
              );
            })}
          </>
        )}

        {/* ═══════════ NEW RETURN WIZARD ═══════════ */}
        {tab === 'new' && (
          <>
            <View style={[{ flexDirection: 'row', marginTop: SP.l, overflow: 'hidden' }, BORDER(1)]}>
              {stepLabels.map((label, i) => {
                const active = i === stepIndex; const done = i < stepIndex;
                return (
                  <View key={label} style={[{ flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: active || done ? C.ink : C.white }, i > 0 && { borderLeftWidth: 1, borderColor: C.ink }]}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: active || done ? C.white : C.ink, letterSpacing: 0.6 }}>{label}</Text>
                    <Text style={[T.mono, { fontSize: 8, marginTop: 2, color: active || done ? 'rgba(255,255,255,0.6)' : C.dim }]}>0{i + 1}</Text>
                  </View>
                );
              })}
            </View>

            {/* STEP 1: pick a delivered order */}
            {step === 'order' && (
              <>
                <SectionLabel label="SELECT ORDER" right={loadingOrders ? '…' : `${orders.length} ELIGIBLE`} />
                {loadingOrders && <Text style={[T.mono, { fontSize: 11, color: C.dim, marginTop: 8 }]}>LOADING…</Text>}
                {!loadingOrders && orders.length === 0 && (
                  <View style={[{ marginTop: SP.s, padding: SP.l, alignItems: 'center' }, BORDER(1)]}>
                    <Text style={[T.monoB, { fontSize: 11 }]}>NO RETURNABLE ORDERS</Text>
                    <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 4, textAlign: 'center' }]}>Only delivered orders within 7 days can be returned.</Text>
                  </View>
                )}
                {orders.map((o, i) => {
                  const days = returnDaysLeft(o.deliveredAt); const expired = days <= 0;
                  return (
                    <FadeInUp key={o.id} delay={i * 40}>
                      <Pressable onPress={() => pickOrder(o)} style={[{ marginTop: SP.s, backgroundColor: C.white, opacity: expired ? 0.55 : 1 }, BORDER(1)]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[T.monoB, { fontSize: 11 }]}>{o.storeName}</Text>
                            <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}{o.grandTotalPaise != null ? ` · ₹${(o.grandTotalPaise / 100).toFixed(0)}` : ''}</Text>
                          </View>
                          <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: expired ? C.white : C.ink }, BORDER(1)]}>
                            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.6, color: expired ? C.ink : C.white }}>{expired ? 'WINDOW CLOSED' : `${days}D LEFT`}</Text>
                          </View>
                          {!expired && <Feather name="chevron-right" size={16} color={C.ink} style={{ marginLeft: 8 }} />}
                        </View>
                      </Pressable>
                    </FadeInUp>
                  );
                })}
              </>
            )}

            {/* STEP 2: pick the item */}
            {step === 'item' && order && (
              <>
                <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: C.ink }, BORDER(1)]}>
                  <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.6)' }]}>SELECTED ORDER</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.white, marginTop: 4 }}>{order.storeName}</Text>
                  <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 }]}>{returnDaysLeft(order.deliveredAt)}D LEFT IN WINDOW</Text>
                </View>
                <SectionLabel label="SELECT ITEM TO RETURN" right={loadingItems ? '…' : `${items.length} ITEMS`} />
                {loadingItems && <Text style={[T.mono, { fontSize: 11, color: C.dim, marginTop: 8 }]}>LOADING ITEMS…</Text>}
                {items.map((it, i) => {
                  const on = itemId === it.id;
                  return (
                    <FadeInUp key={it.id} delay={i * 40}>
                      <Pressable onPress={() => { setItemId(it.id); setStep('reason'); }} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                        <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : 'transparent' }, BORDER(1), on && { borderColor: C.white }]}>
                          <Feather name="shopping-bag" size={16} color={C.ink} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[T.monoB, { fontSize: 9, color: on ? 'rgba(255,255,255,0.7)' : C.dim }]}>{it.brandSnap}</Text>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: on ? C.white : C.ink, marginTop: 2 }} numberOfLines={1}>{it.listingNameSnap}</Text>
                          <Text style={[T.mono, { fontSize: 10, color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 2 }]}>Qty {it.qty} · ₹{(it.netLinePaise / 100).toFixed(0)}</Text>
                        </View>
                        <Feather name={on ? 'check' : 'chevron-right'} size={16} color={on ? C.white : C.ink} />
                      </Pressable>
                    </FadeInUp>
                  );
                })}
              </>
            )}

            {/* STEP 3: reason + optional note */}
            {step === 'reason' && order && selectedItem && (
              <>
                <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: C.ink }, BORDER(1)]}>
                  <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.6)' }]}>RETURNING</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.white, marginTop: 4 }}>{selectedItem.listingNameSnap}</Text>
                  <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 }]}>{selectedItem.brandSnap} · ₹{(selectedItem.netLinePaise / 100).toFixed(0)} · from {order.storeName}</Text>
                </View>
                <SectionLabel label="WHY ARE YOU RETURNING?" />
                {RETURN_REASONS.map((r, i) => {
                  const on = reason === r.category;
                  return (
                    <FadeInUp key={r.category} delay={i * 30}>
                      <Pressable onPress={() => setReason(r.category)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                        <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : 'transparent' }, BORDER(1), on && { borderColor: C.white }]}>
                          <Feather name={r.icon as any} size={14} color={C.ink} />
                        </View>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: on ? C.white : C.ink, flex: 1, marginLeft: 12 }}>{r.label}</Text>
                        {on && <Feather name="check" size={16} color={C.white} />}
                      </Pressable>
                    </FadeInUp>
                  );
                })}
                <SectionLabel label="ADD A NOTE (OPTIONAL)" />
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything the store should know…"
                  placeholderTextColor={C.dim}
                  multiline
                  style={[{ marginTop: 6, paddingHorizontal: SP.m, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink, backgroundColor: C.white, minHeight: 72, textAlignVertical: 'top' }, BORDER(1)]}
                />
                <BrutalButton label={submitting ? 'Submitting…' : 'Initiate return'} icon="rotate-ccw" block disabled={!reason || submitting} onPress={submit} style={{ marginTop: SP.xl }} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </PageShell>
  );
}

function Row2({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{k}</Text>
      <Text style={[T.monoB, { fontSize: 10, color: C.ink }]}>{v}</Text>
    </View>
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
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'YOUR_REVIEWS'}
          title={'YOUR\nFEEDBACK.'}
          intro="The reviews you've left. Brands listen — your words help others shop better."
          chips={[{ label: `${MOCK_REVIEWS.length} POSTED`, solid: true }, { label: `AVG ${avg}★` }, { label: 'HELPFUL' }]}
        />

        <SectionLabel label="FILTER" />
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
          {(['ALL', '5', '4', '3'] as const).map(f => (
            <Chip key={f} label={f === 'ALL' ? 'ALL' : `${f} STAR`} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>

        <SectionLabel label="POSTED" right={`${filtered.length} RESULTS`} />
        {filtered.map((r, i) => (
          <FadeInUp key={r.id} delay={i * 50}>
            <View style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[T.monoB, { fontSize: 9, color: C.dim }]}>{r.brand}</Text>
                  <Text style={[T.bodyB, { marginTop: 2 }]}>{r.product}</Text>
                </View>
                <Text style={[T.mono, { color: C.dim }]}>{r.date}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 2, marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <Text key={s} style={{ fontSize: 16, color: s <= r.rating ? C.ink : C.hairline }}>★</Text>
                ))}
              </View>
              <Text style={[T.body, { marginTop: 8, lineHeight: 18 }]}>{r.text}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: C.hairline, gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="thumbs-up" size={12} color={C.ink} />
                  <Text style={[T.mono, { fontSize: 10 }]}>{r.likes} HELPFUL</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="edit-2" size={12} color={C.dim} />
                  <Text style={[T.mono, { fontSize: 10, color: C.dim }]}>EDIT</Text>
                </View>
              </View>
            </View>
          </FadeInUp>
        ))}
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
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 120 }}>
        <Hero
          code={'PICKUP · ZERO_DELIVERY_FEE'}
          title={'BUY ONLINE.\nPICK IT UP.'}
          intro="Skip delivery. Grab your order from your nearest store — usually ready in under an hour."
          chips={[{ label: 'FREE', solid: true }, { label: 'IN STORE' }, { label: '4 STORES' }]}
          inverted
        />

        <SectionLabel label="HOW_IT_WORKS" />
        <View style={{ marginTop: 8, gap: SP.s }}>
          {[
            { i: 1, t: 'Shop as normal', sub: 'Add anything from the app to your bag' },
            { i: 2, t: 'Pick INSTORE PICKUP at checkout', sub: 'Choose your nearest store from the list' },
            { i: 3, t: "We ping you when it's ready", sub: 'Show the QR at the counter — walk out with it' },
          ].map(step => (
            <View key={step.i} style={[{ flexDirection: 'row', padding: SP.s, gap: 10, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.white }}>{step.i}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.ink }}>{step.t}</Text>
                <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{step.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <SectionLabel label="STORES_NEAR_YOU" right={`${PICKUP_STORES.length} FOUND`} />
        <View style={{ marginTop: 8, gap: SP.s }}>
          {PICKUP_STORES.map(st => {
            const on = picked === st.id;
            return (
              <Pressable key={st.id} onPress={() => setPicked(st.id)} style={[{ padding: SP.m, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : C.ink }]}>
                    <Feather name="map-pin" size={20} color={on ? C.ink : C.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: on ? C.white : C.ink }}>{st.name}</Text>
                      <View style={[{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: on ? C.white : C.ink }]}>
                        <Text style={[T.monoB, { fontSize: 8, color: on ? C.ink : C.white }]}>{st.dist}</Text>
                      </View>
                    </View>
                    <Text style={[T.mono, { fontSize: 9, color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 3 }]}>{st.addr}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                      <Text style={[T.monoB, { fontSize: 9, color: on ? C.white : C.ink }]}>◆ READY IN {st.eta}</Text>
                      <Text style={[T.mono, { fontSize: 9, color: on ? 'rgba(255,255,255,0.7)' : C.dim }]}>{st.open}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <BrutalButton label="Shop now — pickup in store" iconRight="arrow-right" block onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} style={{ marginTop: SP.xl }} />
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
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 120 }}>
        <Hero
          code={'TRY_AT_HOME // FREE_RETURNS'}
          title={"TRY IT.\nKEEP IT.\nOR DON'T."}
          intro="Order up to 5 items. Courier waits 15 min at your door. Keep what fits — return the rest on the spot."
          chips={[{ label: '₹99', solid: true }, { label: '15 MIN TRIAL' }, { label: 'FREE RETURNS' }]}
          inverted
        />

        <SectionLabel label="HOW_IT_WORKS" />
        <View style={{ marginTop: 8, gap: 8 }}>
          {[
            { i: 1, t: 'Add up to 5 items to your bag' },
            { i: 2, t: 'Pick TRY & BUY at checkout' },
            { i: 3, t: 'Courier delivers next day, waits 15 min at your door' },
            { i: 4, t: 'Try everything on — keep what fits' },
            { i: 5, t: 'Return the rest on the spot · zero hassle, zero fee' },
          ].map(step => (
            <View key={step.i} style={[{ flexDirection: 'row', padding: SP.s, gap: 10, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.white }}>{step.i}</Text>
              </View>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink, flex: 1 }}>{step.t}</Text>
            </View>
          ))}
        </View>

        <SectionLabel label="GOOD_TO_KNOW" />
        <View style={[{ marginTop: 8, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
          {[
            'Only get charged for what you keep',
            'COD not available for Try & Buy orders',
            'Max trial slots per month: 3',
            'Must be home when the courier arrives',
          ].map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: i === 0 ? 0 : 8 }}>
              <Text style={[T.monoB, { fontSize: 11 }]}>▸</Text>
              <Text style={[T.body, { flex: 1, fontSize: 12 }]}>{t}</Text>
            </View>
          ))}
        </View>

        <BrutalButton label="Shop Try & Buy →" iconRight="arrow-right" block onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} style={{ marginTop: SP.xl }} />
      </ScrollView>
    </PageShell>
  );
}
