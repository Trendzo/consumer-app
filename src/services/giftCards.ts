// Gift cards — GET /consumer/gift-cards + POST /consumer/gift-cards/redeem.
// Redeem-to-wallet model: redeeming a card credits the wallet and zeroes the card.
// There is NO purchase endpoint.
import { request } from './api';

export type GiftCard = {
  id: string;
  code: string;
  balancePaise: number;
  expiresOn: string; // YYYY-MM-DD
};

export type GiftCardList = {
  totalPaise: number;
  cards: GiftCard[];
};

export type RedeemGiftCardResult = {
  giftCardId: string;
  creditedPaise: number;
  walletBalancePaise: number;
};

export const listGiftCards = () => request<GiftCardList>('/consumer/gift-cards');

/** Redeem a code into the wallet. Errors: gift_card_invalid / gift_card_expired / gift_card_already_redeemed. */
export const redeemGiftCard = (code: string) =>
  request<RedeemGiftCardResult>('/consumer/gift-cards/redeem', { method: 'POST', body: { code } });
