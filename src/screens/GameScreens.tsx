import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Animated, Easing, Alert, Modal, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalStatusBar, FadeInUp, CachedImage } from '../components/Brutal';
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
  const { showToast } = useApp();
  const today = 4; // 0-indexed → day 5
  const [claimed, setClaimed] = useState([true, true, true, true, false, false, false]);
  const [reward, setReward] = useState<{ label: string; sub: string } | null>(null);
  const DAYS = [
    { d: 1, rw: '+10' }, { d: 2, rw: '+20' }, { d: 3, rw: '+30' }, { d: 4, rw: '₹50' },
    { d: 5, rw: '+50' }, { d: 6, rw: '₹100' }, { d: 7, rw: '🎁' },
  ];
  const streak = claimed.filter(Boolean).length;
  const points = 374;
  const REWARD_POOL = [
    { label: '₹100 off', sub: 'On your next order' },
    { label: '50 points', sub: 'Added to your wallet' },
    { label: 'Free shipping', sub: 'Valid for 7 days' },
    { label: '15% off', sub: 'Min order ₹999' },
  ];
  const claimToday = () => {
    if (claimed[today]) return;
    const next = [...claimed]; next[today] = true; setClaimed(next);
    setReward(REWARD_POOL[today % REWARD_POOL.length]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Daily rewards" onBack={() => nav.goBack()} />

      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Streak + points */}
        <View style={{ flexDirection: 'row', gap: SP.s }}>
          <View style={[{ flex: 1, padding: SP.m, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
            <Text style={[T.micro, { color: C.dim }]}>{'Streak'}</Text>
            <Text style={[T.h1, { color: C.ink, marginTop: 2 }]}>{streak}<Text style={[T.caption, { color: C.dim }]}> days</Text></Text>
          </View>
          <View style={[{ flex: 1, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            <Text style={[T.micro, { color: C.dim }]}>{'Points'}</Text>
            <Text style={[T.h1, { marginTop: 2 }]}>{points}</Text>
          </View>
        </View>

        {/* 7-day streak track */}
        <Text style={[T.caption, { marginTop: SP.xl, marginBottom: SP.s }]}>7-day streak</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s, paddingVertical: 4 }}>
          {DAYS.map((day, i) => {
            const got = claimed[i];
            const isToday = i === today;
            return (
              <View key={i} style={[{ width: 70, paddingVertical: SP.m, alignItems: 'center', gap: 7, backgroundColor: got ? '#F4F4F4' : C.white }, BORDER(isToday ? 2 : 1)]}>
                <Text style={[T.micro, { color: C.dim }]}>Day {day.d}</Text>
                {got ? <Feather name="check" size={18} color={C.ink} /> : isToday ? <Feather name="gift" size={18} color={C.ink} /> : <Feather name="lock" size={13} color={C.dim} />}
                <Text style={[T.caption, { color: C.ink }]}>{day.rw}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Today's reward */}
        <View style={[{ marginTop: SP.l, padding: SP.l, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
          <Text style={[T.micro, { color: C.dim }]}>{`Today · Day ${today + 1}`}</Text>
          {claimed[today] ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Feather name="check" size={20} color={C.ink} />
              <Text style={[T.h1, { color: C.ink, textTransform: 'uppercase' }]}>Claimed</Text>
            </View>
          ) : (
            <Text style={[T.h1, { color: C.ink, marginTop: 4, textTransform: 'uppercase' }]}>{`${DAYS[today].rw} points`}</Text>
          )}
          <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>Come back daily — bigger rewards each day you keep the streak.</Text>
          <Pressable onPress={claimToday} disabled={claimed[today]} style={[{ marginTop: SP.m, paddingVertical: 15, alignItems: 'center', backgroundColor: claimed[today] ? C.white : C.ink }, BORDER(1)]}>
            <Text style={[T.button, { color: claimed[today] ? C.dim : C.white }]}>{claimed[today] ? 'Come back tomorrow' : 'Claim today'}</Text>
          </Pressable>
        </View>

        {/* Countdown */}
        <View style={[{ marginTop: SP.l, padding: SP.l, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
          <Text style={[T.micro]}>Next reward unlocks in</Text>
          <Text style={[T.monoB, { fontSize: rf(24), letterSpacing: 3, marginTop: 6 }]}>09:12:22</Text>
        </View>

        {/* Bonus spin */}
        <Pressable onPress={() => nav.navigate('SpinWheel')} style={[{ marginTop: SP.l, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white }, BORDER(1)]}>
          <View style={[{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
            <Feather name="rotate-cw" size={18} color={C.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.h3]}>Free Spin & Win</Text>
            <Text style={[T.micro, { marginTop: 2 }]}>Spin the wheel · up to 80% off</Text>
          </View>
          <Feather name="arrow-right" size={18} color={C.ink} />
        </Pressable>
      </ScrollView>

      {/* REWARD REVEAL MODAL — gift pops, then the prize reveals */}
      <Modal visible={reward !== null} transparent animationType="fade" onRequestClose={() => setReward(null)}>
        <Pressable onPress={() => setReward(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
          <MotiView from={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'timing', duration: 220 }} onStartShouldSetResponder={() => true} style={[{ width: '100%', maxWidth: 360, backgroundColor: C.white, padding: SP.xl, alignItems: 'center' }, BORDER(2)]}>
            <MotiView from={{ scale: 0, rotate: '-25deg' }} animate={{ scale: 1, rotate: '0deg' }} transition={{ type: 'spring', delay: 120, damping: 9 }}>
              <Ionicons name="gift" size={80} color={C.ink} />
            </MotiView>
            <Text style={[T.micro, { marginTop: SP.m }]}>You unlocked</Text>
            <MotiView from={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 380 }}>
              <Text style={[T.h1, { marginTop: 4, textAlign: 'center', textTransform: 'uppercase' }]}>{reward?.label}</Text>
            </MotiView>
            <Text style={[T.body, { color: C.dim, marginTop: 4 }]}>{reward?.sub}</Text>
            <Pressable onPress={() => { showToast('Claimed', (reward?.label || '') + ' added to your account', 'gift'); setReward(null); }} style={[{ marginTop: SP.l, alignSelf: 'stretch', paddingVertical: 14, alignItems: 'center', backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={[T.button, { color: C.white }]}>Awesome</Text>
            </Pressable>
          </MotiView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── SPIN WHEEL — Brutalist wheel + history + power-ups ─────
const SLICES = [
  { label: '10% off', weight: 3 },
  { label: '₹100', weight: 2 },
  { label: 'Try again', weight: 3 },
  { label: '20% off', weight: 2 },
  { label: '50 pts', weight: 3 },
  { label: 'Free ship', weight: 2 },
  { label: '₹500', weight: 1 },
  { label: 'Better luck', weight: 3 },
];
const INITIAL_HISTORY = [
  { prize: '10% off', user: 'YOU', date: '3d' },
  { prize: '50 pts', user: 'YOU', date: '5d' },
  { prize: 'Try again', user: 'YOU', date: '1w' },
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
    const pool = boost ? SLICES.filter(s => !s.label.includes('again') && !s.label.includes('luck')) : SLICES;
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
          <View style={[{ flex: 1, padding: SP.m, backgroundColor: '#F4F4F4', borderRightWidth: 1, borderColor: C.hairline }]}>
            <Text style={[T.micro, { color: C.dim }]}>{'Spins left'}</Text>
            <Text style={[T.h1, { fontSize: rf(44), color: C.ink, marginTop: 2, lineHeight: rf(46) }]}>{spinsLeft}<Text style={[T.h3, { color: C.dim }]}>/3</Text></Text>
          </View>
          <View style={{ flex: 1, padding: SP.m }}>
            <Text style={[T.micro, { color: C.dim }]}>{'Jackpot odds'}</Text>
            <Text style={[T.h2, { marginTop: 2, textTransform: 'uppercase' }]}>1 in 19</Text>
            <Text style={[T.micro, { marginTop: 2 }]}>₹500 slice</Text>
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
                  <Text style={[T.micro, { color: C.white }]}>Win</Text>
                </View>
                <View style={{ width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 20, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.ink, marginTop: -1 }} />
              </View>

              {/* ROTATING wheel — just slices + dividers */}
              <Animated.View style={{ marginTop: 18, width: WHEEL, height: WHEEL, transform: [{ rotate }] }}>
                <View style={{ width: WHEEL, height: WHEEL, borderRadius: R, overflow: 'hidden', borderWidth: 3, borderColor: C.hairline, backgroundColor: C.ink }}>
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
                          <Text style={[T.caption, { color: isDark ? C.white : C.ink }]}>{s.label}</Text>
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
              <View pointerEvents="none" style={{ position: 'absolute', top: 18 + R - 34, left: 20 + R - 34, width: 68, height: 68, borderRadius: 34, backgroundColor: C.white, borderWidth: 3, borderColor: C.hairline, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[T.micro, { color: C.white }]}>Spin</Text>
                  <Text style={[T.micro, { color: C.white, marginTop: -2 }]}>& win</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {result && !spinning && (
          <MotiView from={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}>
            <View style={[{ marginTop: SP.l, padding: SP.l, alignItems: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
              <Text style={[T.micro, { color: C.dim }]}>{'Spin result'}</Text>
              <Text style={[T.h1, { color: C.ink, marginTop: 6, textTransform: 'uppercase' }]}>{result}</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[T.bodyB, { color: boost ? C.white : C.ink }]}>Lucky boost</Text>
              {boost && <><Feather name="check" size={13} color={C.white} /><Text style={[T.micro, { color: C.white }]}>Active</Text></>}
            </View>
            <Text style={[T.micro, { color: boost ? C.white : C.dim, marginTop: 2 }]}>Spend 100 pts → remove "try again" slices</Text>
          </View>
          {!boost && <Text style={[T.caption, { color: C.ink }]}>─100</Text>}
        </Pressable>

        {/* Spin action */}
        <Pressable
          onPress={spin}
          disabled={spinning || spinsLeft === 0}
          style={[{ marginTop: SP.m, padding: SP.l, alignItems: 'center', backgroundColor: spinsLeft === 0 ? C.hairline : C.ink }, BORDER(1)]}
        >
          <Text style={[T.button, { color: spinsLeft === 0 ? C.dim : C.white }]}>
            {spinning ? 'Spinning...' : spinsLeft === 0 ? 'Come back tomorrow' : `Spin now (${spinsLeft} left)`}
          </Text>
        </Pressable>

        {/* History */}
        <Text style={[T.caption, { marginTop: SP.xl }]}>{'Recent spins'}</Text>
        <View style={{ marginTop: SP.s }}>
          {history.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: C.hairline }}>
              <Text style={[T.micro, { width: 30 }]}>{`#${i + 1}`}</Text>
              <Text style={[T.bodyB, { flex: 1 }]}>{h.prize}</Text>
              <Text style={[T.micro]}>{h.date}</Text>
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
    kind: 'swipe', prompt: 'Oversized fits?',
    card: { label: 'Oversized', sub: 'Loose, baggy silhouettes', img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80', tags: ['STREET', 'UTILITY'] },
  },
  {
    kind: 'pair', prompt: 'Pick your weekend fit',
    a: { label: 'Minimal', sub: 'Clean · neutral · sharp', img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', tags: ['MINIMAL', 'CLASSIC'] },
    b: { label: 'Maximal', sub: 'Layered · loud · bold', img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80', tags: ['CHAOS', 'STREET'] },
  },
  {
    kind: 'grid', prompt: "Which is you?",
    opts: [
      { label: 'Cargo', img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80', tags: ['STREET', 'UTILITY'] },
      { label: 'Preppy', img: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80', tags: ['PREPPY', 'CLASSIC'] },
      { label: 'Goth', img: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=400&q=80', tags: ['GOTH', 'MINIMAL'] },
      { label: 'Soft', img: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80', tags: ['COQUETTE', 'SOFT'] },
    ],
  },
  {
    kind: 'colors', prompt: 'Pick 3 colors you live in', pick: 3,
    palette: [
      { hex: '#000000', tag: 'MINIMAL', name: 'Ink' },
      { hex: '#FFFFFF', tag: 'MINIMAL', name: 'Paper' },
      { hex: '#C9A87C', tag: 'CLASSIC', name: 'Taupe' },
      { hex: '#E8D5C4', tag: 'SOFT', name: 'Cream' },
      { hex: '#FF6B9D', tag: 'COQUETTE', name: 'Pink' },
      { hex: '#FEC53D', tag: 'CHAOS', name: 'Mustard' },
      { hex: '#5D4037', tag: 'UTILITY', name: 'Olive' },
      { hex: '#A78BFA', tag: 'CHAOS', name: 'Lilac' },
      { hex: '#2980B9', tag: 'PREPPY', name: 'Denim' },
    ],
  },
  {
    kind: 'slider', prompt: 'How bold do you go?',
    left: 'Subtle', right: 'Loud',
    leftTag: 'MINIMAL', rightTag: 'CHAOS',
  },
  {
    kind: 'chips', prompt: 'Pick 3 words that describe you', pick: 3,
    opts: [
      { word: 'Clean', tag: 'MINIMAL' },
      { word: 'Loud', tag: 'CHAOS' },
      { word: 'Rebel', tag: 'STREET' },
      { word: 'Soft', tag: 'COQUETTE' },
      { word: 'Sharp', tag: 'CLASSIC' },
      { word: 'Raw', tag: 'UTILITY' },
      { word: 'Dark', tag: 'GOTH' },
      { word: 'Playful', tag: 'CHAOS' },
      { word: 'Archive', tag: 'PREPPY' },
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
          <View style={[{ padding: SP.s, backgroundColor: '#F4F4F4', borderRightWidth: 1, borderColor: C.hairline }]}>
            <Text style={[T.micro, { color: C.ink }]}>{`Q${step + 1}/${QUIZ.length}`}</Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
            <Text style={[T.micro, { marginRight: 8 }]}>XP</Text>
            <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
              {[...Array(QUIZ.length)].map((_, i) => (
                <View key={i} style={{ flex: 1, height: 8, backgroundColor: i < step ? C.ink : i === step ? C.ink : C.hairline }} />
              ))}
            </View>
            <Text style={[T.caption, { color: C.ink, marginLeft: 8 }]}>+{step * XP_PER_Q}</Text>
          </View>
        </View>

        {/* Floating XP pop */}
        {xpPop !== null && (
          <MotiView from={{ opacity: 0, translateY: 0, scale: 0.8 }} animate={{ opacity: 1, translateY: -30, scale: 1.2 }} transition={{ type: 'timing', duration: 700 }} style={{ position: 'absolute', top: 80, right: 30, zIndex: 50 }}>
            <View style={[{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={[T.bodyB, { color: C.white }]}>+{xpPop} XP</Text>
            </View>
          </MotiView>
        )}

        {/* Prompt */}
        <MotiView key={step} from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          <Text style={[T.micro, { color: C.dim, marginTop: SP.l }]}>{`Question ${(step + 1).toString().padStart(2, '0')}`}</Text>
          <Text style={[T.h1, { marginTop: 4, textTransform: 'uppercase' }]}>{q.prompt}</Text>
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
        <CachedImage source={{ uri: q.card.img }} style={{ width: '100%', height: '70%' }} resizeMode="cover" />
        <View style={{ padding: SP.m }}>
          <Text style={[T.h1]}>{q.card.label}</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 2 }]}>{q.card.sub}</Text>
        </View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 30, left: 20, opacity: x.interpolate({ inputRange: [-200, -20, 0], outputRange: [1, 0, 0] }), transform: [{ rotate: '-18deg' }] }}>
          <View style={[{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.ink }, BORDER(1)]}><Text style={[T.h1, { color: C.white }]}>Nope</Text></View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 30, right: 20, opacity: x.interpolate({ inputRange: [0, 20, 200], outputRange: [0, 0, 1] }), transform: [{ rotate: '18deg' }] }}>
          <View style={[{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.ink }, BORDER(1)]}><Text style={[T.h1, { color: C.white }]}>Vibe</Text></View>
        </Animated.View>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: SP.m, marginTop: SP.m }}>
        <Pressable onPress={() => choose(false)} style={[{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.white, flexDirection: 'row', justifyContent: 'center', gap: 8 }, BORDER(1)]}>
          <Feather name="x" size={20} color={C.ink} />
          <Text style={[T.button, { color: C.ink }]}>Skip</Text>
        </Pressable>
        <Pressable onPress={() => choose(true)} style={[{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.ink, flexDirection: 'row', justifyContent: 'center', gap: 8 }, BORDER(1)]}>
          <Feather name="heart" size={20} color={C.white} />
          <Text style={[T.button, { color: C.white }]}>Vibe</Text>
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
        <CachedImage source={{ uri: o.img }} style={{ width: '100%', height: '70%', opacity: tapped === k ? 0.6 : 1 }} resizeMode="cover" />
        <View style={{ padding: SP.s }}>
          <Text style={[T.h3, { color: tapped === k ? C.white : C.ink }]}>{o.label}</Text>
          <Text style={[T.micro, { color: tapped === k ? C.white : C.dim, marginTop: 2 }]}>{o.sub}</Text>
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
          <View style={[{ width: 40, height: 40, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
            <Text style={[T.caption, { color: C.ink }]}>VS</Text>
          </View>
        </View>
        {tile('b', q.b)}
      </View>
      <Text style={[T.micro, { textAlign: 'center', marginTop: SP.s }]}>Tap the side that's more you</Text>
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
            <CachedImage source={{ uri: o.img }} style={{ width: '100%', height: '75%', opacity: tapped === i ? 0.5 : 1 }} resizeMode="cover" />
            <View style={{ padding: 6, alignItems: 'center' }}>
              <Text style={[T.caption, { color: tapped === i ? C.white : C.ink }]}>{o.label}</Text>
            </View>
            <View style={[{ position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: tapped === i ? C.white : C.ink }]}>
              <Text style={[T.micro, { color: tapped === i ? C.ink : C.white }]}>{`0${i + 1}`}</Text>
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
                    <Text style={[T.micro, { color: C.white }]}>{idx + 1}</Text>
                  </View>
                )}
                <View style={[{ paddingHorizontal: 4, paddingVertical: 2, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.micro, { color: C.ink }]}>{c.name}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={[T.micro, { marginTop: SP.s, textAlign: 'center' }]}>{picked.length}/{q.pick} selected</Text>
      <Pressable onPress={submit} disabled={picked.length !== q.pick} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: picked.length === q.pick ? C.ink : C.hairline }, BORDER(1)]}>
        <Text style={[T.button, { color: picked.length === q.pick ? C.white : C.dim }]}>Lock in palette</Text>
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
      <View style={[{ padding: SP.l, backgroundColor: '#F4F4F4', alignItems: 'center' }, BORDER(1)]}>
        <Text style={[T.h1, { fontSize: rf(48), color: C.ink, letterSpacing: -1, lineHeight: rf(52) }]}>{Math.round(val)}</Text>
        <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>{val < 40 ? q.left : val > 60 ? q.right : 'Balanced'}</Text>
      </View>
      {/* Slider track */}
      <View style={{ marginTop: SP.l, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[T.caption, { color: C.ink, width: 60 }]}>{q.left}</Text>
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
        <Text style={[T.caption, { color: C.ink, width: 60, textAlign: 'right' }]}>{q.right}</Text>
      </View>
      <Text style={[T.micro, { marginTop: SP.s, textAlign: 'center' }]}>Drag the block</Text>
      <Pressable onPress={submit} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: C.ink }, BORDER(1)]}>
        <Text style={[T.button, { color: C.white }]}>Lock in</Text>
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
                {on && <Text style={[T.caption, { color: C.white }]}>{idx + 1}</Text>}
                <Text style={[T.caption, { color: on ? C.white : C.ink }]}>{o.word}</Text>
              </MotiView>
            </Pressable>
          );
        })}
      </View>
      <Text style={[T.micro, { marginTop: SP.s, textAlign: 'center' }]}>{picked.length}/{q.pick} selected</Text>
      <Pressable onPress={submit} disabled={picked.length !== q.pick} style={[{ marginTop: SP.m, padding: SP.m, alignItems: 'center', backgroundColor: picked.length === q.pick ? C.ink : C.hairline }, BORDER(1)]}>
        <Text style={[T.button, { color: picked.length === q.pick ? C.white : C.dim }]}>Lock in</Text>
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
          <View style={[{ padding: SP.l, backgroundColor: '#F4F4F4', alignItems: 'center' }, BORDER(1)]}>
            <Text style={[T.micro, { color: C.dim }]}>{'Your aesthetic'}</Text>
            <Text style={[T.h1, { fontSize: rf(48), color: C.ink, letterSpacing: -1, marginTop: 6, textTransform: 'uppercase' }]}>{winner}×</Text>
            <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{`${Math.round(((counts[winner] || 0) / total) * 100)}% match · level up`}</Text>
            {/* XP earned */}
            <View style={{ marginTop: SP.m, flexDirection: 'row', gap: SP.s, alignItems: 'center' }}>
              <View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.ink }]}>
                <Text style={[T.bodyB, { color: C.white }]}>+{totalXP} XP</Text>
              </View>
              <View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.bodyB, { color: C.ink }]}>{badgeCount} badges</Text>
              </View>
            </View>
          </View>
        </MotiView>

        {/* Aesthetic description */}
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 300 }}>
          <View style={[{ marginTop: SP.m, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            <Text style={[T.micro]}>{'About your aesthetic'}</Text>
            <Text style={[T.body, { marginTop: 6 }]}>{AESTHETIC_DESC[winner] || 'You have a distinctive look that refuses categorization.'}</Text>
          </View>
        </MotiView>

        {/* Breakdown bars */}
        <Text style={[T.caption, { marginTop: SP.xl }]}>{'Full breakdown'}</Text>
        <View style={{ marginTop: SP.s, gap: 10 }}>
          {sorted.map(([tag, count], i) => {
            const pct = Math.round((count / total) * 100);
            return (
              <MotiView key={tag} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: 400 + i * 60 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[T.micro]}>{`#${i + 1}`}</Text>
                    <Text style={[T.bodyB]}>{tag}</Text>
                  </View>
                  <Text style={[T.caption, { color: C.ink }]}>{pct}%</Text>
                </View>
                <View style={[{ height: 12 }, BORDER(1)]}>
                  <MotiView from={{ width: '0%' }} animate={{ width: `${pct}%` as any }} transition={{ type: 'timing', duration: 700, delay: 500 + i * 60 }} style={{ height: '100%', backgroundColor: C.ink }} />
                </View>
              </MotiView>
            );
          })}
        </View>

        {/* Unlocked badges */}
        <Text style={[T.caption, { marginTop: SP.xl }]}>{'Badges unlocked'}</Text>
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.s }}>
          {sorted.slice(0, 3).map(([tag], i) => (
            <MotiView key={tag} from={{ scale: 0, rotate: '-20deg' }} animate={{ scale: 1, rotate: '0deg' }} transition={{ type: 'spring', delay: 700 + i * 100 }} style={{ flex: 1 }}>
              <View style={[{ padding: SP.s, backgroundColor: i === 0 ? '#F4F4F4' : C.white, alignItems: 'center' }, BORDER(1)]}>
                <Feather name="award" size={26} color={C.ink} />
                <Text style={[T.micro, { color: C.ink, marginTop: 4 }]}>{tag}</Text>
                <Text style={[T.micro, { color: C.dim }]}>{['Gold', 'Silver', 'Bronze'][i]}</Text>
              </View>
            </MotiView>
          ))}
        </View>

        {/* Actions */}
        <BrutalButton label="See my curated picks" iconRight="arrow-right" block onPress={onGoHome} style={{ marginTop: SP.xl }} />
        <Pressable onPress={onRetake} style={{ alignSelf: 'center', marginTop: SP.m, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="rotate-ccw" size={13} color={C.ink} />
          <Text style={[T.caption, { color: C.ink }]}>Retake quiz</Text>
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
          <Text style={[T.micro]}>{`${NOTIFS.length} updates`}</Text>
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
              <Text style={[T.micro]}>{n.time}</Text>
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
              <Text style={[T.caption, { color: mode === m ? C.white : C.ink }]}>
                {m === 'ar' ? 'AR · Live camera' : 'Photo · Upload'}
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
                <CachedImage
                  source={{ uri: pick.img }}
                  style={{ width: '100%', height: '100%', opacity: 0.88 }}
                  resizeMode="contain"
                />
              </View>
              {/* In-camera HUD */}
              <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.micro, { color: C.ink }]}>Live · tracking</Text>
                </View>
                <Pressable onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))} hitSlop={8} style={[{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                  <Feather name="refresh-cw" size={14} color={C.ink} />
                </Pressable>
              </View>
              {/* Capture & generate — the live-camera answer to "just run try-on now" */}
              <View style={{ position: 'absolute', bottom: 70, left: 0, right: 0, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Pressable onPress={() => setCameraOn(false)} hitSlop={8} style={[{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.caption, { color: C.ink }]}>Close</Text>
                </Pressable>
                <Pressable onPress={() => captureAndTryOn()} hitSlop={8} style={[{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.ink }, BORDER(1)]}>
                  <Text style={[T.caption, { color: C.white }]}>Capture & try-on</Text>
                </Pressable>
              </View>
            </>
          ) : mode === 'photo' && uploadedPhoto ? (
            <>
              {/* Generated try-on wins over the quick overlay preview when ready */}
              {generatedPhoto ? (
                <CachedImage
                  source={{ uri: generatedPhoto }}
                  style={StyleSheet.absoluteFillObject as any}
                  resizeMode="cover"
                  onError={(e: any) => openErrorInspector(`Generated image failed to load: ${e.nativeEvent?.error || 'unknown'}\nURL: ${generatedPhoto}`)}
                />
              ) : (
                <>
                  <CachedImage
                    source={{ uri: uploadedPhoto }}
                    style={StyleSheet.absoluteFillObject as any}
                    resizeMode="cover"
                    onError={(e: any) => openErrorInspector(`Uploaded photo failed to load: ${e.nativeEvent?.error || 'unknown'}\nURI: ${uploadedPhoto}`)}
                  />
                  <View pointerEvents="none" style={{ position: 'absolute', top: '18%', left: '10%', right: '10%', bottom: '22%' }}>
                    <CachedImage source={{ uri: pick.img }} style={{ width: '100%', height: '100%', opacity: 0.88 }} resizeMode="contain" />
                  </View>
                </>
              )}
              {/* Visible confirmation that the photo is loaded */}
              {!generating && !generatedPhoto && (
                <View style={[{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.micro, { color: C.ink }]}>Photo loaded</Text>
                </View>
              )}
              {/* Loading overlay while the HF Space is generating */}
              {generating && (
                <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}>
                  <Text style={[T.h1, { color: C.white }]}>Generating...</Text>
                  <Text style={[T.micro, { color: C.white, marginTop: 6, opacity: 0.8, textAlign: 'center' }]}>{'AI is dressing your photo\nCan take 15–60s'}</Text>
                </View>
              )}
              <Pressable onPress={() => { setUploadedPhoto(null); setGeneratedPhoto(null); }} hitSlop={8} style={[{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                <Feather name="x" size={14} color={C.ink} />
              </Pressable>
              {generatedPhoto && !generating && (
                <View style={[{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.micro, { color: C.ink }]}>AI try-on</Text>
                </View>
              )}
            </>
          ) : (
            <CachedImage source={{ uri: pick.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          )}
          {/* Corner frame — thin hairline ticks */}
          {[{top:6,left:8},{top:6,right:8},{bottom:6,left:8},{bottom:6,right:8}].map((pos, i) => (
            <View key={i} pointerEvents="none" style={{ position: 'absolute', ...pos, width: 14, height: 14, borderColor: C.ink, borderTopWidth: i < 2 ? 2 : 0, borderBottomWidth: i >= 2 ? 2 : 0, borderLeftWidth: i % 2 === 0 ? 2 : 0, borderRightWidth: i % 2 === 1 ? 2 : 0 }} />
          ))}
          {/* Static badge — hidden while live camera / uploaded preview is running */}
          {!(mode === 'ar' && cameraOn) && !(mode === 'photo' && uploadedPhoto) && (
            <View style={[{ position: 'absolute', top: 10, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={[T.micro, { color: C.ink }]}>{mode === 'ar' ? 'Tap open camera' : 'Tap upload photo'}</Text>
            </View>
          )}
          {/* Product caption */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: SP.m, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.hairline }}>
            <Text style={[T.micro, { color: C.ink }]}>{pick.brand}</Text>
            <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={1}>{pick.name}</Text>
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
        <Text style={[T.caption, { marginTop: SP.xl }]}>{'Swap fit'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s, paddingVertical: SP.s }}>
          {picks.map(p => (
            <Pressable key={p.id} onPress={() => { setPick(p); setGeneratedPhoto(null); }} style={[{ width: 90, height: 110, backgroundColor: C.hairline, overflow: 'hidden' }, pick.id === p.id ? BORDER(2) : BORDER(1)]}>
              <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '78%' }} resizeMode="contain" />
              <View style={{ flex: 1, paddingHorizontal: 4, justifyContent: 'center', backgroundColor: pick.id === p.id ? C.ink : C.white, borderTopWidth: 1, borderColor: C.hairline }}>
                <Text style={[T.micro, { color: pick.id === p.id ? C.white : C.ink }]} numberOfLines={1}>{p.brand}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* How it works */}
        <Text style={[T.caption, { marginTop: SP.l }]}>{'How it works'}</Text>
        <View style={{ marginTop: SP.s, gap: 8 }}>
          {[
            mode === 'ar' ? { icon: 'video', title: 'Point camera', desc: 'Stand in frame — we track your body.' } : { icon: 'image', title: 'Upload a pic', desc: 'Full-body shot works best.' },
            { icon: 'layers', title: 'Pick a fit', desc: 'Swap clothes in real time.' },
            { icon: 'shopping-bag', title: 'Love it? Bag it', desc: '60-min delivery in your city.' },
          ].map((step, i) => (
            <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.m, backgroundColor: C.white, gap: 12 }, BORDER(1)]}>
              <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                <Feather name={step.icon as any} size={16} color={C.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyB]}>{step.title}</Text>
                <Text style={[T.micro, { marginTop: 2 }]}>{step.desc}</Text>
              </View>
              <Text style={[T.micro]}>0{i + 1}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ═══ ERROR INSPECTOR — copyable modal with full trace ═══ */}
      <Modal visible={!!errorMsg} transparent animationType="fade" onRequestClose={() => setErrorMsg(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SP.l }}>
          <View style={[{ backgroundColor: C.white, padding: SP.l, maxHeight: '85%' }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[T.h3]}>Try-on failed</Text>
              <Pressable onPress={() => setErrorMsg(null)} hitSlop={10}>
                <Feather name="x" size={22} color={C.ink} />
              </Pressable>
            </View>
            <Text style={[T.micro, { color: C.dim, marginTop: SP.m }]}>{'Error'}</Text>
            <TextInput
              value={errorMsg || ''}
              multiline
              editable={false}
              selectTextOnFocus
              style={[T.body, { marginTop: 6, padding: SP.s, minHeight: 60, backgroundColor: '#F4F4F4', color: C.ink }, BORDER(1)]}
            />
            <Text style={[T.micro, { color: C.dim, marginTop: SP.m }]}>{`Log (${logLines.length})`}</Text>
            <ScrollView style={[{ maxHeight: 260, marginTop: 6, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
              <TextInput
                value={logLines.join('\n') || '(no log yet)'}
                multiline
                editable={false}
                selectTextOnFocus
                style={[T.mono, { padding: SP.s, color: C.ink }]}
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
