// Profile sub-screens — each page has a unique hero banner, structured
// body, and consistent brutalist treatment.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Linking, Share } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, T, SP, BORDER, rf, HELV} from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalStatusBar, FadeInUp, BrutalInput, Chip, OptionSheet } from '../components/Brutal';
import { useApp } from '../state/AppState';
import * as Clipboard from 'expo-clipboard';
import { getLoyalty } from '../services/loyalty';
import { getWallet } from '../services/wallet';
import { listGiftCards, redeemGiftCard, type GiftCard } from '../services/giftCards';
import { listIssues, createIssue, type IssueRow } from '../services/issues';
import { listOrders, type OrderListRow } from '../services/orders';
import { listReviews, isBackendListingId, listNearbyStores, dayHours, type Store } from '../services/catalog';
import { ReviewComposer } from '../components/ReviewComposer';
import { lookupPincode } from '../services/pincode';
import { captureCurrentLocation } from '../services/geo';
import { MapPicker } from '../components/MapPicker';
import { getPlace } from '../state/location';
import { getReferral, type Referral } from '../services/referrals';
import { useAppConfig } from '../hooks/useAppConfig';
import { formatWindow, tierFor, pointsToRupees, type AppConfig } from '../services/appConfig';
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
// lat/lng feed delivery routing + the serviceable-radius check + GST
// place-of-supply. They used to be a single hardcoded Mumbai coordinate sent for
// EVERY address, so a Delhi customer's address was routed as if it were in
// Mumbai. Now: captured from the device on request (services/geo.ts), and the
// pincode fills city + GST state code (services/pincode.ts).
const EMPTY_ADDR_FORM = {
  label: '', line1: '', line2: '', city: '', pincode: '', stateCode: '',
  lat: null as number | null, lng: null as number | null,
};

export function SavedAddressesScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  // When opened from checkout (ReviewOrder passes pickReturn), tapping an
  // address selects it for the order and returns.
  const pickReturn = !!route.params?.pickReturn;
  const { showToast, showConfirm } = useApp();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDR_FORM);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const pickForOrder = (a: Address) => {
    // merge:true returns to the EXISTING ReviewOrder instance with the param.
    nav.navigate({ name: 'ReviewOrder', params: { pickedAddressId: a.id }, merge: true } as any);
  };
  const openForm = () => {
    setFormOpen(true);
    // The form renders at the bottom — bring it into view above the keyboard.
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
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

  // Six digits typed → resolve city + GST state code. Cached for a day, so
  // re-opening the form or correcting a typo costs nothing.
  const [pinLookup, setPinLookup] = useState<'idle' | 'loading' | 'failed'>('idle');
  useEffect(() => {
    const pin = form.pincode.trim();
    if (!/^\d{6}$/.test(pin)) { setPinLookup('idle'); return; }
    let cancelled = false;
    setPinLookup('loading');
    lookupPincode(pin)
      .then((info) => {
        if (cancelled) return;
        if (!info) { setPinLookup('failed'); return; }
        setPinLookup('idle');
        setForm((f) => ({
          ...f,
          // Never clobber something the customer typed themselves.
          city: f.city.trim() ? f.city : info.city,
          stateCode: f.stateCode.trim() ? f.stateCode : (info.stateCode ?? ''),
        }));
      })
      .catch(() => { if (!cancelled) setPinLookup('failed'); });
    return () => { cancelled = true; };
  }, [form.pincode]);

  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    const res = await captureCurrentLocation();
    setLocating(false);
    if (!res.ok) {
      // A refusal or a dead GPS is not a dead end — coordinates are required to save, so hand
      // the shopper the map instead of a toast telling them to go and change a system setting.
      showToast(
        res.reason === 'denied' ? 'No location access' : 'Could not get a fix',
        'Place the pin on the map instead',
        'map',
      );
      setMapOpen(true);
      return;
    }
    setForm((f) => ({
      ...f,
      lat: res.coords.lat,
      lng: res.coords.lng,
      pincode: f.pincode.trim() || res.postalCode || f.pincode,
      city: f.city.trim() || res.city || f.city,
    }));
    showToast('Location set', 'This address is now pinned for delivery', 'check');
  };

  // Coordinates are now REQUIRED to save. That is deliberate: the alternative is
  // shipping a wrong one, and a wrong coordinate silently misroutes the order.
  const canSave =
    !!form.line1.trim() && !!form.city.trim() &&
    /^\d{6}$/.test(form.pincode.trim()) && form.stateCode.trim().length === 2 &&
    form.lat != null && form.lng != null;

  const onSave = () => {
    if (!canSave || saving) return;
    setSaving(true);
    createAddress({
      label: form.label.trim() || null,
      line1: form.line1.trim(), line2: form.line2.trim() || null,
      city: form.city.trim(), pincode: form.pincode.trim(), stateCode: form.stateCode.trim().toUpperCase(),
      lat: form.lat!, lng: form.lng!,
    })
      .then((created) => {
        setFormOpen(false); setForm(EMPTY_ADDR_FORM);
        showToast('Address added', 'Saved to your account', 'check');
        // Came from checkout? The fresh address is what they want — select it
        // for the order and return straight to the review page.
        if (pickReturn && created?.id) { pickForOrder(created); return; }
        load();
      })
      .catch((e: any) => showToast('Could not save', e?.message || 'Check details / sign in', 'x'))
      .finally(() => setSaving(false));
  };

  return (
    <PageShell>
      <ScreenHeader title="Addresses" onBack={() => nav.goBack()} />
      {/* KeyboardAvoidingView + persistent-taps scroll: the add form is INLINE
          on the page now (was an OptionSheet modal), so fields can never hide
          behind the keyboard — the page shrinks/scrolls to keep them visible. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
          <Hero
            code={`ADDRESSES · ${addresses.length} SAVED`}
            title={'Your\naddresses.'}
            intro={pickReturn ? 'Tap an address to deliver there.' : 'Deliver to home, office, or anywhere else. One tap to switch.'}
            chips={[{ label: pickReturn ? 'PICK FOR THIS ORDER' : 'DELIVERY' }]}
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
                    {/* Whole card is tappable: from checkout it SELECTS the
                        address for the order; otherwise it sets the default. */}
                    <Pressable onPress={() => (pickReturn ? pickForOrder(a) : onSetDefault(a))} style={{ flexDirection: 'row', alignItems: 'flex-start', padding: SP.m }}>
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
                    </Pressable>
                    {pickReturn ? (
                      <Pressable onPress={() => pickForOrder(a)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.m, paddingVertical: 11, borderTopWidth: 1, borderColor: C.hairline, backgroundColor: '#F4F4F4' }}>
                        <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '700' }]}>Deliver here</Text>
                        <Feather name="arrow-right" size={14} color={C.ink} />
                      </Pressable>
                    ) : !a.isDefault && (
                      <Pressable onPress={() => onSetDefault(a)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.m, paddingVertical: 11, borderTopWidth: 1, borderColor: C.hairline }}>
                        <Text style={[T.caption, { color: C.ink }]}>Set as default</Text>
                        <Feather name="chevron-right" size={14} color={C.ink} />
                      </Pressable>
                    )}
                  </View>
                </FadeInUp>
              );
            })}

            {/* ── ADD ADDRESS — inline card (no modal), keyboard-safe ── */}
            {formOpen ? (
              <View style={[{ marginTop: SP.l, backgroundColor: C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
                  <Text style={[T.h3, { textTransform: 'uppercase' }]}>New address</Text>
                  <Pressable onPress={() => setFormOpen(false)} hitSlop={10}>
                    <Feather name="x" size={16} color={C.ink} />
                  </Pressable>
                </View>
                <View style={{ padding: SP.m }}>
                  <BrutalInput label="Label (Home / Office)" value={form.label} onChangeText={(v: string) => setForm(f => ({ ...f, label: v }))} placeholder="Home" />
                  <BrutalInput label="Address line 1" value={form.line1} onChangeText={(v: string) => setForm(f => ({ ...f, line1: v }))} placeholder="Flat, building, street" />
                  <BrutalInput label="Address line 2" value={form.line2} onChangeText={(v: string) => setForm(f => ({ ...f, line2: v }))} placeholder="Area, landmark (optional)" />
                  <BrutalInput label="City" value={form.city} onChangeText={(v: string) => setForm(f => ({ ...f, city: v }))} placeholder="Mumbai" />
                  <View style={{ flexDirection: 'row', gap: SP.m }}>
                    <View style={{ flex: 1 }}>
                      <BrutalInput label="Pincode" value={form.pincode} onChangeText={(v: string) => setForm(f => ({ ...f, pincode: v }))} keyboardType="number-pad" placeholder="400050" maxLength={6} />
                    </View>
                    <View style={{ width: 110 }}>
                      <BrutalInput label="State (GST)" value={form.stateCode} onChangeText={(v: string) => setForm(f => ({ ...f, stateCode: v.toUpperCase() }))} placeholder="27" maxLength={2} />
                    </View>
                  </View>
                  {pinLookup === 'loading' && (
                    <Text style={[T.micro, { marginTop: 4, color: C.dim }]}>Looking up pincode…</Text>
                  )}
                  {pinLookup === 'failed' && (
                    <Text style={[T.micro, { marginTop: 4, color: '#B0740A' }]}>
                      We could not find that pincode — check it, or fill city and state yourself.
                    </Text>
                  )}

                  {/* Delivery pin. Required, because a guessed coordinate silently
                      misroutes the order — see the note on EMPTY_ADDR_FORM. */}
                  <View style={[{ marginTop: SP.m, padding: SP.m, backgroundColor: form.lat != null ? '#F1F8F3' : '#FFF8E1' }, BORDER(1)]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Feather name={form.lat != null ? 'check-circle' : 'map-pin'} size={15} color={form.lat != null ? '#1B8A5A' : '#B0740A'} />
                      <Text style={[T.bodyB, { flex: 1, color: C.ink }]}>
                        {form.lat != null ? 'Delivery location pinned' : 'Pin this address'}
                      </Text>
                    </View>
                    <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>
                      {form.lat != null
                        ? 'We use this only to route your order to the nearest store.'
                        : 'We need your location to route orders and check we deliver here.'}
                    </Text>
                    {form.lat != null && (
                      <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>
                        {`Pinned at ${form.lat.toFixed(5)}, ${form.lng!.toFixed(5)}`}
                      </Text>
                    )}
                    <BrutalButton
                      label={locating ? 'Getting location…' : form.lat != null ? 'Update location' : 'Use my current location'}
                      icon="navigation"
                      variant="outline"
                      block
                      disabled={locating}
                      onPress={useMyLocation}
                      style={{ marginTop: SP.s }}
                    />
                    {/* Always offered, not only after a refusal. GPS gives the shopper's own
                        position, which is the wrong pin whenever they are adding someone
                        else's address — or a home address from the office. */}
                    <BrutalButton
                      label={form.lat != null ? 'Adjust pin on map' : 'Drop pin on map'}
                      icon="map"
                      variant="outline"
                      block
                      onPress={() => setMapOpen(true)}
                      style={{ marginTop: SP.s }}
                    />
                  </View>
                  <BrutalButton label={saving ? 'Saving…' : 'Save address'} icon="check" block onPress={onSave} style={{ marginTop: SP.m, opacity: canSave && !saving ? 1 : 0.5 }} />
                </View>
              </View>
            ) : (
              <BrutalButton label="Add new address" icon="plus" variant="outline" block onPress={openForm} style={{ marginTop: SP.l }} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pin picker for this address. Opens on the pin already set, else on the shopper's own
          location if we have one, so they start near where they are rather than mid-ocean.
          The pin is authoritative for lat/lng; city and pincode are only prefilled where the
          form is still blank, so a hand-typed pincode is never overwritten by the geocoder. */}
      <MapPicker
        visible={mapOpen}
        initial={
          form.lat != null && form.lng != null
            ? { lat: form.lat, lng: form.lng }
            : getPlace()?.coords ?? null
        }
        title="Pin this address"
        onCancel={() => setMapOpen(false)}
        onConfirm={(picked) => {
          setForm((f) => ({
            ...f,
            lat: picked.coords.lat,
            lng: picked.coords.lng,
            pincode: f.pincode.trim() || picked.postalCode || f.pincode,
            city: f.city.trim() || picked.city || f.city,
          }));
          setMapOpen(false);
          showToast('Location pinned', 'This address is now pinned for delivery', 'check');
        }}
      />
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// PAYMENT METHODS
// ═══════════════════════════════════════════════════════════
const PAYMENTS = [
  { id: '1', type: 'UPI', label: 'pay@okhdfcbank', sub: 'HDFC · linked Oct 2024', icon: 'smartphone' },
  { id: '2', type: 'CARD', label: '•••• •••• •••• 4242', sub: 'VISA · exp 08/28', icon: 'credit-card' },
  // Balance filled from GET /consumer/wallet at render — it was the literal ₹1,240.
  { id: '3', type: 'WALLET', label: 'Trendzo Pay', sub: '', icon: 'briefcase' },
];

export function PaymentMethodsScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [selected, setSelected] = useState('1');
  // Real wallet balance. The saved UPI id and card here remain placeholders —
  // there is no stored-instrument endpoint yet, so they are NOT presented as the
  // customer's own (see the note on PAYMENTS above).
  const [walletPaise, setWalletPaise] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getWallet({ limit: 1 })
      .then((w) => { if (!cancelled) setWalletPaise(w.balancePaise); })
      .catch(() => { /* guest / offline — 0 */ });
    return () => { cancelled = true; };
  }, []);
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
                    <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.6)' : C.dim, marginTop: 2 }]}>
                      {p.type === 'WALLET' ? `Balance: ₹${Math.round(walletPaise / 100).toLocaleString()}` : p.sub}
                    </Text>
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
/**
 * The tier ladder now comes from GET /app-config.
 *
 * It was hardcoded here as 0 / 1000 / 5000 / 10000 while the backend derives
 * tiers from loyalty_tier_silver_min (500), _gold_min (2000) and _platinum_min
 * (5000). A customer on 600 points was SILVER server-side and BRONZE in the app,
 * with a wrong "points to next tier" to match. Those three config keys were also
 * read-but-never-seeded; they are seeded now.
 */

export function LoyaltyRewardsScreen() {
  const nav = useNavigation<any>();
  // Real balance from GET /consumer/loyalty. This was the literal 1240, so every
  // customer saw the same made-up tier and the same distance to the next one.
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    getLoyalty({ limit: 1 })
      .then((l) => { if (!cancelled) setPoints(l.balancePoints); })
      .catch(() => { /* signed out / offline — show zero, never a fake balance */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const cfg = useAppConfig();
  const TIERS = cfg.loyalty.tiers;
  const t = tierFor(points, cfg);
  const currentTier = t.current;
  const nextTier = t.next;
  const curIdx = TIERS.findIndex((x) => x.name === currentTier.name);
  const progress = t.progress;
  const toNext = t.toNext;

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
                    <Text style={[T.micro, { color: C.dim, marginTop: 1 }]}>{t.minPoints >= 1000 ? `${t.minPoints / 1000}K` : t.minPoints}</Text>
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
                  <Text style={[T.micro, { color: C.ink, fontFamily: HELV, fontWeight: '600', marginTop: 2 }]}>3 free pushes today</Text>
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

          {/* SPIN & WIN — the one game that pays out for real. Its only entry point:
              the wheel was previously reachable solely from DailyRewardScreen, which
              itself has no way in, so nobody could open it on purpose. */}
          <FadeInUp>
            <Pressable onPress={() => nav.navigate('SpinWheel')} style={[{ backgroundColor: C.white, overflow: 'hidden', marginTop: SP.s }, BORDER(1)]}>
              <Text numberOfLines={1} style={{ position: 'absolute', right: -6, bottom: -16, fontFamily: 'Inter_900Black', fontSize: rf(72), letterSpacing: -3, color: 'rgba(0,0,0,0.04)' }}>SPIN&WIN</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.l, gap: SP.m }}>
                <View style={[{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: TILE }, BORDER(1)]}>
                  <MaterialCommunityIcons name="ferris-wheel" size={32} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ alignSelf: 'flex-start' }}>
                    <View style={{ position: 'absolute', left: -2, right: -4, bottom: 1, height: 8, backgroundColor: '#F2E63C' }} />
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(17), color: C.ink, letterSpacing: 0.5 }}>SPIN & WIN</Text>
                  </View>
                  <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>Real coupon codes and points · applied at checkout</Text>
                  <Text style={[T.micro, { color: C.ink, fontFamily: HELV, fontWeight: '600', marginTop: 2 }]}>One spin a day</Text>
                </View>
                <View>
                  <View style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, backgroundColor: '#F2E63C', borderWidth: 1, borderColor: C.ink }} />
                  <View style={{ backgroundColor: C.ink, paddingHorizontal: 18, paddingVertical: 11 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(13), color: C.white, letterSpacing: 2 }}>SPIN</Text>
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
/**
 * Gift cards — the two things the backend actually supports: seeing the cards on
 * your account, and redeeming a code into your wallet.
 *
 * This screen used to be a full PURCHASE flow (amount picker, recipient email,
 * personal note, "Buy gift card" button) for which there is no endpoint at all —
 * the button ended in a "coming soon" toast. Selling something the platform
 * cannot deliver is worse than not offering it, so the purchase form is gone and
 * the real capability is here instead.
 */
export function GiftCardScreen() {
  const nav = useNavigation<any>();
  const { showToast, token, requireAuth } = useApp();
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [totalPaise, setTotalPaise] = useState(0);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(() => {
    if (!token) { setLoading(false); return; }
    listGiftCards()
      .then((res) => { setCards(res.cards); setTotalPaise(res.totalPaise); })
      .catch(() => { /* offline — leave empty rather than invent a balance */ })
      .finally(() => setLoading(false));
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const redeem = () => {
    const c = code.trim().toUpperCase();
    if (!c || redeeming) return;
    if (!token) { requireAuth(); return; }
    setRedeeming(true);
    redeemGiftCard(c)
      .then((res) => {
        showToast('Gift card redeemed', `₹${Math.round(res.creditedPaise / 100)} added to your wallet`, 'gift');
        setCode('');
        load();
      })
      // The server distinguishes invalid / expired / already-redeemed; show its reason.
      .catch((e: any) => showToast('Could not redeem', e?.message || 'Check the code and try again', 'x'))
      .finally(() => setRedeeming(false));
  };

  return (
    <PageShell>
      <ScreenHeader title="Gift Cards" onBack={() => nav.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <Hero
          code={'GIFT_CARDS'}
          title={'Your\ngift cards.'}
          intro="Redeem a code and the value lands in your Trendzo wallet, ready to spend."
          chips={[{ label: `₹${Math.round(totalPaise / 100).toLocaleString()} AVAILABLE`, solid: true }]}
        />

        {/* Signature black card — now showing the REAL combined balance */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <FadeInUp>
            <View style={{ backgroundColor: C.ink, overflow: 'hidden', minHeight: 170 }}>
              <Text numberOfLines={1} style={{ position: 'absolute', right: -10, bottom: -22, fontFamily: 'Inter_900Black', fontSize: rf(96), color: 'rgba(255,255,255,0.05)', letterSpacing: -4, textTransform: 'uppercase' }}>GIFT</Text>
              <View style={{ padding: SP.l }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.caption, { color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }]}>Total gift balance</Text>
                  <Feather name="gift" size={16} color="rgba(255,255,255,0.85)" />
                </View>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(52), color: '#fff', letterSpacing: -2.5, marginTop: SP.l }}>
                  {`₹${Math.round(totalPaise / 100).toLocaleString()}`}
                </Text>
                <Text style={[T.micro, { color: 'rgba(255,255,255,0.6)', marginTop: SP.s }]}>
                  {cards.length ? `${cards.length} card${cards.length === 1 ? '' : 's'} on your account` : 'No cards yet'}
                </Text>
              </View>
            </View>
          </FadeInUp>
        </View>

        <SectionHead title="Redeem a code" />
        <View style={{ paddingHorizontal: SP.l }}>
          <BrutalInput
            value={code}
            onChangeText={(v: string) => setCode(v.toUpperCase())}
            placeholder="Enter gift card code"
            label="Gift card code"
            icon="gift"
            autoCapitalize="characters"
          />
          <BrutalButton
            label={redeeming ? 'Redeeming…' : 'Redeem to wallet'}
            icon="check"
            block
            disabled={!code.trim() || redeeming}
            onPress={redeem}
            style={{ marginTop: SP.s }}
          />
        </View>

        <SectionHead title="Your cards" right={`${cards.length}`} />
        <View style={{ paddingHorizontal: SP.l }}>
          {!loading && cards.length === 0 && (
            <View style={[{ padding: SP.xl, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <Feather name="gift" size={24} color={C.dim} />
              <Text style={[T.h3, { marginTop: 10 }]}>{token ? 'No gift cards yet' : 'Sign in to see your cards'}</Text>
              <Text style={[T.caption, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>
                Redeem a code above and it will appear here.
              </Text>
            </View>
          )}
          {cards.map((c, i) => (
            <FadeInUp key={c.id} delay={i * 40}>
              <View style={[{ marginTop: i === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
                <IconTile icon="gift" size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[T.monoB]}>{c.code}</Text>
                  <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{`Expires ${c.expiresOn}`}</Text>
                </View>
                <Text style={[T.price]}>{`₹${Math.round(c.balancePaise / 100).toLocaleString()}`}</Text>
              </View>
            </FadeInUp>
          ))}
        </View>

        {/* Honest about what is missing, rather than a form that does nothing. */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <Text style={[T.micro, { color: C.dim }]}>
            Buying gift cards in the app is not available yet.
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════
// REFERRAL REWARDS
// ═══════════════════════════════════════════════════════════
export function ReferralRewardsScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  // Real referral data from GET /consumer/referrals/me. The code was the constant
  // 'TRENDZO42' — so two customers opening this screen were told to share the SAME
  // code, and the stats (7 invited / ₹800 earned) were the same invented numbers
  // for everyone. The genuine code is also already on the profile object.
  const [ref, setRef] = useState<Referral | null>(null);
  useEffect(() => {
    let cancelled = false;
    getReferral()
      .then((r) => { if (!cancelled) setRef(r); })
      .catch(() => { /* signed out / offline — render the empty state, not fake stats */ });
    return () => { cancelled = true; };
  }, []);
  const code = ref?.code ?? null;
  const invited = ref?.referredCount ?? 0;
  const earned = ref?.pointsEarned ?? 0;

  const copyCode = () => {
    if (!code) return;
    Clipboard.setStringAsync(code)
      .then(() => showToast('Copied', 'Code copied to clipboard', 'copy'))
      .catch(() => {});
  };
  const shareCode = () => {
    if (!code) return;
    const link = ref?.shareLink;
    Share.share({ message: link ? `Use my Trendzo code ${code} — ${link}` : `Use my Trendzo code ${code}` }).catch(() => {});
  };
  return (
    <PageShell>
      <ScreenHeader title="Refer & Earn" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'REFERRAL · ₹200 EACH'}
          title={'Share the\ndrip.'}
          intro="Give ₹200, get ₹200 when your friend makes their first order."
          chips={[{ label: `${invited} INVITED` }, { label: `${earned} PTS EARNED`, solid: true }]}
        />

        {/* Signature black referral-code card */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <FadeInUp delay={60}>
            <View style={{ backgroundColor: C.ink, overflow: 'hidden' }}>
              <Text numberOfLines={1} style={{ position: 'absolute', right: -8, top: -18, fontFamily: 'Inter_900Black', fontSize: rf(80), color: 'rgba(255,255,255,0.05)', letterSpacing: -3 }}>₹200</Text>
              <View style={{ padding: SP.xl, alignItems: 'center' }}>
                <Text style={[T.caption, { color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }]}>Your referral code</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(code && code.length > 8 ? 30 : 42), color: '#fff', marginTop: 10, letterSpacing: 4 }}>{code ?? '—'}</Text>
                <Text style={[T.micro, { color: 'rgba(255,255,255,0.55)', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 }]}>Give ₹200 · Get ₹200</Text>
              </View>
            </View>
          </FadeInUp>

          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.s }}>
            <BrutalButton label="Copy code" icon="copy" variant="outline" disabled={!code} style={{ flex: 1 }} onPress={copyCode} />
            <BrutalButton label="Share" icon="share-2" disabled={!code} style={{ flex: 1 }} onPress={shareCode} />
          </View>
        </View>

        <SectionHead title="Your stats" />
        <View style={{ paddingHorizontal: SP.l }}>
          <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
            {[{ label: 'INVITED', value: String(invited), green: false }, { label: 'JOINED', value: String(invited), green: false }, { label: 'POINTS EARNED', value: String(earned), green: true }].map((s, i) => (
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
            { i: 1, t: 'Share your code', sub: code ? `Send ${code} to your friends` : 'Sign in to get your code' },
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
/**
 * Contact rows are built from GET /app-config, not hardcoded.
 *
 * The phone number, email and opening hours used to be string literals here, so
 * changing any of them meant shipping a build — and a released app would keep
 * sending customers to a dead line. Rows the server has no value for are omitted
 * rather than rendered with a placeholder.
 *
 * They are also ACTIONS now: tapping Call opens the dialer and Email opens the
 * mail client, instead of showing a toast of the number to copy by hand.
 */
type SupportRow = {
  key: string;
  label: string;
  sub: string;
  icon: string;
  onPress: () => void;
};

function buildSupportRows(
  cfg: AppConfig,
  showToast: (t: string, m?: string, i?: string) => void,
): SupportRow[] {
  const rows: SupportRow[] = [
    {
      key: 'chat', label: 'Live chat', sub: 'Online now · avg 2 min', icon: 'message-circle',
      onPress: () => showToast('Live chat', 'Connecting you to an agent', 'message-circle'),
    },
  ];
  if (cfg.support.phone) {
    rows.push({
      key: 'call', label: 'Call us',
      sub: cfg.support.hours ? `${cfg.support.phone} · ${cfg.support.hours}` : cfg.support.phone,
      icon: 'phone',
      onPress: () => Linking.openURL(`tel:${cfg.support.phone}`).catch(() => {}),
    });
  }
  rows.push({
    key: 'email', label: 'Email', sub: `${cfg.support.email} · replies in 24h`, icon: 'mail',
    onPress: () => Linking.openURL(`mailto:${cfg.support.email}`).catch(() => {}),
  });
  return rows;
}

const SUPPORT_TOPICS = [
  { label: 'Track my order', icon: 'package' },
  { label: 'Return an item', icon: 'rotate-ccw' },
  { label: 'Payment & refunds', icon: 'credit-card' },
  { label: 'Size & fit help', icon: 'maximize' },
];

const SUPPORT_FAQ = [
  { q: 'How long does delivery take?', a: 'Standard delivery lands in 3–5 days. Metro cities often get it next-day. Try & Buy orders are delivered the following day.' },
  { q: 'What is the return window?', a: 'You have 7 days from delivery to start a free return. We schedule a doorstep pickup and refund within 3–5 days of receiving the item.' },
  { q: 'When will I get my refund?', a: 'Once the store checks your return: card and UPI refunds take 3–5 working days, wallet refunds land right away, and cash-on-delivery orders are refunded in cash when we collect the items.' },
  { q: 'How do I use a gift card or coupon?', a: 'Apply it at checkout under “Apply code”. Gift cards never expire and can be combined with most offers.' },
  { q: 'Can I change my delivery address?', a: 'Yes — as long as the order has not shipped. Head to Orders, open the order, and tap “Change address”.' },
];

export function CustomerSupportScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const cfg = useAppConfig();
  const contacts = useMemo(() => buildSupportRows(cfg, showToast), [cfg, showToast]);

  // Real support tickets. The topic tiles used to be inert: tapping one showed
  // "Opening help article" and did nothing. /consumer/issues is a full ticket API
  // (list, open, thread, reply) and nothing in the app used it.
  // An issue is always ABOUT AN ORDER server-side, so opening one starts by
  // picking the order it concerns.
  const { token, requireAuth } = useApp();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [supportOrders, setSupportOrders] = useState<OrderListRow[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const [ticketOrderId, setTicketOrderId] = useState<string | null>(null);
  const [ticketBody, setTicketBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSupport = useCallback(() => {
    if (!token) return;
    listIssues().then(setIssues).catch(() => {});
    listOrders().then(setSupportOrders).catch(() => {});
  }, [token]);
  useEffect(() => { loadSupport(); }, [loadSupport]);

  const startTicket = (label: string) => {
    if (!token) { requireAuth(); return; }
    setTopic((cur) => (cur === label ? null : label));
    setTicketOrderId((cur) => cur ?? supportOrders[0]?.id ?? null);
  };

  const submitTicket = () => {
    if (!topic || !ticketOrderId || !ticketBody.trim() || submitting) return;
    setSubmitting(true);
    createIssue({
      kind: 'query',
      orderId: ticketOrderId,
      subject: topic,
      description: ticketBody.trim(),
    })
      .then(() => {
        showToast('Ticket raised', 'Support will reply in this thread', 'check');
        setTopic(null); setTicketBody(''); loadSupport();
      })
      .catch((e: any) => showToast('Could not raise ticket', e?.message || 'Try again', 'x'))
      .finally(() => setSubmitting(false));
  };

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
          {contacts.map((c, i) => (
            <Pressable key={c.key} onPress={c.onPress} style={[{ marginTop: i === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center' }, BORDER(1)]}>
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
          {SUPPORT_TOPICS.map(t => {
            const on = topic === t.label;
            return (
              <Pressable key={t.label} onPress={() => startTicket(t.label)} style={[{ width: '48.5%', padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center', gap: 10 }, BORDER(1)]}>
                <Feather name={t.icon as any} size={16} color={on ? C.white : C.ink} />
                <Text style={[T.caption, { color: on ? C.white : C.ink, flex: 1 }]} numberOfLines={2}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Ticket composer — appears under the tiles once a topic is chosen */}
        {topic && (
          <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={[T.bodyB]}>{topic}</Text>
              {supportOrders.length === 0 ? (
                <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>
                  Tickets are raised against an order, and you have none yet.
                </Text>
              ) : (
                <>
                  <Text style={[T.micro, { color: C.dim, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Which order?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s, paddingVertical: SP.s }}>
                    {supportOrders.slice(0, 10).map((o) => {
                      const sel = o.id === ticketOrderId;
                      return (
                        <Pressable key={o.id} onPress={() => setTicketOrderId(o.id)} style={[{ paddingHorizontal: SP.m, paddingVertical: SP.s, backgroundColor: sel ? C.ink : C.white }, BORDER(1)]}>
                          <Text style={[T.caption, { color: sel ? C.white : C.ink }]}>{`#${o.id.slice(-8).toUpperCase()}`}</Text>
                          <Text style={[T.micro, { color: sel ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 2 }]} numberOfLines={1}>{o.storeName}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <TextInput
                    value={ticketBody}
                    onChangeText={setTicketBody}
                    placeholder="Tell us what went wrong"
                    placeholderTextColor={C.dim}
                    multiline
                    maxLength={1000}
                    style={[{ marginTop: SP.s, minHeight: 84, padding: SP.m, backgroundColor: '#FFFFFF', textAlignVertical: 'top', color: C.ink }, BORDER(1)]}
                  />
                  <BrutalButton
                    label={submitting ? 'Sending...' : 'Raise ticket'}
                    icon="send"
                    block
                    disabled={!ticketBody.trim() || !ticketOrderId || submitting}
                    onPress={submitTicket}
                    style={{ marginTop: SP.s }}
                  />
                </>
              )}
            </View>
          </View>
        )}

        {/* Existing tickets */}
        {issues.length > 0 && (
          <>
            <SectionHead title="Your tickets" right={`${issues.length}`} />
            <View style={{ paddingHorizontal: SP.l }}>
              {issues.map((it, i) => (
                <View key={it.id} style={[{ marginTop: i === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[T.bodyB, { flex: 1 }]} numberOfLines={1}>{it.subject}</Text>
                    <Text style={[T.micro, { color: it.status === 'decided' ? C.green : '#B0740A', textTransform: 'uppercase' }]}>
                      {it.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <Text style={[T.caption, { color: C.dim, marginTop: 4 }]} numberOfLines={2}>{it.description}</Text>
                  {it.awaitingParty === 'consumer' && (
                    <Text style={[T.micro, { color: '#B0740A', marginTop: 6 }]}>Support is waiting on your reply.</Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

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
// REVIEWS
// ═══════════════════════════════════════════════════════════
/**
 * All reviews for ONE product — this screen is only ever opened from the product
 * page's "View all", which passes the product. It used to render three invented
 * reviews of unrelated garments, identical for every product in the catalog.
 */
type ReviewRow = { id: string; author: string; rating: number; text: string; date: string; verified: boolean };

const fmtReviewAge = (iso: string): string => {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
};

export function ReviewsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { token } = useApp();
  const product = route.params?.product;
  const [filter, setFilter] = useState<'ALL' | '5' | '4' | '3'>('ALL');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumped after a successful post to re-pull the (verified-only) public list.
  const [reloadNonce, setReloadNonce] = useState(0);
  const canReview = !!token && isBackendListingId(product?.id);

  useEffect(() => {
    const id = product?.id;
    if (!id || !isBackendListingId(id)) { setLoading(false); return; }
    let cancelled = false;
    listReviews(id)
      .then((rs) => {
        if (cancelled) return;
        setRows(rs.map((r) => ({
          id: r.id,
          author: r.author || 'Trendzo Shopper',
          rating: r.rating,
          text: r.body,
          date: fmtReviewAge(r.createdAt),
          verified: r.verifiedPurchase,
        })));
      })
      .catch(() => { /* leave empty — an invented review is worse than none */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [product?.id, reloadNonce]);

  const filtered = rows.filter(r => filter === 'ALL' || r.rating === Number(filter));
  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : '—';

  return (
    <PageShell>
      <ScreenHeader title="Reviews" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Hero
          code={'PRODUCT_REVIEWS'}
          title={'What\nshoppers say.'}
          intro={product?.name ? `Verified reviews for ${product.name}.` : 'Verified reviews from shoppers who bought this.'}
          chips={[{ label: `${rows.length} REVIEWS`, solid: true }, { label: `AVG ${avg}★` }]}
        />

        {/* Summary strip */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white }}>
              <Text style={T.h1}>{avg}</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Avg rating</Text>
            </View>
            <View style={{ flex: 1, paddingVertical: SP.l, alignItems: 'center', backgroundColor: C.white, borderLeftWidth: 1, borderColor: C.hairline }}>
              <Text style={T.h1}>{rows.length}</Text>
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

        {canReview && (
          <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
            <ReviewComposer listingId={product.id} onSubmitted={() => setReloadNonce((n) => n + 1)} />
          </View>
        )}

        <SectionHead title="Reviews" right={`${filtered.length} shown`} />
        <View style={{ paddingHorizontal: SP.l }}>
          {!loading && rows.length === 0 && (
            <View style={[{ padding: SP.xl, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <Feather name="message-square" size={24} color={C.dim} />
              <Text style={[T.h3, { marginTop: 10 }]}>No reviews yet</Text>
              <Text style={[T.caption, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>Be the first to review this product.</Text>
            </View>
          )}
          {filtered.map((r, i) => (
            <FadeInUp key={r.id} delay={i * 50}>
              <View style={[{ marginTop: i === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.bodyB]}>{r.author}</Text>
                  </View>
                  <Text style={[T.micro, { color: C.dim }]}>{r.date}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 8 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Text key={s} style={[T.h3, { color: s <= r.rating ? C.ink : C.hairline }]}>★</Text>
                  ))}
                </View>
                {r.verified && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Feather name="check-circle" size={12} color={C.ink} />
                    <Text style={[T.micro, { color: C.ink }]}>Verified Purchase</Text>
                  </View>
                )}
                <Text style={[T.body, { marginTop: 8 }]}>{r.text}</Text>
                {/* The "12 helpful" counter and Edit action were invented — there
                    is no helpful-vote endpoint, and these are other people's
                    reviews, not the customer's own. */}
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
/**
 * Real stores from `/catalog/stores/nearby`.
 *
 * This page used to render four invented Mumbai stores with invented distances
 * and closing times — a shopper could read "2.4 KM · Ready in 45 MIN" for a
 * store that does not exist. The endpoint requires a coordinate (there is no
 * "any store" form), so the page resolves one first: the location the app
 * already holds, else a fresh capture, and it says plainly when it has neither
 * rather than falling back to fiction.
 */
function useNearbyStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-location'>('loading');
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    setStatus('loading');

    (async () => {
      // Reuse the place the app already resolved (address flow, location gate)
      // before asking the OS again — a second permission prompt on a page about
      // shop addresses reads as the app nagging.
      let coords = getPlace()?.coords ?? null;
      if (!coords) {
        const cap = await captureCurrentLocation();
        if (cap.ok) coords = cap.coords;
      }
      if (cancelled) return;
      if (!coords) { setStatus('no-location'); return; }

      try {
        const rows = await listNearbyStores({ ...coords, radiusKm: 25, limit: 20, signal: ac.signal });
        if (cancelled) return;
        setStores(rows);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; ac.abort(); };
  }, [nonce]);

  return { stores, status, retry };
}

/** "Open · closes 21:00", or "Closed today" — from the store's own template. */
function openLabel(store: Store): string {
  const today = dayHours(store.openingHours);
  return today ? `Open · closes ${today.to}` : 'Closed today';
}

export function StorePickupScreen() {
  const nav = useNavigation<any>();
  const { stores, status, retry } = useNearbyStores();
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <PageShell>
      <ScreenHeader title="Store Pickup" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Hero
          code={'PICKUP · ZERO_DELIVERY_FEE'}
          title={'Buy online.\nPick it up.'}
          intro="Skip delivery. Grab your order from your nearest store — usually ready in under an hour."
          chips={[
            { label: 'FREE', solid: true },
            { label: 'IN STORE' },
            // Real count, or no claim at all — never a hardcoded "4 STORES".
            ...(status === 'ready' && stores.length
              ? [{ label: `${stores.length} STORE${stores.length === 1 ? '' : 'S'}` }]
              : []),
          ]}
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

        <SectionHead
          title="Stores near you"
          right={status === 'ready' && stores.length ? `${stores.length} found` : undefined}
        />
        <View style={{ paddingHorizontal: SP.l }}>
          {status === 'loading' ? (
            <Text style={[T.caption, { color: C.dim }]}>Finding stores near you…</Text>
          ) : status === 'no-location' ? (
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={T.bodyB}>Location needed</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 3 }]}>
                We need your location to find stores near you. Turn it on and try again.
              </Text>
              <BrutalButton label="Try again" variant="outline" onPress={retry} style={{ marginTop: SP.m }} />
            </View>
          ) : status === 'error' ? (
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={T.bodyB}>Couldn't load stores</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 3 }]}>Check your connection and try again.</Text>
              <BrutalButton label="Retry" variant="outline" onPress={retry} style={{ marginTop: SP.m }} />
            </View>
          ) : stores.length === 0 ? (
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={T.bodyB}>No stores nearby yet</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 3 }]}>
                There is no pickup store within 25 km of you. Delivery still works everywhere.
              </Text>
            </View>
          ) : (
            stores.map((st, idx) => {
              const on = picked === st.id;
              return (
                <Pressable key={st.id} onPress={() => setPicked(st.id)} style={[{ marginTop: idx === 0 ? 0 : SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <IconTile icon="map-pin" size={44} on={on} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <Text style={[T.bodyB, { color: on ? C.white : C.ink, flex: 1 }]} numberOfLines={1}>{st.name}</Text>
                        {typeof st.distanceKm === 'number' && (
                          <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: on ? C.white : C.ink }}>
                            <Text style={[T.micro, { color: on ? C.ink : C.white }]}>{st.distanceKm} KM</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 3 }]} numberOfLines={2}>{st.address}</Text>
                      {/* No invented "Ready in 45 MIN" — there is no per-store
                          readiness estimate in the API. Opening hours are real. */}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.7)' : C.dim }]}>{openLabel(st)}</Text>
                        {st.phone ? (
                          <Pressable onPress={() => Linking.openURL(`tel:${st.phone}`)} hitSlop={8}>
                            <Text style={[T.micro, { color: on ? C.white : C.ink, textDecorationLine: 'underline' }]}>Call</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}

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
  const cfg = useAppConfig();
  // Trial length comes from the server's `try_on_window_seconds`. The app used to
  // state "15 min" in eight places while the backend falls back to 600 — so on any
  // environment missing that config row the courier left after ten minutes against
  // a fifteen-minute promise.
  const windowLabel = formatWindow(cfg.tryAndBuy.windowSeconds);
  const maxItems = cfg.tryAndBuy.maxItemsPerTrial;

  // Caps are stated ONLY when the backend reports one. Nothing enforces an item
  // cap or a monthly trial cap today — no table, no config key, no validation —
  // so the old copy told customers rules that did not exist.
  const goodToKnow = [
    'Only get charged for what you keep',
    'COD not available for Try & Buy orders',
    ...(cfg.tryAndBuy.maxTrialsPerMonth ? [`Max trial slots per month: ${cfg.tryAndBuy.maxTrialsPerMonth}`] : []),
    'Must be home when the courier arrives',
  ];
  return (
    <PageShell>
      <ScreenHeader title="Try & Buy" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Hero
          code={'TRY_AT_HOME // FREE_RETURNS'}
          title={"Try it.\nKeep it.\nOr don't."}
          intro={`Courier waits ${windowLabel} at your door. Keep what fits — return the rest on the spot.`}
          chips={[{ label: '₹99', solid: true }, { label: `${windowLabel.toUpperCase()} TRIAL` }, { label: 'FREE RETURNS' }]}
          inverted
        />

        <SectionHead title="How it works" />
        <View style={{ paddingHorizontal: SP.l }}>
          {[
            { i: 1, t: maxItems ? `Add up to ${maxItems} items to your bag` : 'Add what you want to try to your bag' },
            { i: 2, t: 'Pick Try & Buy at checkout' },
            { i: 3, t: `The agent brings your order and waits ${windowLabel} at your door` },
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
            {goodToKnow.map((t, i) => (
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
