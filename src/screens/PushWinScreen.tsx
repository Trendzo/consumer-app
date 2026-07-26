// PUSH & WIN — the Trendzo arcade, in the app's own design language:
// white page, ink type, hairline borders, sharp corners, and the same yellow
// highlighter accent the Home headline uses. Playful comes from motion and
// type — a scrolling ticker, a yellow payline band, pixel-square confetti,
// and a push-button with a hard offset shadow — never from gradients.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, Dimensions, Vibration } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { BrutalStatusBar } from '../components/Brutal';
import { useApp } from '../state/AppState';

const { width: W } = Dimensions.get('window');

// The Home headline highlighter yellow (EX_YELLOW) — the one accent colour.
const YELLOW = '#F2E63C';

// ── Reel symbols — ink icons, index-keyed payouts below ──
const SYMBOLS = [
  'cash-multiple',        // 0 → ₹200 coupon
  'ticket-percent',       // 1 → free shipping ×3
  'star-four-points',     // 2 → +200 points
  'gift-outline',         // 3 → mystery gift
  'diamond-stone',        // 4 → jackpot ₹500
  'emoticon-sad-outline', // 5 → dud
];
const N = SYMBOLS.length;
const SYM_H = 56;
const STRIP = Array.from({ length: N * 10 }, (_, i) => SYMBOLS[i % N]);

const MACH_W = Math.min(W - SP.l * 2, 372);
const WIN_W = MACH_W - SP.l * 2 - 2;
const REEL_W = WIN_W / 3;
const WIN_H = SYM_H * 3;

const TRIPLE_PAYOUT: Record<number, { label: string; sub: string; jackpot?: boolean }> = {
  4: { label: 'JACKPOT · ₹500 COUPON', sub: 'Added to your coupon wallet', jackpot: true },
  0: { label: '₹200 COUPON', sub: 'Added to your coupon wallet' },
  1: { label: 'FREE SHIPPING ×3', sub: 'Valid on your next 3 orders' },
  2: { label: '+200 POINTS', sub: 'Added to your rewards balance' },
  3: { label: 'MYSTERY GIFT', sub: 'Ships with your next order' },
  5: { label: '+20 PITY POINTS', sub: 'Even sad faces pay a little' },
};

// ── TICKER — the Home marquee, black strip + endlessly scrolling white text ──
function Ticker({ text }: { text: string }) {
  const [segW, setSegW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!segW) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: -segW, duration: segW * 20, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [segW]);
  const seg = <Text numberOfLines={1} style={[T.caption, { color: C.white }]}>{text}</Text>;
  return (
    <View style={{ height: 32, backgroundColor: C.ink, overflow: 'hidden', justifyContent: 'center' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
        <View onLayout={(e) => setSegW(e.nativeEvent.layout.width)}>{seg}</View>
        {seg}
      </Animated.View>
    </View>
  );
}

// ── HIGHLIGHT — headline word with the Home-style yellow bar behind it ──
function Highlight({ children }: { children: string }) {
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <View style={{ position: 'absolute', left: -3, right: -6, bottom: 3, height: 12, backgroundColor: YELLOW }} />
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(34), lineHeight: rf(38), color: C.ink, letterSpacing: -1 }}>{children}</Text>
    </View>
  );
}

export function PushWinScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();

  // Reel positions in symbol-index units; start at N so a row is always
  // rendered above the payline (rows val-1 / val / val+1 are visible).
  const reels = useRef([new Animated.Value(N), new Animated.Value(N), new Animated.Value(N)]).current;
  const posRef = useRef<number[]>([N, N, N]);
  const btnPress = useRef(new Animated.Value(0)).current;
  const winFlash = useRef(new Animated.Value(0)).current;

  const [spinning, setSpinning] = useState(false);
  const [pushesLeft, setPushesLeft] = useState(3);
  const [wins, setWins] = useState(0);
  const [result, setResult] = useState<{ big: boolean; label: string; sub: string; win: boolean } | null>(null);
  const [burst, setBurst] = useState(0); // bumps once per win → regenerates confetti

  // Pixel-square confetti (ink + yellow), regenerated per win — same particle
  // language as the splash screen.
  const confetti = useMemo(() => {
    if (!burst) return [];
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 70 + Math.random() * 110;
      return {
        id: `${burst}-${i}`,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist * 0.8,
        size: 5 + Math.random() * 5,
        color: i % 3 === 0 ? YELLOW : C.ink,
        delay: Math.random() * 100,
      };
    });
  }, [burst]);

  const rollTargets = (): number[] => {
    const r = Math.random();
    if (r < 0.06) return [4, 4, 4];
    if (r < 0.26) {
      const pick = [0, 1, 2, 3][Math.floor(Math.random() * 4)];
      return [pick, pick, pick];
    }
    if (r < 0.62) {
      const pick = Math.floor(Math.random() * N);
      let other = Math.floor(Math.random() * N);
      if (other === pick) other = (other + 1) % N;
      const t = [pick, pick, pick];
      t[Math.floor(Math.random() * 3)] = other;
      return t;
    }
    const a = Math.floor(Math.random() * N);
    return [a, (a + 2) % N, (a + 4) % N];
  };

  const settle = (targets: number[]) => {
    const counts: Record<number, number> = {};
    targets.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
    const tripleKey = Object.keys(counts).find((k) => counts[+k] === 3);
    const pairKey = Object.keys(counts).find((k) => counts[+k] === 2);
    let res: { big: boolean; label: string; sub: string; win: boolean };
    if (tripleKey !== undefined) {
      const pay = TRIPLE_PAYOUT[+tripleKey];
      res = { big: !!pay.jackpot, label: pay.label, sub: pay.sub, win: true };
      Vibration.vibrate(pay.jackpot ? [0, 60, 60, 140] : 40);
    } else if (pairKey !== undefined && +pairKey !== 5) {
      res = { big: false, label: '+50 POINTS', sub: 'A pair pays — added to your balance', win: true };
      Vibration.vibrate(25);
    } else {
      res = { big: false, label: 'SO CLOSE', sub: 'No match this push — go again', win: false };
    }
    setResult(res);
    if (res.win) {
      setWins((w) => w + 1);
      setBurst((b) => b + 1);
      winFlash.setValue(0);
      Animated.sequence([
        Animated.timing(winFlash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(winFlash, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  };

  const push = () => {
    if (spinning || pushesLeft <= 0) return;
    setSpinning(true);
    setResult(null);
    setPushesLeft((p) => p - 1);
    Animated.sequence([
      Animated.timing(btnPress, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(btnPress, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    const targets = rollTargets();
    const anims = reels.map((val, i) => {
      const cur = posRef.current[i];
      const loops = 4 + i;
      const final = cur + loops * N + ((targets[i] - (cur % N) + N) % N);
      posRef.current[i] = (final % N) + N;
      return Animated.timing(val, {
        toValue: final,
        duration: 1500 + i * 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    });
    Animated.parallel(anims).start(() => {
      reels.forEach((val, i) => val.setValue(posRef.current[i]));
      setSpinning(false);
      settle(targets);
    });
  };

  // Neo-brutal press: the black slab sinks into its yellow offset shadow.
  const pressShift = btnPress.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });
  const disabled = spinning || pushesLeft <= 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />

      {/* ── Header — app-style: bordered close box, tracked-out kicker ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingTop: insets.top + 8, paddingBottom: SP.s }}>
        <View style={{ width: 36 }} />
        <Text style={[T.caption, { color: C.dim, letterSpacing: 3 }]}>TRENDZO ARCADE</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
          <Feather name="x" size={17} color={C.ink} />
        </Pressable>
      </View>

      {/* ── Headline — highlighter bars, exactly like Home's trending block ── */}
      <View style={{ paddingHorizontal: SP.l, marginTop: SP.s }}>
        <Highlight>PUSH & WIN</Highlight>
        <Text style={[T.caption, { color: C.dim, marginTop: 8 }]}>Match 3 on the payline · 3 free pushes a day</Text>
      </View>

      {/* ── Ticker — what's inside the machine ── */}
      <View style={{ marginTop: SP.m }}>
        <Ticker text={'₹500 coupons  //  free shipping  //  mystery gifts  //  +200 points  //  every push counts  //  '} />
      </View>

      {/* ── Counters ── */}
      <View style={{ flexDirection: 'row', gap: SP.s, paddingHorizontal: SP.l, marginTop: SP.m }}>
        <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
          <MaterialCommunityIcons name="gesture-tap-button" size={14} color={C.ink} />
          <Text style={[T.caption, { color: C.ink }]}>PUSHES {pushesLeft}/3</Text>
        </View>
        <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: C.white }, BORDER(1)]}>
          <MaterialCommunityIcons name="trophy-outline" size={14} color={C.ink} />
          <Text style={[T.caption, { color: C.ink }]}>WINS {wins}</Text>
        </View>
      </View>

      {/* ── Machine — white card, ink window, yellow payline band ── */}
      <View style={{ alignItems: 'center', marginTop: SP.m }}>
        <View style={[{ width: MACH_W, backgroundColor: C.white, padding: SP.l }, BORDER(1)]}>
          {/* Window: 2px ink frame, the brand highlighter as the payline */}
          <View style={{ width: WIN_W + 2, height: WIN_H + 2, borderWidth: 2, borderColor: C.ink, alignSelf: 'center', overflow: 'hidden', backgroundColor: C.white }}>
            {/* Yellow payline band — behind the icons, full width */}
            <View pointerEvents="none" style={{ position: 'absolute', top: SYM_H, left: 0, right: 0, height: SYM_H, backgroundColor: YELLOW }} />

            <View style={{ flexDirection: 'row' }}>
              {reels.map((val, i) => (
                <View key={i} style={{ width: REEL_W, height: WIN_H, overflow: 'hidden', borderLeftWidth: i ? 1 : 0, borderColor: C.hairline }}>
                  <Animated.View
                    style={{
                      transform: [{
                        // translateY = -(val - 1) * SYM_H — target symbol on
                        // the middle payline, one row above and below visible.
                        translateY: val.interpolate({ inputRange: [0, 1], outputRange: [SYM_H, 0] }),
                      }],
                    }}
                  >
                    {STRIP.map((s, j) => (
                      <View key={j} style={{ height: SYM_H, alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialCommunityIcons name={s as any} size={30} color={C.ink} />
                      </View>
                    ))}
                  </Animated.View>
                </View>
              ))}
            </View>

            {/* Payline side markers */}
            <View pointerEvents="none" style={{ position: 'absolute', top: SYM_H + SYM_H / 2 - 7, left: 0 }}>
              <View style={{ width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 9, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: C.ink }} />
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', top: SYM_H + SYM_H / 2 - 7, right: 0 }}>
              <View style={{ width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderRightWidth: 9, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: C.ink }} />
            </View>

            {/* Win flash — a beat of pure highlighter */}
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: YELLOW, opacity: winFlash }} />
          </View>

          {/* Paytable — hairline row, ink icons */}
          <View style={[{ flexDirection: 'row', marginTop: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            {[
              { icon: 'diamond-stone', pays: '₹500' },
              { icon: 'cash-multiple', pays: '₹200' },
              { icon: 'ticket-percent', pays: 'SHIP' },
              { icon: 'star-four-points', pays: '200P' },
              { icon: 'gift-outline', pays: 'GIFT' },
            ].map((p, i) => (
              <View key={p.icon} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, gap: 3, borderLeftWidth: i ? 1 : 0, borderColor: C.hairline }}>
                <MaterialCommunityIcons name={p.icon as any} size={15} color={C.ink} />
                <Text style={[T.micro, { color: C.dim, letterSpacing: 0.5 }]}>{p.pays}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Confetti — pixel squares bursting from the window centre */}
        <View pointerEvents="none" style={{ position: 'absolute', top: SP.l + WIN_H / 2, left: 0, right: 0, alignItems: 'center' }}>
          {confetti.map((c) => (
            <MotiView
              key={c.id}
              from={{ translateX: 0, translateY: 0, opacity: 1 }}
              animate={{ translateX: c.tx, translateY: c.ty, opacity: 0 }}
              transition={{ type: 'timing', duration: 800, delay: c.delay }}
              style={{ position: 'absolute', width: c.size, height: c.size, backgroundColor: c.color }}
            />
          ))}
        </View>
      </View>

      {/* ── Result strip ── */}
      {result && (
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', damping: 15 }} style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
          <Pressable
            onPress={() => { if (result.win) showToast('Claimed', result.label, 'gift'); setResult(null); }}
            style={[
              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SP.m, paddingVertical: 11 },
              result.big ? { backgroundColor: YELLOW, borderWidth: 1, borderColor: C.ink }
                : result.win ? { backgroundColor: C.ink }
                : [{ backgroundColor: C.white }, BORDER(1)],
            ]}
          >
            <MaterialCommunityIcons
              name={result.big ? 'crown-outline' : result.win ? 'check-decagram' : 'refresh'}
              size={18}
              color={result.big ? C.ink : result.win ? C.white : C.ink}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(14), color: result.big ? C.ink : result.win ? C.white : C.ink, letterSpacing: 0.5 }}>{result.label}</Text>
              <Text style={[T.micro, { color: result.big ? 'rgba(0,0,0,0.6)' : result.win ? 'rgba(255,255,255,0.7)' : C.dim, marginTop: 1 }]}>
                {result.sub}{result.win ? ' · tap to claim' : ''}
              </Text>
            </View>
            {result.win && <Feather name="arrow-right" size={15} color={result.big ? C.ink : C.white} />}
          </Pressable>
        </MotiView>
      )}

      <View style={{ flex: 1 }} />

      {/* ── PUSH TO SPIN — black slab sinking into a yellow offset shadow ── */}
      <View style={{ paddingHorizontal: SP.l, marginBottom: insets.bottom + 20 }}>
        <View>
          {/* offset shadow block */}
          <View style={{ position: 'absolute', top: 5, left: 5, right: -5, bottom: -5, backgroundColor: disabled ? C.hairline : YELLOW, borderWidth: 1, borderColor: disabled ? C.hairline : C.ink }} />
          <Animated.View style={{ transform: [{ translateX: pressShift }, { translateY: pressShift }] }}>
            <Pressable
              onPress={push}
              disabled={disabled}
              style={{ backgroundColor: pushesLeft <= 0 ? C.faint : C.ink, paddingVertical: 17, alignItems: 'center', borderWidth: 1, borderColor: C.ink }}
            >
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(19), color: C.white, letterSpacing: 3 }}>
                {spinning ? 'SPINNING···' : pushesLeft <= 0 ? 'COME BACK TOMORROW' : 'PUSH TO SPIN'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
        <Text style={[T.micro, { color: C.dim, textAlign: 'center', marginTop: 14 }]}>
          {pushesLeft > 0 ? 'Land 3 matching symbols on the yellow line to win' : 'Your pushes refresh at midnight'}
        </Text>
      </View>
    </View>
  );
}
