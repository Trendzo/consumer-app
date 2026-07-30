# Virtual Try-On: HuggingFace → Backend Vertex Integration

**Handoff spec for the customer-app (frontend) work.**
Goal: replace the app's HuggingFace (Kolors) client-side try-on with the Trendzo
backend's Vertex `virtual-try-on-001` try-on. The backend and the app's try-on
**service layer are already done**; the remaining work is the **garment image
picker UI**. This doc is self-contained — read it fully before editing.

---

## 1. Status at a glance

| Layer | State | Where |
|---|---|---|
| Backend try-on endpoint | ✅ DONE (deploy pending) | `backend/src/modules/consumer/tryon/` |
| App try-on service (`tryOn.ts`) | ✅ DONE (rewritten) | `src/services/tryOn.ts` |
| App screen wiring (call + auth + listingId) | ✅ DONE (MVP) | `src/screens/GameScreens.tsx` → `TryOnScreen` |
| **Garment image picker UI** | ❌ **TODO — your job** | `TryOnScreen` in `GameScreens.tsx` |
| Env cleanup (remove HF vars) | ⚠️ partial | `.env.local.example`, `tryOn.ts` (already clean) |

**What works right now (MVP):** from a real product's PDP, the user uploads/captures
a photo → it's sent to the backend → Vertex generates the try-on → result shown.
The garment used is the product's **default image** (or its cheapest `variantId`
if the flat product row carries one). The user **cannot yet pick** which variant
image / the default to try on. That picker is the remaining work.

---

## 2. Architecture / flow

```
[TryOnScreen]
  person photo (local file:// from gallery/camera)
     │
     ├─ generateTryOn(personUri, listingId, variantId?)   (src/services/tryOn.ts)
     │      1. POST /api/v1/uploads   (multipart, consumer Bearer)  → { url } (person URL)
     │      2. POST /api/v1/consumer/tryon
     │              body: { personImageUrl, listingId, variantId? }
     │            → backend resolves the garment URL from its own catalog
     │            → Vertex virtual-try-on-001
     │            → { result: <url>, steps: [<url>] }
     │
     └─ setGeneratedPhoto(result)  → shown on the stage
```

Key point: the app **never sends a garment URL**. It sends a **reference**
(`listingId` + optional `variantId`); the backend looks up the real hosted URL.
This avoids Cloudinary transform-URL mismatches and is SSRF-safe. The picker you
build selects *which reference* to send, not a URL.

---

## 3. Backend API contract (already live in code; deploy pending)

### `POST /api/v1/consumer/tryon`
- **Auth:** consumer Bearer token (the app attaches it via `api.ts`).
- **Body:**
  ```jsonc
  {
    "personImageUrl": "https://.../person.jpg",  // hosted (from /uploads)
    "listingId": "lst_...",                       // the product
    "variantId": "var_..."                        // OPTIONAL: which variant's image
  }
  ```
  - Omit `variantId` → backend uses the listing's **default (gallery[0])** image.
  - `variantId` present + that variant has an image → uses **that variant's image**.
  - `variantId` present but the variant has **no** image → backend **falls back**
    to the default automatically.
- **Success 200:** `{ success:true, data:{ result:"<url>", steps:["<url>"] } }`
- **Errors (envelope `{ success:false, error:{ code, message } }`):**
  | HTTP | code | when | app should show |
  |---|---|---|---|
  | 401 | `unauthorized` | no/invalid consumer token | route to sign-in |
  | 404 | `not_found` | listing/variant missing | "Product unavailable" |
  | 422 | `invalid_state` | product has **zero** images | "No image to try on" |
  | 503 | `rate_limited` | **Vertex busy / 429** | "Try-on is busy — try again in a moment" |
  | 502 | `internal_error` | other Vertex failure | "Try-on failed — try again" |

The backend already **logs the exact provider error server-side** on 502/503; the
app only ever sees the friendly message above.

### `POST /api/v1/uploads` (person photo — existing, reused)
- Multipart, single field **`file`**, consumer Bearer allowed.
- Returns `{ success:true, data:{ url, publicId, width, height, ... } }` — use `data.url`.

---

## 4. What's already implemented in the app (do NOT redo)

### `src/services/tryOn.ts` (fully rewritten)
- HF Gradio client removed. New public API (unchanged names so the screen keeps
  compiling):
  - `generateTryOn(personUri: unknown, listingId: string, variantId?: string): Promise<string>`
    — uploads the person photo, calls `/consumer/tryon`, returns the result URL.
  - `subscribeTryOnLog`, `clearTryOnLog`, `getTryOnLog` — unchanged (debug modal).
  - `class TryOnAuthRequiredError` — thrown when `getAuthToken()` is null.
  - Re-exports `ApiError` (so callers can branch on `.code === 'rate_limited'`).
- Person upload helper uses the same RN multipart pattern as `reels.ts`
  (`FormData` `{ uri, name, type }`, no `Content-Type`, Bearer via `getAuthToken()`).
- Removed env: `EXPO_PUBLIC_HF_TOKEN / TRYON_SPACE / TRYON_ENDPOINT`.

### `src/screens/GameScreens.tsx` → `TryOnScreen` (MVP wiring)
- Import updated: `generateTryOn, …, TryOnAuthRequiredError`.
- `runTryOn()`:
  - derives `listingId = String(pick?.id ?? '').replace(/-\d+$/, '')`
  - **gates to real products:** `if (!listingId.startsWith('lst_')) { toast; return }`
  - calls `generateTryOn(uri, listingId, pick?.variantId)`
  - catches `TryOnAuthRequiredError` → sign-in toast.

---

## 5. YOUR TODO — the garment image picker

**Problem:** `runTryOn` currently uses `pick?.variantId` (the product row's single
default/cheapest variant, often `undefined`). The requirement: the user must be
able to choose **between the default (gallery) image and each variant that has its
own image**, per the current product.

### 5.1 Data source
The flat `Product` (`src/data/mockData.ts`, ~L65) has only `img: string | number`
and optional `variantId` — **not** the full image set. To build the picker, fetch
the product detail (same call the PDP uses):

- `getProductDetail(listingId)` — in `src/services/catalog.ts`. Returns (verify exact
  fields in that file) roughly:
  ```ts
  ProductDetailData = {
    listingId: string;
    gallery: string[];                 // default/listing images
    variants: Array<{
      id: string;                      // "var_..." → send as variantId
      color?: string; size?: string;   // for the option label
      img?: string;                    // the variant's image (may be absent)
    }>;
    // ...
  }
  ```
- `listingId` derivation is already in the PDP: `String(product.id).replace(/-\d+$/, '')`,
  guarded by an `isBackendListingId(...)` (roughly `id.startsWith('lst_')`). Reuse the
  same derivation in `TryOnScreen` (the MVP already does the `lst_` check inline).

### 5.2 Build the options list
```ts
type GarmentOption = { key: string; label: string; thumb: string; variantId?: string };

function buildGarmentOptions(detail: ProductDetailData): GarmentOption[] {
  const opts: GarmentOption[] = [];
  const def = detail.gallery?.find(Boolean);
  if (def) opts.push({ key: 'default', label: 'Default', thumb: def, variantId: undefined });
  for (const v of detail.variants ?? []) {
    if (v.img) {
      opts.push({
        key: v.id,
        label: [v.color, v.size].filter(Boolean).join(' · ') || 'Variant',
        thumb: v.img,
        variantId: v.id,
      });
    }
  }
  return opts;
}
```

Edge cases (must all be handled):
| Product shape | Options shown |
|---|---|
| Single variant, only gallery | `Default` |
| Multi-variant, some have images | `Default` + those variants |
| Variant without image | not shown (Default still is) |
| No variant images anywhere | `Default` only |
| **Zero images at all** | **empty → hide/disable try-on** ("No image to try on") |

### 5.3 Wire it in `TryOnScreen`
1. On mount / when `pick` changes: derive `listingId`; if it `startsWith('lst_')`,
   `getProductDetail(listingId)` and `setGarmentOptions(buildGarmentOptions(detail))`.
   (Guard against races / unmount, like the PDP does with a `cancelled` flag.)
2. Add state: `garmentOptions: GarmentOption[]`, `selectedGarment: GarmentOption | null`
   (default to `garmentOptions[0]`).
3. Replace / augment the existing **swap-strip** (currently other products,
   `picks`/`pick`, ~L1094-1100 + its render) with a **thumbnail row of
   `garmentOptions`** for the CURRENT product. Tapping a thumbnail sets
   `selectedGarment`. Show a selected-state ring/label.
4. In `runTryOn`, pass the chosen reference:
   ```ts
   if (!selectedGarment) { showToast('No image to try on'); return; }
   const outUrl = await generateTryOn(uri, listingId, selectedGarment.variantId);
   ```
5. If `garmentOptions.length === 0` → hide the Generate button / show the empty state.

### 5.4 Auth gate (finish it)
Right now `TryOnAuthRequiredError` shows a toast. The requirement is **force login**.
Wire the real login navigation for guests:
- Before capture/upload (or in the catch), if `!getAuthToken()`, route to the app's
  sign-in flow. **Find the actual login route** — a repo-wide search for the login
  screen name / how `cart`/`wallet` gate guests (they must already do this). Replace
  the toast with that navigation.

---

## 6. Conventions to follow (already in the repo)
- **JSON calls:** `request<T>(path, { method, body, timeoutMs })` from `src/services/api.ts`
  — unwraps the envelope, attaches Bearer, throws `ApiError`. Base URL already includes
  `/api/v1` (`src/config/env.ts` `API_BASE`).
- **Auth token:** `getAuthToken()` / `setAuthToken()` in `api.ts` (module holder set by
  `AppState` on login/hydrate).
- **Multipart upload:** raw `fetch` with `FormData`, no `Content-Type` (see `reels.ts`
  `requestMultipart` and the new `uploadPerson` in `tryOn.ts`).
- **Toasts:** `const { showToast } = useApp();`

---

## 7. Testing checklist
- [ ] Real product (PDP) → pick **Default** → capture photo → result shows.
- [ ] Product with variant images → pick a **variant** → result uses that variant.
- [ ] Variant without image not offered; Default still works.
- [ ] Product with **no images** → try-on hidden, no crash.
- [ ] **Signed-out** user → tapping try-on routes to login (not a silent fail).
- [ ] Backend **busy (503)** → shows "Try-on is busy — try again in a moment".
- [ ] Slow generation (Vertex ~10-30s) → loading state holds (90s timeout).
- [ ] Result image displays and is shareable/saveable (existing screen behavior).

## 8. Cleanup
- [ ] Remove `EXPO_PUBLIC_HF_TOKEN / TRYON_SPACE / TRYON_ENDPOINT` from `.env.local.example`.
- [ ] Remove any leftover HF copy in `TryOnScreen` (comments referencing "HF Space").

---

## 9. Gotchas
- **Never send a garment URL** to the backend — send `variantId` (or omit for default).
  The app's product images are Cloudinary-transformed and won't string-match the DB.
- **`listingId`** = product id with the trailing `-<n>` stripped; must start with `lst_`
  (mock/bundled products have no backend listing → try-on unavailable).
- **Vertex tier / 429:** consumer volume on the current Vertex project hits Dynamic
  Shared Quota limits. There is **no client retry** (intentional — retries double-bill).
  A 429 surfaces as the friendly 503 "busy" message. Don't add client retries.
- **Person image must be a public URL** — that's why it goes through `/uploads` first
  (Vertex fetches it server-side).
- **Cost:** each try-on is a paid Vertex image (~₹2-6). No per-user cap (business
  decision: the company bears the cost). Don't add charging.

---

## 10. Backend files (reference only — already implemented)
- `backend/src/modules/consumer/tryon/consumer-tryon.validators.ts` — `ConsumerTryOnBody`.
- `backend/src/modules/consumer/tryon/consumer-tryon.controller.ts` — `resolveGarment` + `tryOn`.
- `backend/src/modules/consumer/tryon/consumer-tryon.routes.ts` — route + friendly-error mapping.
- `backend/src/app.ts` — registered at prefix `/consumer/tryon`.
- Reuses `backend/src/shared/vertex-tryon.ts` (`virtualTryOn`, Vertex `virtual-try-on-001`).

Deploy the backend (push to `main` → Render) before end-to-end testing the app.
