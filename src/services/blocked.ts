// Creators this shopper has blocked.
//
// App Store Review Guideline 1.2 requires an app with user-generated content to
// let a user block someone abusive, with the content gone from their feed at
// once. There is no server-side block endpoint, so the list lives on the device:
// the reels feed filters these authors out on every fetch. Reporting (which does
// reach the moderation queue) is separate — see reportContent in ./community.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@closetx/blockedAuthors';
/** A sane ceiling so the stored list can never grow without bound. */
const MAX = 500;

/** Read the list. Never throws — an unreadable store just means none. */
export async function getBlockedAuthors(): Promise<string[]> {
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

/** Add an author and return the updated list, newest first. */
export async function blockAuthor(authorId: string): Promise<string[]> {
  const current = await getBlockedAuthors();
  const next = [authorId, ...current.filter((id) => id !== authorId)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return next;
}
