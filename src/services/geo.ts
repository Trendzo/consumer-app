// Device location capture for the address form.
//
// Why this exists: the backend requires `lat` and `lng` as finite numbers on every
// address, because they drive delivery routing and the serviceable-radius check.
// The app satisfied that by sending ONE hardcoded Mumbai coordinate for every
// address ever created — so a customer in Delhi saved a Delhi address and the
// server believed they were in Mumbai. That silently corrupts routing for
// everyone outside one city.
//
// A pincode lookup fixes city and state but cannot give coordinates; India Post
// does not return them. The only source of a true coordinate on-device is the GPS,
// which is also correct in the common case — people add their home address while
// at home.

import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

export type CaptureResult =
  | { ok: true; coords: Coords; postalCode?: string; city?: string; region?: string }
  | { ok: false; reason: 'denied' | 'unavailable' };

/** A resolved place: where the shopper is, and how we came to believe it. */
export type Place = {
  coords: Coords;
  city: string | null;
  postalCode: string | null;
  region: string | null;
  /** `gps` = read from the device. `manual` = the shopper dropped a pin themselves. */
  source: 'gps' | 'manual';
};

/**
 * Has permission already been decided, without showing a dialog?
 *
 * Distinct from requesting: on app open we want to use an existing grant silently and only
 * prompt when nothing has been decided. `canAskAgain` is false once Android's "don't ask
 * again" has been hit, which is the point where a system dialog is useless and the map
 * picker is the only way forward.
 */
export async function getPermissionState(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  try {
    const res = await Location.getForegroundPermissionsAsync();
    return { granted: res.status === 'granted', canAskAgain: res.canAskAgain !== false };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

/** Show the system dialog. Returns whether it ended in a grant. */
export async function requestPermission(): Promise<boolean> {
  try {
    const res = await Location.requestForegroundPermissionsAsync();
    return res.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Name a coordinate. Best-effort by design — a coordinate is already enough for routing and
 * for city targeting is only a nicety, so every failure returns nulls rather than throwing.
 *
 * Uses the platform geocoder rather than a web service: no key, no rate limit, and it works
 * where the OSM tile servers' usage policy would not let us hammer Nominatim.
 */
export async function describeCoords(coords: Coords): Promise<Omit<Place, 'source'>> {
  const bare = { coords, city: null, postalCode: null, region: null };
  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lng,
    });
    if (!place) return bare;
    return {
      coords,
      // `district`/`subregion` stand in for a city the geocoder reports only as a locality.
      city: place.city ?? place.district ?? place.subregion ?? null,
      postalCode: place.postalCode ?? null,
      region: place.region ?? null,
    };
  } catch {
    return bare;
  }
}

/** One line for the header: the most specific thing we actually know. */
export function placeLabel(place: Place | null): string {
  if (!place) return 'Set your location';
  const bits = [place.city, place.postalCode].filter(Boolean);
  if (bits.length) return bits.join(' ');
  // No reverse-geocode result — show the coordinate rather than pretending to know a city.
  return `${place.coords.lat.toFixed(3)}, ${place.coords.lng.toFixed(3)}`;
}

// ── Web Mercator tile maths, for the pin picker ───────────────────────────────
//
// OSM serves raster tiles at {z}/{x}/{y}.png, 256px square, in the standard spherical
// Mercator scheme. These four functions are the whole projection: they are all the picker
// needs to place tiles under a fixed centre pin and to read a coordinate back out of a pan
// offset. Written here rather than pulling in a map library, which would mean a new native
// dependency for what is ultimately arithmetic.

export const TILE_SIZE = 256;

/** Fractional tile column for a longitude at zoom `z`. */
export function lngToTileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z);
}

/** Fractional tile row for a latitude at zoom `z`. */
export function latToTileY(lat: number, z: number): number {
  // Clamped to the Mercator limit; beyond ~85° the projection runs to infinity.
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

export function tileXToLng(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

export function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Tile URL template. Defaults to OpenStreetMap's own tiles.
 *
 * NOTE for production: openstreetmap.org tiles are a donated service with a usage policy that
 * forbids heavy or commercial traffic. Point EXPO_PUBLIC_OSM_TILE_URL at your own cache or a
 * paid provider before this ships to real volume — the app needs no code change, only the URL.
 */
const TILE_TEMPLATE =
  process.env.EXPO_PUBLIC_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function tileUrl(z: number, x: number, y: number): string {
  return TILE_TEMPLATE.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

/**
 * Headers every tile request must carry.
 *
 * OSM's tile policy blocks callers that do not identify themselves, and React Native's Image
 * fetches through OkHttp, whose default `okhttp/4.x` User-Agent is exactly what those servers
 * refuse. The refusal is not an HTTP error: they answer 200 with an "Access blocked" PNG, so
 * the map renders as a wall of that graphic and reads like a rendering bug rather than a
 * rejection. A unique, honest User-Agent is the whole fix — verified against the live server.
 *
 * Keep this identifying the real app. Faking another app's User-Agent is what the policy
 * blocks permanently. If EXPO_PUBLIC_OSM_TILE_URL points at a provider that wants a key
 * instead, put it in the URL; sending this along too is harmless.
 */
export const TILE_HEADERS: Record<string, string> = {
  'User-Agent': 'Trendzo/1.0.2 (Android; com.trendzo.app)',
};

/**
 * Ask for foreground permission and read one fix, reverse-geocoding it for a
 * postcode/city we can prefill.
 *
 * Balanced accuracy, not High: a delivery address does not need metre precision,
 * and High keeps the GPS radio on far longer.
 */
export async function captureCurrentLocation(): Promise<CaptureResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

    // Reverse geocode is best-effort — a coordinate alone is already enough to
    // fix routing, so a failure here must not fail the capture.
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: coords.lat,
        longitude: coords.lng,
      });
      return {
        ok: true,
        coords,
        ...(place?.postalCode ? { postalCode: place.postalCode } : {}),
        ...(place?.city ? { city: place.city } : {}),
        ...(place?.region ? { region: place.region } : {}),
      };
    } catch {
      return { ok: true, coords };
    }
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
