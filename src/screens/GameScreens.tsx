import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Animated, Easing, Alert, Modal, TextInput, RefreshControl, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalStatusBar, FadeInUp, CachedImage } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { generateTryOn, subscribeTryOnLog, clearTryOnLog, getTryOnLog, TryOnAuthRequiredError } from '../services/tryOn';
import { getProductDetail, type ProductDetailData } from '../services/catalog';
import {
  listNotifications, markNotificationRead, markAllNotificationsRead,
  type NotificationRow,
} from '../services/notifications';
import {
  getWheel as getSpinWheel, play, claim as claimPrize, setPendingClaim, listRewards,
  type SpinWheel as SpinWheelData, type SpinResult, type Reward,
} from '../services/spin';

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
    // Day 7 was a 🎁 emoji — the one non-icon glyph in the app. 'GIFT' keeps
    // the calendar cell typographic like every other day label.
    { d: 5, rw: '+50' }, { d: 6, rw: '₹100' }, { d: 7, rw: 'GIFT' },
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

// ─── SPIN WHEEL — the full-screen wheel, driven by the server ───
//
// This screen used to hold its own prize table (`SLICES`), its own weights, a fake
// "Jackpot odds 1 in 19", a seeded history of spins that never happened, and a
// "Lucky boost" that claimed to spend 100 points but only toggled a boolean. All
// of it was local: the outcome came from `Math.random()` and the win was never
// recorded anywhere.
//
// Now the slices, the odds, the spin allowance and the outcome all come from the
// backend, and a win is a real single-use code (or real points) on the account.

type SpinScreenState = {
  wheel: SpinWheelData | null;
  loading: boolean;
  error: boolean;
};

export function SpinWheelScreen() {
  const nav = useNavigation<any>();
  const { showToast, requireAuth, token } = useApp();
  const rotation = useRef(new Animated.Value(0)).current;

  const [state, setState] = useState<SpinScreenState>({ wheel: null, loading: true, error: false });
  const [result, setResult] = useState<SpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimedPrize, setClaimedPrize] = useState<{ code: string | null; points: number | null } | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const wheel = await getSpinWheel('screen');
      setState({ wheel, loading: false, error: false });
    } catch {
      setState({ wheel: null, loading: false, error: true });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Real history, replacing the three hardcoded rows: the codes this account has
  // actually been given. Guests have none, which is the honest answer.
  const loadRewards = useCallback(async () => {
    if (!token) { setRewards([]); return; }
    try { setRewards(await listRewards()); } catch { /* leave the list as it was */ }
  }, [token]);

  useEffect(() => { void loadRewards(); }, [loadRewards]);

  const wheel = state.wheel;
  const segments = wheel?.segments ?? [];
  const spinsLeft = wheel?.spinsLeftToday ?? 0;

  const spin = async () => {
    if (spinning || !wheel || spinsLeft <= 0 || result) return;
    setSpinning(true);
    let outcome: SpinResult;
    try {
      outcome = await play('screen');
    } catch (e: any) {
      setSpinning(false);
      showToast(
        e?.code === 'already_spun' ? 'No spins left' : "Couldn't spin",
        e?.code === 'already_spun' ? 'Come back tomorrow for another go.' : 'Check your connection and try again.',
        'x',
      );
      return;
    }

    // Slice i's centre sits at (i * sliceDeg) clockwise from the top when the wheel
    // is unrotated, and the pointer is at 12 o'clock — so landing slice `idx` under
    // it means rotating by -idx * sliceDeg (mod 360). The index is the server's.
    const sliceDeg = 360 / Math.max(segments.length, 1);
    const jitter = (Math.random() - 0.5) * sliceDeg * 0.7;
    const target = 360 * 6 + (360 - outcome.segmentIndex * sliceDeg) + jitter;

    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: target,
      duration: 3800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setResult(outcome);
      if (outcome.prize) {
        setClaimedPrize({ code: outcome.prize.code, points: outcome.prize.points });
        void loadRewards();
      }
      setState((s) => (s.wheel ? { ...s, wheel: { ...s.wheel, spinsLeftToday: Math.max(0, s.wheel.spinsLeftToday - 1) } } : s));
    });
  };

  const runClaim = async (tokenStr: string) => {
    setClaiming(true);
    try {
      const res = await claimPrize(tokenStr);
      if (res.prize) {
        setClaimedPrize({ code: res.prize.code, points: res.prize.points });
        if (res.prize.code) showToast('Prize claimed', `Code ${res.prize.code} — apply it at checkout`, 'gift');
        else if (res.prize.points) showToast('Prize claimed', `${res.prize.points} points added`, 'gift');
        void loadRewards();
      }
    } catch {
      showToast("Couldn't claim", 'Try again in a moment.', 'x');
    } finally {
      setClaiming(false);
    }
  };

  const onClaimPress = () => {
    const t = result?.claimToken;
    if (!result?.won || !t || claimedPrize) return;
    if (result.requiresLogin) {
      setPendingClaim(t);
      requireAuth(() => { void runClaim(t); });
      return;
    }
    void runClaim(t);
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  // ── Empty / error states, before anything can be drawn ──
  if (state.loading || state.error || !wheel || segments.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <BrutalStatusBar />
        <ScreenHeader title="Spin & Win" onBack={() => nav.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}>
          <Text style={[T.h2, { textAlign: 'center', textTransform: 'uppercase' }]}>
            {state.loading ? 'Loading…' : state.error ? 'Could not load' : 'Nothing running'}
          </Text>
          <Text style={[T.caption, { color: C.dim, marginTop: SP.s, textAlign: 'center' }]}>
            {state.loading ? 'Fetching today’s wheel.'
              : state.error ? 'Check your connection and try again.'
              : 'There’s no wheel running right now. Check back soon.'}
          </Text>
          {!state.loading && (
            <Pressable onPress={() => void load()} style={[{ marginTop: SP.l, paddingHorizontal: SP.l, paddingVertical: SP.m, backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={[T.button, { color: C.white }]}>Try again</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const available = rewards.filter((r) => r.state === 'available');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Spin & Win" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Counter strip */}
        <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
          <View style={[{ flex: 1, padding: SP.m, backgroundColor: '#F4F4F4', borderRightWidth: 1, borderColor: C.hairline }]}>
            <Text style={[T.micro, { color: C.dim }]}>{'Spins left'}</Text>
            <Text style={[T.h1, { fontSize: rf(44), color: C.ink, marginTop: 2, lineHeight: rf(46) }]}>{spinsLeft}</Text>
            <Text style={[T.micro, { marginTop: 2 }]}>{spinsLeft > 0 ? 'today' : 'back tomorrow'}</Text>
          </View>
          <View style={{ flex: 1, padding: SP.m }}>
            <Text style={[T.micro, { color: C.dim }]}>{'Your prizes'}</Text>
            <Text style={[T.h1, { fontSize: rf(44), color: C.ink, marginTop: 2, lineHeight: rf(46) }]}>
              {token ? available.length : '—'}
            </Text>
            <Text style={[T.micro, { marginTop: 2 }]}>{token ? 'ready to use' : 'sign in to collect'}</Text>
          </View>
        </View>

        {/* Wheel assembly */}
        {(() => {
          const WHEEL = 300;
          const R = WHEEL / 2;
          const N = segments.length;
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
                  {segments.map((s, i) => {
                    const rot = i * sliceAngle;
                    // The admin may set a colour per slice; otherwise keep the
                    // screen's original alternating ink/white rhythm.
                    const fill = s.colorHex ?? (i % 2 === 0 ? C.ink : C.white);
                    const onDark = !s.colorHex && i % 2 === 0;
                    return (
                      <View key={s.id} style={{ position: 'absolute', width: WHEEL, height: WHEEL, transform: [{ rotate: `${rot}deg` }] }}>
                        <View style={{
                          position: 'absolute',
                          left: R - halfBase,
                          top: R - L,
                          width: 0, height: 0,
                          borderTopWidth: L,
                          borderLeftWidth: halfBase,
                          borderRightWidth: halfBase,
                          borderTopColor: fill,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                        }} />
                        {/* Radial label reading outward */}
                        <View style={{ position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center', opacity: s.soldOut ? 0.4 : 1 }}>
                          <Text style={[T.caption, { color: onDark ? C.white : C.ink }]}>{s.label}</Text>
                          {!!s.sublabel && (
                            <Text style={[T.micro, { color: onDark ? C.white : C.ink, marginTop: 1 }]}>{s.sublabel}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}

                  {/* Radial divider lines at slice boundaries */}
                  {segments.map((s, i) => (
                    <View
                      key={'div' + s.id}
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
              <Text style={[T.micro, { color: C.dim }]}>{result.won ? 'You won' : 'Spin result'}</Text>
              <Text style={[T.h1, { color: C.ink, marginTop: 6, textTransform: 'uppercase', textAlign: 'center' }]}>
                {`${result.label} ${result.sublabel ?? ''}`.trim()}
              </Text>
              {claimedPrize?.code && (
                // Tap-to-copy: the code used to be plain text with no way to get
                // it into the clipboard for checkout.
                <Pressable
                  onPress={() => {
                    void Clipboard.setStringAsync(claimedPrize.code!)
                      .then(() => showToast('Copied', `${claimedPrize.code} — paste it at checkout`, 'copy'));
                  }}
                  style={[{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.white }, BORDER(1)]}
                >
                  <Text style={[T.monoB, { letterSpacing: 2 }]}>{claimedPrize.code}</Text>
                  <Feather name="copy" size={14} color={C.ink} />
                </Pressable>
              )}
              {!!claimedPrize?.points && (
                <Text style={[T.caption, { color: C.dim, marginTop: 8 }]}>{`${claimedPrize.points} points added`}</Text>
              )}
              {result.won && !claimedPrize && (
                <Pressable
                  onPress={onClaimPress}
                  disabled={claiming}
                  style={[{ marginTop: SP.m, alignSelf: 'stretch', paddingVertical: SP.m, alignItems: 'center', backgroundColor: claiming ? C.faint : C.ink }, BORDER(1)]}
                >
                  <Text style={[T.button, { color: C.white }]}>
                    {claiming ? 'Claiming…' : result.requiresLogin ? 'Sign in to claim' : 'Claim it'}
                  </Text>
                </Pressable>
              )}
            </View>
          </MotiView>
        )}

        {/* Spin action */}
        <Pressable
          onPress={spin}
          disabled={spinning || spinsLeft <= 0 || result !== null}
          style={[{ marginTop: SP.m, padding: SP.l, alignItems: 'center', backgroundColor: spinsLeft <= 0 || result !== null ? C.hairline : C.ink }, BORDER(1)]}
        >
          <Text style={[T.button, { color: spinsLeft <= 0 || result !== null ? C.dim : C.white }]}>
            {spinning ? 'Spinning...'
              : result !== null ? 'Come back tomorrow'
              : spinsLeft <= 0 ? 'Come back tomorrow'
              : `Spin now (${spinsLeft} left)`}
          </Text>
        </Pressable>

        {/* What you already hold — real codes, not a seeded list of fake spins */}
        <Text style={[T.caption, { marginTop: SP.xl }]}>{'Your prizes'}</Text>
        <View style={{ marginTop: SP.s }}>
          {!token ? (
            <Text style={[T.micro, { color: C.dim, padding: 10 }]}>Sign in to collect prizes and see them here.</Text>
          ) : rewards.length === 0 ? (
            <Text style={[T.micro, { color: C.dim, padding: 10 }]}>Nothing yet — a win will show up here.</Text>
          ) : (
            rewards.slice(0, 6).map((r) => (
              // Available codes copy on tap — same clipboard affordance as the
              // wallet, so a prize is usable from wherever the shopper sees it.
              <Pressable
                key={r.id}
                disabled={r.state !== 'available' || !r.code}
                onPress={() => {
                  void Clipboard.setStringAsync(r.code)
                    .then(() => showToast('Copied', `${r.code} — paste it at checkout`, 'copy'));
                }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: C.hairline, opacity: r.state === 'available' ? 1 : 0.45 }}
              >
                <Text style={[T.monoB, { flex: 1 }]}>{r.code}</Text>
                <Text style={[T.micro, { marginRight: 8 }]}>{r.name}</Text>
                {r.state === 'available'
                  ? <Feather name="copy" size={13} color={C.ink} />
                  : <Text style={[T.micro, { color: C.dim }]}>{r.state}</Text>}
              </Pressable>
            ))
          )}
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
// (NOTIFS removed — the inbox is real; see NotificationsScreen below.)

/** Server notification kind -> the Feather icon the row already used. */
const NOTIF_ICON: Record<string, string> = {
  order: 'package',
  order_status: 'package',
  refund: 'credit-card',
  return: 'rotate-ccw',
  payment: 'credit-card',
  promo: 'tag',
  loyalty: 'award',
  referral: 'gift',
  system: 'bell',
};

/** "2h" / "3d" — compact age, matching the mock list's right-hand column. */
function notifAge(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationsScreen() {
  const nav = useNavigation<any>();
  const { token, requireAuth } = useApp();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const page = await listNotifications({ limit: 30 });
      setItems(page.items);
      setUnread(page.unreadCount);
    } catch {
      /* offline — show the empty state rather than invented updates */
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  // Tapping marks read locally first so the row responds instantly, then follows
  // the deep link if the notification carries one.
  const open = (n: NotificationRow) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    const orderId = (n.payload?.orderId as string | undefined)
      ?? (n.deepLink?.startsWith('/orders/') ? n.deepLink.slice('/orders/'.length) : undefined);
    if (orderId) nav.navigate('OrderTracking', { orderId });
  };

  const markAll = () => {
    if (unread === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    markAllNotificationsRead().catch(() => load());
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Notifications" onBack={() => nav.goBack()} />

      {!token ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}>
          <Feather name="bell" size={26} color={C.dim} />
          <Text style={[T.h3, { marginTop: 12 }]}>Sign in to see your updates</Text>
          <BrutalButton label="Sign in" onPress={() => requireAuth()} style={{ marginTop: SP.l }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={C.ink}
            />
          }
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingTop: SP.l }}>
            <Text style={[T.micro]}>
              {loading ? 'Loading…' : `${items.length} update${items.length === 1 ? '' : 's'}${unread ? ` · ${unread} unread` : ''}`}
            </Text>
            {unread > 0 && (
              <Pressable onPress={markAll} hitSlop={8}>
                <Text style={[T.caption, { color: C.ink, textDecorationLine: 'underline' }]}>Mark all read</Text>
              </Pressable>
            )}
          </View>

          {!loading && items.length === 0 && (
            <View style={{ padding: SP.xl, alignItems: 'center', marginTop: SP.xl }}>
              <Feather name="bell" size={26} color={C.dim} />
              <Text style={[T.h3, { marginTop: 12 }]}>Nothing yet</Text>
              <Text style={[T.caption, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>
                Order updates and offers will land here.
              </Text>
            </View>
          )}

          {items.map((n, i) => (
            <FadeInUp key={n.id} delay={Math.min(i, 8) * 40}>
              <Pressable
                onPress={() => open(n)}
                style={{
                  flexDirection: 'row', padding: SP.l, alignItems: 'flex-start',
                  borderBottomWidth: 1, borderColor: C.hairline,
                  // Unread rows sit on white; read ones recede into the page.
                  backgroundColor: n.read ? 'transparent' : C.white,
                }}
              >
                <View style={[{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                  <Feather name={(NOTIF_ICON[n.kind] ?? 'bell') as any} size={16} color={C.ink} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {!n.read && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.ink }} />}
                    <Text style={[T.bodyB, { flex: 1 }]} numberOfLines={1}>{n.title}</Text>
                  </View>
                  {!!n.body && <Text style={[T.body, { color: C.dim, marginTop: 2 }]}>{n.body}</Text>}
                </View>
                <Text style={[T.micro]}>{notifAge(n.createdAt)}</Text>
              </Pressable>
            </FadeInUp>
          ))}
        </ScrollView>
      )}
    </View>
  );
}


// ─── VIRTUAL TRY-ON — AR + photo modes, brutalist hero layout ─────
/**
 * One thing the shopper can try on: the product's default image, or a variant
 * that has a picture of its own.
 *
 * `variantId` is a REFERENCE, not a URL. The app never sends a garment image to
 * the backend — it names the listing (and optionally the variant) and the server
 * resolves the real hosted file. The app's own thumbnails are Cloudinary-
 * transformed renditions that would not match what the catalogue stores.
 */
type GarmentOption = { key: string; label: string; thumb: string; variantId?: string };

/**
 * Default first, then only those variants carrying their own image.
 *
 * A variant whose `img` merely fell back to the gallery is skipped: it would be a
 * second button producing a byte-identical try-on, which reads as a broken
 * picker rather than a choice.
 */
function buildGarmentOptions(detail: ProductDetailData): GarmentOption[] {
  const opts: GarmentOption[] = [];
  /**
   * `defaultImage`, NOT gallery[0].
   *
   * `gallery` is variant-first so the card→detail zoom is seamless, which means
   * its head is usually the cheapest variant's photo. Using it here showed that
   * variant's picture under "Default" while the request — which omits variantId
   * — generated from the listing's galleryUrls[0] instead. The same variant then
   * appeared as its own button too: two identical thumbnails, two different
   * outputs. `defaultImage` is exactly what the backend resolves to.
   */
  const def = detail.defaultImage;
  if (def) opts.push({ key: 'default', label: 'Default', thumb: def });
  for (const v of detail.variants ?? []) {
    if (!v.hasOwnImage) continue;
    opts.push({
      key: v.id,
      label: [v.color, v.size].filter(Boolean).join(' · ') || 'Variant',
      thumb: v.img,
      variantId: v.id,
    });
  }
  return opts;
}

export function TryOnScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const incomingProduct = route.params?.product;
  const { showToast, requireAuth, getToken } = useApp();

  /**
   * Try-on always runs against the product the shopper arrived with.
   *
   * This strip used to offer six OTHER products pulled from the bundled mock
   * catalogue, so "swap fit" mostly listed things the store does not sell and
   * that have no backend listing to try on. It now offers the images of THIS
   * product: its default, plus any variant with a picture of its own.
   */
  const pick = incomingProduct;
  const listingId = React.useMemo(
    () => String(pick?.id ?? '').replace(/-\d+$/, ''),
    [pick?.id],
  );
  const isRealListing = listingId.startsWith('lst_');

  const [garmentOptions, setGarmentOptions] = useState<GarmentOption[]>([]);
  /** Why there are no garments — so a dead Try button can explain itself. */
  const [garmentError, setGarmentError] = useState<string | null>(null);
  const [selectedGarment, setSelectedGarment] = useState<GarmentOption | null>(null);
  const [garmentsLoading, setGarmentsLoading] = useState(false);

  React.useEffect(() => {
    setGeneratedPhoto(null);
    setGarmentOptions([]);
    setSelectedGarment(null);
    genKeyRef.current = null;
    if (!isRealListing) return;
    let cancelled = false;
    setGarmentsLoading(true);
    setGarmentError(null);
    getProductDetail(listingId)
      .then((d) => {
        if (cancelled) return;
        const opts = buildGarmentOptions(d);
        setGarmentOptions(opts);
        setSelectedGarment(opts[0] ?? null);
        // A product that loaded but has no usable image is a REAL answer, and a
        // different one from "the request failed" — say which.
        if (opts.length === 0) setGarmentError('This product has no picture to try on.');
      })
      .catch((e: any) => {
        if (cancelled) return;
        // This used to swallow the error entirely. The consequence was severe:
        // no garments means `selectedGarment` stays null, which makes the Try
        // button hit its `!selectedGarment` guard and return silently — the
        // button looked broken with nothing explaining why. The API is on a
        // tier that cold-starts slowly, so this path is hit routinely, not
        // rarely.
        setGarmentError(
          e?.code === 'timeout' || e?.code === 'unreachable'
            ? "Couldn't reach the store — check your connection and tap Try again."
            : e?.message || "Couldn't load this product's images.",
        );
      })
      .finally(() => { if (!cancelled) setGarmentsLoading(false); });
    return () => { cancelled = true; };
  }, [listingId, isRealListing]);

  // Live camera — permission + controls for the in-app AR try-on
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<CameraView>(null);
  // Timestamp of the last tap on the camera preview — a second tap within
  // 300ms counts as the double-tap that flips the camera.
  const lastCamTap = useRef(0);

  // The person photo — from the gallery OR captured live. It drives generation:
  // choosing or snapping one runs the try-on automatically, and the AI result
  // replaces it in `generatedPhoto`.
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [generatedPhoto, setGeneratedPhoto] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  // A finished attempt that produced no result — lets the UI offer 'Try again'
  // for the recoverable failures (busy/offline) without a standing regen button.
  const [attemptFailed, setAttemptFailed] = useState(false);
  // Guards the auto-generate effect against firing twice for the same
  // (photo, garment) pair (e.g. dev double-invoke). Manual retry bypasses it.
  const genKeyRef = useRef<string | null>(null);

  // Copyable error inspector — every step logs, errors pop this modal open so
  // the user can copy the full trace instead of chasing disappearing toasts.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /**
   * Why the last attempt failed, rendered INLINE next to Try again.
   *
   * Failures used to be reported only by a transient toast (for the coded
   * errors) or by a <Modal> (for everything else) — and this screen is itself
   * a `transparentModal`, so a nested Modal frequently never presents on iOS.
   * The result was a retry button with no explanation at all. Inline text is
   * in the normal view tree, so it cannot be swallowed by either problem.
   */
  const [failReason, setFailReason] = useState<string | null>(null);
  /** Fullscreen result viewer. An in-tree overlay, NOT a Modal, for the same reason. */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  useEffect(() => { const unsub = subscribeTryOnLog(setLogLines); return () => { unsub(); }; }, []);
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
    // Fresh start — drop any previous photo/result so the live view is clean.
    setUploadedPhoto(null);
    setGeneratedPhoto(null);
    setAttemptFailed(false);
    genKeyRef.current = null;
    setCameraOn(true);
  };

  const uploadPhoto = async () => {
    try {
      // The Android photo picker needs no media permission — it returns only the
      // file the user picked (see the note in CreateReelScreen.pickVideo).
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        // System crop step after picking — lets the shopper frame themselves
        // before the AI dresses the photo. 3:4 matches the try-on canvas.
        allowsEditing: true,
        aspect: [3, 4],
      });
      console.log('[tryOn] picker result=', JSON.stringify(result).slice(0, 400));
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri || typeof uri !== 'string') {
        Alert.alert('Upload failed', `Picker returned: ${JSON.stringify(result.assets?.[0] || null)}`);
        return;
      }
      // Clear the flags first, then set the photo LAST so the generation
      // effect fires against a clean state and runs the try-on automatically.
      setGeneratedPhoto(null);
      setAttemptFailed(false);
      setCameraOn(false);
      genKeyRef.current = null;
      setUploadedPhoto(uri);
    } catch (e: any) {
      openErrorInspector(`uploadPhoto crash: ${e?.message || String(e)}`);
    }
  };

  const runTryOn = async (personUri: string, garment: GarmentOption) => {
    clearTryOnLog();
    if (!personUri) {
      openErrorInspector(`No photo. runTryOn got: ${JSON.stringify(personUri)}`);
      return;
    }
    // Try-on runs on the backend against a REAL store product. Mock catalogue
    // products (bundled art) have no backend listing to resolve a garment from.
    if (!isRealListing) {
      showToast('Not available', 'Try-on works on store products only', 'x');
      return;
    }
    // Explain, never no-op. Without a garment the generate call cannot run, and
    // returning quietly here is what made the button feel dead.
    if (!garment) {
      showToast('Try-on unavailable', garmentError ?? 'Still loading this product — try again in a moment', 'x');
      return;
    }
    setAttemptFailed(false);
    setFailReason(null);
    setGenerating(true);
    setGeneratedPhoto(null);
    try {
      // A REFERENCE, never a URL — the server resolves the real garment file.
      // Omitting variantId asks for the listing's default image.
      const outUrl = await generateTryOn(personUri, listingId, garment.variantId);
      setGeneratedPhoto(outUrl);
      showToast('Try-on ready', `${pick?.name ?? 'Look'} on you`, 'check');
    } catch (e: any) {
      // Every failure leaves `attemptFailed` set so the stage offers a one-tap
      // retry instead of stranding the shopper on a photo with no result.
      setAttemptFailed(true);
      /**
       * Guests get the real sign-in sheet, not a dead-end toast. `requireAuth`
       * opens it and runs the callback once a session exists, so the shopper
       * lands back on the try-on they asked for instead of having to start over.
       */
      if (e instanceof TryOnAuthRequiredError) {
        // requireAuth() returns TRUE — and shows NO sheet — when AppState already
        // holds a token. But generateTryOn checks a different store
        // (getAuthToken() in services/api). When those two disagree the shopper
        // is never asked to sign in and the retry fails identically, forever.
        // Say so rather than looping in silence.
        const appThinksSignedIn = !!getToken();
        if (appThinksSignedIn) {
          setFailReason('Your session expired. Log out from Profile, sign in again, then retry.');
          openErrorInspector('Auth desync: app holds a session but the API layer has no token. Sign out and back in.');
          return;
        }
        // This was the ONLY failure path that left `failReason` unset, so the
        // screen fell back to "Something went wrong" — the least useful thing it
        // could say, for the one cause the shopper can actually fix. Worse, the
        // sign-in sheet is a <Modal> and this screen is a `transparentModal`, so
        // iOS is asked to present a modal from a controller that is already
        // presenting one and it may never appear. State it in the panel too, so
        // the instruction survives even when the sheet does not.
        setFailReason('Sign in to try this on. Open Profile and sign in, then come back.');
        showToast('Sign in required', 'Sign in to try this on', 'lock');
        requireAuth(() => { void runTryOn(personUri, garment); });
        return;
      }
      // Friendly copy for the failures the shopper can act on; everything else
      // goes to the copyable inspector.
      if (e?.code === 'rate_limited') {
        setFailReason('Try-on is busy right now. Give it a moment and tap Try again.');
        showToast('Try-on is busy', 'Give it a moment and try again', 'clock');
        return;
      }
      if (e?.code === 'invalid_state') {
        setFailReason('This product has no picture to try on.');
        showToast('No image to try on', 'This product has no picture to work from', 'x');
        return;
      }
      if (e?.code === 'not_found') {
        setFailReason('That item is no longer available.');
        showToast('Product unavailable', 'That item is no longer available', 'x');
        return;
      }
      if (e?.code === 'timeout' || e?.code === 'unreachable') {
        setFailReason("Couldn't reach the server. Check your connection and tap Try again.");
        return;
      }
      // Unknown failure: show it inline AND keep the copyable inspector for the
      // full log. Inline is what the shopper reads; the inspector is for us.
      // Name the CODE as well as the message. "Something went wrong" told us
      // nothing across three rebuilds; a code points straight at the cause.
      const code = e?.code ? ` [${e.code}]` : '';
      const status = e?.status ? ` (HTTP ${e.status})` : '';
      setFailReason(`${e?.message || String(e)}${code}${status}`);
      openErrorInspector(`${e?.message || String(e)}${code}${status}\n\n${getTryOnLog().join('\n')}`);
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Auto-generate. Providing a photo (gallery or camera) or switching the garment
   * runs the try-on with no extra tap — "click the picture and it's on you". The
   * ref stops the identical (photo, garment) pair from re-running; a manual
   * "Try again" bypasses it by calling runTryOn directly.
   */
  React.useEffect(() => {
    if (!uploadedPhoto || !selectedGarment || !isRealListing || generating) return;
    const key = `${uploadedPhoto}::${selectedGarment.key}`;
    if (genKeyRef.current === key) return;
    genKeyRef.current = key;
    void runTryOn(uploadedPhoto, selectedGarment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedPhoto, selectedGarment?.key, isRealListing]);

  // Snap a still from the live camera; the generation effect runs it through the
  // same backend model as a gallery photo. No separate flow.
  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) return;
      let uri = photo.uri;
      // CameraX mirrors FRONT-camera output by design (to match the preview),
      // so the generation ran on a mirrored selfie. Flip it back explicitly —
      // deterministic on every device, unlike the capture flags.
      if (facing === 'front') {
        try {
          const flipped = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ flip: ImageManipulator.FlipType.Horizontal }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
          );
          uri = flipped.uri;
        } catch { /* flip failing is not worth losing the shot over */ }
      }
      setGeneratedPhoto(null);
      setAttemptFailed(false);
      setCameraOn(false);
      genKeyRef.current = null;
      setUploadedPhoto(uri);
    } catch (e: any) {
      showToast('Capture failed', e?.message || 'Try again', 'x');
    }
  };

  // Pull the remote result to a local file once, reused by save + share.
  const cacheResult = async (): Promise<string | null> => {
    if (!generatedPhoto) return null;
    const dest = `${FileSystem.cacheDirectory}trendzo-tryon-${Date.now()}.jpg`;
    const dl = await FileSystem.downloadAsync(generatedPhoto, dest);
    return dl?.uri ?? null;
  };

  const saveLook = async () => {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        showToast('Photo access needed', 'Allow saving to your gallery in Settings', 'image');
        return;
      }
      const local = await cacheResult();
      if (!local) return;
      await MediaLibrary.saveToLibraryAsync(local);
      showToast('Saved', 'Look saved to your gallery', 'check');
    } catch (e: any) {
      showToast('Save failed', e?.message || 'Try again', 'x');
    }
  };

  const shareLook = async () => {
    try {
      const local = await cacheResult();
      // Prefer the OS share sheet with the actual image; fall back to a link.
      if (local && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(local, { mimeType: 'image/jpeg', dialogTitle: 'Share your try-on' });
      } else if (generatedPhoto) {
        await Share.share({ message: `My Trendzo try-on: ${generatedPhoto}` });
      }
    } catch (e: any) {
      showToast('Share failed', e?.message || 'Try again', 'x');
    }
  };

  /**
   * Try-on needs a product to try on.
   *
   * The screen is reachable from Profile with no params (ProfileScreens "Scan
   * with AR"), which previously landed on a mock catalogue row. Now that the
   * garment comes from the product the shopper arrived with, a bare entry has
   * nothing to work from — so say that instead of dereferencing undefined.
   */
  if (!pick) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <BrutalStatusBar />
        <ScreenHeader title="Virtual Try On" onBack={() => nav.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl }}>
          <Feather name="camera-off" size={26} color={C.dim} />
          <Text style={[T.h3, { marginTop: 12, textAlign: 'center' }]}>Pick something to try on</Text>
          <Text style={[T.caption, { color: C.dim, marginTop: 6, textAlign: 'center' }]}>
            Open any product and tap Try On.
          </Text>
          <BrutalButton label="Browse products" onPress={() => nav.navigate('Tabs', { screen: 'HomeTab' })} style={{ marginTop: SP.l }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Virtual Try On" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* STAGE — live camera, the AI result, or the chosen photo. One flow. */}
        <View style={[{ marginTop: SP.l, height: 460, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
          {cameraOn ? (
            <>
              {/* Live camera — NO garment overlay; the person is captured clean
                  and the garment is composited server-side. Close/rotate buttons
                  removed per redesign: back is the header arrow, and the camera
                  flips on a DOUBLE TAP anywhere on the preview (hint below). */}
              <Pressable
                onPress={(e: any) => {
                  // Manual double-tap: two taps within 300ms flip the camera.
                  const now = Date.now();
                  if (now - lastCamTap.current < 300) setFacing(f => (f === 'front' ? 'back' : 'front'));
                  lastCamTap.current = now;
                }}
                style={StyleSheet.absoluteFillObject as any}
              >
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject as any} facing={facing} />
              </Pressable>
              <View pointerEvents="none" style={[{ position: 'absolute', top: 10, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.ink }]}>Double tap to rotate</Text>
              </View>
              {/* Shutter — take the picture then and there */}
              <View style={{ position: 'absolute', bottom: 22, left: 0, right: 0, alignItems: 'center' }}>
                <Pressable onPress={capturePhoto} style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 3, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink }} />
                </Pressable>
              </View>
            </>
          ) : generatedPhoto ? (
            <>
              {/* Tappable. The result used to be a bare image with no press
                  target at all, so there was literally no way to open it — it
                  could only ever be seen cover-cropped inside this small box. */}
              <Pressable onPress={() => setViewerOpen(true)} style={StyleSheet.absoluteFillObject as any}>
                <CachedImage
                  source={{ uri: generatedPhoto }}
                  style={StyleSheet.absoluteFillObject as any}
                  resizeMode="cover"
                  onError={(e: any) => openErrorInspector(`Generated image failed to load: ${e.nativeEvent?.error || 'unknown'}\nURL: ${generatedPhoto}`)}
                />
              </Pressable>
              <View pointerEvents="none" style={[{ position: 'absolute', bottom: 10, right: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.ink }]}>Tap to enlarge</Text>
              </View>
              <View style={[{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.ink }]}>AI try-on</Text>
              </View>
              {/* Clear → back to the chooser (gallery / camera). */}
              <Pressable onPress={() => { setGeneratedPhoto(null); setUploadedPhoto(null); setAttemptFailed(false); genKeyRef.current = null; }} hitSlop={8} style={[{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                <Feather name="x" size={14} color={C.ink} />
              </Pressable>
            </>
          ) : uploadedPhoto ? (
            <>
              <CachedImage
                source={{ uri: uploadedPhoto }}
                style={StyleSheet.absoluteFillObject as any}
                resizeMode="cover"
                onError={(e: any) => openErrorInspector(`Photo failed to load: ${e.nativeEvent?.error || 'unknown'}\nURI: ${uploadedPhoto}`)}
              />
              {generating && (
                <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}>
                  <Text style={[T.h1, { color: C.white }]}>Generating…</Text>
                  <Text style={[T.micro, { color: C.white, marginTop: 6, opacity: 0.8, textAlign: 'center' }]}>{'AI is dressing your photo\nCan take 15–60s'}</Text>
                </View>
              )}
              {!generating && (
                <Pressable onPress={() => { setUploadedPhoto(null); setAttemptFailed(false); genKeyRef.current = null; }} hitSlop={8} style={[{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                  <Feather name="x" size={14} color={C.ink} />
                </Pressable>
              )}
            </>
          ) : (
            <>
              {/* Nothing chosen yet — show the garment so the box is never empty. */}
              <CachedImage source={{ uri: pick.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={[{ position: 'absolute', top: 10, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.ink }]}>Add a photo or open the camera</Text>
              </View>
            </>
          )}
          {/* Corner frame — thin hairline ticks */}
          {[{top:6,left:8},{top:6,right:8},{bottom:6,left:8},{bottom:6,right:8}].map((pos, i) => (
            <View key={i} pointerEvents="none" style={{ position: 'absolute', ...pos, width: 14, height: 14, borderColor: C.ink, borderTopWidth: i < 2 ? 2 : 0, borderBottomWidth: i >= 2 ? 2 : 0, borderLeftWidth: i % 2 === 0 ? 2 : 0, borderRightWidth: i % 2 === 1 ? 2 : 0 }} />
          ))}
          {/* Product caption — hidden over the live camera so it never covers the shutter. */}
          {!cameraOn && (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: SP.m, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.hairline }}>
              <Text style={[T.micro, { color: C.ink }]}>{pick.brand}</Text>
              <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={1}>{pick.name}</Text>
            </View>
          )}
        </View>

        {/* CONTROLS — one row, driven by state rather than a mode tab. */}
        {!isRealListing ? (
          <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: '#F4F4F4', flexDirection: 'row', alignItems: 'center', gap: 10 }, BORDER(1)]}>
            <Feather name="info" size={16} color={C.dim} />
            <Text style={[T.micro, { flex: 1, color: C.dim }]}>Virtual try-on works on store products only.</Text>
          </View>
        ) : cameraOn ? null : generatedPhoto ? (
          <>
            <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l }}>
              <BrutalButton label="Save" icon="bookmark" onPress={saveLook} style={{ flex: 1 }} />
              <BrutalButton label="Share" icon="share-2" variant="outline" onPress={shareLook} style={{ flex: 1 }} />
            </View>
            {/* Escape hatch. After a successful try-on the only way back to the
                gallery/camera chooser was a 30x30 'x' tucked in the image
                corner, so it read as "I can never pick another photo". */}
            <BrutalButton
              label="New photo"
              icon="image"
              variant="outline"
              onPress={() => { setGeneratedPhoto(null); setUploadedPhoto(null); setAttemptFailed(false); setFailReason(null); genKeyRef.current = null; uploadPhoto(); }}
              style={{ marginTop: SP.s }}
            />
          </>
        ) : attemptFailed && uploadedPhoto && !generating ? (
          <>
            {/* WHY it failed, in the view tree — never only a toast or a Modal. */}
            <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={[T.bodyB, { color: C.ink }]}>Couldn't generate the look</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>
                {failReason ?? 'Something went wrong. Tap Try again.'}
              </Text>
              {errorMsg ? (
                <Pressable onPress={() => setErrorMsg(errorMsg)} hitSlop={8} style={{ marginTop: 8 }}>
                  <Text style={[T.micro, { color: C.ink, textDecorationLine: 'underline' }]}>See details</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.s }}>
              <BrutalButton label="Try again" icon="zap" onPress={() => { if (selectedGarment) runTryOn(uploadedPhoto, selectedGarment); }} disabled={!selectedGarment} style={{ flex: 1 }} />
              <BrutalButton label="New photo" icon="image" variant="outline" onPress={uploadPhoto} style={{ flex: 1 }} />
            </View>
          </>
        ) : !generating ? (
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l }}>
            <BrutalButton label="Choose photo" icon="image" onPress={uploadPhoto} style={{ flex: 1 }} />
            <BrutalButton label="Open camera" icon="camera" variant="outline" onPress={openCamera} style={{ flex: 1 }} />
          </View>
        ) : null}

        {/* WHICH IMAGE — the default, plus any variant with its own picture.
            Tapping a different one re-renders the look automatically. */}
        {isRealListing && (
          <>
            <Text style={[T.caption, { marginTop: SP.xl }]}>{'Try on which one'}</Text>
            {garmentsLoading ? (
              <Text style={[T.micro, { color: C.dim, marginTop: SP.s }]}>Loading images…</Text>
            ) : garmentOptions.length === 0 ? (
              <Text style={[T.micro, { color: C.dim, marginTop: SP.s }]}>
                This product has no image to try on.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s, paddingVertical: SP.s }}>
                {garmentOptions.map((g) => {
                  const on = selectedGarment?.key === g.key;
                  return (
                    <Pressable
                      key={g.key}
                      onPress={() => setSelectedGarment(g)}
                      // White fill + cover-fit: `contain` on a grey box left the
                      // photo floating in a grey frame. Cover fills the card
                      // edge-to-edge; the label strip overlays the bottom.
                      style={[{ width: 90, height: 110, backgroundColor: C.white, overflow: 'hidden' }, on ? BORDER(2) : BORDER(1)]}
                    >
                      <CachedImage source={{ uri: g.thumb }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
                      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 4, paddingVertical: 3, backgroundColor: on ? C.ink : 'rgba(255,255,255,0.92)' }}>
                        <Text style={[T.micro, { color: on ? C.white : C.ink }]} numberOfLines={1}>{g.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}

        {/* How it works */}
        <Text style={[T.caption, { marginTop: SP.l }]}>{'How it works'}</Text>
        <View style={{ marginTop: SP.s, gap: 8 }}>
          {[
            { icon: 'image', title: 'Add your photo', desc: 'Pick from gallery or snap one live — full-body works best.' },
            { icon: 'layers', title: 'Pick a fit', desc: 'Switch the colour or style and it re-renders.' },
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
      {viewerOpen && generatedPhoto ? (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', zIndex: 999 }]}>
          <CachedImage source={{ uri: generatedPhoto }} style={StyleSheet.absoluteFillObject as any} resizeMode="contain" />
          <Pressable
            onPress={() => setViewerOpen(false)}
            hitSlop={12}
            style={[{ position: 'absolute', top: 54, right: 16, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}
          >
            <Feather name="x" size={18} color={C.ink} />
          </Pressable>
        </View>
      ) : null}

      {/* IN-TREE overlay, not a <Modal>.
          This screen is a `transparentModal`, and an RN Modal opened from inside
          one is a separate presented controller that can OUTLIVE the screen: pop
          try-on while it is up and an invisible layer stays over the app,
          swallowing every touch — which reads as "Home froze after going back".
          Same bug, same fix as the delivery-terms sheet and the result viewer.
          An absolutely-positioned View belongs to this screen and dies with it. */}
      {errorMsg ? (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SP.l, zIndex: 1000 }]}>
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
      ) : null}
    </View>
  );
}
