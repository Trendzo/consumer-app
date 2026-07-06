// Saved addresses — /consumer/addresses (all requireAuth('consumer')). lat/lng are
// mandatory on the backend (they feed delivery routing + GST place-of-supply), so an
// add/edit form needs a map/geocode step; until then callers pass a best-effort default.

import { request } from './api';

export type Address = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
  stateCode: string; // 2-letter, uppercased server-side
  lat: number;
  lng: number;
  isDefault: boolean;
};

export type AddressInput = {
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string; // 6 digits
  stateCode: string; // 2 letters
  lat: number;
  lng: number;
  isDefault?: boolean;
};

/** One-line display string for a saved address. */
export const formatAddress = (a: Address) =>
  [a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(', ');

export const listAddresses = () => request<Address[]>('/consumer/addresses');

export const createAddress = (body: AddressInput) =>
  request<Address>('/consumer/addresses', { method: 'POST', body });

export const updateAddress = (id: string, body: Partial<AddressInput>) =>
  request<Address>(`/consumer/addresses/${encodeURIComponent(id)}`, { method: 'PATCH', body });

export const removeAddress = (id: string) =>
  request<unknown>(`/consumer/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const setDefaultAddress = (id: string) =>
  request<unknown>(`/consumer/addresses/${encodeURIComponent(id)}/set-default`, { method: 'POST' });
