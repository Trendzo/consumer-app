// Where the shopper is — one store, read by the home/category headers, the CMS city filter
// and the address form.
//
// A tiny external store rather than provider state, for the same reason toast/confirm live in
// uiBus: the location changes rarely but is read in several places, and putting it in the
// AppState context value would re-render the entire mounted tree every time a fix lands.
//
// Persisted, because the permission dialog should be a once-ever event. A shopper who granted
// (or who dropped a pin) must not be asked again on the next cold start, so the last known
// place is written to disk and read back before the gate decides whether to show itself.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { Place } from '../services/geo';

const PLACE_KEY = '@closetx/place';
/** Set once the shopper has answered the launch prompt, however they answered it. */
const ASKED_KEY = '@closetx/place_asked';

type Listener = () => void;

let current: Place | null = null;
let asked = false;
let hydrated = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * Read the persisted place before the gate runs. Resolves even on a read failure — a corrupt
 * cache must cost the shopper a re-prompt, never a launch.
 */
export async function hydratePlace(): Promise<void> {
  if (hydrated) return;
  try {
    const pairs = await AsyncStorage.multiGet([PLACE_KEY, ASKED_KEY]);
    const read = (k: string) => pairs.find(([key]) => key === k)?.[1] ?? null;
    const raw = read(PLACE_KEY);
    asked = read(ASKED_KEY) === '1';
    if (raw) {
      const parsed = JSON.parse(raw) as Place;
      // Validated rather than trusted: a half-written or older-shaped record would otherwise
      // put NaN into tile maths and the CMS query string.
      if (Number.isFinite(parsed?.coords?.lat) && Number.isFinite(parsed?.coords?.lng)) {
        current = parsed;
      }
    }
  } catch {
    // Leave the defaults; the gate will ask.
  } finally {
    hydrated = true;
    emit();
  }
}

// ── "Change location" channel ─────────────────────────────────────────────────
//
// The headers that display the place also need to let the shopper change it. Rather than each
// one mounting its own MapPicker (two modals, two copies of the state, two ways to drift), they
// fire this and the single picker inside LocationGate opens.

const pickListeners = new Set<Listener>();

/** Open the map picker, from anywhere. */
export function openLocationPicker(): void {
  pickListeners.forEach((l) => l());
}

export function subscribeLocationPick(l: Listener): () => void {
  pickListeners.add(l);
  return () => { pickListeners.delete(l); };
}

export function getPlace(): Place | null {
  return current;
}

export function hasHydrated(): boolean {
  return hydrated;
}

export function hasAsked(): boolean {
  return asked;
}

/** Record that the launch prompt has been answered, so it is never shown twice. */
export async function markAsked(): Promise<void> {
  if (asked) return;
  asked = true;
  emit();
  await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
}

export async function setPlace(place: Place): Promise<void> {
  current = place;
  emit();
  await AsyncStorage.setItem(PLACE_KEY, JSON.stringify(place)).catch(() => {});
}

/** Subscribe a component to the current place. */
export function usePlace(): Place | null {
  return useSyncExternalStore(subscribe, getPlace, getPlace);
}

/**
 * The city to filter CMS content by, or null for "everywhere".
 *
 * Lower-cased and trimmed because it goes into a query string that the backend compares
 * against admin-entered city lists, and an admin typing "Mumbai" must match a device
 * reporting "mumbai".
 */
export function usePlaceCity(): string | null {
  const place = usePlace();
  const city = place?.city?.trim();
  return city ? city.toLowerCase() : null;
}
