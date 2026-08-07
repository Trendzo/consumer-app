import React, { useEffect, useState } from 'react';
import { View, StatusBar, StyleSheet, Dimensions, Image } from 'react-native';
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

// ── Wordmark — the real Trendzo logo (white on transparent) ─────────
// This replaced a 5×5 pixel-font grid that lit ~60 cells: with two nested
// animated views per cell that was ~120 animated views for the word alone,
// all mounting while the app cold-starts behind the splash — the single
// biggest source of splash jank. One image + one animator now.
const LOGO = require('../../assets/trendzo-logo.png');
const LOGO_W = Math.min(Math.round(width * 0.78), 360);
const LOGO_H = Math.round((LOGO_W * 123) / 600); // asset is 600×123

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
// from the centre out — an explosion of light, not a group zoom.
function PixelGrid({ rows, cell, base, zooming = false, zoomBase = 0 }: {
  rows: string[]; cell: number; base: number; zooming?: boolean; zoomBase?: number;
}) {
  const cols = rows[0].length;
  const pxSize = cell - Math.max(1.5, cell * 0.14);

  /**
   * Only the LIT cells become views, absolutely positioned — and ONE view per
   * particle. The previous version nested two MotiViews per cell (outer =
   * flight, inner = swell/spin), doubling the animated-view count on the very
   * first frame of the app. Flight, swell and spin now ride one transform
   * (translate first, then scale/rotate — same visual composition).
   *
   * The geometry is memoised: it is pure trig over the glyph data and does
   * not depend on `zooming`.
   */
  const particles = React.useMemo(() => {
    const cx = (cols - 1) / 2;
    const cy = (rows.length - 1) / 2;
    const inset = (cell - pxSize) / 2;
    const out: {
      key: string; left: number; top: number;
      tx: number; ty: number; spin: string; delay: number; springDelay: number;
    }[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]!;
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 'X') continue;
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
        out.push({
          key: `${r}-${x}`,
          left: x * cell + inset,
          top: r * cell + inset,
          tx: Math.cos(angle) * throw_,
          ty: Math.sin(angle) * throw_,
          spin: `${(j - 0.5) * 200}deg`,
          // Launch order: rings from the centre outward, so it bursts one by one.
          delay: zoomBase + Math.min(radius, 9) * ZOOM_STAGGER + j * 70,
          springDelay: base + (r + x) * 18,
        });
      }
    }
    return out;
  }, [rows, cell, base, zoomBase, cols, pxSize]);

  return (
    <View style={{ width: cell * cols, height: cell * rows.length }}>
      {particles.map((pt) => (
        <MotiView
          key={pt.key}
          from={{ translateX: 0, translateY: 0, scale: 0, rotate: '0deg', opacity: 0 }}
          animate={zooming
            ? { translateX: pt.tx, translateY: pt.ty, scale: ZOOM_SCALE, rotate: pt.spin, opacity: 0 }
            : { translateX: 0, translateY: 0, scale: 1, rotate: '0deg', opacity: 1 }}
          transition={zooming
            ? { type: 'timing', duration: 820, delay: pt.delay, easing: Easing.out(Easing.cubic) }
            : { type: 'spring', delay: pt.springDelay, damping: 12, stiffness: 220, mass: 0.6 }}
          style={{ position: 'absolute', left: pt.left, top: pt.top, width: pxSize, height: pxSize, borderRadius: 1.5, backgroundColor: '#fff' }}
        />
      ))}
    </View>
  );
}

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  // Ending: the cart + wordmark disperse — every particle bursts outward from
  // the centre (staggered), swelling and spinning, then fading into light.
  // No white wall; once the burst clears we hand off to home.
  const [zooming, setZooming] = useState(false);
  // `leaving` gates the exit: the whole burst plays out ON BLACK, and only
  // once the particles are spent does the black (and the logo with it) fade —
  // so no splash element is ever composited over a visible home page.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const tz = setTimeout(() => setZooming(true), 1150);
    const tl = setTimeout(() => setLeaving(true), 1980);
    const t = setTimeout(onDone, 2300);
    return () => { clearTimeout(tz); clearTimeout(tl); clearTimeout(t); };
  }, [onDone]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Black backdrop — fades OUT as the particles disperse, so the
          already-mounted home shows through the spreading burst instead of
          the splash ending on a static black frame. */}
      <MotiView
        pointerEvents="none"
        from={{ opacity: 1 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ type: 'timing', duration: 300, easing: Easing.inOut(Easing.cubic) }}
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}
      />

      <View style={styles.heroWrap}>
        <View style={styles.stack}>
          <PixelGrid rows={CART} cell={CART_CELL} base={200} zooming={zooming} zoomBase={0} />
          {/* Logo — static through the whole splash; it only fades out WITH
              the black backdrop at the very end, never lingering over home. */}
          <MotiView animate={{ opacity: leaving ? 0 : 1 }} transition={{ type: 'timing', duration: 250 }}>
            <Image source={LOGO} style={{ width: LOGO_W, height: LOGO_H }} resizeMode="contain" />
          </MotiView>
        </View>
      </View>

      {/* ── Bottom loader — plain white sweep (fades with the burst) ── */}
      <MotiView
        from={{ opacity: 1 }}
        animate={{ opacity: zooming ? 0 : 1 }}
        transition={{ type: 'timing', duration: 400 }}
        style={styles.bottomWrap}
      >
        <View style={styles.barTrack}>
          <MotiView
            from={{ translateX: -width }}
            animate={{ translateX: 0 }}
            transition={{ delay: 250, type: 'timing', duration: 1800, easing: Easing.inOut(Easing.cubic) }}
            style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]}
          />
        </View>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Transparent — the animated black backdrop above handles the fill, so it
    // can fade out to reveal the pre-mounted home underneath.
    backgroundColor: 'transparent',
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
