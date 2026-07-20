// Reels — consumer short product videos + social layer (likes / saves / comments / views).
// Mirrors backend /consumer/reels/* (see backend src/modules/consumer/reels). Two-step
// create: POST /consumer/reels/media (multipart video → Cloudinary) returns URLs, then
// POST /consumer/reels with those URLs + the purchased productId.
//
// Contract notes from the backend:
//  • Feed is keyset-paginated: pass the previous page's `nextCursor` (ISO createdAt) to page.
//  • A reel MUST tag a product the consumer purchased — create 403s otherwise.
//  • Videos are hard-capped at 30s (rejected at upload against Cloudinary's duration).
//  • like/save are idempotent; the counts come back on every toggle.

import { request, getAuthToken, ApiError } from './api';
import { API_BASE } from '../config/env';

export type ReelAuthor = { id: string; name: string; avatarUrl: string | null };
export type ReelProduct = {
  id: string;
  name: string;
  image: string | null;
  status: string;
} | null;

export type Reel = {
  id: string;
  caption: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  status: 'active' | 'taken_down' | 'hidden_pending_review';
  likeCount: number;
  commentCount: number;
  saveCount: number;
  viewCount: number;
  createdAt: string;
  author: ReelAuthor;
  product: ReelProduct;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
};

export type ReelComment = {
  id: string;
  body: string;
  createdAt: string;
  author: ReelAuthor;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

type FeedOpts = { cursor?: string; limit?: number };

function qs(opts: FeedOpts): string {
  const p = new URLSearchParams();
  if (opts.cursor) p.set('cursor', opts.cursor);
  if (opts.limit != null) p.set('limit', String(opts.limit));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Global reel feed, newest first. */
export function getFeed(opts: FeedOpts = {}): Promise<Page<Reel>> {
  return request<Page<Reel>>(`/consumer/reels${qs(opts)}`);
}

/** The signed-in consumer's own reels. */
export function listMine(opts: FeedOpts = {}): Promise<Page<Reel>> {
  return request<Page<Reel>>(`/consumer/reels/mine${qs(opts)}`);
}

/** Reels the consumer has saved. */
export function listSaved(opts: FeedOpts = {}): Promise<Page<Reel>> {
  return request<Page<Reel>>(`/consumer/reels/saved${qs(opts)}`);
}

export function getReel(id: string): Promise<Reel> {
  return request<Reel>(`/consumer/reels/${id}`);
}

export function deleteReel(id: string): Promise<{ deleted: true }> {
  return request(`/consumer/reels/${id}`, { method: 'DELETE' });
}

export function like(id: string): Promise<{ liked: boolean; likeCount: number }> {
  return request(`/consumer/reels/${id}/like`, { method: 'POST' });
}
export function unlike(id: string): Promise<{ liked: boolean; likeCount: number }> {
  return request(`/consumer/reels/${id}/like`, { method: 'DELETE' });
}

export function save(id: string): Promise<{ saved: boolean; saveCount: number }> {
  return request(`/consumer/reels/${id}/save`, { method: 'POST' });
}
export function unsave(id: string): Promise<{ saved: boolean; saveCount: number }> {
  return request(`/consumer/reels/${id}/save`, { method: 'DELETE' });
}

/** Best-effort view ping — safe to fire-and-forget when a reel becomes active. */
export function recordView(id: string): Promise<{ viewCount: number }> {
  return request(`/consumer/reels/${id}/view`, { method: 'POST' });
}

export function listComments(
  id: string,
  opts: FeedOpts = {},
): Promise<Page<ReelComment>> {
  return request<Page<ReelComment>>(`/consumer/reels/${id}/comments${qs(opts)}`);
}

export function addComment(id: string, body: string): Promise<ReelComment> {
  return request(`/consumer/reels/${id}/comments`, { method: 'POST', body: { body } });
}

export function deleteComment(id: string, commentId: string): Promise<{ deleted: true }> {
  return request(`/consumer/reels/${id}/comments/${commentId}`, { method: 'DELETE' });
}

// ── create (used by the record/upload flow, wired later) ──

export type UploadedReelMedia = {
  videoUrl: string;
  videoPublicId: string;
  thumbnailUrl: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  bytes: number;
};

/**
 * Upload a reel video to the backend (which forwards to Cloudinary) and get back the
 * URLs + metadata to pass to `createReel`. `file` is a React Native asset URI.
 */
export async function uploadMedia(file: {
  uri: string;
  name?: string;
  type?: string;
}): Promise<UploadedReelMedia> {
  const form = new FormData();
  // RN FormData file part.
  form.append('file', {
    uri: file.uri,
    name: file.name ?? 'reel.mp4',
    type: file.type ?? 'video/mp4',
  } as unknown as Blob);
  // Bypass the JSON request() helper — multipart needs the raw fetch with the bearer token.
  return requestMultipart<UploadedReelMedia>('/consumer/reels/media', form);
}

export type CreateReelInput = {
  videoUrl: string;
  videoPublicId: string;
  thumbnailUrl: string;
  productId: string;
  durationSec?: number;
  width?: number;
  height?: number;
  bytes?: number;
  caption?: string;
};

export function createReel(input: CreateReelInput): Promise<Reel> {
  return request<Reel>('/consumer/reels', { method: 'POST', body: input });
}

// Multipart helper — reuses the same auth token + envelope handling as request().
async function requestMultipart<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // Note: do NOT set Content-Type — fetch sets the multipart boundary itself.
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiError('unreachable', "Can't reach the server. Check your connection.");
  }
  let payload: any;
  try {
    payload = await res.json();
  } catch {
    throw new ApiError('bad_response', `Server returned ${res.status}.`, res.status);
  }
  if (res.ok && payload?.success) return payload.data as T;
  const err = payload?.error;
  throw new ApiError(err?.code || 'error', err?.message || 'Upload failed', res.status, err?.details);
}
