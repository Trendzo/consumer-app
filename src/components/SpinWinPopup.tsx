// SPIN & WIN POPUP — the welcome-gift wheel shown after the splash.
//
// Built exactly in the app's language: a white sharp-cornered card with a black
// header strip (same shell as BrutalConfirm), ink type, hairline dividers, and the
// Home highlighter-yellow as the single accent — pixel-square confetti, no
// gradients. None of that changed.
//
// What changed is who decides the outcome. This component used to own a hardcoded
// prize table, its own weights, and a `Math.random()` draw — so the odds shipped
// inside the bundle, the "win" was a toast, and the footer's promise that it was
// "applied at checkout" was not implemented anywhere. Now the slices come from the
// server, the server draws, and this animates the pointer to the index it is told.
// A guest keeps a claim token and signs in to collect.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, Dimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf, HELV } from '../theme/brutal';
import { useApp } from '../state/AppState';
import { claim as claimPrize, play, setPendingClaim, type SpinResult, type SpinWheel } from '../services/spin';

const { width: W } = Dimensions.get('window');

const CARD_W = Math.min(W - 36, 380);
const WHEEL = CARD_W - SP.l * 2 - 26;
const R = WHEEL / 2;

/** Alternating slice fill when the admin has not chosen a colour for a slice. */
const DEFAULT_BG = [C.white, '#F2F2F2'];

export function SpinWinPopup({ visible, wheel, onClose, onShop }: {
  visible: boolean;
  /** The live wheel, already fetched by the caller. The popup never renders without one. */
  wheel: SpinWheel;
  onClose: () => void;
  onShop: () => void;
}) {
  const { showToast, requireAuth } = useApp();
  const rotation = useRef(new Animated.Value(0)).current;
  const hubPulse = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [claimed, setClaimed] = useState<{ code: string | null; points: number | null } | null>(null);
  const [claiming, setClaiming] = useState(false);

  const segments = wheel.segments;
  const N = Math.max(segments.length, 1);
  const SLICE_DEG = 360 / N;

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

  const spin = async () => {
    if (spinning || result !== null) return;
    setSpinning(true);
    let outcome: SpinResult;
    try {
      // Ask FIRST, animate second. The wheel is a presentation of the server's
      // answer, not a way of producing one.
      outcome = await play('popup');
    } catch (e: any) {
      setSpinning(false);
      showToast(
        e?.code === 'already_spun' ? 'No spins left' : "Couldn't spin",
        e?.code === 'already_spun' ? 'Come back tomorrow for another go.' : 'Check your connection and try again.',
        'x',
      );
      return;
    }

    // Land inside the winning slice, with a little jitter so it never looks
    // mechanically centred.
    const jitter = (Math.random() - 0.5) * SLICE_DEG * 0.5;
    const target = 360 * 6 + (360 - outcome.segmentIndex * SLICE_DEG) + jitter;
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: target,
      duration: 4200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setResult(outcome);
      if (outcome.prize) setClaimed({ code: outcome.prize.code, points: outcome.prize.points });
    });
  };

  /** Turn a settled claim into the one line the shopper needs. */
  const announce = (prize: { code: string | null; points: number | null }) => {
    if (prize.code) showToast('Prize claimed', `Code ${prize.code} — apply it at checkout`, 'gift');
    else if (prize.points) showToast('Prize claimed', `${prize.points} points added to your account`, 'gift');
    else showToast('Claimed', 'Enjoy!', 'gift');
  };

  const runClaim = async (token: string) => {
    setClaiming(true);
    try {
      const res = await claimPrize(token);
      if (res.prize) {
        setClaimed({ code: res.prize.code, points: res.prize.points });
        announce(res.prize);
      }
    } catch {
      showToast("Couldn't claim", 'Try again from Coupons in your profile.', 'x');
    } finally {
      setClaiming(false);
    }
  };

  const onClaimPress = () => {
    if (!result) return;
    if (!result.won) { onClose(); return; }
    if (claimed) { onClose(); return; } // already settled — nothing left to do

    const token = result.claimToken;
    if (!token) { onClose(); return; }

    if (result.requiresLogin) {
      // Park the token across the sign-in round trip, then collect automatically.
      setPendingClaim(token);
      onClose();
      requireAuth(() => { void runClaim(token); });
      return;
    }
    void runClaim(token).then(onClose);
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const hubScale = hubPulse.interpolate({ inputRange: [0, 1], outputRange: [1, spinning || result !== null ? 1 : 1.07] });

  // Slice geometry — border-triangles overshoot the circle, clipped by it.
  const halfAngleRad = ((SLICE_DEG / 2) * Math.PI) / 180;
  const L = R * 1.25;
  const halfBase = L * Math.tan(halfAngleRad);

  // Pixel-square confetti (ink + yellow) — same particle language as the splash.
  // Losing slices get none: a consolation shower reads as a win.
  const confetti = useMemo(() => {
    if (!result?.won) return [];
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 80 + Math.random() * 90;
      return {
        id: i,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        size: 5 + Math.random() * 5,
        color: i % 3 === 0 ? C.accent : C.ink,
        delay: Math.random() * 120,
      };
    });
  }, [result]);

  const headline = result ? `${result.label} ${result.sublabel ?? ''}`.trim() : 'Spin to win';
  const subline = !result
    ? wheel.spinsLeftToday > 0 ? 'One spin, one prize · sign in to collect' : 'Come back tomorrow for another spin'
    : !result.won ? 'Not this time — try again tomorrow'
    : claimed ? (claimed.code ? `Code ${claimed.code} · use it at checkout` : 'Added to your account')
    : result.requiresLogin ? 'Sign in to collect it' : 'Locked in — claim it below';

  const fillFor = (i: number) => segments[i]?.colorHex || DEFAULT_BG[i % DEFAULT_BG.length];

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
            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent }}>
              <MaterialCommunityIcons name="gift-outline" size={15} color={C.accentInk} />
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
              <View style={{ position: 'absolute', left: -4, right: -8, bottom: 2, height: 11, backgroundColor: C.accent }} />
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(26), color: C.ink, letterSpacing: -0.5, textTransform: 'uppercase' }}>
                {headline}
              </Text>
            </View>
            <Text style={[T.caption, { color: C.dim, marginTop: 8 }]}>{subline}</Text>

            {/* ── Wheel ── */}
            <View style={{ width: WHEEL, height: WHEEL + 16, alignItems: 'center', marginTop: SP.l }}>
              {/* Ink pointer at 12 o'clock */}
              <View style={{ position: 'absolute', top: 0, zIndex: 10, alignItems: 'center' }}>
                <View style={{ width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 18, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.ink }} />
              </View>

              <View style={{ marginTop: 10, width: WHEEL, height: WHEEL, alignItems: 'center', justifyContent: 'center' }}>
                {/* Rotating face — 2px ink ring, flat slices */}
                <Animated.View style={{ width: WHEEL, height: WHEEL, transform: [{ rotate }] }}>
                  <View style={{ width: WHEEL, height: WHEEL, borderRadius: R, overflow: 'hidden', backgroundColor: fillFor(0), borderWidth: 2, borderColor: C.ink }}>
                    {segments.map((s, i) => (
                      <View key={s.id} style={{ position: 'absolute', width: WHEEL, height: WHEEL, transform: [{ rotate: `${i * SLICE_DEG}deg` }] }}>
                        <View style={{
                          position: 'absolute',
                          left: R - halfBase,
                          top: R - L,
                          width: 0, height: 0,
                          borderTopWidth: L,
                          borderLeftWidth: halfBase,
                          borderRightWidth: halfBase,
                          borderTopColor: fillFor(i),
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                        }} />
                        {/* Label reads outward along the slice axis — ink only */}
                        <View style={{ position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center', opacity: s.soldOut ? 0.35 : 1 }}>
                          {!!s.icon && <MaterialCommunityIcons name={s.icon as any} size={20} color={C.ink} />}
                          <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(13), color: C.ink, marginTop: 3, letterSpacing: 0.3 }}>{s.label}</Text>
                          {!!s.sublabel && (
                            <Text style={{ fontFamily: HELV, fontWeight: '600', fontSize: rf(9), color: C.ink, letterSpacing: 1.5, marginTop: 1 }}>{s.sublabel}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                    {/* Hairline dividers at slice boundaries */}
                    {segments.map((s, i) => (
                      <View
                        key={'d' + s.id}
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
                    disabled={spinning || result !== null || wheel.spinsLeftToday <= 0}
                    style={{ width: 58, height: 58, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white }}
                  >
                    {result !== null ? (
                      <Feather name={result.won ? 'check' : 'x'} size={22} color={C.accent} />
                    ) : (
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(13), color: C.white, letterSpacing: 1.5 }}>{spinning ? '···' : 'SPIN'}</Text>
                    )}
                  </Pressable>
                </Animated.View>
              </View>
            </View>

            {/* ── CTA — full-width black slab, app-standard button ── */}
            {result === null ? (
              <Pressable
                onPress={spin}
                disabled={spinning || wheel.spinsLeftToday <= 0}
                style={{ marginTop: SP.l, alignSelf: 'stretch', paddingVertical: 15, alignItems: 'center', backgroundColor: spinning || wheel.spinsLeftToday <= 0 ? C.faint : C.ink }}
              >
                <Text style={[T.button, { color: C.white, letterSpacing: 2 }]}>
                  {wheel.spinsLeftToday <= 0 ? 'NO SPINS LEFT' : spinning ? 'SPINNING···' : 'SPIN NOW'}
                </Text>
              </Pressable>
            ) : (
              <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }} style={{ alignSelf: 'stretch', alignItems: 'center' }}>
                <Pressable
                  onPress={onClaimPress}
                  disabled={claiming}
                  style={{ alignSelf: 'stretch', paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: claiming ? C.faint : C.ink }}
                >
                  <Feather name={result.won ? 'gift' : 'x'} size={16} color={C.accent} />
                  <Text style={[T.button, { color: C.white, letterSpacing: 2 }]}>
                    {!result.won ? 'CLOSE'
                      : claiming ? 'CLAIMING···'
                      : claimed ? 'DONE'
                      : result.requiresLogin ? 'SIGN IN TO CLAIM'
                      : 'CLAIM MY GIFT'}
                  </Text>
                </Pressable>
                {result.won && (
                  <Pressable onPress={() => { onClaimPress(); onShop(); }} hitSlop={8} style={{ marginTop: SP.m, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '600' }]}>Claim & shop now</Text>
                    <Feather name="arrow-right" size={13} color={C.ink} />
                  </Pressable>
                )}
              </MotiView>
            )}

            {/* The claimed code, tappable to copy — it existed only inside a toast
                before, with no way to get it onto the clipboard. */}
            {claimed?.code && (
              <Pressable
                onPress={() => {
                  void Clipboard.setStringAsync(claimed.code!)
                    .then(() => showToast('Copied', `${claimed.code} — paste it at checkout`, 'copy'));
                }}
                style={[{ marginTop: SP.m, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F4F4F4' }, BORDER(1)]}
              >
                <Text style={[T.monoB, { letterSpacing: 2 }]}>{claimed.code}</Text>
                <Feather name="copy" size={13} color={C.ink} />
              </Pressable>
            )}
            <Text style={[T.micro, { color: C.dim, marginTop: SP.m }]}>
              {claimed?.code ? 'Saved to your coupons · apply it at checkout' : 'Prizes apply at checkout'}
            </Text>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}
