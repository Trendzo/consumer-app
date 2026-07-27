// SPIN & WIN POPUP — the welcome-gift wheel shown right after the splash,
// every launch. Built exactly in the app's language: a white sharp-cornered
// card with a black header strip (same shell as BrutalConfirm), ink type,
// hairline dividers, and the Home highlighter-yellow as the single accent —
// one yellow slice, a yellow win bar, pixel-square confetti. No gradients.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, Dimensions, Vibration } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { useApp } from '../state/AppState';

const { width: W } = Dimensions.get('window');

const YELLOW = '#F2E63C'; // Home headline highlighter — the one accent
const CARD_W = Math.min(W - 36, 380);
const WHEEL = CARD_W - SP.l * 2 - 26;
const R = WHEEL / 2;
const N = 5;
const SLICE_DEG = 360 / N;

// Slice content — index-aligned with colors/weights. 20% OFF is the rare
// yellow slice; everything else alternates white / grey (100% win).
const PRIZES = [
  { title: 'WELCOME', sub: 'GIFT', icon: 'gift-outline', toast: 'Welcome gift unlocked' },
  { title: 'FREE', sub: 'SHIPPING', icon: 'truck-fast', toast: 'Free shipping on your next order' },
  { title: '20%', sub: 'OFF', icon: 'fire', toast: '20% OFF coupon added' },
  { title: '15% OFF', sub: 'COUPON', icon: 'tag', toast: '15% OFF coupon added' },
  { title: '₹100', sub: 'COUPON', icon: 'ticket-percent', toast: '₹100 coupon added' },
];
const SLICE_BG = [C.white, '#F2F2F2', YELLOW, C.white, '#F2F2F2'];
const WEIGHTS = [3, 3, 1, 2, 3];

export function SpinWinPopup({ visible, onClose, onShop }: {
  visible: boolean;
  onClose: () => void;
  onShop: () => void;
}) {
  const { showToast } = useApp();
  const rotation = useRef(new Animated.Value(0)).current;
  const hubPulse = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<number | null>(null);

  // The hub breathes gently until the first spin.
  useEffect(() => {
    if (!visible) return;
    const p = Animated.loop(Animated.sequence([
      Animated.timing(hubPulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(hubPulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [visible]);

  const spin = () => {
    if (spinning || won !== null) return;
    setSpinning(true);
    const bag: number[] = [];
    WEIGHTS.forEach((w, i) => { for (let k = 0; k < w; k++) bag.push(i); });
    const idx = bag[Math.floor(Math.random() * bag.length)];
    const jitter = (Math.random() - 0.5) * SLICE_DEG * 0.5;
    const target = 360 * 6 + (360 - idx * SLICE_DEG) + jitter;
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: target,
      duration: 4200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setWon(idx);
      Vibration.vibrate([0, 40, 60, 40]);
    });
  };

  const claim = () => {
    if (won === null) return;
    showToast('You won!', PRIZES[won].toast, 'gift');
    onClose();
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const hubScale = hubPulse.interpolate({ inputRange: [0, 1], outputRange: [1, spinning || won !== null ? 1 : 1.07] });

  // Slice geometry — border-triangles overshoot the circle, clipped by it.
  const halfAngleRad = ((SLICE_DEG / 2) * Math.PI) / 180;
  const L = R * 1.25;
  const halfBase = L * Math.tan(halfAngleRad);

  // Pixel-square confetti (ink + yellow) — same particle language as the splash.
  const confetti = useMemo(() => {
    if (won === null) return [];
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 80 + Math.random() * 90;
      return {
        id: i,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        size: 5 + Math.random() * 5,
        color: i % 3 === 0 ? YELLOW : C.ink,
        delay: Math.random() * 120,
      };
    });
  }, [won]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
        <MotiView
          from={{ opacity: 0, translateY: 30, scale: 0.94 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 260 }}
          style={[{ width: CARD_W, backgroundColor: C.white, overflow: 'hidden' }, BORDER(2)]}
        >
          {/* ── Header strip — same shell as the app's confirm dialog ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.ink }}>
            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: YELLOW }}>
              <MaterialCommunityIcons name="gift-outline" size={15} color={C.ink} />
            </View>
            <Text style={[T.h3, { color: C.white, flex: 1, textTransform: 'uppercase' }]}>Spin & Win</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={16} color={C.white} />
            </Pressable>
          </View>

          {/* ── Body ── */}
          <View style={{ padding: SP.l, alignItems: 'center' }}>
            {/* Headline with the Home highlighter bar */}
            <View style={{ alignSelf: 'center' }}>
              <View style={{ position: 'absolute', left: -4, right: -8, bottom: 2, height: 11, backgroundColor: YELLOW }} />
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(26), color: C.ink, letterSpacing: -0.5, textTransform: 'uppercase' }}>
                {won === null ? '100% Win!' : `${PRIZES[won].title} ${PRIZES[won].sub}`}
              </Text>
            </View>
            <Text style={[T.caption, { color: C.dim, marginTop: 8 }]}>
              {won === null ? 'Your first-order gift · every spin wins' : 'Locked in — claim it below'}
            </Text>

            {/* ── Wheel ── */}
            <View style={{ width: WHEEL, height: WHEEL + 16, alignItems: 'center', marginTop: SP.l }}>
              {/* Ink pointer at 12 o'clock */}
              <View style={{ position: 'absolute', top: 0, zIndex: 10, alignItems: 'center' }}>
                <View style={{ width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 18, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.ink }} />
              </View>

              <View style={{ marginTop: 10, width: WHEEL, height: WHEEL, alignItems: 'center', justifyContent: 'center' }}>
                {/* Rotating face — 2px ink ring, flat slices */}
                <Animated.View style={{ width: WHEEL, height: WHEEL, transform: [{ rotate }] }}>
                  <View style={{ width: WHEEL, height: WHEEL, borderRadius: R, overflow: 'hidden', backgroundColor: SLICE_BG[0], borderWidth: 2, borderColor: C.ink }}>
                    {PRIZES.map((p, i) => (
                      <View key={i} style={{ position: 'absolute', width: WHEEL, height: WHEEL, transform: [{ rotate: `${i * SLICE_DEG}deg` }] }}>
                        <View style={{
                          position: 'absolute',
                          left: R - halfBase,
                          top: R - L,
                          width: 0, height: 0,
                          borderTopWidth: L,
                          borderLeftWidth: halfBase,
                          borderRightWidth: halfBase,
                          borderTopColor: SLICE_BG[i],
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                        }} />
                        {/* Label reads outward along the slice axis — ink only */}
                        <View style={{ position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' }}>
                          <MaterialCommunityIcons name={p.icon as any} size={20} color={C.ink} />
                          <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(13), color: C.ink, marginTop: 3, letterSpacing: 0.3 }}>{p.title}</Text>
                          <Text style={{ fontFamily: 'Helvetica Neue', fontWeight: '600', fontSize: rf(9), color: C.ink, letterSpacing: 1.5, marginTop: 1 }}>{p.sub}</Text>
                        </View>
                      </View>
                    ))}
                    {/* Hairline dividers at slice boundaries */}
                    {PRIZES.map((_, i) => (
                      <View
                        key={'d' + i}
                        style={{
                          position: 'absolute',
                          width: 1.5,
                          height: R,
                          left: R - 0.75,
                          top: 0,
                          backgroundColor: C.ink,
                          opacity: 0.35,
                          transform: [{ rotate: `${i * SLICE_DEG + SLICE_DEG / 2}deg` }],
                          transformOrigin: 'bottom center',
                        }}
                      />
                    ))}
                  </View>
                </Animated.View>

                {/* Confetti — pixel squares from the hub on win */}
                {confetti.map((c) => (
                  <MotiView
                    key={c.id}
                    from={{ translateX: 0, translateY: 0, opacity: 1 }}
                    animate={{ translateX: c.tx, translateY: c.ty, opacity: 0 }}
                    transition={{ type: 'timing', duration: 850, delay: c.delay }}
                    style={{ position: 'absolute', width: c.size, height: c.size, backgroundColor: c.color }}
                  />
                ))}

                {/* Hub — ink square (pixel language), breathes until pressed */}
                <Animated.View style={{ position: 'absolute', transform: [{ scale: hubScale }] }}>
                  <Pressable
                    onPress={spin}
                    disabled={spinning || won !== null}
                    style={{ width: 58, height: 58, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white }}
                  >
                    {won !== null ? (
                      <Feather name="check" size={22} color={YELLOW} />
                    ) : (
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(13), color: C.white, letterSpacing: 1.5 }}>{spinning ? '···' : 'SPIN'}</Text>
                    )}
                  </Pressable>
                </Animated.View>
              </View>
            </View>

            {/* ── CTA — full-width black slab, app-standard button ── */}
            {won === null ? (
              <Pressable
                onPress={spin}
                disabled={spinning}
                style={{ marginTop: SP.l, alignSelf: 'stretch', paddingVertical: 15, alignItems: 'center', backgroundColor: spinning ? C.faint : C.ink }}
              >
                <Text style={[T.button, { color: C.white, letterSpacing: 2 }]}>{spinning ? 'SPINNING···' : 'SPIN NOW'}</Text>
              </Pressable>
            ) : (
              <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }} style={{ alignSelf: 'stretch', alignItems: 'center' }}>
                <Pressable onPress={claim} style={{ alignSelf: 'stretch', paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: C.ink }}>
                  <Feather name="gift" size={16} color={YELLOW} />
                  <Text style={[T.button, { color: C.white, letterSpacing: 2 }]}>CLAIM MY GIFT</Text>
                </Pressable>
                <Pressable onPress={() => { claim(); onShop(); }} hitSlop={8} style={{ marginTop: SP.m, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={[T.caption, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '600' }]}>Claim & shop now</Text>
                  <Feather name="arrow-right" size={13} color={C.ink} />
                </Pressable>
              </MotiView>
            )}

            <Text style={[T.micro, { color: C.dim, marginTop: SP.m }]}>Every spin wins · applied at checkout</Text>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}
