import React, { useEffect } from 'react';
import { View, Text, StatusBar, StyleSheet, Dimensions } from 'react-native';
import { MotiView, MotiText } from 'moti';
import { Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { rf } from '../theme/brutal';

const { width } = Dimensions.get('window');

const PINK = '#FF1E8E';
const PINK_DEEP = '#C9106B';

// Hero pixel-art heart (13 × 11). Each 'X' pops in with a diagonal stagger so
// the mark "materialises" pixel by pixel — ties the splash to the app's new
// pixelated bottom nav.
const HEART = [
  '..XXX...XXX..',
  '.XXXXX.XXXXX.',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  '.XXXXXXXXXXX.',
  '..XXXXXXXXX..',
  '...XXXXXXX...',
  '....XXXXX....',
  '.....XXX.....',
  '......X......',
];
const COLS = HEART[0].length;
const CELL = Math.min(17, Math.floor((width * 0.62) / COLS));

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Background: dark base + a warm pink glow rising from below ── */}
      <LinearGradient
        colors={['#000000', '#0A0208', '#1A0410']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowWrap} pointerEvents="none">
        <MotiView
          from={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.55, scale: 1 }}
          transition={{ type: 'timing', duration: 1400, easing: Easing.out(Easing.cubic) }}
          style={styles.glow}
        />
      </View>

      {/* ── Top status row ── */}
      <MotiView
        from={{ opacity: 0, translateY: -8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={styles.topRow}
      >
        <MotiView
          from={{ opacity: 0.3 }}
          animate={{ opacity: 1 }}
          transition={{ loop: true, type: 'timing', duration: 700 }}
          style={styles.topDot}
        />
        <Text style={styles.topMono}>BOOTING TRENDZO</Text>
      </MotiView>

      {/* ── Hero: pixel heart that assembles ── */}
      <View style={styles.heroWrap}>
        <View style={{ width: CELL * COLS }}>
          {HEART.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', height: CELL }}>
              {row.split('').map((c, x) => {
                if (c !== 'X') return <View key={x} style={{ width: CELL, height: CELL }} />;
                const delay = 220 + (r + x) * 26;
                return (
                  <MotiView
                    key={x}
                    from={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay, damping: 12, stiffness: 220, mass: 0.6 }}
                    style={{
                      width: CELL - 2.5,
                      height: CELL - 2.5,
                      margin: 1.25,
                      borderRadius: 1.5,
                      backgroundColor: (r + x) % 3 === 0 ? PINK_DEEP : PINK,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Wordmark — slides up from behind a mask once the heart lands */}
        <View style={styles.maskRow}>
          <MotiView
            from={{ translateY: 80 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 650, delay: 720, easing: Easing.out(Easing.cubic) }}
          >
            <Text style={styles.wordmark} numberOfLines={1} adjustsFontSizeToFit>TRENDZO</Text>
          </MotiView>
        </View>

        <MotiText
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 1050, type: 'timing', duration: 500 }}
          style={styles.tagline}
        >
          FASHION · IN · 60 · MINUTES
        </MotiText>
      </View>

      {/* ── Bottom loader ── */}
      <View style={styles.bottomWrap}>
        <View style={styles.barTrack}>
          <MotiView
            from={{ translateX: -width }}
            animate={{ translateX: 0 }}
            transition={{ delay: 300, type: 'timing', duration: 2100, easing: Easing.inOut(Easing.cubic) }}
            style={StyleSheet.absoluteFill}
          >
            <LinearGradient
              colors={[PINK_DEEP, PINK, '#FF66B2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </MotiView>
        </View>
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 500, duration: 500 }}
          style={styles.footMono}
        >
          © TRENDZO — v1.0
        </MotiText>
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
    paddingBottom: 44,
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: width * 1.1,
    height: width * 1.1,
    borderRadius: width,
    backgroundColor: PINK,
    // soft bloom — big blurred-looking disc behind the heart
    shadowColor: PINK,
    shadowOpacity: 0.9,
    shadowRadius: 120,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PINK,
  },
  topMono: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 1.5,
  },
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },
  maskRow: {
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  wordmark: {
    fontFamily: 'Inter_900Black',
    fontSize: rf(64),
    color: '#fff',
    letterSpacing: -3,
    lineHeight: rf(66),
    textAlign: 'center',
    maxWidth: width - 44,
  },
  tagline: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    color: PINK,
    letterSpacing: 3,
    marginTop: -14,
  },
  bottomWrap: {
    width: '100%',
    gap: 12,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  footMono: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});
