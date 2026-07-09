// Wallet — GET /consumer/wallet (balance + ledger). requireAuth('consumer').
// Amounts are integer paise. 200 with zeros if the consumer has no wallet yet.
import { request } from './api';

export type WalletTxn = {
  id: string;
  kind: 'top_up' | 'debit' | 'refund_credit' | 'gift_card_credit' | 'adjustment' | string;
  amountPaise: number; // signed: + credit, − debit
  balanceAfterPaise: number;
  refOrderId: string | null;
  refRefundId: string | null;
  refGiftCardId: string | null;
  note: string | null;
  at: string;
};

export type Wallet = {
  balancePaise: number;
  version: number;
  total: number;
  transactions: WalletTxn[];
};

export const getWallet = (opts?: { limit?: number; offset?: number }) => {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.offset != null) q.set('offset', String(opts.offset));
  const qs = q.toString();
  return request<Wallet>(`/consumer/wallet${qs ? `?${qs}` : ''}`);
};
