// Notification inbox — /consumer/notifications (requireAuth('consumer')).
//
// The `notifications` table has stored consumer rows all along, written by the
// backend whenever an order, refund or return changes state. Admin and retailer
// both had list/mark-read endpoints; consumers did not, so the app shipped a
// hardcoded list of four fake updates instead of the customer's real ones.

import { request } from './api';

export type NotificationRow = {
  id: string;
  /** Server enum: order / refund / return / promo / system … */
  kind: string;
  title: string;
  body: string | null;
  /** Where tapping it should navigate, e.g. "/orders/ord_…". */
  deepLink: string | null;
  payload: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

export type NotificationPage = {
  items: NotificationRow[];
  /** null once the list is exhausted. */
  nextCursor: string | null;
  unreadCount: number;
};

export const listNotifications = (opts?: { before?: string; limit?: number }) => {
  const q = new URLSearchParams();
  if (opts?.before) q.set('before', opts.before);
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return request<NotificationPage>(`/consumer/notifications${qs ? `?${qs}` : ''}`);
};

export const markNotificationRead = (id: string) =>
  request<{ id: string; read: boolean }>(
    `/consumer/notifications/${encodeURIComponent(id)}/read`,
    { method: 'POST', body: {} },
  );

export const markAllNotificationsRead = () =>
  request<{ markedRead: number }>('/consumer/notifications/read-all', { method: 'POST', body: {} });

export const deleteNotification = (id: string) =>
  request<{ id: string; deleted: true }>(
    `/consumer/notifications/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
