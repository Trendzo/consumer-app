// Recent searches — the shopper's own last few queries, on this device.
//
// The Search screen used to render a fixed list ('oversized blazer', 'cropped
// cargo', 'silk dress', 'sneakers') that was never written to and never read
// back, so it showed the same four phrases to everyone forever and never once
// showed something the person had actually typed.
//
// Deliberately LOCAL. There is no search-history endpoint on the backend, and a
// recent-search list is per-device by nature: it must render instantly, work
// offline, and belong to whoever is holding the phone. Nothing here is sent
// anywhere.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@closetx/recentSearches';
/** Enough to be useful, few enough that the list never pushes Trending off-screen. */
const MAX = 8;
/** Longer than this is a paste, not a search — store a sane prefix. */
const MAX_LEN = 60;

/** Read the list, newest first. Never throws — an unreadable store just means none. */
export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX);
  } catch {
    return [];
  }
}

/**
 * Record a search and return the new list.
 *
 * Case-insensitive dedupe, but the NEW spelling wins — someone who types
 * "Kenneth Cole" after "kenneth cole" should see it the way they last wrote it,
 * with one entry rather than two.
 */
export async function addRecentSearch(term: string): Promise<string[]> {
  const clean = term.trim().slice(0, MAX_LEN);
  if (!clean) return getRecentSearches();
  const existing = await getRecentSearches();
  const next = [clean, ...existing.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

/** Drop one entry (the per-row ×). Returns the new list. */
export async function removeRecentSearch(term: string): Promise<string[]> {
  const next = (await getRecentSearches()).filter((x) => x !== term);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
