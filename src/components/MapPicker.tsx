// Drop-a-pin location picker, on OpenStreetMap tiles.
//
// Deliberately built from an Image grid and one pan gesture rather than a map SDK. OSM serves
// 256px raster tiles at {z}/{x}/{y}.png in plain Web Mercator, so placing them is arithmetic
// (see services/geo.ts) — and the alternatives all cost a new native dependency: react-native-maps
// is Google Maps on Android and wants an API key, MapLibre ships a renderer, and a WebView
// + Leaflet means loading a script off a CDN at runtime.
//
// The interaction is the one every delivery app uses: the pin is FIXED at the centre of the
// screen and the map moves under it. That removes the whole class of "which pixel did they tap,
// and did the tap land on a tile or the gap between two" problems, and it reads as precise
// because the shopper is aiming the map rather than poking at it.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
// expo-image, not react-native's Image: RN's Android image pipeline drops the source `headers`
// here, so the tile server sees OkHttp's own User-Agent and answers with its "Access blocked"
// graphic. expo-image passes headers through to the fetch, which is what makes tiles load.
import { Image as ExpoImage } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { C, T, SP, BORDER } from '../theme/brutal';
import { BrutalButton } from './Brutal';
import {
  TILE_SIZE, TILE_HEADERS, tileUrl, lngToTileX, latToTileY, tileXToLng, tileYToLat,
  describeCoords, captureCurrentLocation, type Coords, type Place,
} from '../services/geo';

/** Centre of India — a neutral opening view when we have no better guess at all. */
const FALLBACK_CENTER: Coords = { lat: 22.9734, lng: 78.6569 };
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;
/** Close enough to see individual buildings, which is the precision a courier needs. */
const DEFAULT_ZOOM = 16;
/** A neutral zoom for "we only know the country", so the shopper can find their city. */
const COARSE_ZOOM = 5;

export type MapPickerProps = {
  visible: boolean;
  /** Opening centre. Omitted (no known location) opens on the country at a coarse zoom. */
  initial?: Coords | null | undefined;
  title?: string;
  onCancel: () => void;
  onConfirm: (place: Omit<Place, 'source'>) => void;
};

export function MapPicker({ visible, initial, title, onCancel, onConfirm }: MapPickerProps) {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();

  const [center, setCenter] = useState<Coords>(initial ?? FALLBACK_CENTER);
  const [zoom, setZoom] = useState(initial ? DEFAULT_ZOOM : COARSE_ZOOM);
  const [size, setSize] = useState({ w: win.width, h: 320 });
  const [naming, setNaming] = useState(false);
  const [locating, setLocating] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  // Reopening for a different address must not inherit the last one's pin.
  useEffect(() => {
    if (!visible) return;
    setCenter(initial ?? FALLBACK_CENTER);
    setZoom(initial ? DEFAULT_ZOOM : COARSE_ZOOM);
    setLabel(null);
  }, [visible, initial?.lat, initial?.lng]);

  // Pan lives on the UI thread; only the settled offset crosses back to JS. Panning a grid of
  // tiles by re-rendering per frame would drop frames on a mid-range device, so the whole grid
  // is translated as one layer and the tiles are only recomputed once the finger lifts.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const commitPan = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    const cx = lngToTileX(center.lng, zoom) - dx / TILE_SIZE;
    const cy = latToTileY(center.lat, zoom) - dy / TILE_SIZE;
    const span = Math.pow(2, zoom);
    setCenter({
      lng: tileXToLng(((cx % span) + span) % span, zoom),
      // Clamped so a hard flick past the pole cannot produce a NaN latitude.
      lat: tileYToLat(Math.max(0, Math.min(span, cy)), zoom),
    });
    setLabel(null);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          tx.value = e.translationX;
          ty.value = e.translationY;
        })
        .onEnd(() => {
          const dx = tx.value;
          const dy = ty.value;
          tx.value = 0;
          ty.value = 0;
          runOnJS(commitPan)(dx, dy);
        }),
    // Rebuilt when the centre/zoom change, because commitPan closes over both.
    [center.lat, center.lng, zoom],
  );

  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  /**
   * The visible tiles, plus a one-tile margin so a pan reveals map rather than background
   * before the finger lifts and the grid is recomputed.
   */
  const tiles = useMemo(() => {
    const span = Math.pow(2, zoom);
    const cx = lngToTileX(center.lng, zoom);
    const cy = latToTileY(center.lat, zoom);
    const halfCols = Math.ceil(size.w / 2 / TILE_SIZE) + 1;
    const halfRows = Math.ceil(size.h / 2 / TILE_SIZE) + 1;
    const out: { key: string; url: string; left: number; top: number }[] = [];
    for (let i = Math.floor(cx) - halfCols; i <= Math.floor(cx) + halfCols; i++) {
      for (let j = Math.floor(cy) - halfRows; j <= Math.floor(cy) + halfRows; j++) {
        // Rows off the top/bottom of the world have no tile; columns wrap around it.
        if (j < 0 || j >= span) continue;
        const wrappedI = ((i % span) + span) % span;
        out.push({
          key: `${zoom}/${wrappedI}/${j}`,
          url: tileUrl(zoom, wrappedI, j),
          left: size.w / 2 + (i - cx) * TILE_SIZE,
          top: size.h / 2 + (j - cy) * TILE_SIZE,
        });
      }
    }
    return out;
  }, [center.lat, center.lng, zoom, size.w, size.h]);

  const jumpToMe = async () => {
    if (locating) return;
    setLocating(true);
    const res = await captureCurrentLocation();
    setLocating(false);
    if (!res.ok) return;
    setCenter(res.coords);
    setZoom(DEFAULT_ZOOM);
    setLabel(null);
  };

  // Name the pin so the shopper can see they are confirming the right place, not just a dot.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const t = setTimeout(() => {
      describeCoords(center).then((p) => {
        if (cancelled) return;
        setLabel([p.city, p.postalCode].filter(Boolean).join(' ') || null);
      });
    }, 350); // settle before geocoding, so a pan does not fire one lookup per frame
    return () => { cancelled = true; clearTimeout(t); };
  }, [visible, center.lat, center.lng]);

  const confirm = async () => {
    if (naming) return;
    setNaming(true);
    const described = await describeCoords(center);
    setNaming(false);
    onConfirm(described);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      {/* A Modal is its own Android window and does not inherit the app's gesture-handler root,
          so a GestureDetector inside one receives nothing without this wrapper. Without it the
          map simply refuses to pan. */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        {/* HEADER */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m, paddingHorizontal: SP.l, paddingVertical: SP.m }}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Feather name="arrow-left" size={20} color={C.ink} />
          </Pressable>
          <Text style={[T.h3, { flex: 1, textTransform: 'uppercase' }]}>{title ?? 'Pick your location'}</Text>
        </View>

        {/* MAP */}
        <View
          style={{ flex: 1, overflow: 'hidden', backgroundColor: '#E8E4DD' }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
          }}
        >
          <GestureDetector gesture={pan}>
            <Animated.View style={[{ flex: 1 }, gridStyle]}>
              {tiles.map((t) => (
                <ExpoImage
                  key={t.key}
                  // Headers, not just a URL: without an identifying User-Agent the tile server
                  // serves an "Access blocked" graphic with a 200, and the map looks broken.
                  source={{ uri: t.url, headers: TILE_HEADERS }}
                  style={{ position: 'absolute', left: t.left, top: t.top, width: TILE_SIZE, height: TILE_SIZE }}
                  // Tiles are opaque squares that abut exactly; a fade would show seams.
                  transition={0}
                  // Panning revisits the same tiles constantly — keep them on disk, not just in
                  // memory, so a reopen or a pan back is instant and costs the server nothing.
                  cachePolicy="memory-disk"
                />
              ))}
            </Animated.View>
          </GestureDetector>

          {/* CENTRE PIN — outside the panned layer, so it stays put while the map moves.
              pointerEvents none, or it would swallow the drag that aims it. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="map-pin" size={36} color={C.ink} style={{ marginBottom: 18 }} />
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.ink, marginTop: -14 }} />
          </View>

          {/* ZOOM — buttons, not pinch. One finger aims the map and the other hand is holding
              the phone; discrete steps also keep the tile grid on integer zooms, which is the
              only thing the tile scheme can actually serve. */}
          <View style={{ position: 'absolute', right: SP.m, top: SP.m, gap: SP.s }}>
            {([['plus', 1], ['minus', -1]] as const).map(([icon, dir]) => (
              <Pressable
                key={icon}
                onPress={() => setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + dir)))}
                style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}
              >
                <Feather name={icon} size={18} color={C.ink} />
              </Pressable>
            ))}
            <Pressable
              onPress={jumpToMe}
              style={[{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}
            >
              {locating ? <ActivityIndicator size="small" color={C.ink} /> : <Feather name="crosshair" size={18} color={C.ink} />}
            </Pressable>
          </View>
        </View>

        {/* FOOTER */}
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m, paddingBottom: insets.bottom + SP.l, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.hairline }}>
          <Text style={[T.caption, { color: C.dim }]}>Move the map to place the pin</Text>
          <Text style={[T.bodyB, { marginTop: 4 }]} numberOfLines={1}>
            {label ?? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`}
          </Text>
          <BrutalButton
            label={naming ? 'Confirming…' : 'Use this location'}
            iconRight="check"
            onPress={confirm}
            disabled={naming}
            block
            style={{ marginTop: SP.m }}
          />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export default MapPicker;
