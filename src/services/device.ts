// A stable per-install identifier.
//
// The app had no concept of an anonymous identity — nothing distinguished one
// signed-out visitor from another. Spin & Win needs one, because "one spin per
// day" has to mean something before a shopper has an account.
//
// Deliberately NOT a security token. It survives until the app is uninstalled and
// a determined person can reset it in seconds, so the server treats it as a
// throttle key and nothing more: the real protection on the prize budget is the
// per-account claim cap, which needs a verified phone number to move.
//
// No `expo-crypto` in this project, so the id is composed from the clock plus
// several random segments. Uniqueness across installs is what matters and this
// gives ~10^19 of headroom for it; unpredictability is not a requirement.

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@closetx/deviceId';

/** Cached after the first read so callers can await it freely on every render path. */
let cached: string | null = null;
let inFlight: Promise<string> | null = null;

function mint(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `dev-${Date.now().toString(36)}-${rand()}${rand()}`;
}

/**
 * The device id for this install, creating and persisting one on first call.
 *
 * Concurrent callers share a single in-flight read, so mounting three screens at
 * once cannot mint three ids and have the last write win.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (stored) {
        cached = stored;
        return stored;
      }
      const fresh = mint();
      await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
      cached = fresh;
      return fresh;
    } catch {
      // Storage unavailable (rare, but it happens on a full disk). Fall back to an
      // in-memory id: the shopper gets their spin, and the cap resets next launch —
      // which is the right way to fail on a promotional feature.
      cached = cached ?? mint();
      return cached;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
