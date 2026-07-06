// Server-side cart for logged-in consumers — a thin {variantId, qty} sync so a cart
// started on one device shows up on another. All routes require auth; guests keep a
// purely local cart. Display data (name/price/image) is re-resolved via /pricing/cart.

import { request } from './api';

export type ServerCartItem = { variantId: string; qty: number };

export const getServerCart = () =>
  request<{ items: ServerCartItem[]; updatedAt?: string }>('/consumer/cart');

/** Full replace — the whole items array (server dedups + clamps). Empty array clears it. */
export const putServerCart = (items: ServerCartItem[]) =>
  request<{ items: ServerCartItem[] }>('/consumer/cart', { method: 'PUT', body: { items } });
