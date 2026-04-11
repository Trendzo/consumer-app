import React, { useEffect } from 'react';
import { View, Text, StatusBar, StyleSheet, Dimensions } from 'react-native';
import { MotiView, MotiText } from 'moti';
import { Easing } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const LETTERS = ['C', 'L', 'O', 'S', 'E', 'T'];

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Background scan grid ─────────────────────────── */}
      <View style={styles.gridWrap} pointerEvents="none">
        {Array.from({ length: 24 }).map((_, i) => (
          <View key={i} style={[styles.gridLine, { top: i * 40 }]} />
        ))}
      </View>

      {/* ── Top status row ───────────────────────────────── */}
      <MotiView
        from={{ opacity: 0, translateY: -8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={styles.topRow}
      >
        <View style={styles.topDot} />
        <Text style={styles.topMono}>BOOTING CLOSET-X.SYS</Text>
        <Text style={[styles.topMono, { opacity: 0.5 }]}>v4.26</Text>
      </MotiView>

      {/* ── Hero wordmark — reveals from behind a mask ───── */}
      <View style={styles.heroWrap}>
        <View style={styles.maskRow}>
          <MotiView
            from={{ translateY: 90 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 750, delay: 250 }}
          >
            <Text style={styles.letter}>CLOSET</Text>
          </MotiView>
        </View>

        <View style={[styles.maskRow, { marginTop: -22 }]}>
          <MotiView
            from={{ translateY: 90 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 750, delay: 420 }}
          >
            <Text style={styles.cross}>×</Text>
          </MotiView>
        </View>

        {/* Glitch underline that sweeps across */}
        <View style={styles.underlineTrack}>
          <MotiView
            from={{ width: 0 }}
            animate={{ width: width * 0.6 }}
            transition={{ delay: 900, type: 'timing', duration: 1200, easing: Easing.out(Easing.exp) }}
            style={styles.underlineFill}
          />
        </View>

        <MotiText
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 1100, type: 'timing', duration: 500 }}
          style={styles.tagline}
        >
          FASHION · IN · 60 · MINUTES
        </MotiText>
      </View>

      {/* ── Bottom metadata stack ───────────────────────── */}
      <View style={styles.bottomWrap}>
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1300, duration: 400 }}
          style={{ width: '100%' }}
        >
          {/* Progress bar */}
          <View style={styles.barTrack}>
            <MotiView
              from={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ delay: 1300, type: 'timing', duration: 1100, easing: Easing.inOut(Easing.cubic) }}
              style={styles.barFill}
            />
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaMono}>{'> LOADING_ASSETS'}</Text>
            <MotiText
              from={{ opacity: 0.3 }}
              animate={{ opacity: 1 }}
              transition={{ loop: true, type: 'timing', duration: 600 }}
              style={styles.metaMono}
            >
              ░▒▓█▓▒░
            </MotiText>
          </View>

          <View style={[styles.metaRow, { marginTop: 6 }]}>
            <Text style={[styles.metaMono, { opacity: 0.5 }]}>BUILD · 0413</Text>
            <Text style={[styles.metaMono, { opacity: 0.5 }]}>NODE · IN-BLR-01</Text>
            <Text style={[styles.metaMono, { opacity: 0.5 }]}>SECURE</Text>
          </View>
        </MotiView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 50,
  },
  gridWrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#fff',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topDot: {
    width: 6,
    height: 6,
    backgroundColor: '#fff',
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
  },
  maskRow: {
    overflow: 'hidden',
  },
  letter: {
    fontFamily: 'Inter_900Black',
    fontSize: 76,
    color: '#fff',
    letterSpacing: -4,
    lineHeight: 78,
  },
  cross: {
    fontFamily: 'Inter_900Black',
    fontSize: 76,
    color: '#fff',
    letterSpacing: -3,
    lineHeight: 78,
  },
  underlineTrack: {
    marginTop: 18,
    height: 2,
    width: width * 0.6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  underlineFill: {
    height: 2,
    backgroundColor: '#fff',
  },
  tagline: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    color: '#fff',
    letterSpacing: 3,
    marginTop: 14,
  },
  bottomWrap: {
    width: '100%',
  },
  barTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  barFill: {
    height: 2,
    backgroundColor: '#fff',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaMono: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1,
  },
});
