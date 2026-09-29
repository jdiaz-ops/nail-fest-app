// Admin-uploaded photos live in Vercel Blob at full size (up to 1600px,
// often 300–600KB). Shown as a 170px grid tile, that's 10× more than the
// screen needs — thirty of them made a page crawl. These route a Blob URL
// through Next's own image optimizer (/_next/image, the same one the
// event hero already uses via next/image — the Blob host is allowlisted
// in next.config.js), which returns a resized WebP at the width asked
// for. Plain <img> tags keep their markup and layout; only src/srcSet
// change. Anything that isn't a Blob URL is returned untouched.

// Must be one of Next's configured widths (default deviceSizes +
// imageSizes) or /_next/image rejects the request.
const ALLOWED_WIDTHS = [64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function snap(width: number): number {
  return ALLOWED_WIDTHS.find((w) => w >= width) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]!;
}

/** A resized copy of `url` about `width` CSS px wide (doubled for sharp
 * phone screens is the caller's choice — pass the pixel width wanted). */
export function optimizedSrc(url: string, width: number, quality = 75): string {
  if (!isBlobUrl(url)) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${snap(width)}&q=${quality}`;
}

/** srcSet for several widths, so the browser picks the one that fits the
 * tile and the screen's pixel density. Empty for non-Blob URLs. */
export function optimizedSrcSet(url: string, widths: number[], quality = 75): string | undefined {
  if (!isBlobUrl(url)) return undefined;
  return widths.map((w) => `${optimizedSrc(url, w, quality)} ${snap(w)}w`).join(", ");
}
