// Shared reader for GET /app-config.
//
// The underlying fetch is cached and de-duplicated in services/api.ts, so every
// screen calling this hook shares one request and one hour-long cache entry —
// mounting five screens does not mean five round trips.

import { useEffect, useState } from 'react';
import { getAppConfig, FALLBACK_CONFIG, type AppConfig } from '../services/appConfig';

/**
 * Merge the server payload OVER the shipped defaults, one section at a time.
 *
 * NOT a plain assignment. `/app-config` grows over time, and an app build is
 * routinely newer than the backend it talks to — a rolling deploy guarantees it.
 * Replacing the whole object meant any section the server had not learned to
 * send yet arrived `undefined`, and the first screen to read `cfg.delivery.methods`
 * crashed with "Cannot read property 'methods' of undefined".
 *
 * Merging per section means a missing section keeps its shipped default and the
 * app degrades to slightly stale copy instead of a crash.
 */
function merge(server: Partial<AppConfig> | null | undefined): AppConfig {
  if (!server || typeof server !== 'object') return FALLBACK_CONFIG;
  const pick = <K extends keyof AppConfig>(k: K): AppConfig[K] => {
    const v = server[k];
    if (v === undefined || v === null) return FALLBACK_CONFIG[k];
    // Section present: fill any individual field the server omitted.
    return { ...(FALLBACK_CONFIG[k] as object), ...(v as object) } as AppConfig[K];
  };
  return {
    support: pick('support'),
    delivery: pick('delivery'),
    tryAndBuy: pick('tryAndBuy'),
    returns: pick('returns'),
    loyalty: pick('loyalty'),
    referral: pick('referral'),
    orderLifecycle: pick('orderLifecycle'),
    company: pick('company'),
  };
}

/** Module-level so a screen mounting after the first fetch renders real copy on
 *  its FIRST frame instead of flashing the fallback. */
let lastKnown: AppConfig = FALLBACK_CONFIG;

export function useAppConfig(): AppConfig {
  const [cfg, setCfg] = useState<AppConfig>(lastKnown);
  useEffect(() => {
    let cancelled = false;
    getAppConfig()
      .then((c) => {
        const merged = merge(c as Partial<AppConfig>);
        lastKnown = merged;
        if (!cancelled) setCfg(merged);
      })
      .catch(() => { /* offline — keep the last known / shipped defaults */ });
    return () => { cancelled = true; };
  }, []);
  return cfg;
}
