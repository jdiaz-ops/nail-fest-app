"use client";

// Client-side only — runs in the browser right after a photo is picked,
// before it ever reaches /api/comprobantes/upload (see that route's own
// size caps). Target: under 1MB, max 2000px on the long side, JPEG ~0.8.
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.8;

/** Downscales and re-encodes an image File as JPEG. PDFs are returned
 * untouched by the caller — this is only ever invoked for image/* files.
 * `imageOrientation: "from-image"` is what makes createImageBitmap apply
 * the file's own EXIF rotation before drawing, instead of every photo
 * taken in portrait coming out sideways once EXIF is stripped by the
 * re-encode below. */
export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // no canvas support — fall back to the original rather than fail the whole capture

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
