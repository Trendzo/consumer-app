import React, { useEffect, useState } from 'react';
import { View, StatusBar, StyleSheet, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// ── Hero pixel-art shopping cart (13 × 12) ──────────────────
const CART = [
  'XX...........',
  '.X...........',
  '.X..XXXXXXXX.',
  '.XXXX......X.',
  '....X......X.',
  '....X......X.',
  '....X......X.',
  '....XXXXXXXX.',
  '.....X....X..',
  '.............',
  '....XX...XX..',
  '....XX...XX..',
];
const CART_COLS = CART[0].length;
const CART_CELL = Math.min(17, Math.floor((width * 0.55) / CART_COLS));

// ── 5 × 5 pixel font for the wordmark ───────────────────────
const FONT: Record<string, string[]> = {
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..'],
  R: ['XXXX.', 'X...X', 'XXXX.', 'X..X.', 'X...X'],
  E: ['XXXXX', 'X....', 'XXXX.', 'X....', 'XXXXX'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  Z: ['XXXXX', '...X.', '..X..', '.X...', 'XXXXX'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', '.XXX.'],
};
const WORD = 'TRENDZO';
// Build 5 rows for the whole word, letters separated by a 1px gap column.
const WORD_ROWS = Array.from({ length: 5 }, (_, r) =>
  WORD.split('').map((ch) => FONT[ch][r]).join('.'),
);
const WORD_COLS = WORD_ROWS[0].length;
const WORD_CELL = Math.min(9, Math.floor((width * 0.82) / WORD_COLS));

const ZOOM_SCALE = 4;      // each particle swells as it comes toward you — small enough to keep gaps
const ZOOM_STAGGER = 34;   // ms per ring — particles launch one after another from the centre out
const DIAG = Math.hypot(width, height);
// Deterministic pseudo-random (stable per particle across re-renders) — used to
// scatter the burst so it looks like a swirl of light, not a neat grid.
const rand2 = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Renders a bitmap grid where every 'X' pops in with a diagonal stagger. When
// `zooming` flips true the grid DISPERSES like the Paytm QR: each particle
// flies OUTWARD in its own direction (radial + swirl), scattered and staggered
// from the centre out — an explosion of light, not a group zoom. Nested pair:
// OUTER = the outward flight (screen-space), INNER = swell + spin.
function PixelGrid({ rows, cell, base, zooming = false, zoomBase = 0 }: {
  rows: string[]; cell: number; base: number; zooming?: boolean; zoomBase?: number;
}) {
  const cols = rows[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows.length - 1) / 2;
  const pxSize = cell - Math.max(1.5, cell * 0.14);
  return (
    <View style={{ width: cell * cols }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {row.split('').map((c, x) => {
            if (c !== 'X') return <View key={x} style={{ width: cell, height: cell }} />;
            const dcx = x - cx;
            const dcy = r - cy;
            const radius = Math.hypot(dcx, dcy);
            const j = rand2(r, x);
            // Outward direction from centre + a swirl twist + a little jitter.
            let angle = Math.atan2(dcy, dcx) + 0.5 + (j - 0.5) * 0.7;
            if (radius < 0.01) angle = j * Math.PI * 2;
            // Wide scatter so the particles spread out with clear gaps between
            // them (not a tight clump) as they disperse.
            const throw_ = DIAG * (0.34 + rand2(x, r) * 0.42);
            const tx = Math.cos(angle) * throw_;
            const ty = Math.sin(angle) * throw_;
            const spin = `${(j - 0.5) * 200}deg`;
            // Launch order: rings from the centre outward, so it bursts one by one.
            const delay = zoomBase + Math.min(radius, 9) * ZOOM_STAGGER + j * 70;
            return (
              <View key={x} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
                {/* OUTER — the outward flight, spreading apart */}
                <MotiView
                  from={{ translateX: 0, translateY: 0 }}
                  animate={zooming ? { translateX: tx, translateY: ty } : { translateX: 0, translateY: 0 }}
                  transition={zooming
                    ? { type: 'timing', duration: 820, delay, easing: Easing.out(Easing.cubic) }
                    : { type: 'timing', duration: 150 }}
                >
                  {/* INNER — swells toward you, spins, then fades into light (no white wall) */}
                  <MotiView
                    from={{ opacity: 0, scale: 0, rotate: '0deg' }}
                    animate={zooming ? { opacity: 0, scale: ZOOM_SCALE, rotate: spin } : { opacity: 1, scale: 1, rotate: '0deg' }}
                    transition={zooming
                      ? { type: 'timing', duration: 820, delay, easing: Easing.out(Easing.cubic) }
                      : { type: 'spring', delay: base + (r + x) * 18, damping: 12, stiffness: 220, mass: 0.6 }}
                    style={{ width: pxSize, height: pxSize, borderRadius: 1.5, backgroundColor: '#fff' }}
                  />
                </MotiView>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  // Ending: the cart + wordmark disperse — every particle bursts outward from
  // the centre (staggered), swelling and spinning, then fading into light.
  // No white wall; once the burst clears we hand off to home.
  const [zooming, setZooming] = useState(false);
  useEffect(() => {
    const tz = setTimeout(() => setZooming(true), 2050);
    const t = setTimeout(onDone, 3350);
    return () => { clearTimeout(tz); clearTimeout(t); };
  }, [onDone]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroWrap}>
        <View style={styles.stack}>
          <PixelGrid rows={CART} cell={CART_CELL} base={200} zooming={zooming} zoomBase={0} />
          <PixelGrid rows={WORD_ROWS} cell={WORD_CELL} base={780} zooming={zooming} zoomBase={120} />
        </View>
      </View>

      {/* ── Bottom loader — plain white sweep ── */}
      <View style={styles.bottomWrap}>
        <View style={styles.barTrack}>
          <MotiView
            from={{ translateX: -width }}
            animate={{ translateX: 0 }}
            transition={{ delay: 250, type: 'timing', duration: 1800, easing: Easing.inOut(Easing.cubic) }}
            style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 22,
    paddingTop: 70,
    paddingBottom: 48,
  },
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    alignItems: 'center',
    gap: 34,
  },
  bottomWrap: {
    width: '100%',
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
});
