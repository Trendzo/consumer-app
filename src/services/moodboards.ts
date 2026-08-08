// Moodboards — owner CRUD plus a public share read.
// docs/home-api-integration.md §M.
//
// Items reference listings and the server JOINS THE LIVE LISTING ON READ, so a
// delisted product surfaces its real `status` instead of freezing a stale
// snapshot. Render from `item.listing.status` rather than assuming a saved item
// is still buyable.
import { request } from './api';

/** A board in a list: everything except `items`. */
export type MoodBoardSummary = {
  id: string;
  name: string;
  note: string | null;
  isPublic: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  coverImageUrl: string | null;
};

export type MoodBoardItem = {
  id: string;
  listingId: string;
  sortOrder: number;
  addedAt: string;
  listing: { id: string; name: string; image: string | null; status: string };
};

export type MoodBoard = MoodBoardSummary & { items: MoodBoardItem[] };

/* ── Owner routes (consumer auth) ─────────────────────────────────────────── */

/** Summaries, most recently updated first. No paging — returns everything. */
export const listMoodBoards = () => request<MoodBoardSummary[]>('/consumer/moodboards');

/** `name` 1–80, `note` ≤500 or null. */
export const createMoodBoard = (input: { name: string; note?: string | null; isPublic?: boolean }) =>
  request<MoodBoardSummary>('/consumer/moodboards', {
    method: 'POST',
    body: {
      name: input.name.slice(0, 80),
      ...(input.note !== undefined ? { note: input.note ? input.note.slice(0, 500) : null } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
    },
  });

/** Detail with items. Ownership is enforced — someone else's board is a 404. */
export const getMoodBoard = (id: string) =>
  request<MoodBoard>(`/consumer/moodboards/${encodeURIComponent(id)}`);

/**
 * Any subset of the create body. An EMPTY body is a 422 ("No fields to update"),
 * so callers must not send `{}` when nothing changed.
 */
export const updateMoodBoard = (
  id: string,
  patch: { name?: string; note?: string | null; isPublic?: boolean },
) =>
  request<MoodBoard>(`/consumer/moodboards/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
  });

export const deleteMoodBoard = (id: string) =>
  request<{ deleted: boolean }>(`/consumer/moodboards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

/**
 * Add a listing. Throws `invalid_state` (409) when the product is already on
 * this board — treat that as success, not an error worth showing.
 */
export const addMoodBoardItem = (boardId: string, listingId: string) =>
  request<{ id: string; listingId: string; addedAt: string }>(
    `/consumer/moodboards/${encodeURIComponent(boardId)}/items`,
    { method: 'POST', body: { listingId } },
  );

export const removeMoodBoardItem = (boardId: string, itemId: string) =>
  request<{ deleted: boolean }>(
    `/consumer/moodboards/${encodeURIComponent(boardId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );

/* ── Public share read ────────────────────────────────────────────────────── */

/**
 * The shareable read — PUBLIC, no token. Returns detail minus `status`, and only
 * when the board is `isPublic` AND active; anything else is a 404. Returns null
 * on 404 so a dead share link renders "this board isn't shared" rather than an
 * error screen.
 */
export const getPublicMoodBoard = async (id: string): Promise<Omit<MoodBoard, 'status'> | null> => {
  try {
    return await request<Omit<MoodBoard, 'status'>>(
      `/public/moodboards/${encodeURIComponent(id)}`,
      { auth: false },
    );
  } catch {
    return null;
  }
};
