// Bottom sheet listing delivery charges, terms and policies for every
// fulfilment method. Opened from the ⓘ affordances in checkout/review —
// the method cards themselves stay fee-free (Zomato pattern: sell the speed,
// bill the fee at the end, keep the fine print one tap away).

import React from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf } from '../theme/brutal';

const SECTIONS: { icon: string; title: string; points: string[] }[] = [
  {
    icon: 'zap',
    title: 'Express delivery',
    points: [
      'Delivered in about 60 minutes from your nearest partner store.',
      'The delivery charge is shown in your bill before you pay — never after.',
      'Timer starts once the store confirms your order.',
      'If we miss the window by a lot, support will make it right.',
    ],
  },
  {
    icon: 'package',
    title: 'Standard delivery',
    points: [
      'Arrives in 2–3 days, tracked door-to-door.',
      'The delivery charge is shown in your bill before you pay.',
      'Signature may be required on delivery.',
    ],
  },
  {
    icon: 'home',
    title: 'Try & Buy',
    points: [
      'Your order arrives the next day. The agent waits at your door while you try everything on — up to 15 minutes.',
      'Keep what fits, hand back the rest on the spot. You are refunded for whatever you return, usually within 3–5 working days.',
      'Try & Buy is prepaid only (no COD) — the refund needs a payment to return to.',
      'The Try & Buy service charge covers the doorstep trial and applies even if you return everything.',
      'Returned items must be unworn beyond trying on, with all tags attached.',
    ],
  },
  {
    icon: 'map-pin',
    title: 'In-store pickup',
    points: [
      'Free — no delivery charge.',
      'Show your pickup code at the counter to collect.',
      'Orders are held for 48 hours, then cancelled and refunded.',
    ],
  },
  {
    icon: 'file-text',
    title: 'General',
    points: [
      'All charges — delivery, service and GST — are itemised in your final bill before payment. What you see on the pay button is exactly what you are charged.',
      'Refunds go back to the original payment method.',
      'Questions? Reach us any time from Profile → Support.',
    ],
  },
];

export function DeliveryTermsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    // animationType="none" + split animations, matching OptionSheet: "slide" slid
    // the WHOLE modal — scrim included — up from the bottom, so opening showed a
    // hard-edged black slab travelling up the screen. Now the scrim fades in
    // place and only the white sheet slides.
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      {/* Tap the dim backdrop to dismiss */}
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      </MotiView>
      <MotiView from={{ translateY: 560 }} animate={{ translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
      <View style={[{ backgroundColor: C.white, maxHeight: '78%' }, BORDER(1)]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingVertical: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
          <Text style={[T.h3, { textTransform: 'uppercase' }]}>Charges, terms & policies</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={20} color={C.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: SP.l, paddingTop: SP.s, paddingBottom: 40 }}>
          {SECTIONS.map((sec) => (
            <View key={sec.title} style={{ marginTop: SP.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }}>
                  <Feather name={sec.icon as any} size={13} color={C.ink} />
                </View>
                <Text style={[T.bodyB, { textTransform: 'uppercase' }]}>{sec.title}</Text>
              </View>
              {sec.points.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 7, paddingLeft: 2 }}>
                  <Text style={[T.caption, { color: C.dim }]}>•</Text>
                  <Text style={[T.caption, { color: C.dim, flex: 1, lineHeight: rf(17) }]}>{p}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
      </MotiView>
    </Modal>
  );
}
