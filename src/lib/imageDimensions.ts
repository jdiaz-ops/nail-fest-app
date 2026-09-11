import { imageSize } from "image-size";

// The event hero image's REAL aspect ratio, probed from the actual
// uploaded file — see [eventSlug]/page.tsx's own comment for why this
// exists: a hardcoded 16:9 guess (this app doesn't store the real
// uploaded dimensions on Event) forced every hero image into the same
// crop window regardless of its real shape. A wide banner-style graphic
// (headline text spanning edge to edge — exactly what Nail Fest's own
// event images are) got its sides cropped off the moment its real ratio
// didn't match 16:9, which is what broke mobile specifically (the
// narrower the box, the more object-fit:cover has to crop a wide image
// to fill it). Probing the real file and rendering next/image at ITS
// actual ratio is what makes the box shrink to the image's own shape
// instead of cropping the image to fit a guessed box — the same
// behavior the plain <img> this whole feature replaced always had.
const FALLBACK = { width: 1600, height: 900 }; // 16:9 — only if the probe itself fails

export async function probeImageDimensions(url: string): Promise<{ width: number; height: number }> {
  try {
    // fetch() (the Node/server-side one, not a browser's) can't resolve a
    // relative URL on its own — there's no "current page" to resolve
    // against server-side. imageUrl is normally an absolute Vercel Blob
    // URL, but resolve against APP_BASE_URL just in case it's ever a
    // local /public path instead, rather than silently always falling
    // back for that case.
    const absoluteUrl = url.startsWith("/") ? new URL(url, process.env.APP_BASE_URL ?? "http://localhost").toString() : url;
    // revalidate: the file at this URL doesn't change without a new
    // upload (see uploads/event-image/route.ts — a re-upload gets its
    // own new Blob URL, it never overwrites one in place), so caching
    // this fetch for a while avoids re-downloading the same image bytes
    // on every single page view just to read its header.
    const res = await fetch(absoluteUrl, { next: { revalidate: 3600 } });
    if (!res.ok) return FALLBACK;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { width, height } = imageSize(bytes);
    if (!width || !height) return FALLBACK;
    return { width, height };
  } catch {
    // Malformed file, network hiccup, an image-size format it doesn't
    // recognize — never let a probe failure take down the whole public
    // landing page. Same 16:9 guess as before, just as a last resort
    // instead of the default.
    return FALLBACK;
  }
}
