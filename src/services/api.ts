// Thin fetch client for the Trendzo backend.
//
// Every backend response uses the envelope { success:true, data } |
// { success:false, error:{ code, message, details } } (see backend
// src/shared/http/envelope.ts). `request()` unwraps `data` on success and
// throws a normalized `ApiError` on failure so callers can branch on `.code`.
//
// The auth token lives in a module-level holder (set by AppState on login /
// hydrate) so non-React code can attach the Bearer header without prop-drilling.

import { API_BASE } from '../config/env';

let authToken: string | null = null;

/** Set (or clear) the bearer token used on every subsequent request. */
export function setAuthToken(token: string | null) {
  const changed = authToken !== token;
  authToken = token;
  // Identity changed — drop every cached GET so a signed-out session can never
  // read the previous user's responses out of the cache.
  if (changed) clearCache();
}
export function getAuthToken(): string | null {
  return authToken;
}

export class ApiError extends Error {
  code: string;
  status?: number;
  details?: unknown;
  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOpts {
  method?: Method;
  body?: unknown;
  /** Attach the bearer token. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
  /** Abort the request after this many ms. Defaults to 30s. */
  timeoutMs?: number;
  /** Extra request headers (used for If-None-Match revalidation). */
  headers?: Record<string, string>;
  /** Receive the ETag of a 200 response, for a later conditional request. */
  onEtag?: (etag: string | null) => void;
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal, timeoutMs = 30000 } = opts;
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  // The backend runs on a free tier that cold-starts slowly, so without a
  // timeout a request can hang indefinitely (looks like a frozen "Verifying…").
  // Bound it and surface a clear, retryable error instead. Any externally
  // supplied `signal` still aborts too.
  const timer = new AbortController();
  const to = setTimeout(() => timer.abort(), timeoutMs);
  const onExternalAbort = () => timer.abort();
  if (signal) {
    if (signal.aborted) timer.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: timer.signal,
    });
  } catch {
    // Distinguish a timeout (server too slow) from an offline / unreachable host.
    if (timer.signal.aborted && !(signal && signal.aborted)) {
      throw new ApiError('timeout', 'The server took too long to respond. Please try again.');
    }
    throw new ApiError('unreachable', "Can't reach the server. Check your connection.");
  } finally {
    clearTimeout(to);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }

  // 304 Not Modified: the server confirmed our cached copy is current and sent
  // NO body, so res.json() below would throw. Signalled to the caller instead —
  // cachedGet turns it back into the stale-but-valid cached value.
  if (res.status === 304) {
    throw new ApiError('not_modified', 'Not modified', 304);
  }

  opts.onEtag?.(res.headers.get('etag'));

  // Parse the envelope. A non-JSON body (proxy error page, 502, …) is surfaced
  // as a generic error rather than crashing on res.json().
  let payload: any;
  try {
    payload = await res.json();
  } catch {
    throw new ApiError('bad_response', `Server returned ${res.status}.`, res.status);
  }

  if (res.ok && payload?.success) {
    return payload.data as T;
  }

  const err = payload?.error;
  throw new ApiError(
    err?.code || 'error',
    friendly(err?.code, err?.message),
    res.status,
    err?.details,
  );
}

/* ── Cached + de-duplicated GETs ──────────────────────────────────────────────
 *
 * The app had no caching, no request de-duplication and no in-flight guard
 * anywhere. Concretely: flipping HER→HIM→HER on the category browser fired three
 * full counted-tree requests for data already on the device, and every sort tap
 * on a listing refetched 60 products with the previous request left running.
 *
 * `cachedGet` gives three things:
 *   • a short TTL cache, so going back to a screen is instant
 *   • in-flight de-duplication, so two components asking for the same URL at the
 *     same moment share one socket
 *   • `invalidate()` for after a mutation
 *
 * Deliberately GET-only and keyed by URL + auth state. Mutations must never be
 * de-duplicated, and a cache shared across sign-in would leak one user's data to
 * the next.
 */

type Entry = { at: number; value: unknown; etag?: string | null };

/**
 * An in-flight GET, possibly shared by several callers.
 *
 * `subscribers` exists because de-duplication and cancellation fight each other:
 * if two screens ask for the same URL and one unmounts, aborting the shared fetch
 * would kill the other screen's data too. So the underlying request is only
 * aborted once EVERY subscriber has detached; a caller that gives up early just
 * stops listening.
 */
type Flight = {
  promise: Promise<unknown>;
  controller: AbortController;
  subscribers: number;
};

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Flight>();

/** Default freshness. Catalog data changes on the order of minutes, not seconds. */
const DEFAULT_TTL_MS = 60_000;

const keyFor = (path: string) => `${authToken ? 'a' : 'g'}:${path}`;

export async function cachedGet<T>(
  path: string,
  opts: { ttlMs?: number; auth?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS } = opts;
  const key = keyFor(path);

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  let flight = inFlight.get(key);
  if (!flight) {
    const controller = new AbortController();
    // Past its TTL but still held: revalidate conditionally. If the server says
    // 304 the payload never crosses the wire at all and the stale value is simply
    // re-dated. `hit` is captured here, not re-read later, so a concurrent
    // clearCache() cannot make this resolve to something that was dropped.
    const stale = hit;
    let freshEtag: string | null = null;
    const promise = request<T>(path, {
      ...(opts.auth !== undefined ? { auth: opts.auth } : {}),
      signal: controller.signal,
      ...(stale?.etag ? { headers: { 'If-None-Match': stale.etag } } : {}),
      onEtag: (e) => { freshEtag = e; },
    })
      .then((value) => {
        cache.set(key, { at: Date.now(), value, etag: freshEtag });
        return value;
      })
      .catch((e) => {
        if (e?.code === 'not_modified' && stale) {
          cache.set(key, { at: Date.now(), value: stale.value, etag: stale.etag });
          return stale.value as T;
        }
        throw e;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    // Nothing is listening to `promise` yet; without this an abort before the
    // first `await` below would surface as an unhandled rejection.
    promise.catch(() => {});
    flight = { promise, controller, subscribers: 0 };
    inFlight.set(key, flight);
  }

  const f = flight;
  f.subscribers++;

  // No signal — the caller cannot give up, so just await the shared promise.
  if (!opts.signal) {
    try {
      return (await f.promise) as T;
    } finally {
      f.subscribers--;
    }
  }

  const signal = opts.signal;
  return new Promise<T>((resolve, reject) => {
    let detached = false;
    const detach = () => {
      if (detached) return;
      detached = true;
      f.subscribers--;
      signal.removeEventListener('abort', onAbort);
    };
    function onAbort() {
      detach();
      // Last one out turns off the socket.
      if (f.subscribers <= 0) f.controller.abort();
      reject(new ApiError('aborted', 'Request aborted'));
    }
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener('abort', onAbort);
    f.promise.then(
      (v) => { detach(); resolve(v as T); },
      (e) => { detach(); reject(e); },
    );
  });
}

/** Drop cached GETs. No argument clears everything; a string clears by prefix match. */
export function invalidate(prefix?: string) {
  if (!prefix) { cache.clear(); return; }
  for (const k of [...cache.keys()]) {
    // Keys carry an auth-scope prefix ("a:" / "g:"), so match on the path part.
    if (k.slice(2).startsWith(prefix)) cache.delete(k);
  }
}

/** Sign-in / sign-out must not serve the previous identity's cached responses. */
export function clearCache() {
  cache.clear();
  inFlight.clear();
}

/** Map backend error codes to consumer-friendly copy. */
function friendly(code?: string, message?: string): string {
  switch (code) {
    case 'invalid_credentials':
      return message || 'Verification failed. Please try again.';
    case 'email_already_taken':
      return 'That email is already linked to another account.';
    case 'consumer_suspended':
      return 'This account is suspended. Contact support.';
    case 'consumer_closed':
      return 'This account is closed.';
    case 'validation_error':
      return message || 'Please check your details and try again.';
    default:
      return message || 'Something went wrong. Please try again.';
  }
}
