// Returns — GET /consumer/returns (list) + POST /consumer/returns (open a return).
// A consumer-opened return schedules a driver reverse-pickup; the collect OTP the
// customer must give the pickup partner is surfaced here (reversePickup.collectOtp,
// non-null only while pending/assigned).
import { request } from './api';

export type ReasonCategory = 'damaged' | 'wrong_item' | 'not_as_described' | 'doesnt_fit' | 'other';

export type ReturnRow = {
  id: string;
  kind: 'door_return' | 'standard_return' | string;
  openedAt: string;
  reasonText: string | null;
  reasonCategory: ReasonCategory | null;
  storeDecision: 'pending' | 'accepted' | 'rejected' | 'rejected_at_door' | string;
  storeDecidedAt: string | null;
  orderId: string;
  orderItemId: string;
  itemName: string;
  itemBrand: string;
  itemAttributes: string;
  itemImage: string | null;
  itemOutcome: string;
  netLinePaise: number;
  refund: null | { id: string; status: string; amountPaise: number };
  reversePickup: null | {
    id: string;
    status: 'pending' | 'assigned' | 'collected' | 'delivered_to_store' | 'cancelled' | string;
    collectOtp: string | null;
    assignedAt: string | null;
    collectedAt: string | null;
    deliveredAt: string | null;
  };
};

export type CreateReturnInput = {
  orderId: string;
  items: { orderItemId: string; reasonText?: string; reasonCategory?: ReasonCategory; photos?: string[] }[];
};

export type CreateReturnResult = { orderId: string; returnIds: string[]; reversePickupId?: string };

export const listReturns = () => request<ReturnRow[]>('/consumer/returns');

/** Open a post-delivery return. Errors: return_invalid_state / return_window_expired / not_found. */
export const createReturn = (body: CreateReturnInput) =>
  request<CreateReturnResult>('/consumer/returns', { method: 'POST', body });
