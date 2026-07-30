// Server-side image resizing — request images at the size they are DISPLAYED
// instead of the original upload. The backend's Cloudinary URLs carry no
// transformation, so every product image is the raw ~1.5-1.7 MB PNG (a single
// catalog page ≈ 35-40 MB of downloads — measured); a `w_512,q_auto,f_auto`
// transform serves the same image at ~40 KB with no visible quality loss at
// card size. Recipes below were probe-verified per host (2026-07-21):
//
//   res.cloudinary.com    insert "w_<px>,q_auto,f_auto/" after /upload/
//                         (query params like ?w= are IGNORED by Cloudinary)
//   images.unsplash.com   imgix params: ?w=<px>&q=80&auto=format&fit=crop
//   upload.wikimedia.org  thumb URLs accept ONLY bucket widths
//                         (120/250/330/500/960 — anything else is HTTP 400)
//   pngimg.com            no native resize (left untouched — mock fallback only)

export const IMG = {
  /** small tiles: vibe grid, rail thumbnails, logos */
  thumb: 256,
  /** product cards & medium tiles — 160dp box × ~3x density */
  card: 512,
  /** full-width heroes & the PDP gallery — full quality */
  hero: 1080,
} as const;

const WIKI_BUCKETS = [120, 250, 330, 500, 960];

/** Rewrite a remote image URL to request a `px`-wide rendition when the host
 *  supports it. Unknown hosts and already-transformed URLs pass through. */
export function sizedImage(url: string | null | undefined, px: number): string {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    // Already carries a transformation segment? Leave it alone.
    if (/\/upload\/[^/]*(?:w_|q_|f_)[^/]*\//.test(url)) return url;
    return url.replace('/upload/', `/upload/w_${px},q_auto,f_auto/`);
  }
  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0];
    return `${base}?w=${px}&q=80&auto=format&fit=crop`;
  }
  if (url.includes('upload.wikimedia.org') && url.includes('/thumb/')) {
    const bucket = WIKI_BUCKETS.find((b) => b >= px) ?? 960;
    return url.replace(/\/(\d+)px-/, `/${bucket}px-`);
  }
  // S3 / CloudFront (the Cloudinary migration target, and where Home CMS uploads land).
  // Deliberately NO transform: the distribution serves objects byte-for-byte — there is no
  // image-resizing Lambda@Edge or CloudFront Function in front of it — so appending `?w=` would
  // change the URL, bust the cache, and return the identical full-size object. Anything added
  // here has to be provisioned first. Until then a CMS upload is served at the size it was
  // uploaded, which is why the admin picker warns on oversized files rather than relying on a
  // rewrite that does not exist.
  if (isS3Host(url)) return url;
  return url;
}

/** CloudFront distribution or a direct S3 object URL, either regional or path style. */
function isS3Host(url: string): boolean {
  return (
    url.includes('.cloudfront.net') ||
    /\.s3[.-][a-z0-9-]+\.amazonaws\.com/.test(url) ||
    url.includes('s3.amazonaws.com')
  );
}
