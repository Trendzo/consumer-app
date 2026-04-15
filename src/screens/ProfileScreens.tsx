// Profile sub-screens — each page has a unique hero banner, structured
// body, and consistent brutalist treatment.
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, BrutalStatusBar, BrutalBox, FadeInUp, BrutalInput, Chip } from '../components/Brutal';
import { useApp } from '../state/AppState';

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
  code: string;           // e.g. "> ADDRESSES_v1"
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
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 36, color: fg, letterSpacing: -1.4, marginTop: 6, lineHeight: 38 }}>
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
        <Text style={[T.monoB, { fontSize: 10 }]}>{`> ${label.toUpperCase()}`}</Text>
        {right && <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{right}</Text>}
      </View>
      <AsciiDivider faint style={{ marginTop: 4 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// SAVED ADDRESSES
// ═══════════════════════════════════════════════════════════
const ADDRESSES = [
  { id: '1', label: 'HOME', name: 'Chandresh', address: '42, Lajpat Nagar, New Delhi 110024', phone: '+91 98765 43210', primary: true },
  { id: '2', label: 'OFFICE', name: 'Chandresh', address: '12th Floor, WeWork, Connaught Place, New Delhi 110001', phone: '+91 98765 43210' },
];

export function SavedAddressesScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  return (
    <PageShell>
      <ScreenHeader title="Addresses" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'> ADDRESSES · 2 SAVED'}
          title={'YOUR\nADDRESSES.'}
          intro="Deliver to home, office, or anywhere else. One tap to switch."
          chips={[{ label: 'HOME · PRIMARY', solid: true }, { label: 'OFFICE' }]}
        />

        <SectionLabel label="SAVED" right={`${ADDRESSES.length} ENTRIES`} />
        {ADDRESSES.map((a, i) => (
          <FadeInUp key={a.id} delay={i * 60}>
            <View style={[{ marginTop: SP.s, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.ink }}>
                  <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{a.label}</Text>
                </View>
                {a.primary && (
                  <View style={[{ paddingHorizontal: 6, paddingVertical: 3, marginLeft: 6 }, BORDER(1)]}>
                    <Text style={[T.monoB, { fontSize: 8 }]}>DEFAULT</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => showToast('Edit', 'Coming soon', 'edit-2')} style={{ padding: 6 }}>
                  <Feather name="edit-2" size={13} color={C.ink} />
                </Pressable>
                <Pressable onPress={() => showToast('Delete', 'Coming soon', 'trash-2')} style={{ padding: 6, marginLeft: 4 }}>
                  <Feather name="trash-2" size={13} color={C.ink} />
                </Pressable>
              </View>
              <View style={{ padding: SP.m }}>
                <Text style={[T.bodyB]}>{a.name}</Text>
                <Text style={[T.body, { color: C.dim, marginTop: 4, lineHeight: 18 }]}>{a.address}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Feather name="phone" size={11} color={C.dim} />
                  <Text style={[T.mono, { color: C.dim }]}>{a.phone}</Text>
                </View>
              </View>
            </View>
          </FadeInUp>
        ))}
        <BrutalButton label="Add new address" icon="plus" variant="outline" block onPress={() => showToast('Add address', 'Coming soon', 'plus')} style={{ marginTop: SP.l }} />
      </ScrollView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// PAYMENT METHODS
// ═══════════════════════════════════════════════════════════
const PAYMENTS = [
  { id: '1', type: 'UPI', label: 'pay@okhdfcbank', sub: 'HDFC · linked Oct 2024', icon: 'smartphone' },
  { id: '2', type: 'CARD', label: '•••• •••• •••• 4242', sub: 'VISA · exp 08/28', icon: 'credit-card' },
  { id: '3', type: 'WALLET', label: 'ClosetX Pay', sub: 'Balance: ₹1,240', icon: 'briefcase' },
];

export function PaymentMethodsScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [selected, setSelected] = useState('1');
  return (
    <PageShell>
      <ScreenHeader title="Payment" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'> PAYMENT_METHODS_v2'}
          title={'YOUR\nWALLETS.'}
          intro="UPI, cards, wallets. Pick your default — we remember for next time."
          chips={[{ label: 'SECURE' }, { label: '256-BIT' }, { label: 'PCI DSS' }]}
        />

        <SectionLabel label="METHODS" right={`${PAYMENTS.length} LINKED`} />
        {PAYMENTS.map((p, i) => {
          const on = selected === p.id;
          return (
            <FadeInUp key={p.id} delay={i * 60}>
              <Pressable onPress={() => setSelected(p.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
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
  const progress = nextTier ? points / nextTier.min : 1;

  return (
    <PageShell>
      <ScreenHeader title="Loyalty" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <View style={[{ padding: SP.l, backgroundColor: C.ink }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{'> LOYALTY · TIER: ' + currentTier.name}</Text>
              <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{new Date().toLocaleDateString()}</Text>
            </View>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 72, color: C.white, letterSpacing: -3, marginTop: 6, lineHeight: 72 }}>{points.toLocaleString()}</Text>
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
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'> GIFT_CARD · DIGITAL'}
          title={'GIVE THE\nGIFT OF FIT.'}
          intro="Send a ClosetX gift card to anyone. Redeemable across the entire catalog."
          chips={[{ label: 'INSTANT DELIVERY', solid: true }, { label: 'NO EXPIRY' }]}
        />

        {/* Live preview card */}
        <View style={[{ marginTop: SP.l, padding: SP.l, backgroundColor: C.ink, minHeight: 180 }, BORDER(1)]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{'CLOSETX · GIFT CARD'}</Text>
            <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>//PREVIEW</Text>
          </View>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 48, color: C.white, letterSpacing: -2, marginTop: 12 }}>₹{amount || '—'}</Text>
          <Text style={[T.mono, { color: C.white, opacity: 0.7, marginTop: 8 }]}>TO: {toEmail || '—'}</Text>
          <Text style={[T.mono, { color: C.white, opacity: 0.7, marginTop: 2 }]}>NOTE: {note || '—'}</Text>
        </View>

        <SectionLabel label="SELECT AMOUNT" />
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
          {amounts.map(a => (
            <Pressable key={a} onPress={() => setAmount(String(a))} style={[{ flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: amount === String(a) ? C.ink : C.white }, BORDER(1)]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: amount === String(a) ? C.white : C.ink }}>₹{a}</Text>
            </Pressable>
          ))}
        </View>

        <SectionLabel label="RECIPIENT" />
        <View style={{ marginTop: 8 }}>
          <BrutalInput value={toEmail} onChangeText={setToEmail} placeholder="friend@example.com" label="Send to (email)" icon="mail" />
          <BrutalInput value={note} onChangeText={setNote} placeholder="You're the best. Go buy something good." label="Personal note" icon="message-square" />
        </View>

        <BrutalButton label={`Buy gift card — ₹${amount || '0'}`} icon="gift" block onPress={() => showToast('Gift Card', 'Purchase coming soon', 'gift')} style={{ marginTop: SP.l }} />
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
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'> REFERRAL · ₹200 EACH'}
          title={'SHARE THE\nDRIP.'}
          intro="Give ₹200, get ₹200 when your friend makes their first order."
          chips={[{ label: '7 INVITED' }, { label: '4 JOINED' }, { label: '₹800 EARNED', solid: true }]}
        />

        <FadeInUp delay={60}>
          <View style={[{ marginTop: SP.l, padding: SP.xl, alignItems: 'center', backgroundColor: C.ink }, BORDER(1)]}>
            <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6 }]}>{'> YOUR CODE'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 44, color: C.white, marginTop: 8, letterSpacing: 4 }}>CLOSETX42</Text>
            <Text style={[T.mono, { color: C.white, opacity: 0.6, marginTop: 6, fontSize: 10 }]}>TAP COPY TO SHARE</Text>
          </View>
        </FadeInUp>

        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l }}>
          <BrutalButton label="Copy code" icon="copy" variant="outline" style={{ flex: 1 }} onPress={() => showToast('Copied', 'Code copied to clipboard', 'copy')} />
          <BrutalButton label="Share" icon="share-2" style={{ flex: 1 }} onPress={() => showToast('Share', 'Share sheet coming soon', 'share-2')} />
        </View>

        <SectionLabel label="HOW IT WORKS" />
        {[
          { i: 1, t: 'Share your code', sub: 'Send CLOSETX42 to your friends' },
          { i: 2, t: 'Friend signs up', sub: 'They apply the code at checkout' },
          { i: 3, t: 'They order', sub: 'First order of ₹499 or more unlocks it' },
          { i: 4, t: 'You both get ₹200', sub: 'Instantly credited to your wallet' },
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
          {[{ label: 'INVITED', value: '7' }, { label: 'JOINED', value: '4' }, { label: 'EARNED', value: '₹800' }].map((s, i) => (
            <View key={i} style={[{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white }, i > 0 && { borderLeftWidth: 1, borderColor: C.ink }]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 26, color: C.ink, letterSpacing: -0.8 }}>{s.value}</Text>
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
          code={'> PUSH_SETTINGS'}
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
          code={'> LOCALE · 8 LANGUAGES'}
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
export function CustomerSupportScreen() {
  const nav = useNavigation<any>();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ from: 'bot' | 'user'; text: string }[]>([
    { from: 'bot', text: "Hey! I'm CX-Bot. How can I help you today?" },
  ]);
  const quick = ['Track order', 'Return item', 'Payment issue', 'Size help'];

  const send = (text?: string) => {
    const msg = (text ?? message).trim();
    if (!msg) return;
    setMessages(prev => [
      ...prev,
      { from: 'user', text: msg },
      { from: 'bot', text: "Got it! Let me look into that. A human agent will follow up shortly." },
    ]);
    setMessage('');
  };

  return (
    <PageShell>
      <ScreenHeader title="Support" onBack={() => nav.goBack()} />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 20 }}>
          <Hero
            code={'> CX_BOT_v2 · 24×7'}
            title={'WE GOT\nYOU.'}
            intro="Live chat with CX-Bot. Escalates to a human agent in seconds."
            chips={[{ label: 'ONLINE NOW', solid: true }, { label: 'AVG 2 MIN' }]}
          />

          <SectionLabel label="QUICK HELP" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {quick.map(q => (
              <Pressable key={q} onPress={() => send(q)} style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: C.ink }}>{q}</Text>
              </Pressable>
            ))}
          </View>

          <SectionLabel label="CONVERSATION" />
          {messages.map((m, i) => (
            <FadeInUp key={i} delay={i * 40}>
              <View style={{ marginTop: SP.s, alignItems: m.from === 'bot' ? 'flex-start' : 'flex-end' }}>
                {m.from === 'bot' && <Text style={[T.mono, { color: C.dim, fontSize: 9, marginBottom: 4 }]}>CX-BOT</Text>}
                {m.from === 'user' && <Text style={[T.mono, { color: C.dim, fontSize: 9, marginBottom: 4 }]}>YOU</Text>}
                <View style={[{ padding: SP.m, maxWidth: '85%', backgroundColor: m.from === 'bot' ? C.white : C.ink }, BORDER(1)]}>
                  <Text style={[T.body, { color: m.from === 'bot' ? C.ink : C.white }]}>{m.text}</Text>
                </View>
              </View>
            </FadeInUp>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', padding: SP.m, gap: SP.s, borderTopWidth: 1, borderColor: C.ink, backgroundColor: C.white }}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type your message..."
            placeholderTextColor={C.dim}
            style={[{ flex: 1, padding: SP.m, fontFamily: 'Inter_400Regular', fontSize: 14, color: C.ink }, BORDER(1)]}
          />
          <BrutalButton label="Send" icon="send" small onPress={() => send()} />
        </View>
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
          code={'> STYLE_DNA'}
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
          code={'> BODY_SCAN · 8 POINTS'}
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
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.ink, letterSpacing: -0.8, marginTop: 6 }}>{convert(m.valueCm)}</Text>
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
          code={'> UPCOMING · 6 EVENTS'}
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
    { title: 'SECOND LIFE PROGRAM', sub: 'Donate old clothes for ClosetX credits', icon: 'refresh-cw' },
    { title: 'SUSTAINABLE BRANDS', sub: '40+ eco-conscious brands on the platform', icon: 'award' },
  ];
  return (
    <PageShell>
      <ScreenHeader title="Eco" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'> ECO_MODE · IMPACT_2026'}
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
  const stepLabels = ['ORDER', 'ITEM', 'REASON'];

  return (
    <PageShell>
      <ScreenHeader title="Returns" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'> RETURN_FLOW · 7D'}
          title={'EASY\nRETURNS.'}
          intro="7-day hassle-free returns. Pickup from your door. Refund in 3-5 days."
          chips={[{ label: `STEP ${stepIndex + 1}/3`, solid: true }, { label: 'FREE PICKUP' }]}
        />

        {/* Step progress */}
        <View style={[{ flexDirection: 'row', marginTop: SP.l, overflow: 'hidden' }, BORDER(1)]}>
          {stepLabels.map((label, i) => {
            const active = i === stepIndex;
            const done = i < stepIndex;
            return (
              <View
                key={label}
                style={[
                  { flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: active || done ? C.ink : C.white },
                  i > 0 && { borderLeftWidth: 1, borderColor: C.ink },
                ]}
              >
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: active || done ? C.white : C.ink, letterSpacing: 0.6 }}>{label}</Text>
                <Text style={[T.mono, { fontSize: 8, marginTop: 2, color: active || done ? 'rgba(255,255,255,0.6)' : C.dim }]}>0{i + 1}</Text>
              </View>
            );
          })}
        </View>

        {/* ── STEP 1: PICK ORDER ── */}
        {step === 'order' && (
          <>
            <SectionLabel label="SELECT ORDER" right={`${RETURNABLE_ORDERS.length} ELIGIBLE`} />
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
                        <Text style={[T.monoB, { fontSize: 10 }]}>{`#${o.id}`}</Text>
                        <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{o.date} · {o.items.length} item{o.items.length !== 1 ? 's' : ''}</Text>
                      </View>
                      <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: expired ? C.white : C.ink }, BORDER(1)]}>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.6, color: expired ? C.ink : C.white }}>
                          {expired ? 'WINDOW CLOSED' : `${o.daysLeft}D LEFT`}
                        </Text>
                      </View>
                    </View>
                    <View style={{ padding: SP.m, gap: 6 }}>
                      {o.items.map(it => (
                        <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[T.monoB, { fontSize: 8, color: C.dim, width: 48 }]}>{it.brand}</Text>
                          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink, flex: 1 }} numberOfLines={1}>{it.name}</Text>
                          <Text style={[T.mono, { fontSize: 10 }]}>₹{it.price}</Text>
                        </View>
                      ))}
                    </View>
                    {!expired && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', padding: SP.m, borderTopWidth: 1, borderColor: C.hairline, gap: 4 }}>
                        <Text style={[T.monoB, { fontSize: 10 }]}>CHOOSE ITEM</Text>
                        <Feather name="chevron-right" size={14} color={C.ink} />
                      </View>
                    )}
                  </Pressable>
                </FadeInUp>
              );
            })}
          </>
        )}

        {/* ── STEP 2: PICK ITEM ── */}
        {step === 'item' && selectedOrder && (
          <>
            <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.6)' }]}>{'> SELECTED ORDER'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.white, marginTop: 4 }}>{`#${selectedOrder.id}`}</Text>
              <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 }]}>{selectedOrder.date} · {selectedOrder.daysLeft}D LEFT IN WINDOW</Text>
            </View>

            <SectionLabel label="SELECT ITEM TO RETURN" right={`${selectedOrder.items.length} ITEMS`} />
            {selectedOrder.items.map((it, i) => {
              const on = itemId === it.id;
              return (
                <FadeInUp key={it.id} delay={i * 40}>
                  <Pressable onPress={() => pickItem(it.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                    <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : 'transparent' }, BORDER(1), on && { borderColor: C.white }]}>
                      <Feather name="shopping-bag" size={16} color={on ? C.ink : C.ink} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[T.monoB, { fontSize: 9, color: on ? 'rgba(255,255,255,0.7)' : C.dim }]}>{it.brand}</Text>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: on ? C.white : C.ink, marginTop: 2 }}>{it.name}</Text>
                      <Text style={[T.mono, { fontSize: 10, color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 2 }]}>₹{it.price}</Text>
                    </View>
                    <Feather name={on ? 'check' : 'chevron-right'} size={16} color={on ? C.white : C.ink} />
                  </Pressable>
                </FadeInUp>
              );
            })}
          </>
        )}

        {/* ── STEP 3: PICK REASON ── */}
        {step === 'reason' && selectedOrder && selectedItem && (
          <>
            <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.6)' }]}>{'> RETURNING'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.white, marginTop: 4 }}>{selectedItem.name}</Text>
              <Text style={[T.mono, { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 }]}>{selectedItem.brand} · ₹{selectedItem.price} · from #{selectedOrder.id}</Text>
            </View>

            <SectionLabel label="WHY ARE YOU RETURNING?" />
            {reasons.map((r, i) => {
              const on = reason === r.label;
              return (
                <FadeInUp key={r.label} delay={i * 30}>
                  <Pressable onPress={() => setReason(r.label)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                    <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : 'transparent' }, BORDER(1), on && { borderColor: C.white }]}>
                      <Feather name={r.icon as any} size={14} color={C.ink} />
                    </View>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: on ? C.white : C.ink, flex: 1, marginLeft: 12 }}>{r.label}</Text>
                    {on && <Feather name="check" size={16} color={C.white} />}
                  </Pressable>
                </FadeInUp>
              );
            })}

            <BrutalButton label="Initiate return" icon="rotate-ccw" block disabled={!reason} onPress={submit} style={{ marginTop: SP.xl }} />
          </>
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
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <Hero
          code={'> YOUR_REVIEWS'}
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
          code={'> PICKUP · ZERO_DELIVERY_FEE'}
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
          code={'> TRY_AT_HOME // FREE_RETURNS'}
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
