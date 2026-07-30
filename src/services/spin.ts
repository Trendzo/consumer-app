// Spin & Win.
//
// The important thing about this module is what it does NOT do: it does not decide
// what you win. The wheel used to hold its own prize table and weights and call
// `Math.random()`, which meant the odds shipped in the bundle and the "win" was a
// toast that never reached the server. Now the server draws and returns a slice
// index; the app animates to it.
//
// Reading the wheel and spinning both work signed out. Claiming does not — that is
// the whole shape of the feature.

import { request } from './api';
import { getDeviceId } from './device';

export type SpinSegment = {
  id: string;
  sortOrder: number;
  label: string;
  sublabel: string | null;
  icon: string | null;
  colorHex: string | null;
  soldOut: boolean;
};

export type SpinWheel = {
  id: string;
  name: string;
  spinsLeftToday: number;
  guestSpinAllowed: boolean;
  segments: SpinSegment[];
};

export type SpinPrize = { code: string | null; points: number | null; label: string };

export type SpinResult = {
  playId: string;
  /** Where the pointer must land. Authoritative — do not re-roll on the client. */
  segmentIndex: number;
  segmentId: string;
  label: string;
  sublabel: string | null;
  won: boolean;
  rewardKind: 'promotion' | 'points' | 'none';
  requiresLogin: boolean;
  claimToken: string | null;
  claimExpiresAt: string | null;
  /** Present only when the spinner was already signed in. */
  prize: SpinPrize | null;
};

export type ClaimResult = {
  won: boolean;
  alreadyClaimed?: boolean;
  prize: SpinPrize | null;
};

export type Reward = {
  id: string;
  code: string;
  name: string;
  discountType: string;
  config: Record<string, unknown> | null;
  validUntil: string;
  state: 'available' | 'used' | 'expired';
  wonAt: string;
};

/**
 * The live wheel for a surface, or null when nothing is running.
 *
 * Null is a normal answer, not an error — an admin pausing the wheel should make it
 * vanish quietly rather than produce a failure banner. Not cached: `spinsLeftToday`
 * is per-device state that goes stale the moment you spin.
 */
export async function getWheel(surface: 'popup' | 'screen'): Promise<SpinWheel | null> {
  const deviceId = await getDeviceId();
  const res = await request<{ wheel: SpinWheel | null }>(
    `/spin/wheel?deviceId=${encodeURIComponent(deviceId)}&surface=${surface}`,
    { auth: true },
  );
  return res.wheel;
}

/** Draw a slice. Throws `already_spun` (409) when the device is out of spins today. */
export async function play(surface: 'popup' | 'screen'): Promise<SpinResult> {
  const deviceId = await getDeviceId();
  return request<SpinResult>('/spin/play', {
    method: 'POST',
    body: { deviceId, surface },
    auth: true,
  });
}

/**
 * Bind a guest's pending win to the account that just signed in.
 *
 * Idempotent server-side on the token, so retrying after a dropped connection
 * returns the same prize rather than issuing a second one.
 */
export async function claim(claimToken: string): Promise<ClaimResult> {
  return request<ClaimResult>('/spin/claim', {
    method: 'POST',
    body: { claimToken },
    auth: true,
  });
}

/** Codes this account personally holds — won on the wheel or granted by support. */
export async function listRewards(): Promise<Reward[]> {
  const res = await request<{ rewards: Reward[] }>('/consumer/rewards', { auth: true });
  return res.rewards;
}

// ── Pending claim, parked across the sign-in round trip ───────────────────────
//
// A guest wins, taps "claim", and is sent to the auth sheet. The token has to
// survive that trip. Module state rather than AsyncStorage on purpose: the win is
// only interesting for the next minute, and a token that outlives the session
// would resurface as a confusing "you have a prize" after the claim window closed.

let pendingClaimToken: string | null = null;

export function setPendingClaim(token: string | null): void {
  pendingClaimToken = token;
}

export function takePendingClaim(): string | null {
  const t = pendingClaimToken;
  pendingClaimToken = null;
  return t;
}

export function hasPendingClaim(): boolean {
  return pendingClaimToken !== null;
}
