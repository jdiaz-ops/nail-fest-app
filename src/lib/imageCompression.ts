"use client";

// Client-side only — runs in the browser right after a file is picked,
// before it ever reaches the server. Shared by the comprobantes capture
// flow (CaptureModal.tsx, defaults: max 2000px, JPEG ~0.8 — under 1MB) and
// the event hero image uploader (EventForm.tsx, larger/higher-quality
// options — see that call site's own comment for why). One function, one
// set of defaults, so the two callers only differ in the numbers they
// pass, not in how the resize/re-encode itself works.
const DEFAULT_MAX_DIMENSION = 2000;
const DEFAULT_JPEG_QUALITY = 0.8;

/** Downscales and re-encodes an image File as JPEG. PDFs are returned
 * untouched by the caller — this is only ever invoked for image/* files.
 * `imageOrientation: "from-image"` is what makes createImageBitmap apply
 * the file's own EXIF rotation before drawing, instead of every photo
 * taken in portrait coming out sideways once EXIF is stripped by the
 * re-encode below. */
export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  const maxDimension = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = opts.quality ?? DEFAULT_JPEG_QUALITY;

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // no canvas support — fall back to the original rather than fail the whole capture

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
