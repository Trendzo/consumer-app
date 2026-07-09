// Loyalty — GET /consumer/loyalty (points balance + ledger). requireAuth('consumer').
import { request } from './api';

export type LoyaltyTxn = {
  id: string;
  kind: 'earn' | 'redeem' | 'refund_credit' | 'adjustment' | 'bonus' | string;
  points: number; // signed
  balanceAfterPoints: number;
  refOrderId: string | null;
  note: string | null;
  expiresAt: string | null;
  at: string;
};

export type Loyalty = {
  balancePoints: number;
  total: number;
  transactions: LoyaltyTxn[];
};

export const getLoyalty = (opts?: { limit?: number; offset?: number }) => {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.offset != null) q.set('offset', String(opts.offset));
  const qs = q.toString();
  return request<Loyalty>(`/consumer/loyalty${qs ? `?${qs}` : ''}`);
};
