# Festival Theming — the app side

How the server-driven festival skin works in this app, and the rules that keep it working.
Backend architecture, wire contract and admin workflow live in
`backend/docs/festival-theming-API.md`.

## Lifecycle

1. **Cold start** — `AppState`'s hydration `multiGet` includes `cms.theme.v1`;
   `hydratePersistedTheme()` (`src/services/theme.ts`) re-validates the raw persisted wire
   theme, checks expiry against server-corrected time, and applies it **synchronously
   before `authHydrated` flips** — the first routed frame paints themed, no flash.
2. **Refresh** — `startThemeService()` fetches `GET /cms/theme` on launch and on every
   app-foreground (TTL-throttled through `cachedGet`; unchanged snapshot = 304). Every
   request carries `x-app-version` + `x-app-platform` (`src/services/api.ts`) so the server
   can gate themes on platform and minimum app version.
3. **Apply** — validated allowlisted tokens merge over `LIGHT` (`applyPalette` in
   `src/theme/brutal.ts`), the precomputed `T` typography map is rebuilt and swapped, and
   the theme version bumps. Chrome surfaces subscribed via `useFestivalTheme()` /
   `useThemeVersion()` repaint immediately; body accents repaint on each screen's next
   render because every `C.*` / `T.*` read resolves the active palette at access time.
4. **Expire / disable** — an armed timer (and every foreground) reverts to `LIGHT` the
   moment `endsAt` passes, network or not. Clock skew is corrected via the server's
   `generatedAt`, so a device clock set 3 days ahead neither ends Diwali early nor keeps it
   alive past the next successful fetch.
5. **Fail** — malformed payload, unknown `schemaVersion`, non-https asset, dead Lottie URL,
   offline: each degrades to `LIGHT` or to a smaller decoration. `validateTheme()`
   (`src/theme/remoteTheme.ts`, 126 unit tests) is allowlist-only and wrapped in try/catch;
   raw server JSON never reaches the palette.

## Token rules

- **Remote-safe** (the ONLY keys a theme can change): `accent`, `accentInk`, `accentSoft`,
  `surfaceAlt`, `hairline`.
- **Client-owned**: `bg`, `ink`, `inkSoft`, `dim`, `faint`, `white`.
- **Locked semantic** (never themed, also hardcoded at call sites on purpose): success
  `#1B8A5A`, warning `#B0740A`, error `#C1121F` and the savings green — an error is red in
  every season and the green is money.

`LIGHT.accent` is `#F2E63C` — exactly the old hardcoded brand yellow — so an un-themed app
is pixel-identical to before theming existed.

## The one rule that keeps this working

**Never read `C.*` or `T.*` at module scope.** A module-level
`StyleSheet.create({ color: C.ink })` or `const YELLOW = C.accent` snapshots the palette at
bundle load — *before* hydration — and becomes a surface no theme (not even the cold-start
apply) can reach. Read tokens inline in render paths, or use the rebuilt-on-subscribe
factory pattern in `src/components/RichText.tsx`. Screens with `makeS()` style factories
memoized per mount take `useThemeVersion()` as the memo dep (see ReelsScreen /
ProductDetailScreen / CheckoutScreen).

## Remaining hardcoded visual values (post-migration census)

The brand yellow `#F2E63C` is fully migrated to `C.accent` (13 call sites across 9 files;
zero literals remain outside `theme/brutal.ts`). What's left, categorized per the sdu spec:

| Category | Examples | Verdict |
|---|---|---|
| Intentional semantic constants | `#1B8A5A` (12×), `#B0740A` (16×), `#C1121F` (28×) — order status, warnings, errors | Keep hardcoded; locked from theming by design |
| Neutral surface | `#F4F4F4` (83×) thumb/empty-state backing | `C.surfaceAlt` token exists; migrate opportunistically, zero festival value |
| Chrome whites/blacks | `#FFFFFF` (55×), `#000000`, `#1a1a1a` | Client-owned structural — not themeable by design |
| Illustration/content palettes | style-quiz swatches (`#ff6b9d`, `#5d4037`, `#a78bfa`, `#feca57`…), zoom tints, per-campaign CMS gradients | Content, not chrome — stays authored |
| Third-party | Lottie keypath recolors in CategoryScreen | Cannot migrate; theme-agnostic |

## Testing

`npm run typecheck` (tsc) and `npm test` (vitest over the pure theme logic —
`src/theme/remoteTheme.test.ts`). For visual QA, `debugApplyTheme(fixture)` in
`src/services/theme.ts` pushes a raw wire theme through the full validate/apply path in dev.
