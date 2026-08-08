// Community — posts, comments, likes/saves, reports.
// docs/home-api-integration.md §L.
//
// The WHOLE module is consumer-auth, including the read feed — there is no
// signed-out browse. A screen must therefore gate on auth before calling, not
// call and handle 401 as a surprise.
//
// Paging is KEYSET (`cursor` = the last row's createdAt), not limit/offset.
// The two styles are not interchangeable — see the paging cheat-sheet in §8.
import { request } from './api';

export type PostAuthor = { id: string; name: string; avatarUrl: string | null };

export type Post = {
  id: string;
  body: string;
  media: string[];
  status: string;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  createdAt: string;
  author: PostAuthor;
  /** Viewer-relative — these are why the feed needs a token to read. */
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
};

export type PostComment = {
  id: string;
  body: string;
  createdAt: string;
  author: PostAuthor;
};

/** Keyset page. `nextCursor === null` means the end — do not keep asking. */
export type Page<T> = { items: T[]; nextCursor: string | null };

const clampLimit = (n: number | undefined, def: number, max: number) =>
  Math.min(max, Math.max(1, Math.trunc(n ?? def)));

/* ── Feed ─────────────────────────────────────────────────────────────────── */

/** The feed, newest first. `limit` 1–50 (default 10). */
export const listPosts = (opts: { cursor?: string; limit?: number } = {}) =>
  request<Page<Post>>(
    `/consumer/community/posts?limit=${clampLimit(opts.limit, 10, 50)}${
      opts.cursor ? `&cursor=${encodeURIComponent(opts.cursor)}` : ''
    }`,
  );

export const getPost = (id: string) =>
  request<Post>(`/consumer/community/posts/${encodeURIComponent(id)}`);

/** `body` 1–5000 chars, `media` ≤10 URLs (upload via POST /uploads first). */
export const createPost = (body: string, media: string[] = []) =>
  request<{ id: string; body: string; media: string[]; status: string; createdAt: string }>(
    '/consumer/community/posts',
    { method: 'POST', body: { body, media: media.slice(0, 10) } },
  );

export const deletePost = (id: string) =>
  request<{ deleted: boolean }>(`/consumer/community/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

/* ── Like / save ──────────────────────────────────────────────────────────────
 * Both are idempotent by unique index (§8), so a double-tap cannot double-count.
 * The server returns the authoritative new count — render THAT, not a local
 * increment, or two devices drift apart.
 */

export const likePost = (id: string, on: boolean) =>
  request<{ liked: boolean; likeCount: number }>(
    `/consumer/community/posts/${encodeURIComponent(id)}/like`,
    { method: on ? 'POST' : 'DELETE' },
  );

export const savePost = (id: string, on: boolean) =>
  request<{ saved: boolean; saveCount: number }>(
    `/consumer/community/posts/${encodeURIComponent(id)}/save`,
    { method: on ? 'POST' : 'DELETE' },
  );

/* ── Comments ─────────────────────────────────────────────────────────────── */

/** `limit` 1–50 (default 20). */
export const listComments = (postId: string, opts: { cursor?: string; limit?: number } = {}) =>
  request<Page<PostComment>>(
    `/consumer/community/posts/${encodeURIComponent(postId)}/comments?limit=${clampLimit(opts.limit, 20, 50)}${
      opts.cursor ? `&cursor=${encodeURIComponent(opts.cursor)}` : ''
    }`,
  );

/** `body` 1–1000 chars. */
export const addComment = (postId: string, body: string) =>
  request<PostComment>(`/consumer/community/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    body: { body },
  });

export const deleteComment = (postId: string, commentId: string) =>
  request<{ deleted: boolean }>(
    `/consumer/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' },
  );

/* ── Mine ─────────────────────────────────────────────────────────────────────
 * Cap-only paging (`limit`, 1–100, default 50) — no cursor. These rows carry
 * `takedownReason`, which is the ONLY place a shopper learns their post was
 * moderated; the public feed just omits it silently.
 */

export const myPosts = (limit = 50) =>
  request<(Post & { takedownReason: string | null })[]>(
    `/consumer/community/posts/mine?limit=${clampLimit(limit, 50, 100)}`,
  );

export const myReviews = (limit = 50) =>
  request<
    {
      id: string;
      listingId: string;
      rating: number;
      body: string | null;
      media: string[];
      status: string;
      verifiedPurchase: boolean;
      createdAt: string;
      takedownReason: string | null;
    }[]
  >(`/consumer/community/reviews/mine?limit=${clampLimit(limit, 50, 100)}`);

/* ── Reviews (write path) ─────────────────────────────────────────────────────
 * The field is `body`, NOT `text`.
 *
 * `verifiedPurchase` is derived server-side and never trusted from the client:
 * you must hold a non-cancelled, non-payment-failed order containing the
 * listing. It gates PUBLIC VISIBILITY too — a review from a non-buyer is stored
 * and visible to its author under `myReviews()`, but never shown to anyone else.
 * Say that in the composer, or the reviewer thinks their review vanished.
 */
export const createReview = (input: {
  listingId: string;
  orderId?: string;
  rating: number;
  body?: string;
  media?: string[];
}) =>
  request<{
    id: string;
    listingId: string;
    rating: number;
    body: string | null;
    media: string[];
    status: string;
    verifiedPurchase: boolean;
    createdAt: string;
  }>('/consumer/community/reviews', {
    method: 'POST',
    body: {
      listingId: input.listingId,
      ...(input.orderId ? { orderId: input.orderId } : {}),
      rating: Math.min(5, Math.max(1, Math.round(input.rating))),
      ...(input.body ? { body: input.body.slice(0, 5000) } : {}),
      ...(input.media?.length ? { media: input.media.slice(0, 10) } : {}),
    },
  });

/* ── Reports ──────────────────────────────────────────────────────────────── */

export type ReportTarget =
  | 'community_post'
  | 'product_review'
  | 'reel'
  | 'reel_comment'
  | 'post_comment';

/** `reason` 3–1000 chars. */
export const reportContent = (targetType: ReportTarget, targetId: string, reason: string) =>
  request<{ id: string; targetType: string; targetId: string; status: string; createdAt: string }>(
    '/consumer/community/reports',
    { method: 'POST', body: { targetType, targetId, reason: reason.slice(0, 1000) } },
  );
