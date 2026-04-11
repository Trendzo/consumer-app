import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar, Animated, Easing, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, FadeInUp } from '../components/Brutal';

// ─── DAILY REWARD ──────────────────────────────────────────
export function DailyRewardScreen() {
  const nav = useNavigation<any>();
  const [claimed, setClaimed] = useState([true, true, true, true, true, true, false]);
  const today = 6;

  const claim = () => {
    const next = [...claimed];
    next[today] = true;
    setClaimed(next);
    Alert.alert('Reward claimed', '+50 points · Day 7 streak unlocked!');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Daily Reward" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'> STREAK_07'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 40, color: C.ink, letterSpacing: -1.5, marginTop: 6, lineHeight: 42 }}>SHOW UP{'\n'}EVERY DAY.</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 8 }]}>Login daily for compounding rewards. Skip a day = streak resets.</Text>
        </FadeInUp>

        <AsciiDivider style={{ marginTop: SP.xl }} />
        <Text style={[T.label, { marginTop: 6 }]}>{'> THIS WEEK'}</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, marginTop: SP.m }}>
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d, i) => {
            const isToday = i === today;
            const got = claimed[i];
            const reward = (i + 1) * 10;
            return (
              <MotiView
                key={d}
                from={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 60 }}
                style={[{ width: '13.7%', aspectRatio: 0.7, alignItems: 'center', justifyContent: 'space-between', padding: 6, backgroundColor: got ? C.ink : C.white }, BORDER(1)]}
              >
                <Text style={[T.mono, { color: got ? C.white : C.dim, fontSize: 8 }]}>{d}</Text>
                {got ? <Feather name="check" size={16} color={C.white} /> : isToday ? <Text style={[T.monoB, { fontSize: 10 }]}>?</Text> : <Feather name="lock" size={12} color={C.dim} />}
                <Text style={{ fontFamily: 'Inter_900Black', color: got ? C.white : C.ink, fontSize: 10 }}>+{reward}</Text>
              </MotiView>
            );
          })}
        </View>

        <View style={[{ marginTop: SP.xl, padding: SP.l, backgroundColor: C.white, alignItems: 'center' }, BORDER(1)]}>
          <Text style={[T.monoB, { fontSize: 10 }]}>{'> TODAY · DAY 07'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 56, color: C.ink, marginTop: 8 }}>+70</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 2 }]}>POINTS WAITING</Text>
          <BrutalButton label={claimed[today] ? 'CLAIMED' : 'CLAIM REWARD'} icon="gift" disabled={claimed[today]} onPress={claim} style={{ marginTop: SP.m }} block />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── SPIN WHEEL ─────────────────────────────────────────────
const SLICES = ['10% OFF', '₹100', 'TRY AGAIN', '20% OFF', '50 PTS', 'FREE SHIP', '₹500', 'BETTER LUCK'];

export function SpinWheelScreen() {
  const nav = useNavigation<any>();
  const rotation = useRef(new Animated.Value(0)).current;
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const idx = Math.floor(Math.random() * SLICES.length);
    const target = 360 * 5 + (360 - idx * (360 / SLICES.length)) - (360 / SLICES.length / 2);
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: target,
      duration: 3500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setResult(SLICES[idx]);
      setSpinning(false);
    });
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Spin & Win" onBack={() => nav.goBack()} />
      <View style={{ flex: 1, alignItems: 'center', padding: SP.l }}>
        <FadeInUp>
          <Text style={[T.monoB, { fontSize: 11, marginTop: SP.m }]}>{'> 1 FREE SPIN AVAILABLE'}</Text>
        </FadeInUp>

        <View style={{ marginTop: 30, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: -8, zIndex: 2 }}>
            <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 28, color: C.ink }}>▼</Text>
          </View>
          <Animated.View style={{ width: 280, height: 280, transform: [{ rotate }], borderRadius: 140, overflow: 'hidden', borderWidth: 1, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }}>
            {SLICES.map((s, i) => {
              const angle = (360 / SLICES.length) * i;
              return (
                <View key={i} style={{ position: 'absolute', width: '100%', height: '100%', transform: [{ rotate: `${angle}deg` }], alignItems: 'center' }}>
                  <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 14 }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.ink, transform: [{ rotate: '0deg' }] }}>{s}</Text>
                  </View>
                </View>
              );
            })}
            {/* divider lines */}
            {SLICES.map((_, i) => (
              <View key={'l' + i} style={{ position: 'absolute', width: 1, height: '50%', top: 0, left: '50%', backgroundColor: C.ink, transform: [{ rotate: `${(360 / SLICES.length) * i}deg` }, { translateY: 70 }] }} />
            ))}
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.ink, borderWidth: 1, borderColor: C.ink }} />
          </Animated.View>
        </View>

        {result && (
          <MotiView from={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }} style={{ marginTop: SP.xl }}>
            <View style={[{ paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{'> YOU WON'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.white, marginTop: 4 }}>{result}</Text>
            </View>
          </MotiView>
        )}

        <View style={{ flex: 1 }} />
        <BrutalButton label={spinning ? 'SPINNING...' : result ? 'SPIN AGAIN TOMORROW' : 'SPIN NOW'} icon="rotate-cw" disabled={spinning || !!result} onPress={spin} block />
      </View>
    </View>
  );
}

// ─── STYLE QUIZ ─────────────────────────────────────────────
const Q = [
  { q: 'YOUR VIBE?', opts: ['MINIMAL', 'STREET', 'PREPPY', 'CHAOS'] },
  { q: 'GO-TO COLOR?', opts: ['BLACK', 'NEUTRAL', 'BRIGHT', 'PASTEL'] },
  { q: 'OCCASION?', opts: ['CASUAL', 'PARTY', 'WORK', 'DATE'] },
  { q: 'BUDGET PER FIT?', opts: ['<₹1K', '₹1-3K', '₹3-5K', '₹5K+'] },
];

export function StyleQuizScreen() {
  const nav = useNavigation<any>();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const select = (opt: string) => {
    const next = [...answers, opt];
    setAnswers(next);
    if (step < Q.length - 1) setStep(step + 1);
    else setDone(true);
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Style Quiz" onBack={() => nav.goBack()} />
        <View style={{ flex: 1, padding: SP.l, alignItems: 'center', justifyContent: 'center' }}>
          <MotiView from={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 64, color: C.ink }}>{'[★]'}</Text>
          </MotiView>
          <Text style={[T.monoB, { marginTop: 18 }]}>{'> YOUR STYLE'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 40, color: C.ink, marginTop: 8, letterSpacing: -1.5 }}>STREET×</Text>
          <AsciiDivider style={{ marginTop: 18, width: 200 }} />
          <Text style={[T.body, { color: C.dim, marginTop: 12, textAlign: 'center', maxWidth: 280 }]}>
            You vibe with chunky silhouettes, neutral palettes, and statement footwear. We'll curate your home feed accordingly.
          </Text>
          <BrutalButton label="See my picks" iconRight="arrow-right" onPress={() => nav.replace('Tabs', { screen: 'HomeTab' })} style={{ marginTop: SP.xl }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Style Quiz" onBack={() => nav.goBack()} />
      <View style={{ flex: 1, padding: SP.l }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Q.map((_, i) => (
            <View key={i} style={[{ flex: 1, height: 6, backgroundColor: i <= step ? C.ink : C.white }, BORDER(1)]} />
          ))}
        </View>
        <Text style={[T.monoB, { marginTop: SP.l }]}>{`> Q${step + 1} / ${Q.length}`}</Text>
        <MotiView key={step} from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 40, color: C.ink, marginTop: 12, letterSpacing: -1.5 }}>{Q[step].q}</Text>
        </MotiView>

        <View style={{ marginTop: SP.xl, gap: SP.m }}>
          {Q[step].opts.map((opt, i) => (
            <MotiView key={opt} from={{ opacity: 0, translateX: -12 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: 100 + i * 60 }}>
              <Pressable onPress={() => select(opt)} style={[{ padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink, letterSpacing: 0.5 }}>{opt}</Text>
                <Feather name="arrow-right" size={18} color={C.ink} />
              </Pressable>
            </MotiView>
          ))}
        </View>
      </View>
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
      <StatusBar barStyle="dark-content" />
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

// ─── TRY ON STUB ────────────────────────────────────────────
export function TryOnScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Virtual Try-On" onBack={() => nav.goBack()} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
        <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 56, color: C.ink, letterSpacing: -2 }}>{'(•_•)'}</Text>
        <Text style={[T.h2, { marginTop: 12, textAlign: 'center' }]}>POINT YOUR CAMERA</Text>
        <Text style={[T.body, { color: C.dim, marginTop: 8, textAlign: 'center' }]}>AR try-on will overlay clothes on your body in real time.</Text>
        <BrutalButton label="Open camera" icon="camera" onPress={() => Alert.alert('Camera', 'AR mode coming soon')} style={{ marginTop: SP.l }} />
      </View>
    </View>
  );
}
