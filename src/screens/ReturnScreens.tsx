// Returns. Three steps — pick the order, pick the items, say why — plus a second
// tab listing returns already open, because that is where the reverse-pickup
// collect OTP lives (the customer reads it to the driver at the door).
//
// Everything here is real: eligibility mirrors backend/src/shared/returns/open-return.ts
// (order must be 'delivered', within 7 days, item outcome must still leave the goods
// with the customer, and final-sale lines can never come back).
//
// NOT supported by the backend: exchange / replacement. There is no endpoint, no
// schema, no state for it — a "replace" would have to be a return plus a fresh order.
// The UI says so rather than pretending.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { C, T, SP, BORDER, rf, HELV} from '../theme/brutal';
import { ScreenHeader, BrutalStatusBar, BrutalButton, FadeInUp, CachedImage } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { listOrders, getOrder, type OrderListRow, type OrderDetail } from '../services/orders';
import { createReturn, listReturns, type ReturnRow, type ReasonCategory } from '../services/returns';
import { isItemReturnable, returnDaysLeft, METHOD_LABEL, toApiMethod } from '../services/orderLifecycle';
import { useAppConfig } from '../hooks/useAppConfig';

const rupees = (paise?: number | null) => Math.round((paise ?? 0) / 100);

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(); }
  catch { return ''; }
};

/** Icons stay local; the reasons themselves now come from GET /app-config so the
 *  app is not a second copy of the backend's zod enum. */
const REASON_ICONS: Record<string, string> = {
  doesnt_fit: 'maximize',
  damaged: 'alert-triangle',
  wrong_item: 'x-circle',
  not_as_described: 'eye-off',
  other: 'more-horizontal',
};

/** Offline fallback only. */
const REASONS: { value: ReasonCategory; label: string; icon: string }[] = [
  { value: 'doesnt_fit', label: 'Does not fit', icon: 'maximize' },
  { value: 'damaged', label: 'Damaged or defective', icon: 'alert-triangle' },
  { value: 'wrong_item', label: 'Wrong item sent', icon: 'x-circle' },
  { value: 'not_as_described', label: 'Not as described', icon: 'eye-off' },
  { value: 'other', label: 'Another reason', icon: 'more-horizontal' },
];

type Tab = 'new' | 'open';
type Step = 'order' | 'item' | 'reason';

export function OrderReturnScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { token, showToast, requireAuth } = useApp();

  // Arriving from an order's tracking screen skips straight to item selection.
  const presetOrderId: string | undefined = route.params?.orderId;

  const [tab, setTab] = useState<Tab>('new');
  const [step, setStep] = useState<Step>(presetOrderId ? 'item' : 'order');
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [orderId, setOrderId] = useState<string | null>(presetOrderId ?? null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<ReasonCategory | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const cfg = useAppConfig();
  // Server-supplied reasons, icon-decorated locally. Falls back to the bundled
  // list so the picker is never empty offline.
  const reasons = useMemo(
    () => (cfg.returns.reasons.length
      ? cfg.returns.reasons.map((r) => ({ value: r.value as ReasonCategory, label: r.label, icon: REASON_ICONS[r.value] ?? 'help-circle' }))
      : REASONS),
    [cfg],
  );

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    const [o, r] = await Promise.all([
      listOrders().catch(() => [] as OrderListRow[]),
      listReturns().catch(() => [] as ReturnRow[]),
    ]);
    setOrders(o);
    setReturns(r);
    setLoading(false);
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Load the chosen order's lines — the list row has no per-item outcome or
  // policy snapshot, and both decide whether a line may come back at all.
  const openOrder = useCallback(async (id: string) => {
    setOrderId(id);
    setPicked(new Set());
    setStep('item');
    setDetailLoading(true);
    try {
      setDetail(await getOrder(id));
    } catch (e: any) {
      showToast('Could not load order', e?.message || 'Try again', 'x');
      setStep('order');
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  // Fetch the preset order once on mount.
  useFocusEffect(useCallback(() => {
    if (presetOrderId && !detail && !detailLoading) openOrder(presetOrderId);
  }, [presetOrderId, detail, detailLoading, openOrder]));

  /** Orders whose window is still open. Item-level eligibility is checked in step 2. */
  const eligible = useMemo(
    () => orders.filter((o) => o.status === 'delivered' && returnDaysLeft(o.deliveredAt) > 0),
    [orders],
  );

  const returnableItems = useMemo(
    () => (detail?.items ?? []).filter(isItemReturnable),
    [detail],
  );
  const blockedItems = useMemo(
    () => (detail?.items ?? []).filter((it) => !isItemReturnable(it)),
    [detail],
  );

  const toggle = (id: string) => setPicked((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const back = () => {
    if (step === 'reason') { setStep('item'); return; }
    if (step === 'item' && !presetOrderId) { setStep('order'); setDetail(null); setOrderId(null); return; }
    nav.goBack();
  };

  const submit = async () => {
    if (!orderId || picked.size === 0 || !reason || submitting) return;
    setSubmitting(true);
    try {
      const res = await createReturn({
        orderId,
        items: [...picked].map((orderItemId) => ({
          orderItemId,
          reasonCategory: reason,
          ...(note.trim() ? { reasonText: note.trim() } : {}),
        })),
      });
      showToast(
        'Return opened',
        res.reversePickupId ? 'A pickup has been scheduled' : 'The store will be notified',
        'rotate-ccw',
      );
      setPicked(new Set());
      setReason(null);
      setNote('');
      setStep('order');
      setDetail(null);
      setOrderId(null);
      setTab('open');
      await load();
    } catch (e: any) {
      showToast('Could not open return', e?.message || 'Try again', 'x');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <Shell title="Returns" onBack={() => nav.goBack()}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}>
          <Feather name="user" size={26} color={C.dim} />
          <Text style={[T.h3, { marginTop: 12 }]}>Sign in to manage returns</Text>
          <BrutalButton label="Sign in" onPress={() => requireAuth()} style={{ marginTop: SP.l }} />
        </View>
      </Shell>
    );
  }

  const stepIndex = step === 'order' ? 0 : step === 'item' ? 1 : 2;

  return (
    <Shell title="Returns" onBack={back}>
      {/* Tabs — starting a return vs following one already open */}
      <View style={{ flexDirection: 'row', gap: SP.l, paddingHorizontal: SP.l, paddingTop: SP.s, paddingBottom: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
        {(['new', 'open'] as Tab[]).map((t) => {
          const on = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} hitSlop={6} style={{ paddingBottom: 6, borderBottomWidth: 2, borderColor: on ? C.ink : 'transparent' }}>
              <Text style={{ fontFamily: HELV, fontWeight: '700', fontSize: rf(12), letterSpacing: 0.3, color: on ? C.ink : C.dim }}>
                {t === 'new' ? 'START A RETURN' : `MY RETURNS${returns.length ? ` · ${returns.length}` : ''}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.ink} /></View>
      ) : tab === 'open' ? (
        <OpenReturns
          returns={returns}
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {/* Step rail */}
          <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, marginTop: SP.l }}>
            {['Order', 'Items', 'Reason'].map((label, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              const reached = active || done;
              return (
                <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                  {i > 0 && <View style={{ position: 'absolute', top: 13, right: '50%', left: '-50%', height: 2, backgroundColor: reached ? C.ink : C.hairline }} />}
                  <View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: reached ? C.ink : '#fff' }, BORDER(1)]}>
                    {done ? <Feather name="check" size={13} color="#fff" /> : <Text style={[T.micro, { color: active ? '#fff' : C.dim }]}>{i + 1}</Text>}
                  </View>
                  <Text style={[T.micro, { color: reached ? C.ink : C.dim, marginTop: 6, textTransform: 'uppercase' }]}>{label}</Text>
                </View>
              );
            })}
          </View>

          <View style={[{ marginHorizontal: SP.l, marginTop: SP.l, padding: SP.m, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
            <Text style={[T.caption, { color: C.ink }]}>
              7-day return window from delivery. Free doorstep pickup. Refunds go back to the original payment method once the store checks the items.
            </Text>
          </View>

          {/* ── STEP 1: pick order ── */}
          {step === 'order' && (
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              <Text style={[T.label]}>{`Eligible orders · ${eligible.length}`}</Text>
              {eligible.length === 0 && (
                <View style={{ paddingVertical: SP.xl, alignItems: 'center' }}>
                  <Feather name="inbox" size={24} color={C.dim} />
                  <Text style={[T.h3, { marginTop: 10 }]}>Nothing to return</Text>
                  <Text style={[T.caption, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>
                    Only delivered orders inside their 7-day window can be returned.
                  </Text>
                </View>
              )}
              {eligible.map((o, i) => {
                const left = returnDaysLeft(o.deliveredAt);
                const primary = o.items?.[0];
                return (
                  <FadeInUp key={o.id} delay={Math.min(i, 8) * 40}>
                    <Pressable onPress={() => openOrder(o.id)} style={[{ marginTop: SP.s, backgroundColor: C.white }, BORDER(1)]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[T.caption, { color: C.ink }]}>{`#${o.id.slice(-8).toUpperCase()}`}</Text>
                          <Text style={[T.micro, { marginTop: 2, color: C.dim }]}>
                            {`${fmtDate(o.deliveredAt)} · ${METHOD_LABEL[toApiMethod(o.deliveryMethod)]}`}
                          </Text>
                        </View>
                        <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink }, BORDER(1)]}>
                          <Text style={[T.caption, { color: C.white }]}>{`${left}D LEFT`}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, gap: SP.m }}>
                        <View style={[{ width: 44, height: 56, backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
                          {primary?.image
                            ? <CachedImage source={{ uri: primary.image }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Feather name="shopping-bag" size={16} color={C.dim} /></View>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[T.productName]} numberOfLines={1}>{primary?.name || o.storeName}</Text>
                          <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>
                            {`${o.itemCount ?? 0} item${(o.itemCount ?? 0) !== 1 ? 's' : ''} · ₹${rupees(o.grandTotalPaise).toLocaleString()}`}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={16} color={C.ink} />
                      </View>
                    </Pressable>
                  </FadeInUp>
                );
              })}
            </View>
          )}

          {/* ── STEP 2: pick items ── */}
          {step === 'item' && (
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              {detailLoading || !detail ? (
                <View style={{ paddingVertical: SP.xl, alignItems: 'center' }}><ActivityIndicator color={C.ink} /></View>
              ) : (
                <>
                  <View style={[{ padding: SP.m, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                    <Text style={[T.micro, { color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Selected order</Text>
                    <Text style={[T.h3, { color: C.ink, marginTop: 4 }]}>{`#${detail.id.slice(-8).toUpperCase()}`}</Text>
                    <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>
                      {`${fmtDate(detail.deliveredAt)} · ${returnDaysLeft(detail.deliveredAt)}D left in window`}
                    </Text>
                  </View>

                  <Text style={[T.label, { marginTop: SP.l }]}>{`Choose what to send back · ${picked.size} selected`}</Text>
                  {returnableItems.map((it, i) => {
                    const on = picked.has(it.id);
                    return (
                      <FadeInUp key={it.id} delay={Math.min(i, 8) * 40}>
                        <Pressable onPress={() => toggle(it.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center', gap: SP.m }, BORDER(1)]}>
                          <View style={[{ width: 48, height: 60, backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
                            {it.galleryImageSnap
                              ? <CachedImage source={{ uri: it.galleryImageSnap }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                              : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Feather name="shopping-bag" size={16} color={C.dim} /></View>}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.6)' : C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{it.brandSnap}</Text>
                            <Text style={[T.bodyB, { color: on ? C.white : C.ink, marginTop: 2 }]} numberOfLines={2}>{it.listingNameSnap}</Text>
                            <Text style={[T.caption, { color: on ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 2 }]}>
                              {`${it.attributesLabelSnap} · ₹${rupees(it.netLinePaise).toLocaleString()}`}
                            </Text>
                          </View>
                          <Feather name={on ? 'check-square' : 'square'} size={18} color={on ? C.white : C.dim} />
                        </Pressable>
                      </FadeInUp>
                    );
                  })}

                  {returnableItems.length === 0 && (
                    <View style={{ paddingVertical: SP.xl, alignItems: 'center' }}>
                      <Feather name="slash" size={24} color={C.dim} />
                      <Text style={[T.h3, { marginTop: 10 }]}>Nothing returnable here</Text>
                      <Text style={[T.caption, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>
                        Every line in this order is final sale or has already gone back.
                      </Text>
                    </View>
                  )}

                  {blockedItems.length > 0 && (
                    <View style={{ marginTop: SP.l }}>
                      <Text style={[T.label, { color: C.dim }]}>Cannot be returned</Text>
                      {blockedItems.map((it) => (
                        <View key={it.id} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white, opacity: 0.6 }, BORDER(1)]}>
                          <Text style={[T.bodyB]} numberOfLines={1}>{it.listingNameSnap}</Text>
                          <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>
                            {it.listingPolicySnap === 'final_sale' ? 'Sold as final sale' : 'Already returned or not with you'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <BrutalButton
                    label={picked.size ? `Continue with ${picked.size} item${picked.size !== 1 ? 's' : ''}` : 'Select at least one item'}
                    iconRight="arrow-right"
                    block
                    disabled={picked.size === 0}
                    onPress={() => setStep('reason')}
                    style={{ marginTop: SP.xl }}
                  />
                </>
              )}
            </View>
          )}

          {/* ── STEP 3: reason ── */}
          {step === 'reason' && (
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              <View style={[{ padding: SP.m, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Returning</Text>
                <Text style={[T.h3, { color: C.ink, marginTop: 4 }]}>{`${picked.size} item${picked.size !== 1 ? 's' : ''}`}</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{`from #${(orderId || '').slice(-8).toUpperCase()}`}</Text>
              </View>

              <Text style={[T.label, { marginTop: SP.l }]}>Why are you returning?</Text>
              {reasons.map((r, i) => {
                const on = reason === r.value;
                return (
                  <FadeInUp key={r.value} delay={i * 30}>
                    <Pressable onPress={() => setReason(r.value)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center', gap: 12 }, BORDER(1)]}>
                      <Feather name={r.icon as any} size={18} color={on ? C.white : C.ink} />
                      <Text style={[T.body, { color: on ? C.white : C.ink, flex: 1 }]}>{r.label}</Text>
                      {on && <Feather name="check" size={16} color={C.white} />}
                    </Pressable>
                  </FadeInUp>
                );
              })}

              <Text style={[T.label, { marginTop: SP.l }]}>Anything else? (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Tell the store what went wrong"
                placeholderTextColor={C.dim}
                multiline
                maxLength={500}
                style={[{ marginTop: SP.s, minHeight: 90, padding: SP.m, backgroundColor: C.white, textAlignVertical: 'top', color: C.ink, fontSize: rf(14) }, BORDER(1)]}
              />

              <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: '#FFF8E1' }, BORDER(1)]}>
                <Text style={[T.caption, { color: C.ink }]}>
                  We do not offer direct exchanges. Return the item for a refund and place a fresh order for the size or colour you want.
                </Text>
              </View>

              <BrutalButton
                label={submitting ? 'Opening return…' : 'Confirm return'}
                icon="rotate-ccw"
                block
                disabled={!reason || submitting}
                onPress={submit}
                style={{ marginTop: SP.xl }}
              />
            </View>
          )}
        </ScrollView>
      )}
    </Shell>
  );
}

/* ── Open returns ─────────────────────────────────────────────────────────── */

const DECISION_COPY: Record<string, { label: string; color: string }> = {
  pending: { label: 'Awaiting store check', color: '#B0740A' },
  accepted: { label: 'Accepted', color: '#1B8A5A' },
  rejected: { label: 'Rejected', color: '#C1121F' },
  rejected_at_door: { label: 'Rejected at the door', color: '#C1121F' },
};

const PICKUP_COPY: Record<string, string> = {
  pending: 'Pickup being assigned',
  assigned: 'Driver assigned — hand over the items',
  collected: 'Collected, heading to the store',
  delivered_to_store: 'Delivered to the store',
  cancelled: 'Pickup cancelled',
};

function OpenReturns({ returns, refreshing, onRefresh }: {
  returns: ReturnRow[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (returns.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        <Feather name="rotate-ccw" size={26} color={C.dim} />
        <Text style={[T.h3, { marginTop: 12 }]}>No returns yet</Text>
        <Text style={[T.caption, { color: C.dim, marginTop: 4 }]}>Anything you send back shows up here.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
    >
      {returns.map((r, i) => {
        const decision = DECISION_COPY[r.storeDecision] ?? { label: r.storeDecision, color: C.dim };
        const otp = r.reversePickup?.collectOtp;
        return (
          <FadeInUp key={r.id} delay={Math.min(i, 8) * 40}>
            <View style={[{ marginBottom: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', gap: SP.m, padding: SP.m }}>
                <View style={[{ width: 52, height: 66, backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
                  {r.itemImage
                    ? <CachedImage source={{ uri: r.itemImage }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Feather name="shopping-bag" size={18} color={C.dim} /></View>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.micro, { color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{r.itemBrand}</Text>
                  <Text style={[T.bodyB, { marginTop: 2 }]} numberOfLines={2}>{r.itemName}</Text>
                  <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>
                    {`${r.itemAttributes} · opened ${fmtDate(r.openedAt)}`}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: decision.color }} />
                    <Text style={{ fontFamily: HELV, fontWeight: '700', fontSize: rf(10), letterSpacing: 0.3, color: decision.color }}>
                      {decision.label.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={[T.price]}>{`₹${rupees(r.netLinePaise).toLocaleString()}`}</Text>
              </View>

              {!!r.reversePickup && (
                <View style={{ padding: SP.m, borderTopWidth: 1, borderColor: C.hairline }}>
                  <Text style={[T.caption, { color: C.dim }]}>
                    {PICKUP_COPY[r.reversePickup.status] ?? r.reversePickup.status}
                  </Text>
                  {!!otp && (
                    <View style={[{ marginTop: SP.s, padding: SP.m, alignItems: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                      <Text style={[T.micro, { color: C.dim }]}>GIVE THIS TO THE PICKUP DRIVER</Text>
                      <Text style={[T.monoB, { fontSize: rf(26), letterSpacing: 6, marginTop: 6 }]}>{otp}</Text>
                    </View>
                  )}
                </View>
              )}

              {!!r.refund && (
                <View style={{ padding: SP.m, borderTopWidth: 1, borderColor: C.hairline, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.caption, { color: C.dim }]}>{`Refund · ${r.refund.status}`}</Text>
                  <Text style={[T.bodyB]}>{`₹${rupees(r.refund.amountPaise).toLocaleString()}`}</Text>
                </View>
              )}
            </View>
          </FadeInUp>
        );
      })}
    </ScrollView>
  );
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />
      <ScreenHeader title={title} onBack={onBack} />
      {children}
    </View>
  );
}
