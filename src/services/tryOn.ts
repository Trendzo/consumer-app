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
async function uploadPerson(rawUri: unknown): Promise<string> {
  const localUri = await toLocalFile(rawUri, 'person.jpg');
  const form = new FormData();
  form.append('file', {
    uri: localUri,
    name: 'person.jpg',
    type: guessMime(localUri, 'person.jpg'),
  } as unknown as Blob);

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // Do NOT set Content-Type — fetch adds the multipart boundary itself.
  log('uploading person photo → POST /uploads');
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/uploads`, { method: 'POST', headers, body: form as any });
  } catch {
    throw new Error("Can't reach the server. Check your connection.");
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
