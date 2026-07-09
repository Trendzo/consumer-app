// Support tickets — /consumer/issues. An issue is always about an order (or return);
// list, open, view the message thread, and reply.
import { request } from './api';

export type IssueKind = 'query' | 'complaint' | 'dispute';
export type IssueStatus = 'open' | 'requested_evidence' | 'decided' | 'escalated';

export type IssueRow = {
  id: string;
  kind: IssueKind;
  storeId: string;
  orderId: string | null;
  returnId: string | null;
  subject: string;
  description: string;
  evidence: string[];
  status: IssueStatus;
  awaitingParty: 'admin' | 'retailer' | 'consumer' | 'none';
  decision: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  lastMessageAt: string;
  createdAt: string;
  closedAt: string | null;
};

export type IssueMessage = {
  id: string;
  senderType: 'consumer' | 'retailer' | 'admin' | 'system';
  senderId: string;
  body: string;
  attachments: string[];
  at: string;
};

export type IssueDetail = IssueRow & { messages: IssueMessage[]; transitions: unknown[] };

export const listIssues = (opts?: { status?: IssueStatus; kind?: IssueKind }) => {
  const q = new URLSearchParams();
  if (opts?.status) q.set('status', opts.status);
  if (opts?.kind) q.set('kind', opts.kind);
  const qs = q.toString();
  return request<IssueRow[]>(`/consumer/issues${qs ? `?${qs}` : ''}`);
};

export const getIssue = (id: string) =>
  request<IssueDetail>(`/consumer/issues/${encodeURIComponent(id)}`);

/** Open a ticket. Requires orderId (or returnId). */
export const createIssue = (body: {
  kind: IssueKind;
  orderId?: string;
  returnId?: string;
  subject: string;
  description: string;
  evidence?: string[];
}) => request<{ issueId: string }>('/consumer/issues', { method: 'POST', body });

export const addIssueMessage = (id: string, body: { body: string; attachments?: string[] }) =>
  request<{ messageId: string }>(`/consumer/issues/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body,
  });
