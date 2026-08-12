// Virtual try-on via the Trendzo backend (Vertex `virtual-try-on-001`).
//
// Flow:
//   1. Upload the PERSON photo (local file) to the backend  → POST /uploads
//      → a public hosted URL.
//   2. Call the backend try-on with that person URL plus a REFERENCE to the
//      garment — `listingId`, and `variantId` when the shopper picked a specific
//      variant's image → POST /consumer/tryon → the result image URL.
//
// The app NEVER sends a garment URL. It names the product and the server looks
// the file up in its own catalogue. Two reasons, both load-bearing:
//   • SSRF — a URL parameter would let a caller point the image fetcher at
//     anything; a listing id can only ever resolve to our own catalogue.
//   • Correctness — the app's thumbnails are Cloudinary-transformed renditions
//     that would not string-match what the database stores.
// Omitting `variantId` asks for the listing default (galleryUrls[0]); a variant
// with no image of its own falls back to that same default server-side.
//
// Requires a signed-in consumer (the backend upload + try-on are auth-gated).

import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { API_BASE } from '../config/env';
import { getAuthToken, request, ApiError } from './api';

// ─── In-memory log so the UI can show every step + error in a copyable modal ───
const logLines: string[] = [];
const listeners = new Set<(lines: string[]) => void>();
function log(line: string) {
  const stamped = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  logLines.push(stamped);
  if (logLines.length > 200) logLines.shift();
  console.log(stamped);
  listeners.forEach((l) => l([...logLines]));
}
export function subscribeTryOnLog(fn: (lines: string[]) => void) {
  listeners.add(fn);
  fn([...logLines]);
  return () => listeners.delete(fn);
}
export function clearTryOnLog() {
  logLines.length = 0;
  listeners.forEach((l) => l([]));
}
export function getTryOnLog() {
  return [...logLines];
}

function previewVal(v: unknown): string {
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 77) + '...' : v;
  if (v == null) return String(v);
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v).slice(0, 80);
    } catch {
      return '[object]';
    }
  }
  return String(v);
}

/** Thrown when there's no signed-in consumer — the caller should route to login. */
export class TryOnAuthRequiredError extends Error {
  constructor() {
    super('Please sign in to try on.');
    this.name = 'TryOnAuthRequiredError';
  }
}

// Normalize whatever the caller passes (string URL, { uri }, or a require()'d
// asset module number) into a plain string URI.
function coerceUri(input: unknown, label: string): string {
  if (typeof input === 'string' && input.length > 0) return input;
  try {
    if (typeof input === 'number') {
      const resolved = Image.resolveAssetSource(input as any);
      if (resolved?.uri) return resolved.uri;
    }
    if (input && typeof input === 'object') {
      const anyIn = input as any;
      if (typeof anyIn.uri === 'string' && anyIn.uri.length > 0) return anyIn.uri;
      if (typeof anyIn.url === 'string' && anyIn.url.length > 0) return anyIn.url;
      const resolved = Image.resolveAssetSource(anyIn);
      if (resolved?.uri) return resolved.uri;
    }
  } catch {
    /* fall through */
  }
  const preview = typeof input === 'object' ? JSON.stringify(input).slice(0, 80) : String(input);
  throw new Error(`${label}: bad image input → ${preview}`);
}

// RN's FormData multipart upload wants a local `file://` URI. A remote URL is
// downloaded to cache first (passing an `https://` URI in FormData errors on
// some platforms).
async function toLocalFile(rawUri: unknown, suggestedName: string): Promise<string> {
  const uri = coerceUri(rawUri, suggestedName);
  log(`toLocalFile ${suggestedName} uri=${uri.slice(0, 120)}`);
  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('data:')
  ) {
    return uri;
  }
  if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
    throw new Error(`${suggestedName}: unsupported URI scheme → ${uri.slice(0, 60)}`);
  }
  const ext = guessExt(uri, suggestedName);
  const dest = `${FileSystem.cacheDirectory}tryon-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
  const res = await FileSystem.downloadAsync(uri, dest);
  if (!res?.uri) throw new Error(`${suggestedName}: download returned no file URI`);
  if (res.status && res.status >= 400) throw new Error(`${suggestedName}: download HTTP ${res.status}`);
  return res.uri;
}

function guessExt(uri: string, name: string): string {
  const n = (uri + ' ' + name).toLowerCase();
  if (n.includes('.png')) return 'png';
  if (n.includes('.webp')) return 'webp';
  if (n.includes('.heic') || n.includes('.heif')) return 'heic';
  return 'jpg';
}

function guessMime(uri: string, fallbackName: string): string {
  const n = (uri + fallbackName).toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

// Upload the person photo to the backend and return its public URL. Multipart
// needs raw fetch (not the JSON request() helper), same pattern as reels upload.
/**
 * Shrink the selfie before it goes over the wire.
 *
 * A photo straight out of the iPhone gallery is ~12 MP and 3-5 MB (HEIC or
 * PNG). Pushing that to a cold free-tier backend over a mobile uplink took
 * ~192 SECONDS on device — long enough that iOS killed the connection itself
 * ("Operation timed out" on the flow). Downscaling to 1280px of JPEG typically
 * turns 4 MB into ~200 KB, which is the difference between a try-on that works
 * and one that appears to do nothing.
 *
 * Also normalises HEIC to JPEG. `guessMime` always claimed image/jpeg because
 * the filename it was handed ended in .jpg, so a HEIC was being uploaded under
 * the wrong content type.
 *
 * Best-effort: if manipulation fails we upload the original rather than losing
 * the attempt entirely.
 */
async function shrinkForUpload(localUri: string): Promise<string> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1280 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    log(`compressed person photo → ${out.uri.slice(-40)}`);
    return out.uri;
  } catch (e: any) {
    log(`compress failed (${e?.message || e}) — uploading original`);
    return localUri;
  }
}

async function uploadPerson(rawUri: unknown): Promise<string> {
  const original = await toLocalFile(rawUri, 'person.jpg');
  const localUri = await shrinkForUpload(original);
  const form = new FormData();
  form.append('file', {
    uri: localUri,
    name: 'person.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // Do NOT set Content-Type — fetch adds the multipart boundary itself.
  log('uploading person photo → POST /uploads');
  // TIMEOUT. This was a bare fetch with no abort, so a stalled upload hung
  // forever — the request never failed, it just never finished, and the screen
  // sat on "Generating…" until the OS gave up ~3 minutes later. 60s is generous
  // for a ~200KB body even on a cold backend.
  let res: Response;
  const ctrl = new AbortController();
  const killer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    res = await fetch(`${API_BASE}/uploads`, { method: 'POST', headers, body: form as any, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Uploading your photo timed out. Check your connection and try again.');
    }
    throw new Error("Can't reach the server. Check your connection.");
  } finally {
    clearTimeout(killer);
  }
  const payload: any = await res.json().catch(() => null);
  const url = payload?.data?.url;
  if (res.ok && payload?.success && typeof url === 'string') {
    log(`person uploaded url=${url.slice(0, 120)}`);
    return url;
  }
  throw new Error(payload?.error?.message || `Person upload failed (HTTP ${res.status})`);
}

type TryOnResponse = { result: string | null; steps: string[] };

/**
 * Run virtual try-on. `listingId` is the product; `variantId` picks that
 * variant's image (omit for the product's default/gallery image). The server
 * resolves the actual garment URL from its own catalog. Returns the result URL.
 */
export async function generateTryOn(
  personUri: unknown,
  listingId: string,
  variantId?: string,
): Promise<string> {
  if (!getAuthToken()) throw new TryOnAuthRequiredError();
  if (!listingId) throw new Error('Missing product reference.');

  log(`generateTryOn person=${previewVal(personUri)} listing=${listingId} variant=${variantId ?? '(default)'}`);

  const personImageUrl = await uploadPerson(personUri);

  // Vertex is slow; give it plenty of time (default request timeout is 30s).
  const data = await request<TryOnResponse>('/consumer/tryon', {
    method: 'POST',
    body: { personImageUrl, listingId, ...(variantId ? { variantId } : {}) },
    timeoutMs: 90_000,
  });

  const url = data?.result;
  if (!url) throw new Error('Try-on returned no image. Please try again.');
  log(`success url=${url.slice(0, 120)}`);
  return url;
}

// Re-exported so callers can distinguish a "service busy" (503) from other
// failures if they want a special message. ApiError.code === 'rate_limited'.
export { ApiError };
