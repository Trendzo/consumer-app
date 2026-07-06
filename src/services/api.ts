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
  authToken = token;
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
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal, timeoutMs = 30000 } = opts;
  const headers: Record<string, string> = {};
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
