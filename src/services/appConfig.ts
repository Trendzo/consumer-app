// Client-facing config — GET /app-config (public, no auth).
//
// Everything here used to be a string literal in a screen. The two that actually
// caused wrong behaviour:
//
//   • Support contact was hardcoded, so changing the number meant shipping a build.
//   • The app promised a 15-minute try-on window in eight places while the backend
//     reads `try_on_window_seconds` and falls back to 600. Where that config row is
//     missing the courier leaves after ten minutes.
//
// Values change rarely, so this is cached for an hour and falls back to the last
// shipped defaults when offline — copy should degrade, never blank out.

import { cachedGet } from './api';

/** One selectable delivery option, priced and described by the server. */
export type DeliveryMethodConfig = {
  id: 'express' | 'standard' | 'pickup' | 'try_and_buy';
  label: string;
  blurb: string;
  /** "60 min" / "2-3 days" — a label, not a number; the units differ per method. */
  etaLabel: string;
  icon: string;
  /** Advisory. A store override or coupon can change it — prefer the quote. */
  feePaise: number;
};

export type LoyaltyTier = { name: string; minPoints: number };

export type ReturnReason = { value: string; label: string };

export type AppConfig = {
  support: {
    email: string;
    /** null when unset server-side — hide the row rather than show a dead number. */
    phone: string | null;
    address: string | null;
    hours: string | null;
  };
  delivery: {
    methods: DeliveryMethodConfig[];
    surgeMultiplier: number;
  };
  tryAndBuy: {
    windowSeconds: number;
    extensionSeconds: number;
    /** null = the backend enforces no such cap. Do not state it to the customer. */
    maxItemsPerTrial: number | null;
    maxTrialsPerMonth: number | null;
  };
  returns: { windowDays: number; reasons: ReturnReason[] };
  loyalty: {
    /** What one point is worth. Without it the app cannot honestly say "240 pts = ₹240". */
    pointValuePaise: number;
    earnRateBp: number;
    minRedeemablePoints: number;
    maxRedeemFractionBp: number;
    tiers: LoyaltyTier[];
  };
  referral: { referrerPoints: number; referredPoints: number; welcomePoints: number };
  orderLifecycle: {
    acceptanceWindowSeconds: number;
    paymentAbandonMinutes: number;
    orderCloseAfterDays: number;
    pickupNoshowCancelDays: number;
    holdingWindowDays: number;
  };
  company: { name: string; appName: string };
};

/** Used until the first fetch resolves, and whenever the device is offline. */
export const FALLBACK_CONFIG: AppConfig = {
  support: { email: 'care@trendzo.in', phone: null, address: null, hours: null },
  delivery: {
    methods: [
      { id: 'express', label: 'Express', blurb: 'From your nearest store, in under an hour', etaLabel: '60 min', icon: 'zap', feePaise: 9900 },
      { id: 'standard', label: 'Standard', blurb: 'Tracked shipping, door to door', etaLabel: '2-3 days', icon: 'package', feePaise: 4900 },
      { id: 'pickup', label: 'Store pickup', blurb: 'Collect at the counter with your code', etaLabel: 'In store', icon: 'map-pin', feePaise: 0 },
      { id: 'try_and_buy', label: 'Try & Buy', blurb: 'Try at your door, keep what fits', etaLabel: 'Next day', icon: 'home', feePaise: 9900 },
    ],
    surgeMultiplier: 1,
  },
  // Matches the backend's own in-code fallback (door-visit.ts), NOT the seeded
  // 900 — so an offline app under-promises rather than over-promises.
  tryAndBuy: { windowSeconds: 600, extensionSeconds: 300, maxItemsPerTrial: null, maxTrialsPerMonth: null },
  returns: {
    windowDays: 7,
    reasons: [
      { value: 'doesnt_fit', label: 'Does not fit' },
      { value: 'damaged', label: 'Damaged or defective' },
      { value: 'wrong_item', label: 'Wrong item sent' },
      { value: 'not_as_described', label: 'Not as described' },
      { value: 'other', label: 'Another reason' },
    ],
  },
  loyalty: {
    pointValuePaise: 100,
    earnRateBp: 10000,
    minRedeemablePoints: 100,
    maxRedeemFractionBp: 10000,
    tiers: [
      { name: 'BRONZE', minPoints: 0 },
      { name: 'SILVER', minPoints: 500 },
      { name: 'GOLD', minPoints: 2000 },
      { name: 'PLATINUM', minPoints: 5000 },
    ],
  },
  referral: { referrerPoints: 200, referredPoints: 100, welcomePoints: 100 },
  orderLifecycle: {
    acceptanceWindowSeconds: 180,
    paymentAbandonMinutes: 30,
    orderCloseAfterDays: 7,
    pickupNoshowCancelDays: 3,
    holdingWindowDays: 14,
  },
  company: { name: 'Trendzo', appName: 'Trendzo' },
};

/** Points -> rupees, at the server's rate. Never assume 1:1. */
export const pointsToRupees = (points: number, cfg: AppConfig): number =>
  Math.round((points * cfg.loyalty.pointValuePaise) / 100);

/** The tier a balance sits in, and how far the next one is. */
export function tierFor(points: number, cfg: AppConfig) {
  const tiers = [...cfg.loyalty.tiers].sort((a, b) => a.minPoints - b.minPoints);
  let current = tiers[0]!;
  for (const t of tiers) if (points >= t.minPoints) current = t;
  const next = tiers[tiers.indexOf(current) + 1] ?? null;
  const span = next ? next.minPoints - current.minPoints : 0;
  return {
    current,
    next,
    toNext: next ? Math.max(0, next.minPoints - points) : 0,
    progress: next && span > 0 ? Math.min(1, (points - current.minPoints) / span) : 1,
  };
}

export const getAppConfig = () =>
  cachedGet<AppConfig>('/app-config', { auth: false, ttlMs: 60 * 60_000 });

/** "15 min" / "1 hr 30 min" — the trial window in words, from the real number. */
export function formatWindow(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
