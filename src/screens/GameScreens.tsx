import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Animated, Easing, Alert, Modal, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, BrutalStatusBar, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { PRODUCTS } from '../data/mockData';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { generateTryOn, subscribeTryOnLog, clearTryOnLog, getTryOnLog } from '../services/tryOn';

// ─── DAILY REWARD — Brutalist streak board + tap-to-reveal ──
const WEEK_REWARDS = [10, 20, 30, 40, 50, 60, 100]; // day 7 = jackpot
const DAY_LBL = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function DailyRewardScreen() {
  const nav = useNavigation<any>();
  const [claimed, setClaimed] = useState([true, true, true, true, true, true, false]);
  const today = 6;
  const [revealAnim] = useState(new Animated.Value(0));
  const [bonusWheel, setBonusWheel] = useState(false);
  const totalClaimed = claimed.reduce((s, c, i) => s + (c ? WEEK_REWARDS[i] : 0), 0);
  const streakDays = claimed.filter(Boolean).length;

  const claim = () => {
    if (claimed[today]) return;
    Animated.sequence([
      Animated.timing(revealAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      const next = [...claimed];
      next[today] = true;
      setClaimed(next);
      setTimeout(() => setBonusWheel(true), 300);
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Daily Reward" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }}>
        {/* Header stats strip */}
        <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
          <View style={[{ flex: 1, padding: SP.m, backgroundColor: C.ink, borderRightWidth: 1, borderColor: C.ink }]}>
            <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{'◆ STREAK'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 40, color: C.white, marginTop: 2 }}>{streakDays}<Text style={{ fontSize: 14 }}>/7</Text></Text>
            <Text style={[T.mono, { color: C.white, fontSize: 9, marginTop: 2 }]}>DAYS</Text>
          </View>
          <View style={{ flex: 1, padding: SP.m }}>
            <Text style={[T.monoB, { color: C.dim, fontSize: 9 }]}>{'▲ EARNED'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 40, color: C.ink, marginTop: 2 }}>+{totalClaimed}</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 2 }]}>POINTS THIS WEEK</Text>
          </View>
        </View>

        {/* Week ladder — 7 boxes */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> WEEKLY_BOARD'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: SP.m }}>
          {DAY_LBL.map((d, i) => {
            const got = claimed[i];
            const isToday = i === today;
            const isBig = i === 6;
            return (
              <MotiView
                key={d}
                from={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 60 }}
                style={[{ flex: isBig ? 1.4 : 1, aspectRatio: isBig ? 0.55 : 0.5, alignItems: 'center', justifyContent: 'space-between', padding: 6, backgroundColor: got ? C.ink : isBig ? C.white : C.white }, BORDER(1)]}
              >
                <Text style={[T.monoB, { color: got ? C.white : C.dim, fontSize: 8 }]}>{d}</Text>
                {got ? (
                  <Feather name="check" size={isBig ? 22 : 16} color={C.white} />
                ) : isToday ? (
                  <MotiView
                    from={{ scale: 1 }}
                    animate={{ scale: 1.2 }}
                    transition={{ loop: true, type: 'timing', duration: 800 }}
                  >
                    <Feather name="gift" size={18} color={C.ink} />
                  </MotiView>
                ) : isBig ? (
                  <Ionicons name="trophy-outline" size={22} color={C.ink} />
                ) : (
                  <Feather name="lock" size={12} color={C.dim} />
                )}
                <Text style={{ fontFamily: 'Inter_900Black', color: got ? C.white : C.ink, fontSize: isBig ? 12 : 10 }}>+{WEEK_REWARDS[i]}</Text>
              </MotiView>
            );
          })}
        </View>

        {/* Today's reveal card */}
        <View style={[{ marginTop: SP.xl, padding: SP.l, backgroundColor: claimed[today] ? C.ink : C.white, alignItems: 'center', overflow: 'hidden' }, BORDER(1)]}>
          {!claimed[today] ? (
            <>
              <Text style={[T.monoB, { fontSize: 10 }]}>{'> TODAY · DAY 07 · JACKPOT'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 64, color: C.ink, marginTop: 8, letterSpacing: -3 }}>+100</Text>
              <Text style={[T.body, { color: C.dim, marginTop: 2 }]}>POINTS + BONUS SPIN</Text>
              <AsciiDivider style={{ marginTop: 12, width: 160 }} />
              <Pressable onPress={claim} style={[{ marginTop: 12, paddingHorizontal: 28, paddingVertical: 14, backgroundColor: C.ink }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 16, letterSpacing: 1 }}>◆ TAP TO CLAIM</Text>
              </Pressable>
            </>
          ) : (
            <MotiView from={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}>
              <Ionicons name="trophy" size={48} color={C.white} style={{ alignSelf: 'center' }} />
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 24, color: C.white, marginTop: 8, textAlign: 'center' }}>+100 CLAIMED</Text>
              <Text style={[T.mono, { color: C.white, fontSize: 10, textAlign: 'center', marginTop: 4 }]}>COMPLETE WEEK · BONUS ROLLING</Text>
            </MotiView>
          )}
        </View>

        {/* Bonus spin wheel — unlocks after claim */}
        {claimed[today] && (
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 200 }}>
            <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> WEEK_COMPLETE_BONUS'}</Text>
            <AsciiDivider style={{ marginTop: 4 }} />
            <Pressable onPress={() => nav.navigate('SpinWheel')} style={[{ marginTop: SP.s, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white }, BORDER(1)]}>
              <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                <Feather name="rotate-cw" size={20} color={C.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14 }}>FREE SPIN UNLOCKED</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 2 }]}>Spin & Win · up to 80% off</Text>
              </View>
              <Text style={[T.monoB, { fontSize: 14 }]}>{'──▶'}</Text>
            </Pressable>
          </MotiView>
        )}

        {/* Reset timer */}
        <View style={[{ marginTop: SP.m, padding: SP.s, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
          <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>NEXT DAY RESETS IN</Text>
          <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 18, color: C.ink, letterSpacing: 3, marginTop: 2 }}>14:27:43</Text>
        </View>

        {/* Streak perks ladder */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> STREAK_PERKS'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={[{ marginTop: SP.s, gap: 0, overflow: 'hidden' }, BORDER(1)]}>
          {[
            { d: 7, r: 'Bonus spin unlocked', done: true },
            { d: 14, r: 'Mystery gift box', done: false },
            { d: 30, r: 'Free ship for a month', done: false },
            { d: 100, r: 'VIP tier + ₹1,000 credit', done: false },
          ].map((p, i) => (
            <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.s, backgroundColor: p.done ? C.ink : C.white }, i > 0 && { borderTopWidth: 1, borderColor: C.ink }]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: p.done ? C.white : C.ink, width: 60 }}>D{p.d}</Text>
              <Text style={[T.body, { flex: 1, color: p.done ? C.white : C.ink }]}>{p.r}</Text>
              {p.done ? <Feather name="check" size={14} color={C.white} /> : <Feather name="lock" size={14} color={C.dim} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── SPIN WHEEL — Brutalist wheel + history + power-ups ─────
const SLICES = [
  { label: '10% OFF', weight: 3 },
  { label: '₹100', weight: 2 },
  { label: 'TRY AGAIN', weight: 3 },
  { label: '20% OFF', weight: 2 },
  { label: '50 PTS', weight: 3 },
  { label: 'FREE SHIP', weight: 2 },
  { label: '₹500', weight: 1 },
  { label: 'BETTER LUCK', weight: 3 },
];
const INITIAL_HISTORY = [
  { prize: '10% OFF', user: 'YOU', date: '3d' },
  { prize: '50 PTS', user: 'YOU', date: '5d' },
  { prize: 'TRY AGAIN', user: 'YOU', date: '1w' },
];

export function SpinWheelScreen() {
  const nav = useNavigation<any>();
  const rotation = useRef(new Animated.Value(0)).current;
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinsLeft, setSpinsLeft] = useState(3);
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [boost, setBoost] = useState(false);

  const spin = () => {
    if (spinning || spinsLeft <= 0) return;
    setSpinning(true);
    setResult(null);
    // Weighted selection — higher-weight slices come up more often. Boost removes dud slices.
    const pool = boost ? SLICES.filter(s => !s.label.includes('AGAIN') && !s.label.includes('LUCK')) : SLICES;
    const weightedBag: number[] = [];
    pool.forEach(s => {
      const srcIdx = SLICES.indexOf(s);
      for (let i = 0; i < s.weight; i++) weightedBag.push(srcIdx);
    });
    const idx = weightedBag[Math.floor(Math.random() * weightedBag.length)];

    // Slice i's center sits at angle (i * sliceDeg) clockwise from the top when the
    // wheel is unrotated. The pointer is at 12 o'clock, so to land slice idx under
    // the pointer we need rotation ≡ -idx * sliceDeg (mod 360). Add a small jitter
    // inside the slice so it doesn't always stop dead-center.
    const sliceDeg = 360 / SLICES.length;
    const jitter = (Math.random() - 0.5) * sliceDeg * 0.7;
    const target = 360 * 6 + (360 - idx * sliceDeg) + jitter;

    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: target,
      duration: 3800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      const prize = SLICES[idx].label;
      setResult(prize);
      setSpinning(false);
      setSpinsLeft(s => s - 1);
      setHistory(h => [{ prize, user: 'YOU', date: 'NOW' }, ...h].slice(0, 5));
      setBoost(false);
    });
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Spin & Win" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Counter strip */}
        <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
          <View style={[{ flex: 1, padding: SP.m, backgroundColor: C.ink, borderRightWidth: 1, borderColor: C.ink }]}>
            <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{'◆ SPINS_LEFT'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 44, color: C.white, marginTop: 2, lineHeight: 46 }}>{spinsLeft}<Text style={{ fontSize: 18 }}>/3</Text></Text>
          </View>
          <View style={{ flex: 1, padding: SP.m }}>
            <Text style={[T.monoB, { color: C.dim, fontSize: 9 }]}>{'▲ JACKPOT_ODDS'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, marginTop: 2 }}>1 in 19</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 2 }]}>₹500 SLICE</Text>
          </View>
        </View>

        {/* Wheel assembly */}
        {(() => {
          const WHEEL = 300;
          const R = WHEEL / 2;
          const N = SLICES.length;
          const sliceAngle = 360 / N;
          const halfAngleRad = ((sliceAngle / 2) * Math.PI) / 180;
          const L = R * 1.22; // triangle extends past circle so no gaps after mask
          const halfBase = L * Math.tan(halfAngleRad);
          return (
            <View style={{ marginTop: SP.xl, alignItems: 'center', justifyContent: 'center', width: WHEEL + 40, height: WHEEL + 24, alignSelf: 'center' }}>
              {/* Pointer — static, at 12 o'clock, points DOWN into wheel */}
              <View style={{ position: 'absolute', top: 0, zIndex: 10, alignItems: 'center' }}>
                <View style={[{ paddingHorizontal: 10, paddingVertical: 2, backgroundColor: C.ink }, BORDER(2)]}>
                  <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 9, letterSpacing: 1 }}>WIN</Text>
                </View>
                <View style={{ width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 20, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.ink, marginTop: -1 }} />
              </View>

              {/* ROTATING wheel — just slices + dividers */}
              <Animated.View style={{ marginTop: 18, width: WHEEL, height: WHEEL, transform: [{ rotate }] }}>
                <View style={{ width: WHEEL, height: WHEEL, borderRadius: R, overflow: 'hidden', borderWidth: 3, borderColor: C.ink, backgroundColor: C.ink }}>
                  {/* 8 pie-slice triangles with alternating colors */}
                  {SLICES.map((s, i) => {
                    const rot = i * sliceAngle;
                    const isDark = i % 2 === 0;
                    return (
                      <View key={i} style={{ position: 'absolute', width: WHEEL, height: WHEEL, transform: [{ rotate: `${rot}deg` }] }}>
                        <View style={{
                          position: 'absolute',
                          left: R - halfBase,
                          top: R - L,
                          width: 0, height: 0,
                          borderTopWidth: L,
                          borderLeftWidth: halfBase,
                          borderRightWidth: halfBase,
                          borderTopColor: isDark ? C.ink : C.white,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                        }} />
                        {/* Radial label reading outward */}
                        <View style={{ position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: isDark ? C.white : C.ink, letterSpacing: 0.5 }}>{s.label}</Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* Radial divider lines at slice boundaries */}
                  {SLICES.map((_, i) => (
                    <View
                      key={'div' + i}
                      style={{
                        position: 'absolute',
                        width: 2,
                        height: R,
                        left: R - 1,
                        top: 0,
                        backgroundColor: C.ink,
                        transform: [{ rotate: `${i * sliceAngle + sliceAngle / 2}deg` }],
                        transformOrigin: 'bottom center',
                      }}
                    />
                  ))}
                </View>
              </Animated.View>

              {/* STATIC center hub — sits on top of the rotating wheel */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 18 + R - 34, left: 20 + R - 34, width: 68, height: 68, borderRadius: 34, backgroundColor: C.white, borderWidth: 3, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: C.white, letterSpacing: 1 }}>SPIN</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: C.white, letterSpacing: 1, marginTop: -2 }}>& WIN</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {result && !spinning && (
          <MotiView from={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}>
            <View style={[{ marginTop: SP.l, padding: SP.l, alignItems: 'center', backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{'> SPIN_RESULT'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 34, color: C.white, marginTop: 6, letterSpacing: -1 }}>{result}</Text>
            </View>
          </MotiView>
        )}

        {/* Boost power-up */}
        <Pressable
          onPress={() => !spinning && spinsLeft > 0 && setBoost(b => !b)}
          style={[{ marginTop: SP.m, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: boost ? C.ink : C.white, opacity: spinsLeft === 0 ? 0.4 : 1 }, BORDER(1)]}
        >
          <Feather name="zap" size={20} color={boost ? C.white : C.ink} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: boost ? C.white : C.ink }}>LUCKY BOOST {boost ? '✓ ACTIVE' : ''}</Text>
            <Text style={[T.mono, { color: boost ? C.white : C.dim, fontSize: 9, marginTop: 2 }]}>Spend 100 pts → remove "try again" slices</Text>
          </View>
          {!boost && <Text style={[T.monoB, { fontSize: 10, color: C.ink }]}>─100</Text>}
        </Pressable>

        {/* Spin action */}
        <Pressable
          onPress={spin}
          disabled={spinning || spinsLeft === 0}
          style={[{ marginTop: SP.m, padding: SP.l, alignItems: 'center', backgroundColor: spinsLeft === 0 ? C.hairline : C.ink }, BORDER(1)]}
        >
          <Text style={{ fontFamily: 'Inter_900Black', color: spinsLeft === 0 ? C.dim : C.white, fontSize: 18, letterSpacing: 1 }}>
            {spinning ? '◇ SPINNING...' : spinsLeft === 0 ? '◆ COME BACK TOMORROW' : `◆ SPIN NOW (${spinsLeft} LEFT)`}
          </Text>
        </Pressable>

        {/* History */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> RECENT_SPINS'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={{ marginTop: SP.s }}>
          {history.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: C.hairline }}>
              <Text style={[T.monoB, { fontSize: 10, color: C.dim, width: 30 }]}>{`#${i + 1}`}</Text>
              <Text style={[T.bodyB, { flex: 1, fontSize: 13 }]}>{h.prize}</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>{h.date}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── STYLE QUIZ — Mixed-format engaging game ────────────────
// 6 questions with different interaction types: swipe, this-or-that,
// image grid, color palette, slider, and mood-word chips. XP bar fills
// as user progresses; points pop on each answer.

type QuizQ =
  | { kind: 'swipe'; prompt: string; card: { label: string; sub: string; img: string; tags: string[] } }
  | { kind: 'pair'; prompt: string; a: { label: string; sub: string; img: string; tags: string[] }; b: { label: string; sub: string; img: string; tags: string[] } }
  | { kind: 'grid'; prompt: string; opts: { label: string; img: string; tags: string[] }[] }
  | { kind: 'colors'; prompt: string; pick: number; palette: { hex: string; tag: string; name: string }[] }
  | { kind: 'slider'; prompt: string; left: string; right: string; leftTag: string; rightTag: string }
  | { kind: 'chips'; prompt: string; pick: number; opts: { word: string; tag: string }[] };

const QUIZ: QuizQ[] = [
  {
    kind: 'swipe', prompt: 'OVERSIZED FITS?',
    card: { label: 'OVERSIZED', sub: 'Loose, baggy silhouettes', img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80', tags: ['STREET', 'UTILITY'] },
  },
  {
    kind: 'pair', prompt: 'PICK YOUR WEEKEND FIT',
    a: { label: 'MINIMAL', sub: 'Clean · neutral · sharp', img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', tags: ['MINIMAL', 'CLASSIC'] },
    b: { label: 'MAXIMAL', sub: 'Layered · loud · bold', img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80', tags: ['CHAOS', 'STREET'] },
  },
  {
    kind: 'grid', prompt: "WHICH IS YOU?",
    opts: [
      { label: 'CARGO', img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80', tags: ['STREET', 'UTILITY'] },
      { label: 'PREPPY', img: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80', tags: ['PREPPY', 'CLASSIC'] },
      { label: 'GOTH', img: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=400&q=80', tags: ['GOTH', 'MINIMAL'] },
      { label: 'SOFT', img: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80', tags: ['COQUETTE', 'SOFT'] },
    ],
  },
  {
    kind: 'colors', prompt: 'PICK 3 COLORS YOU LIVE IN', pick: 3,
    palette: [
      { hex: '#000000', tag: 'MINIMAL', name: 'INK' },
      { hex: '#FFFFFF', tag: 'MINIMAL', name: 'PAPER' },
      { hex: '#C9A87C', tag: 'CLASSIC', name: 'TAUPE' },
      { hex: '#E8D5C4', tag: 'SOFT', name: 'CREAM' },
      { hex: '#FF6B9D', tag: 'COQUETTE', name: 'PINK' },
      { hex: '#FEC53D', tag: 'CHAOS', name: 'MUSTARD' },
      { hex: '#5D4037', tag: 'UTILITY', name: 'OLIVE' },
      { hex: '#A78BFA', tag: 'CHAOS', name: 'LILAC' },
      { hex: '#2980B9', tag: 'PREPPY', name: 'DENIM' },
    ],
  },
  {
    kind: 'slider', prompt: 'HOW BOLD DO YOU GO?',
    left: 'SUBTLE', right: 'LOUD',
    leftTag: 'MINIMAL', rightTag: 'CHAOS',
  },
  {
    kind: 'chips', prompt: 'PICK 3 WORDS THAT DESCRIBE YOU', pick: 3,
    opts: [
      { word: 'CLEAN', tag: 'MINIMAL' },
      { word: 'LOUD', tag: 'CHAOS' },
      { word: 'REBEL', tag: 'STREET' },
      { word: 'SOFT', tag: 'COQUETTE' },
      { word: 'SHARP', tag: 'CLASSIC' },
      { word: 'RAW', tag: 'UTILITY' },
      { word: 'DARK', tag: 'GOTH' },
      { word: 'PLAYFUL', tag: 'CHAOS' },
      { word: 'ARCHIVE', tag: 'PREPPY' },
    ],
  },
];

const XP_PER_Q = 25;
const AESTHETIC_DESC: Record<string, string> = {
  MINIMAL: 'Clean silhouettes, restrained palette, no noise. Less is your louder.',
  STREET: 'Baggy, utility-forward, sneaker-first. Comfort without compromise.',
  CLASSIC: 'Timeless pieces, sharp tailoring, neutral tones. The quiet flex.',
  CHAOS: 'Mix patterns, clash colors, collide eras. Rules are for other people.',
  COQUETTE: 'Ribbons, pastels, delicate layers. Soft power, fully dressed.',
  UTILITY: 'Cargo pockets, technical fabrics, functional first. Workwear chic.',
  GOTH: 'All-black everything. Texture over color. Moody and intentional.',
  PREPPY: 'Polos, loafers, knitwear. Ivy-coded and never trying too hard.',
  SOFT: 'Cream, beige, taupe. Warm palette, cozy layers. Visual calm.',
};

export function StyleQuizScreen() {
  const nav = useNavigation<any>();
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [xpPop, setXpPop] = useState<number | null>(null);

  const advance = (tags: string[]) => {
    setPicks(p => [...p, ...tags]);
    setXpPop(XP_PER_Q);
    setTimeout(() => setXpPop(null), 900);
    setTimeout(() => {
      if (step < QUIZ.length - 1) setStep(s => s + 1);
      else setDone(true);
    }, 350);
  };

  if (done) return <QuizResult picks={picks} onRetake={() => { setStep(0); setPicks([]); setDone(false); }} onGoHome={() => nav.replace('Tabs', { screen: 'HomeTab' })} />;

  const q = QUIZ[step];
  const progress = (step + 1) / QUIZ.length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Style Quiz" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* XP bar */}
        <View style={[{ flexDirection: 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
          <View style={[{ padding: SP.s, backgroundColor: C.ink, borderRightWidth: 1, borderColor: C.ink }]}>
            <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{`Q${step + 1}/${QUIZ.length}`}</Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
            <Text style={[T.monoB, { fontSize: 9, color: C.dim, marginRight: 8 }]}>XP</Text>
            <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
              {[...Array(QUIZ.length)].map((_, i) => (
                <View key={i} style={{ flex: 1, height: 8, backgroundColor: i < step ? C.ink : i === step ? C.ink : C.hairline }} />
              ))}
            </View>
            <Text style={[T.monoB, { fontSize: 10, marginLeft: 8 }]}>+{step * XP_PER_Q}</Text>
          </View>
        </View>

        {/* Floating XP pop */}
        {xpPop !== null && (
          <MotiView from={{ opacity: 0, translateY: 0, scale: 0.8 }} animate={{ opacity: 1, translateY: -30, scale: 1.2 }} transition={{ type: 'timing', duration: 700 }} style={{ position: 'absolute', top: 80, right: 30, zIndex: 50 }}>
            <View style={[{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 14 }}>+{xpPop} XP</Text>
            </View>
          </MotiView>
        )}

        {/* Prompt */}
        <MotiView key={step} from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          <Text style={[T.monoB, { fontSize: 10, color: C.dim, marginTop: SP.l }]}>{`> QUESTION_${(step + 1).toString().padStart(2, '0')}`}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.ink, letterSpacing: -1, lineHeight: 34, marginTop: 4 }}>{q.prompt}</Text>
        </MotiView>

        {/* Question content — rendered by type */}
        <View style={{ marginTop: SP.l }}>
          {q.kind === 'swipe' && <QSwipe q={q} onAnswer={advance} />}
          {q.kind === 'pair' && <QPair q={q} onAnswer={advance} />}
          {q.kind === 'grid' && <QGrid q={q} onAnswer={advance} />}
          {q.kind === 'colors' && <QColors q={q} onAnswer={advance} />}
          {q.kind === 'slider' && <QSlider q={q} onAnswer={advance} />}
          {q.kind === 'chips' && <QChips q={q} onAnswer={advance} />}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Q type: SWIPE ──
function QSwipe({ q, onAnswer }: { q: Extract<QuizQ, { kind: 'swipe' }>; onAnswer: (tags: string[]) => void }) {
  const x = useRef(new Animated.Value(0)).current;
  const rot = x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });
  const choose = (yes: boolean) => {
    Animated.timing(x, { toValue: yes ? 400 : -400, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      x.setValue(0);
      onAnswer(yes ? q.card.tags : []);
    });
  };
  return (
    <View>
      <Animated.View style={[{ width: '100%', height: 360, backgroundColor: C.white, transform: [{ translateX: x }, { rotate: rot }], overflow: 'hidden' }, BORDER(1)]}>
        <Image source={{ uri: q.card.img }} style={{ width: '100%', height: '70%' }} resizeMode="cover" />
        <View style={{ padding: SP.m }}>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.ink, letterSpacing: -0.5 }}>{q.card.label}</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 2 }]}>{q.card.sub}</Text>
        </View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 30, left: 20, opacity: x.interpolate({ inputRange: [-200, -20, 0], outputRange: [1, 0, 0] }), transform: [{ rotate: '-18deg' }] }}>
          <View style={[{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.ink }, BORDER(1)]}><Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 22 }}>NOPE</Text></View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 30, right: 20, opacity: x.interpolate({ inputRange: [0, 20, 200], outputRange: [0, 0, 1] }), transform: [{ rotate: '18deg' }] }}>
          <View style={[{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.ink }, BORDER(1)]}><Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 22 }}>VIBE</Text></View>
        </Animated.View>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: SP.m, marginTop: SP.m }}>
        <Pressable onPress={() => choose(false)} style={[{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.white, flexDirection: 'row', justifyContent: 'center', gap: 8 }, BORDER(1)]}>
          <Feather name="x" size={20} color={C.ink} />
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14 }}>SKIP</Text>
        </Pressable>
        <Pressable onPress={() => choose(true)} style={[{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.ink, flexDirection: 'row', justifyContent: 'center', gap: 8 }, BORDER(1)]}>
          <Feather name="heart" size={20} color={C.white} />
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.white }}>VIBE</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Q type: THIS-OR-THAT PAIR ──
function QPair({ q, onAnswer }: { q: Extract<QuizQ, { kind: 'pair' }>; onAnswer: (tags: string[]) => void }) {
  const [tapped, setTapped] = useState<'a' | 'b' | null>(null);
  const pick = (k: 'a' | 'b') => {
    if (tapped) return;
    setTapped(k);
    setTimeout(() => onAnswer(q[k].tags), 250);
  };
  const tile = (k: 'a' | 'b', o: typeof q.a) => (
    <Pressable onPress={() => pick(k)} style={{ flex: 1 }}>
      <MotiView animate={{ scale: tapped === k ? 1.04 : 1 }} transition={{ type: 'spring', damping: 12 }} style={[{ height: 320, overflow: 'hidden', backgroundColor: tapped === k ? C.ink : C.white }, BORDER(1)]}>
        <Image source={{ uri: o.img }} style={{ width: '100%', height: '70%', opacity: tapped === k ? 0.6 : 1 }} resizeMode="cover" />
        <View style={{ padding: SP.s }}>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: tapped === k ? C.white : C.ink, letterSpacing: -0.5 }}>{o.label}</Text>
          <Text style={[T.mono, { color: tapped === k ? C.white : C.dim, fontSize: 9, marginTop: 2 }]}>{o.sub}</Text>
        </View>
        {tapped === k && (
          <View style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white }}>
            <Feather name="check" size={18} color={C.ink} />
          </View>
        )}
      </MotiView>
    </Pressable>
  );
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: SP.s }}>
        {tile('a', q.a)}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={[{ width: 40, height: 40, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.white }}>VS</Text>
          </View>
        </View>
        {tile('b', q.b)}
      </View>
      <Text style={[T.mono, { color: C.dim, textAlign: 'center', fontSize: 10, marginTop: SP.s }]}>TAP THE SIDE THAT'S MORE YOU</Text>
    </View>
  );
}

// ── Q type: 2×2 IMAGE GRID ──
function QGrid({ q, onAnswer }: { q: Extract<QuizQ, { kind: 'grid' }>; onAnswer: (tags: string[]) => void }) {
  const [tapped, setTapped] = useState<number | null>(null);
  const pick = (i: number) => {
    if (tapped !== null) return;
    setTapped(i);
    setTimeout(() => onAnswer(q.opts[i].tags), 280);
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
      {q.opts.map((o, i) => (
        <Pressable key={i} onPress={() => pick(i)} style={{ width: '48.5%' }}>
          <MotiView animate={{ scale: tapped === i ? 1.06 : tapped !== null ? 0.94 : 1, opacity: tapped !== null && tapped !== i ? 0.3 : 1 }} transition={{ type: 'spring', damping: 13 }} style={[{ aspectRatio: 1, backgroundColor: tapped === i ? C.ink : C.white, overflow: 'hidden' }, BORDER(1)]}>
            <Image source={{ uri: o.img }} style={{ width: '100%', height: '75%', opacity: tapped === i ? 0.5 : 1 }} resizeMode="cover" />
            <View style={{ padding: 6, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: tapped === i ? C.white : C.ink, letterSpacing: 1 }}>{o.label}</Text>
            </View>
            <View style={[{ position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: tapped === i ? C.white : C.ink }]}>
              <Text style={[T.monoB, { color: tapped === i ? C.ink : C.white, fontSize: 8 }]}>{`0${i + 1}`}</Text>
            </View>
          </MotiView>
        </Pressable>
      ))}
    </View>
  );
}

// ── Q type: COLOR PALETTE ──
function QColors({ q, onAnswer }: { q: Extract<QuizQ, { kind: 'colors' }>; onAnswer: (tags: string[]) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) => {
    if (picked.includes(i)) {
      setPicked(picked.filter(p => p !== i));
    } else if (picked.length < q.pick) {
      setPicked([...picked, i]);
    }
  };
  const submit = () => onAnswer(picked.map(i => q.palette[i].tag));
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, marginTop: 4 }}>
        {q.palette.map((c, i) => {
          const idx = picked.indexOf(i);
          const on = idx !== -1;
          return (
            <Pressable key={i} onPress={() => toggle(i)} style={{ width: '30.5%' }}>
              <View style={[{ aspectRatio: 1, backgroundColor: c.hex, alignItems: 'center', justifyContent: 'flex-end', padding: 6 }, BORDER(1)]}>
                {on && (
                  <View style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white }}>
                    <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 10 }}>{idx + 1}</Text>
                  </View>
                )}
                <View style={[{ paddingHorizontal: 4, paddingVertical: 2, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.monoB, { fontSize: 8 }]}>{c.name}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: SP.s, textAlign: 'center' }]}>{picked.length}/{q.pick} SELECTED</Text>
      <Pressable onPress={submit} disabled={picked.length !== q.pick} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: picked.length === q.pick ? C.ink : C.hairline }, BORDER(1)]}>
        <Text style={{ fontFamily: 'Inter_900Black', color: picked.length === q.pick ? C.white : C.dim, fontSize: 14, letterSpacing: 1 }}>◆ LOCK IN PALETTE</Text>
      </Pressable>
    </View>
  );
}

// ── Q type: SLIDER ──
function QSlider({ q, onAnswer }: { q: Extract<QuizQ, { kind: 'slider' }>; onAnswer: (tags: string[]) => void }) {
  const [val, setVal] = useState(50);
  const [trackW, setTrackW] = useState(0);
  const startVal = useRef(50);
  const pan = Gesture.Pan()
    .onBegin(() => { startVal.current = val; })
    .onUpdate((e) => {
      if (trackW === 0) return;
      const delta = (e.translationX / trackW) * 100;
      const next = Math.min(100, Math.max(0, startVal.current + delta));
      runOnJS(setVal)(next);
    });
  const submit = () => {
    const tags: string[] = [];
    if (val < 40) { tags.push(q.leftTag, q.leftTag); }
    else if (val > 60) { tags.push(q.rightTag, q.rightTag); }
    else { tags.push(q.leftTag, q.rightTag); }
    onAnswer(tags);
  };
  return (
    <View>
      {/* Big readout */}
      <View style={[{ padding: SP.l, backgroundColor: C.ink, alignItems: 'center' }, BORDER(1)]}>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 72, color: C.white, letterSpacing: -3, lineHeight: 72 }}>{Math.round(val)}</Text>
        <Text style={[T.monoB, { color: C.white, fontSize: 10, marginTop: 4 }]}>{val < 40 ? q.left : val > 60 ? q.right : 'BALANCED'}</Text>
      </View>
      {/* Slider track */}
      <View style={{ marginTop: SP.l, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[T.monoB, { fontSize: 11, width: 60 }]}>{q.left}</Text>
        <GestureDetector gesture={pan}>
          <View onLayout={(e) => setTrackW(e.nativeEvent.layout.width)} style={{ flex: 1, height: 50, justifyContent: 'center' }}>
            {/* Track line */}
            <View style={{ height: 2, backgroundColor: C.ink }} />
            {/* Tick marks */}
            <View style={{ position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
              {[...Array(11)].map((_, i) => (
                <View key={i} style={{ width: 2, height: i === 5 ? 14 : 8, backgroundColor: C.ink }} />
              ))}
            </View>
            {/* Thumb */}
            <View style={[{ position: 'absolute', width: 28, height: 28, backgroundColor: C.ink, left: `${val}%`, marginLeft: -14, alignItems: 'center', justifyContent: 'center' }, BORDER(2)]}>
              <View style={{ width: 6, height: 6, backgroundColor: C.white }} />
            </View>
          </View>
        </GestureDetector>
        <Text style={[T.monoB, { fontSize: 11, width: 60, textAlign: 'right' }]}>{q.right}</Text>
      </View>
      <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: SP.s, textAlign: 'center' }]}>DRAG THE BLOCK</Text>
      <Pressable onPress={submit} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: C.ink }, BORDER(1)]}>
        <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 14, letterSpacing: 1 }}>◆ LOCK IN</Text>
      </Pressable>
    </View>
  );
}

// ── Q type: MOOD CHIPS ──
function QChips({ q, onAnswer }: { q: Extract<QuizQ, { kind: 'chips' }>; onAnswer: (tags: string[]) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) => {
    if (picked.includes(i)) setPicked(picked.filter(p => p !== i));
    else if (picked.length < q.pick) setPicked([...picked, i]);
  };
  const submit = () => onAnswer(picked.map(i => q.opts[i].tag));
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
        {q.opts.map((o, i) => {
          const idx = picked.indexOf(i);
          const on = idx !== -1;
          return (
            <Pressable key={i} onPress={() => toggle(i)}>
              <MotiView animate={{ scale: on ? 1.06 : 1 }} transition={{ type: 'spring', damping: 12 }} style={[{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: on ? C.ink : C.white, flexDirection: 'row', alignItems: 'center', gap: 6 }, BORDER(1)]}>
                {on && <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 11 }}>{idx + 1}</Text>}
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: on ? C.white : C.ink, letterSpacing: 0.5 }}>{o.word}</Text>
              </MotiView>
            </Pressable>
          );
        })}
      </View>
      <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: SP.s, textAlign: 'center' }]}>{picked.length}/{q.pick} SELECTED</Text>
      <Pressable onPress={submit} disabled={picked.length !== q.pick} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: picked.length === q.pick ? C.ink : C.hairline }, BORDER(1)]}>
        <Text style={{ fontFamily: 'Inter_900Black', color: picked.length === q.pick ? C.white : C.dim, fontSize: 14, letterSpacing: 1 }}>◆ LOCK IN</Text>
      </Pressable>
    </View>
  );
}

// ── RESULT SCREEN ──
function QuizResult({ picks, onRetake, onGoHome }: { picks: string[]; onRetake: () => void; onGoHome: () => void }) {
  const counts: Record<string, number> = {};
  picks.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const winner = sorted[0]?.[0] || 'STREET';
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  const totalXP = QUIZ.length * XP_PER_Q;
  const badgeCount = sorted.slice(0, 3).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Result" onBack={onRetake} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }}>
        {/* Hero reveal */}
        <MotiView from={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 11 }}>
          <View style={[{ padding: SP.l, backgroundColor: C.ink, alignItems: 'center' }, BORDER(1)]}>
            <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{'◆ YOUR_AESTHETIC'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 64, color: C.white, letterSpacing: -3, marginTop: 6 }}>{winner}×</Text>
            <Text style={[T.mono, { color: C.white, fontSize: 10, marginTop: 2 }]}>{`${Math.round(((counts[winner] || 0) / total) * 100)}% MATCH · LEVEL UP`}</Text>
            {/* XP earned */}
            <View style={{ marginTop: SP.m, flexDirection: 'row', gap: SP.s, alignItems: 'center' }}>
              <View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.white }]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>+{totalXP} XP</Text>
              </View>
              <View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.white }]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.white }}>{badgeCount} BADGES</Text>
              </View>
            </View>
          </View>
        </MotiView>

        {/* Aesthetic description */}
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 300 }}>
          <View style={[{ marginTop: SP.m, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>{'> ABOUT_YOUR_AESTHETIC'}</Text>
            <Text style={[T.body, { marginTop: 6, fontSize: 13, lineHeight: 19 }]}>{AESTHETIC_DESC[winner] || 'You have a distinctive look that refuses categorization.'}</Text>
          </View>
        </MotiView>

        {/* Breakdown bars */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> FULL_BREAKDOWN'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={{ marginTop: SP.s, gap: 10 }}>
          {sorted.map(([tag, count], i) => {
            const pct = Math.round((count / total) * 100);
            return (
              <MotiView key={tag} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: 400 + i * 60 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[T.monoB, { fontSize: 9, color: C.dim }]}>{`#${i + 1}`}</Text>
                    <Text style={[T.bodyB, { fontSize: 12 }]}>{tag}</Text>
                  </View>
                  <Text style={[T.monoB, { fontSize: 10 }]}>{pct}%</Text>
                </View>
                <View style={[{ height: 12 }, BORDER(1)]}>
                  <MotiView from={{ width: '0%' }} animate={{ width: `${pct}%` as any }} transition={{ type: 'timing', duration: 700, delay: 500 + i * 60 }} style={{ height: '100%', backgroundColor: C.ink }} />
                </View>
              </MotiView>
            );
          })}
        </View>

        {/* Unlocked badges */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> BADGES_UNLOCKED'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.s }}>
          {sorted.slice(0, 3).map(([tag], i) => (
            <MotiView key={tag} from={{ scale: 0, rotate: '-20deg' }} animate={{ scale: 1, rotate: '0deg' }} transition={{ type: 'spring', delay: 700 + i * 100 }} style={{ flex: 1 }}>
              <View style={[{ padding: SP.s, backgroundColor: i === 0 ? C.ink : C.white, alignItems: 'center' }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 24, color: i === 0 ? C.white : C.ink }}>{i === 0 ? '◆' : i === 1 ? '◇' : '◈'}</Text>
                <Text style={[T.monoB, { fontSize: 9, color: i === 0 ? C.white : C.ink, marginTop: 4 }]}>{tag}</Text>
                <Text style={[T.mono, { fontSize: 8, color: i === 0 ? C.white : C.dim }]}>{['GOLD', 'SILVER', 'BRONZE'][i]}</Text>
              </View>
            </MotiView>
          ))}
        </View>

        {/* Actions */}
        <BrutalButton label="See my curated picks" iconRight="arrow-right" block onPress={onGoHome} style={{ marginTop: SP.xl }} />
        <Pressable onPress={onRetake} style={{ alignSelf: 'center', marginTop: SP.m }}>
          <Text style={[T.mono, { color: C.dim, textDecorationLine: 'underline' }]}>↺ retake quiz</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── NOTIFICATIONS ──────────────────────────────────────────
const NOTIFS = [
  { id: '1', icon: 'shopping-bag', title: 'Order out for delivery', sub: 'Arriving in 23 min', time: '2m' },
  { id: '2', icon: 'heart', title: '@maya.styles liked your post', sub: '"Spring brunch fit"', time: '1h' },
  { id: '3', icon: 'zap', title: 'Flash sale starting soon', sub: '50% off · 12 hrs only', time: '3h' },
  { id: '4', icon: 'gift', title: 'Daily reward unlocked', sub: '+70 points · Day 7 streak', time: '5h' },
  { id: '5', icon: 'tag', title: 'Price drop alert', sub: 'Cropped Cargo · -30%', time: '1d' },
  { id: '6', icon: 'user-plus', title: 'New follower', sub: '@kai.fits is now following you', time: '2d' },
];

export function NotificationsScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Notifications" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
          <Text style={[T.mono, { color: C.dim }]}>{`> ${NOTIFS.length} UPDATES`}</Text>
          <AsciiDivider style={{ marginTop: 6 }} />
        </View>
        {NOTIFS.map((n, i) => (
          <FadeInUp key={n.id} delay={i * 40}>
            <View style={{ flexDirection: 'row', padding: SP.l, alignItems: 'flex-start', borderBottomWidth: 1, borderColor: C.hairline }}>
              <View style={[{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                <Feather name={n.icon as any} size={16} color={C.ink} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[T.bodyB]}>{n.title}</Text>
                <Text style={[T.body, { color: C.dim, marginTop: 2 }]}>{n.sub}</Text>
              </View>
              <Text style={[T.mono, { color: C.dim }]}>{n.time}</Text>
            </View>
          </FadeInUp>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── VIRTUAL TRY-ON — AR + photo modes, brutalist hero layout ─────
export function TryOnScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const initialMode: 'ar' | 'photo' = route.params?.mode || 'ar';
  const incomingProduct = route.params?.product;
  const { showToast } = useApp();
  const [mode, setMode] = useState<'ar' | 'photo'>(initialMode);
  // Build the swap-strip so it always contains the product the user came from
  // (pinned first), padded with a few others for variety.
  const picks = React.useMemo(() => {
    const base = PRODUCTS.slice(0, 6);
    if (!incomingProduct) return base;
    const rest = base.filter(p => p.id !== incomingProduct.id);
    return [incomingProduct, ...rest].slice(0, 6);
  }, [incomingProduct]);
  const [pick, setPick] = useState(picks[0]);
  // If the screen gets reused with a different product param, re-point the pick.
  React.useEffect(() => {
    if (incomingProduct && incomingProduct.id !== pick?.id) {
      setPick(incomingProduct);
      setGeneratedPhoto(null);
    }
  }, [incomingProduct?.id]);

  // Live camera — permission + controls for the in-app AR try-on
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);

  // Photo try-on — user's uploaded photo acts as the mirror. When the HF model
  // runs, its generated image replaces the preview in `generatedPhoto`.
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [generatedPhoto, setGeneratedPhoto] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Copyable error inspector — every step logs, errors pop this modal open so
  // the user can copy the full trace instead of chasing disappearing toasts.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  useEffect(() => subscribeTryOnLog(setLogLines), []);
  const openErrorInspector = (msg: string) => setErrorMsg(msg);
  const copyLog = async () => {
    const text = [`ERROR: ${errorMsg || '(none)'}`, '', ...getTryOnLog()].join('\n');
    await Clipboard.setStringAsync(text);
    showToast('Copied', 'Error log on clipboard', 'copy');
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        showToast('Camera blocked', 'Enable camera access in Settings', 'camera-off');
        return;
      }
    }
    setCameraOn(true);
  };

  const uploadPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[tryOn] perm=', perm);
      if (!perm.granted) {
        Alert.alert('Gallery blocked', 'Enable photo access in Settings to upload an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });
      console.log('[tryOn] picker result=', JSON.stringify(result).slice(0, 400));
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri || typeof uri !== 'string') {
        Alert.alert('Upload failed', `Picker returned: ${JSON.stringify(result.assets?.[0] || null)}`);
        return;
      }
      setUploadedPhoto(uri);
      setGeneratedPhoto(null);
      // Force the PHOTO stage so the user can actually see their photo.
      setMode('photo');
      setCameraOn(false);
      showToast('Photo ready', 'Tap Generate to try on', 'check');
    } catch (e: any) {
      openErrorInspector(`uploadPhoto crash: ${e?.message || String(e)}`);
    }
  };

  const runTryOn = async (personUri?: string) => {
    // Guard: if this was fired as an onPress handler, `personUri` will actually
    // be the synthetic press event, not a string. Only trust string inputs.
    const explicit = typeof personUri === 'string' ? personUri : undefined;
    const uri = explicit || uploadedPhoto;
    clearTryOnLog();
    if (!uri || typeof uri !== 'string') {
      openErrorInspector(`No photo. runTryOn got: ${JSON.stringify(uri)}`);
      return;
    }
    const garment = pick?.img;
    if (!garment || typeof garment !== 'string') {
      openErrorInspector(`No garment. pick.img is: ${JSON.stringify(garment)}`);
      return;
    }
    setGenerating(true);
    setGeneratedPhoto(null);
    try {
      const outUrl = await generateTryOn(uri, garment);
      setGeneratedPhoto(outUrl);
      showToast('Try-on ready', `${pick.name} on you`, 'check');
    } catch (e: any) {
      openErrorInspector(e?.message || String(e));
    } finally {
      setGenerating(false);
    }
  };

  // AR: snap a photo from the live camera and pipe it through the same model
  const captureAndTryOn = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (!photo?.uri) return;
      setUploadedPhoto(photo.uri);
      setCameraOn(false);
      setMode('photo');
      runTryOn(photo.uri);
    } catch (e: any) {
      showToast('Capture failed', e?.message || 'Try again', 'x');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Virtual Try-On" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Mode switcher */}
        <View style={[{ flexDirection: 'row' }, BORDER(1)]}>
          {(['ar', 'photo'] as const).map(m => (
            <Pressable key={m} onPress={() => { setMode(m); if (m === 'photo') setCameraOn(false); }} style={{ flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: mode === m ? C.ink : C.white }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: mode === m ? C.white : C.ink, letterSpacing: 1 }}>
                {m === 'ar' ? 'AR · LIVE CAMERA' : 'PHOTO · UPLOAD'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Stage — live camera when AR+cameraOn, otherwise a mocked mirror preview */}
        <View style={[{ marginTop: SP.l, height: 420, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
          {mode === 'ar' && cameraOn ? (
            <>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject as any} facing={facing} />
              {/* Garment overlay — the chosen product hovers over the user's torso area */}
              <View pointerEvents="none" style={{ position: 'absolute', top: '18%', left: '10%', right: '10%', bottom: '22%' }}>
                <Image
                  source={{ uri: pick.img }}
                  style={{ width: '100%', height: '100%', opacity: 0.88 }}
                  resizeMode="contain"
                />
              </View>
              {/* In-camera HUD */}
              <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink }}>
                  <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>◉ LIVE · TRACKING</Text>
                </View>
                <Pressable onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))} hitSlop={8} style={[{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                  <Feather name="refresh-cw" size={14} color={C.ink} />
                </Pressable>
              </View>
              {/* Capture & generate — the live-camera answer to "just run try-on now" */}
              <View style={{ position: 'absolute', bottom: 70, left: 0, right: 0, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Pressable onPress={() => setCameraOn(false)} hitSlop={8} style={[{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.monoB, { fontSize: 10 }]}>CLOSE</Text>
                </Pressable>
                <Pressable onPress={() => captureAndTryOn()} hitSlop={8} style={[{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.ink }, BORDER(1)]}>
                  <Text style={[T.monoB, { fontSize: 10, color: C.white }]}>◆ CAPTURE & TRY-ON</Text>
                </Pressable>
              </View>
            </>
          ) : mode === 'photo' && uploadedPhoto ? (
            <>
              {/* Generated try-on wins over the quick overlay preview when ready */}
              {generatedPhoto ? (
                <Image
                  source={{ uri: generatedPhoto }}
                  style={StyleSheet.absoluteFillObject as any}
                  resizeMode="cover"
                  onError={(e) => openErrorInspector(`Generated image failed to load: ${e.nativeEvent?.error || 'unknown'}\nURL: ${generatedPhoto}`)}
                />
              ) : (
                <>
                  <Image
                    source={{ uri: uploadedPhoto }}
                    style={StyleSheet.absoluteFillObject as any}
                    resizeMode="cover"
                    onError={(e) => openErrorInspector(`Uploaded photo failed to load: ${e.nativeEvent?.error || 'unknown'}\nURI: ${uploadedPhoto}`)}
                  />
                  <View pointerEvents="none" style={{ position: 'absolute', top: '18%', left: '10%', right: '10%', bottom: '22%' }}>
                    <Image source={{ uri: pick.img }} style={{ width: '100%', height: '100%', opacity: 0.88 }} resizeMode="contain" />
                  </View>
                </>
              )}
              {/* Visible confirmation that the photo is loaded */}
              {!generating && !generatedPhoto && (
                <View style={{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink }}>
                  <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>◆ PHOTO LOADED</Text>
                </View>
              )}
              {/* Loading overlay while the HF Space is generating */}
              {generating && (
                <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.white, letterSpacing: -0.5 }}>GENERATING...</Text>
                  <Text style={[T.mono, { color: C.white, fontSize: 10, marginTop: 6, opacity: 0.8, textAlign: 'center' }]}>{'// AI is dressing your photo\nCan take 15–60s'}</Text>
                </View>
              )}
              <Pressable onPress={() => { setUploadedPhoto(null); setGeneratedPhoto(null); }} hitSlop={8} style={[{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                <Feather name="x" size={14} color={C.ink} />
              </Pressable>
              {generatedPhoto && !generating && (
                <View style={{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink }}>
                  <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>◆ AI TRY-ON</Text>
                </View>
              )}
            </>
          ) : (
            <Image source={{ uri: pick.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          )}
          {/* Corner marks */}
          {['┌','┐','└','┘'].map((ch, i) => (
            <Text key={i} style={[T.monoB, { position: 'absolute', ...[{top:6,left:8},{top:6,right:8},{bottom:6,left:8},{bottom:6,right:8}][i], color: C.ink, fontSize: 16 }]} pointerEvents="none">{ch}</Text>
          ))}
          {/* Static badge — hidden while live camera / uploaded preview is running */}
          {!(mode === 'ar' && cameraOn) && !(mode === 'photo' && uploadedPhoto) && (
            <View style={{ position: 'absolute', top: 10, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.ink }}>
              <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{mode === 'ar' ? '◉ TAP OPEN CAMERA' : '◆ TAP UPLOAD PHOTO'}</Text>
            </View>
          )}
          {/* Product caption */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: SP.m, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.ink }}>
            <Text style={[T.monoB, { fontSize: 9 }]}>{pick.brand}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink, marginTop: 2 }} numberOfLines={1}>{pick.name}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.m }}>
          <BrutalButton
            label={
              mode === 'ar'
                ? (cameraOn ? 'Stop camera' : 'Open camera')
                : (uploadedPhoto ? 'Change photo' : 'Upload photo')
            }
            icon={mode === 'ar' ? 'camera' : 'upload'}
            onPress={() => {
              if (mode === 'ar') {
                if (cameraOn) setCameraOn(false);
                else openCamera();
              } else {
                uploadPhoto();
              }
            }}
            variant={mode === 'photo' && uploadedPhoto ? 'outline' : undefined}
            style={{ flex: 1 }}
          />
          {mode === 'photo' && uploadedPhoto ? (
            <BrutalButton
              label={generating ? 'Generating…' : generatedPhoto ? 'Regenerate' : 'Generate try-on'}
              icon="zap"
              onPress={() => runTryOn()}
              disabled={generating}
              style={{ flex: 1 }}
            />
          ) : (
            <BrutalButton label="Save look" icon="bookmark" variant="outline" onPress={() => showToast('Saved', `${pick.name} saved to your closet`, 'bookmark')} style={{ flex: 1 }} />
          )}
        </View>

        {/* Pick a fit strip */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> SWAP FIT'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s, paddingVertical: SP.s }}>
          {picks.map(p => (
            <Pressable key={p.id} onPress={() => { setPick(p); setGeneratedPhoto(null); }} style={[{ width: 90, height: 110, backgroundColor: C.hairline, overflow: 'hidden' }, pick.id === p.id ? BORDER(2) : BORDER(1)]}>
              <Image source={{ uri: p.img }} style={{ width: '100%', height: '78%' }} resizeMode="contain" />
              <View style={{ flex: 1, paddingHorizontal: 4, justifyContent: 'center', backgroundColor: pick.id === p.id ? C.ink : C.white, borderTopWidth: 1, borderColor: C.ink }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: pick.id === p.id ? C.white : C.ink }} numberOfLines={1}>{p.brand}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* How it works */}
        <Text style={[T.monoB, { marginTop: SP.l, fontSize: 11 }]}>{'> HOW IT WORKS'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={{ marginTop: SP.s, gap: 8 }}>
          {[
            mode === 'ar' ? { icon: 'video', title: 'POINT CAMERA', desc: 'Stand in frame — we track your body.' } : { icon: 'image', title: 'UPLOAD A PIC', desc: 'Full-body shot works best.' },
            { icon: 'layers', title: 'PICK A FIT', desc: 'Swap clothes in real time.' },
            { icon: 'shopping-bag', title: 'LOVE IT? BAG IT', desc: '60-min delivery in your city.' },
          ].map((step, i) => (
            <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.m, backgroundColor: C.white, gap: 12 }, BORDER(1)]}>
              <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }}>
                <Feather name={step.icon as any} size={16} color={C.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.ink }}>{step.title}</Text>
                <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{step.desc}</Text>
              </View>
              <Text style={[T.monoB, { color: C.dim, fontSize: 10 }]}>0{i + 1}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ═══ ERROR INSPECTOR — copyable modal with full trace ═══ */}
      <Modal visible={!!errorMsg} transparent animationType="fade" onRequestClose={() => setErrorMsg(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SP.l }}>
          <View style={[{ backgroundColor: C.white, padding: SP.l, maxHeight: '85%' }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink, letterSpacing: -0.3 }}>TRY-ON FAILED</Text>
              <Pressable onPress={() => setErrorMsg(null)} hitSlop={10}>
                <Feather name="x" size={22} color={C.ink} />
              </Pressable>
            </View>
            <AsciiDivider style={{ marginTop: 8 }} />
            <Text style={[T.monoB, { marginTop: SP.m, fontSize: 10, color: C.dim }]}>{'> ERROR'}</Text>
            <TextInput
              value={errorMsg || ''}
              multiline
              editable={false}
              selectTextOnFocus
              style={[{ marginTop: 6, padding: SP.s, minHeight: 60, fontFamily: 'SpaceMono_700Bold', fontSize: 12, color: C.ink, backgroundColor: '#FAFAFA' }, BORDER(1)]}
            />
            <Text style={[T.monoB, { marginTop: SP.m, fontSize: 10, color: C.dim }]}>{`> LOG (${logLines.length})`}</Text>
            <ScrollView style={[{ maxHeight: 260, marginTop: 6, backgroundColor: '#FAFAFA' }, BORDER(1)]}>
              <TextInput
                value={logLines.join('\n') || '(no log yet)'}
                multiline
                editable={false}
                selectTextOnFocus
                style={{ padding: SP.s, fontFamily: 'SpaceMono_700Bold', fontSize: 10, color: C.ink }}
              />
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.m }}>
              <BrutalButton label="Copy all" icon="copy" onPress={() => copyLog()} style={{ flex: 1 }} />
              <BrutalButton label="Close" icon="x" variant="outline" onPress={() => setErrorMsg(null)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
