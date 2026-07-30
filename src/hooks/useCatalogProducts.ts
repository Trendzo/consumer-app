// One way to ask the catalog for products, with a load state attached.
//
// Written because every screen that showed products had rolled its own effect,
// and every one of them collapsed "still loading", "request failed" and "the
// store genuinely has none" into a single falsy check — which is exactly why
// they all fell back to the bundled demo catalogue. A caller cannot get that
// wrong here: it gets `status` or nothing.
//
// The underlying GET is cached and de-duplicated in services/api.ts, so two
// rails asking for the same query share one round trip.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listProducts, type Gender } from '../services/catalog';
import type { Product } from '../data/mockData';
import type { LoadStatus } from '../components/CatalogState';

export type CatalogQuery = {
  gender?: Gender;
  categoryId?: string;
  categorySlug?: string;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating';
  limit?: number;
  offset?: number;
  /** Skip the request entirely (e.g. the screen has no query term yet). */
  enabled?: boolean;
};

export type CatalogResult = {
  products: Product[];
  status: LoadStatus;
  /** Re-run the same query, bypassing nothing — used by the error state's Retry. */
  reload: () => void;
};

export function useCatalogProducts(query: CatalogQuery = {}): CatalogResult {
  const {
    gender, categoryId, categorySlug, search, sort, limit, offset,
    enabled = true,
  } = query;

  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<LoadStatus>(enabled ? 'loading' : 'ready');
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Guards a stale response from a superseded query overwriting a newer one —
  // AbortController covers the network, this covers the resolve that already won
  // the race before abort landed.
  const runId = useRef(0);

  useEffect(() => {
    if (!enabled) { setProducts([]); setStatus('ready'); return; }
    const id = ++runId.current;
    const ac = new AbortController();
    setStatus('loading');
    listProducts({
      ...(gender ? { gender } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(categorySlug ? { categorySlug } : {}),
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
      ...(limit != null ? { limit } : {}),
      ...(offset != null ? { offset } : {}),
      signal: ac.signal,
    })
      .then((rows) => {
        if (id !== runId.current) return;
        setProducts(rows);
        setStatus('ready');
      })
      .catch((e) => {
        if (id !== runId.current) return;
        // An abort is this hook superseding itself, not a failure the shopper
        // should see — leave the state alone and let the newer run finish.
        if (e?.name === 'AbortError') return;
        setProducts([]);
        setStatus('error');
      });
    return () => ac.abort();
  }, [gender, categoryId, categorySlug, search, sort, limit, offset, enabled, nonce]);

  return { products, status, reload };
}
