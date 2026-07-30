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
