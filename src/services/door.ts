/**
 * Customer-driven Try-and-Buy door decisions. During the try-on window (order at_door) the
 * customer taps Keep or Return per item. Keep finalizes the item (and may close the visit);
 * Return notifies the driver, who accepts or inspects it. Mutations invalidate the cached
 * order detail so the tracking screen re-fetches the fresh per-item state.
 */
import { request, invalidate } from './api';

export type DoorItemState =
  | 'undecided'
  | 'kept'
  | 'return_requested'
  | 'return_accepted'
  | 'return_rejected';

export type DoorSessionItem = {
  id: string;
  name: string;
  image: string | null;
  attributesLabel: string;
  policy: string;
  customerDoorChoice: 'keep' | 'return' | null;
  agentDoorDecision: 'accept_return' | 'reject_return' | null;
  agentReturnReason: string | null;
  doorState: DoorItemState;
};

export type DoorSession = {
  id: string;
  status: string;
  deliveryMethod: string;
  deliveryOtp: string | null;
  doorWindowExpiresAt: string | null;
  doorWindowExtendedAt: string | null;
  items: DoorSessionItem[];
};

function bust(orderId: string) {
  invalidate('/consumer/door/orders/' + orderId);
  invalidate('/consumer/checkout/orders/' + orderId);
}

export async function getDoorSession(orderId: string): Promise<DoorSession> {
  return request<DoorSession>(`/consumer/door/orders/${orderId}`);
}

export async function keepItem(orderId: string, orderItemId: string) {
  const res = await request(`/consumer/door/orders/${orderId}/items/${orderItemId}/keep`, {
    method: 'POST',
    body: {},
  });
  bust(orderId);
  return res;
}

export async function returnItem(orderId: string, orderItemId: string) {
  const res = await request(`/consumer/door/orders/${orderId}/items/${orderItemId}/return`, {
    method: 'POST',
    body: {},
  });
  bust(orderId);
  return res;
}
