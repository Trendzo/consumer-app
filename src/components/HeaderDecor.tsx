// Festival header decoration — the visual layer a theme paints UNDER the home
// header's interactive overlay (wordmark, location row, search).
//
// Strictly decorative and strictly inert: pointerEvents="none" at the root so
// profile/location/search taps land regardless of z-order, and the whole tree
// is hidden from accessibility. Every asset degrades independently — a dead
// Lottie URL leaves the overlay strip, a dead overlay leaves the band, and the
// theme itself is never torn down by an asset failure.
//
// The bottom edge fades to the SAME color at alpha 0, never to 'transparent':
// transparent is transparent BLACK, and compositing it over the band produces a
// gray fringe (learned the hard way in CategoryScreen's edge masks).

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { hexAlpha, type ResolvedTheme } from '../theme/remoteTheme';
import { CachedImage } from './Brutal';

const FRINGE_H = 24;

/** Module cache so a remount never refetches the same animation JSON. */
type AnimationJson = Record<string, unknown>;
const lottieCache = new Map<string, AnimationJson>();
const LOTTIE_MAX_BYTES = 1024 * 1024;

function useLottieJson(url: string | undefined): AnimationJson | null {
  const [json, setJson] = useState<AnimationJson | null>(url ? lottieCache.get(url) ?? null : null);
  useEffect(() => {
    if (!url) {
      setJson(null);
      return;
    }
    // Cache hit still has to publish to state — otherwise a theme swap to an
    // already-fetched animation leaves the previous one playing.
    const cached = lottieCache.get(url);
    if (cached) {
      setJson(cached);
      return;
    }
    setJson(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const text = await res.text();
        if (text.length > LOTTIE_MAX_BYTES) return; // decor is never worth a megabyte
        const parsed = JSON.parse(text) as AnimationJson;
        lottieCache.set(url, parsed);
        if (!cancelled) setJson(parsed);
      } catch {
        // 'failed' is simply "no lottie layer" — the band and overlay stand alone.
      }
    })();
    return () => { cancelled = true; };
  }, [url]);
  return json;
}

/** OS reduce-motion — greenfield in this app, so the listener lives here for now. */
function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (!cancelled) setReduced(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { cancelled = true; sub.remove(); };
  }, []);
  return reduced;
}

function LottieDecor({ decor }: { decor: ResolvedTheme['decor'] }) {
  const json = useLottieJson(decor.url);
  const ref = useRef<LottieView>(null);
  const plays = useRef(0);
  if (!json) return null;
  return (
    <LottieView
      ref={ref}
      // Parsed object source, not {uri}: gives us the failure hook above and
      // avoids the remote-uri code path this app has never exercised.
      source={json as unknown as import('lottie-react-native').AnimationObject}
      autoPlay
      loop={decor.loop}
      onAnimationFinish={() => {
        if (decor.loop) return;
        plays.current += 1;
        if (decor.maxPlays !== undefined && plays.current < decor.maxPlays) {
          ref.current?.play();
        }
      }}
      resizeMode="cover"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}

type Props = {
  header: ResolvedTheme['chrome']['header'];
  decor: ResolvedTheme['decor'];
  /** Band height — the header overlay's measured height plus breathing room. */
  height: number;
};

/**
 * Layer stack, top of screen down to `height`:
 *   1. band background — solid and gradient kinds FADE OUT over the last
 *      FRINGE_H (band color to the same color at alpha 0), because on Home the
 *      band sits over the hero PHOTO, and melting into it beats a hard edge.
 *      Kind 'image' keeps a hard edge: it is a designed full-bleed header.
 *   2. overlay art strip, bottom-aligned above the fringe (solid+gradient only)
 *   3. lottie or image decor, absolute-fill
 * The un-themed case never mounts this component at all (HomeScreen gates it).
 */
export default function HeaderDecor({ header, decor, height }: Props) {
  const reduceMotion = useReduceMotion();
  const [overlayDead, setOverlayDead] = useState(false);
  const [decorImgDead, setDecorImgDead] = useState(false);

  // A new theme means new art: clear the "this URL is dead" latches, or the next
  // festival inherits the previous one's failures and renders a bare band.
  useEffect(() => { setOverlayDead(false); }, [header.overlayUrl]);
  useEffect(() => { setDecorImgDead(false); }, [decor.url]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}
    >
      {header.kind === 'solid' && header.color ? (
        <LinearGradient
          colors={[header.color, header.color, hexAlpha(header.color, 0)] as [string, string, string]}
          locations={[0, 1 - FRINGE_H / height, 1] as [number, number, number]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {header.kind === 'gradient' && header.gradient ? (
        <LinearGradient
          colors={[header.gradient[0], header.gradient[1], hexAlpha(header.gradient[1], 0)] as [string, string, string]}
          locations={[0, 1 - FRINGE_H / height, 1] as [number, number, number]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {header.kind === 'image' && header.overlayUrl ? (
        <>
          {/* Underfill while the image decodes (and its permanent home on failure). */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: header.color ?? '#000000' }} />
          {!overlayDead ? (
            <CachedImage
              source={{ uri: header.overlayUrl }}
              resizeMode="cover"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              onError={() => setOverlayDead(true)}
            />
          ) : null}
        </>
      ) : null}

      {/* Overlay art strip (diyas, garlands) along the band's bottom edge. For
          kind 'image' the overlayUrl IS the band, so the strip only applies to
          solid/gradient bands. */}
      {header.kind !== 'image' && header.overlayUrl && !overlayDead ? (
        <CachedImage
          source={{ uri: header.overlayUrl }}
          resizeMode="cover"
          style={{ position: 'absolute', left: 0, right: 0, bottom: FRINGE_H, height: header.overlayHeight }}
          onError={() => setOverlayDead(true)}
        />
      ) : null}

      {decor.kind === 'lottie' && !reduceMotion ? <LottieDecor decor={decor} /> : null}
      {decor.kind === 'image' && decor.url && !decorImgDead ? (
        <CachedImage
          source={{ uri: decor.url }}
          resizeMode="cover"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.9 }}
          onError={() => setDecorImgDead(true)}
        />
      ) : null}

    </View>
  );
}
