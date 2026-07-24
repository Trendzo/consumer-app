import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalStatusBar, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';

const ADDRESSES = [
  { id: 'a1', label: 'Home', name: 'You', addr: 'D-204, Block A, Andheri West, Mumbai 400058', phone: '+91 98xxx xxx21' },
  { id: 'a2', label: 'Office', name: 'You', addr: '12 Floor, Bandra Kurla Complex, Mumbai 400051', phone: '+91 98xxx xxx21' },
];

const PAYMENTS = [
  { id: 'p1', icon: 'smartphone', label: 'UPI', sub: 'pay@okhdfcbank' },
  { id: 'p2', icon: 'credit-card', label: 'Card', sub: '•••• 4242' },
  { id: 'p3', icon: 'dollar-sign', label: 'COD', sub: 'Cash on delivery' },
  { id: 'p4', icon: 'package', label: 'Wallet', sub: '₹1,240 balance' },
];

type Method = 'standard' | 'express' | 'pickup' | 'tryandbuy';
const METHODS: { id: Method; icon: string; label: string; time: string; fee: number; desc: string }[] = [
  { id: 'express', icon: 'zap', label: 'Express delivery', time: '60 min', fee: 99, desc: 'In your hands in under an hour. From your block.' },
  { id: 'standard', icon: 'package', label: 'Standard delivery', time: '2-3 days', fee: 49, desc: 'Regular shipping. Tracked door-to-door.' },
  { id: 'tryandbuy', icon: 'home', label: 'Try & Buy', time: '24 hr', fee: 99, desc: 'Try at home · 15 min. Return what you don\'t love — free.' },
  { id: 'pickup', icon: 'map-pin', label: 'Instore pickup', time: 'In store', fee: 0, desc: 'Ready at your nearest store. No delivery fee.' },
];

const STORES = [
  { id: 's1', name: 'NORTH. × ANDHERI', addr: 'Infiniti Mall, Level 2 · 2.4 km', eta: '45 min', hours: '10:00 — 22:00' },
  { id: 's2', name: 'YORK × BANDRA', addr: 'Linking Road · 4.1 km', eta: '55 min', hours: '11:00 — 23:00' },
  { id: 's3', name: 'KOH × BKC', addr: 'Jio World Drive · 5.8 km', eta: '65 min', hours: '10:00 — 22:00' },
];

// Pickup time windows the user chooses from after selecting a store
const PICKUP_SLOTS = ['ASAP', '2 hr', '4 hr', 'Tonight', 'Tomorrow'];

// Deterministic pickup code per session so step 4 / confirmation stay consistent
const genPickupCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

const STEP_NAMES = ['Address', 'Delivery', 'Payment', 'Confirm'];

export default function CheckoutScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const preMethod: Method | undefined = route.params?.preMethod;
  const { cart, cartTotal, placeOrder, showToast, requireAuth } = useApp();
  const s = React.useMemo(() => makeS(), []);
  const [addr, setAddr] = useState('a1');
  const [method, setMethod] = useState<Method>(preMethod || 'express');
  const [store, setStore] = useState('s1');
  const [slot, setSlot] = useState('ASAP');
  const [pay, setPay] = useState('p1');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const pickupCode = React.useMemo(() => genPickupCode(), []);

  const total = cartTotal || 2499;
  const activeMethod = METHODS.find(m => m.id === method)!;
  const fee = activeMethod.fee;
  const tax = Math.round(total * 0.05);
  const grand = total + fee + tax;

  // Pickup skips "delivery address" — jump straight from step 1 to delivery.
  // Pickup also doesn't need a delivery address at all, so we flag it on the address step.
  const needsAddress = method !== 'pickup';

  const handlePlace = () => {
    // Defense-in-depth: CartScreen already gates entry to this screen behind
    // requireAuth, but re-check here in case the session was signed out mid-flow.
    requireAuth(() => {
      const pickedStore = method === 'pickup' ? STORES.find(st => st.id === store) || null : null;
      placeOrder({
        method,
        store: pickedStore
          ? { id: pickedStore.id, name: pickedStore.name, addr: pickedStore.addr, eta: pickedStore.eta, slot, code: pickupCode }
          : null,
      });
      nav.replace('OrderSuccess');
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />
      <ScreenHeader title="Checkout" onBack={() => nav.goBack()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: SP.l, paddingBottom: 200, paddingTop: SP.l }}>
        {/* PROGRESS — numbered chips + current step label + running total for context */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {STEP_NAMES.map((name, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <View key={name} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={[{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: done || active ? C.ink : C.white }, BORDER(1)]}>
                  {done ? <Feather name="check" size={12} color={C.white} /> : <Text style={[T.caption, { color: active ? C.white : C.ink }]}>{n}</Text>}
                </View>
                {i < STEP_NAMES.length - 1 && <View style={{ flex: 1, height: 2, backgroundColor: done ? C.ink : C.hairline }} />}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <Text style={[T.bodyB]}>
            {`Step ${step} · ${STEP_NAMES[step - 1]}`}
          </Text>
          <Text style={[T.micro]}>{`₹${grand} · ${cart.length || 1} item${(cart.length || 1) > 1 ? 's' : ''}`}</Text>
        </View>

        {/* ─── STEP 1: ADDRESS ─── */}
        {step === 1 && !needsAddress && (
          <FadeInUp>
            <Text style={[T.h2, { marginTop: SP.xl, textTransform: 'uppercase' }]}>{'No address needed'}</Text>
            <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }}>
                <Feather name="map-pin" size={22} color={C.ink} />
              </View>
              <Text style={[T.h3, { marginTop: 10, textTransform: 'uppercase' }]}>Store pickup</Text>
              <Text style={[T.body, { color: C.dim, marginTop: 6 }]}>You picked in-store pickup, so we're skipping delivery address. Tap continue to choose your store and slot.</Text>
            </View>
            <Pressable onPress={() => setMethod('express')} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <Text style={[T.caption, { color: C.ink }]}>Switch to delivery</Text>
            </Pressable>
          </FadeInUp>
        )}
        {step === 1 && needsAddress && (
          <FadeInUp>
            <Text style={[T.h2, { marginTop: SP.xl, textTransform: 'uppercase' }]}>{'Delivery address'}</Text>
            {ADDRESSES.map(a => (
              <Pressable key={a.id} onPress={() => setAddr(a.id)} style={[{ marginTop: SP.m, padding: SP.m, backgroundColor: addr === a.id ? C.ink : C.white }, BORDER(1)]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.caption, { color: addr === a.id ? C.white : C.ink }]}>{a.label}</Text>
                  {addr === a.id && <Feather name="check" size={14} color={C.white} />}
                </View>
                <Text style={[T.bodyB, { color: addr === a.id ? C.white : C.ink, marginTop: 6 }]}>{a.name}</Text>
                <Text style={[T.body, { color: addr === a.id ? C.white : C.dim, marginTop: 2 }]}>{a.addr}</Text>
                <Text style={[T.caption, { color: addr === a.id ? C.white : C.dim, marginTop: 4 }]}>{a.phone}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => showToast('Add address', 'Coming soon', 'plus')} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }, BORDER(1)]}>
              <Feather name="plus" size={14} color={C.ink} />
              <Text style={[T.caption, { color: C.ink }]}>Add new address</Text>
            </Pressable>
          </FadeInUp>
        )}

        {/* ─── STEP 2: DELIVERY METHOD ─── */}
        {step === 2 && (
          <FadeInUp>
            <Text style={[T.h2, { marginTop: SP.xl, textTransform: 'uppercase' }]}>{'How you getting it?'}</Text>

            {/* Deliver-to-you block (Express + Standard) — grouped and headlined as "the common two" */}
            <Text style={[T.h3, { marginTop: SP.m, textTransform: 'uppercase' }]}>{'Deliver to you'}</Text>
            {METHODS.filter(m => m.id === 'express' || m.id === 'standard').map(m => {
              const on = method === m.id;
              const isExpress = m.id === 'express';
              return (
                <Pressable key={m.id} onPress={() => setMethod(m.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : '#F4F4F4' }]}>
                      <Feather name={m.icon as any} size={20} color={C.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[T.bodyB, { color: on ? C.white : C.ink }]}>{m.label}</Text>
                        {isExpress && (
                          <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: on ? C.white : '#F4F4F4' }}>
                            <Text style={[T.caption, { fontSize: 9, color: C.ink }]}>Fastest</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[T.caption, { color: on ? C.white : C.dim, marginTop: 2 }]}>{m.desc}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Text style={[T.price, { color: on ? C.white : C.ink }]}>{m.fee === 0 ? 'Free' : `₹${m.fee}`}</Text>
                      <Text style={[T.caption, { fontSize: 8, color: on ? C.white : C.dim }]}>{m.time}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {/* Other options block (Try & Buy + Pickup) */}
            <Text style={[T.h3, { marginTop: SP.l, textTransform: 'uppercase' }]}>{'Other options'}</Text>
            {METHODS.filter(m => m.id === 'tryandbuy' || m.id === 'pickup').map(m => {
              const on = method === m.id;
              return (
                <Pressable key={m.id} onPress={() => setMethod(m.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : '#F4F4F4' }]}>
                      <Feather name={m.icon as any} size={20} color={C.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.bodyB, { color: on ? C.white : C.ink }]}>{m.label}</Text>
                      <Text style={[T.caption, { color: on ? C.white : C.dim, marginTop: 2 }]}>{m.desc}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Text style={[T.price, { color: on ? C.white : C.ink }]}>{m.fee === 0 ? 'Free' : `₹${m.fee}`}</Text>
                      <Text style={[T.caption, { fontSize: 8, color: on ? C.white : C.dim }]}>{m.time}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {/* Store picker — only shown for pickup */}
            {method === 'pickup' && (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 120 }}>
                <Text style={[T.h3, { marginTop: SP.xl, textTransform: 'uppercase' }]}>{'Pick a store'}</Text>
                {STORES.map(st => {
                  const on = store === st.id;
                  return (
                    <Pressable key={st.id} onPress={() => setStore(st.id)} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center', gap: 10 }, BORDER(1)]}>
                      <View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : '#F4F4F4' }]}>
                        <Feather name="map-pin" size={14} color={C.ink} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[T.bodyB, { color: on ? C.white : C.ink }]}>{st.name}</Text>
                        <Text style={[T.caption, { color: on ? C.white : C.dim, marginTop: 2 }]}>{st.addr}</Text>
                        <Text style={[T.micro, { color: on ? C.white : C.dim, marginTop: 1, opacity: 0.7 }]}>{`Hrs · ${st.hours}`}</Text>
                      </View>
                      <View style={[{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: on ? C.white : '#F4F4F4' }]}>
                        <Text style={[T.caption, { fontSize: 9, color: C.ink }]}>{st.eta}</Text>
                      </View>
                    </Pressable>
                  );
                })}

                {/* Pickup time slot */}
                <Text style={[T.h3, { marginTop: SP.l, textTransform: 'uppercase' }]}>{'Pickup slot'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SP.s }}>
                  {PICKUP_SLOTS.map(sl => {
                    const on = slot === sl;
                    return (
                      <Pressable key={sl} onPress={() => setSlot(sl)} style={[{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                        <Text style={[T.caption, { color: on ? C.white : C.ink }]}>{sl}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Pickup code preview */}
                <View style={[{ marginTop: SP.m, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                  <Feather name="hash" size={16} color={C.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.caption]}>{'Your pickup code'}</Text>
                    <Text style={[T.monoB, { fontSize: rf(18), letterSpacing: 3, marginTop: 2 }]}>{pickupCode}</Text>
                  </View>
                  <Text style={[T.micro, { maxWidth: 100, textAlign: 'right' }]}>Flash this at the counter to collect.</Text>
                </View>
              </MotiView>
            )}

            {/* Try & Buy info card */}
            {method === 'tryandbuy' && (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 120 }}>
                <View style={[{ marginTop: SP.m, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.h3, { textTransform: 'uppercase' }]}>{'How it works'}</Text>
                  {[
                    { i: 1, t: 'We deliver to your door tomorrow', sub: 'Standard dispatch window' },
                    { i: 2, t: 'Try it on — you have 15 minutes', sub: 'Delivery agent waits outside' },
                    { i: 3, t: 'Keep what fits. Return the rest.', sub: 'No questions asked · no return fee' },
                  ].map(step => (
                    <View key={step.i} style={{ flexDirection: 'row', marginTop: 10, gap: 10 }}>
                      <View style={[{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                        <Text style={[T.micro, { color: C.ink }]}>{step.i}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[T.bodyB]}>{step.t}</Text>
                        <Text style={[T.micro, { marginTop: 1 }]}>{step.sub}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </MotiView>
            )}
          </FadeInUp>
        )}

        {/* ─── STEP 3: PAYMENT ─── */}
        {step === 3 && (
          <FadeInUp>
            <Text style={[T.h2, { marginTop: SP.xl, textTransform: 'uppercase' }]}>{'Payment method'}</Text>
            {PAYMENTS.map(p => (
              <Pressable key={p.id} onPress={() => setPay(p.id)} style={[{ marginTop: SP.m, padding: SP.m, flexDirection: 'row', alignItems: 'center', backgroundColor: pay === p.id ? C.ink : C.white }, BORDER(1)]}>
                <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, BORDER(1), { borderColor: pay === p.id ? C.white : C.ink }]}>
                  <Feather name={p.icon as any} size={16} color={pay === p.id ? C.white : C.ink} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[T.bodyB, { color: pay === p.id ? C.white : C.ink }]}>{p.label}</Text>
                  <Text style={[T.caption, { color: pay === p.id ? C.white : C.dim }]}>{p.sub}</Text>
                </View>
                {pay === p.id && <Feather name="check" size={16} color={C.white} />}
              </Pressable>
            ))}
          </FadeInUp>
        )}

        {/* ─── STEP 4: CONFIRM ─── */}
        {step === 4 && (
          <FadeInUp>
            <Text style={[T.h2, { marginTop: SP.xl, textTransform: 'uppercase' }]}>{'Confirm order'}</Text>
            <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={[T.h3, { textTransform: 'uppercase' }]}>{'Order summary'}</Text>
              <View style={{ height: 1, backgroundColor: C.hairline, marginTop: 8 }} />
              <View style={s.row}><Text style={[T.body, { color: C.dim }]}>Items ({cart.length || 1})</Text><Text style={T.bodyB}>₹{total}</Text></View>
              <View style={s.row}><Text style={[T.body, { color: C.dim }]}>{activeMethod.label}</Text><Text style={T.bodyB}>{fee === 0 ? 'Free' : `₹${fee}`}</Text></View>
              <View style={s.row}><Text style={[T.body, { color: C.dim }]}>Tax</Text><Text style={T.bodyB}>₹{tax}</Text></View>
              <View style={{ height: 1, backgroundColor: C.hairline }} />
              <View style={s.row}>
                <Text style={[T.h3]}>Total</Text>
                <Text style={[T.h1]}>₹{grand}</Text>
              </View>
            </View>

            {/* ETA / Method callout */}
            <View style={[{ marginTop: SP.m, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }}>
                <Feather name={activeMethod.icon as any} size={18} color={C.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyB, { color: C.ink }]}>
                  {method === 'pickup'
                    ? `Ready in ${slot === 'ASAP' ? STORES.find(st => st.id === store)?.eta : slot}`
                    : method === 'tryandbuy'
                    ? 'Arrives tomorrow · try 15 min'
                    : method === 'standard'
                    ? 'Arrives in 2-3 days'
                    : 'Arrives in 47 minutes'}
                </Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>
                  {method === 'pickup'
                    ? STORES.find(st => st.id === store)?.name
                    : method === 'tryandbuy'
                    ? 'Return what you don\'t keep — free'
                    : method === 'standard'
                    ? 'Tracked shipping · signature on delivery'
                    : 'From NORTH. store · 2.4 km'}
                </Text>
              </View>
            </View>

            {/* Pickup code card — only when method is pickup */}
            {method === 'pickup' && (
              <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: C.white, alignItems: 'center' }, BORDER(1)]}>
                <Text style={[T.caption]}>{'Pickup code'}</Text>
                <View style={[{ marginTop: 8, paddingHorizontal: SP.l, paddingVertical: SP.s, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                  <Text style={[T.monoB, { fontSize: rf(20), letterSpacing: 5 }]}>{pickupCode}</Text>
                </View>
                <Text style={[T.micro, { marginTop: 8, textAlign: 'center' }]}>
                  {`Show this at ${STORES.find(st => st.id === store)?.name} to collect.`}
                </Text>
              </View>
            )}
          </FadeInUp>
        )}
      </ScrollView>

      {/* BOTTOM — running total + step-aware CTA */}
      <View style={s.bottom}>
        <View style={{ height: 1, backgroundColor: C.hairline }} />
        <View style={{ paddingHorizontal: SP.m, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={[T.micro]}>{step === 4 ? 'Total · tax incl.' : `Running total · step ${step}/4`}</Text>
          <Text style={[T.h2]}>₹{grand}</Text>
        </View>
        <View style={{ padding: SP.m, paddingBottom: 28, flexDirection: 'row', gap: SP.s }}>
          {step > 1 && <BrutalButton label="Back" icon="arrow-left" variant="outline" onPress={() => setStep((step - 1) as any)} />}
          {step < 4 ? (
            <BrutalButton
              label={step === 1 ? (needsAddress ? 'Continue to delivery' : 'Pick store') : step === 2 ? 'Continue to payment' : 'Review order'}
              iconRight="arrow-right"
              onPress={() => setStep((step + 1) as any)}
              style={{ flex: 1 }}
            />
          ) : (
            <BrutalButton label={method === 'pickup' ? 'Confirm & generate code' : 'Place order'} iconRight="check" onPress={handlePlace} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </View>
  );
}

const makeS = () => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg },
});
