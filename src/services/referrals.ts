// Referrals — GET /consumer/referrals/me + POST /consumer/referrals/redeem.
import { request } from './api';

export type Referral = {
  code: string | null;
  shareLink: string | null;
  referredCount: number;
  pointsEarned: number;
  redeemed: boolean;
  refereePointsEarned: number;
};

export type RedeemReferralResult = {
  referrerName: string;
  referrerPointsGranted: number;
  refereePointsGranted: number;
};

export const getReferral = () => request<Referral>('/consumer/referrals/me');

/** Redeem a friend's code. Errors: referral_code_invalid / referral_self / referral_already_used. */
export const redeemReferral = (code: string) =>
  request<RedeemReferralResult>('/consumer/referrals/redeem', { method: 'POST', body: { code } });
