import { createHmac, timingSafeEqual } from "crypto";
import { formatHeroDate } from "@/lib/eventHeroDate";
import type { EventHeading } from "./confirmationEmail";

// The event's name and days in its emails' header as its page writes them
// (2026-10-30, the team chose that over the banners' script): «Nail Fest
// Cúcuta» and the big «7 y 8», in Fraunces Black. Gmail shows no fonts of its
// own, so they go as images, drawn by app/api/correo/titulo (signed: it draws
// only what we asked for). Their boxes are measured here, from the font's own
// measures, for the email's <img> to keep their proportions: no letter cut,
// nothing out of line. Text with a letter the font doesn't have stays text.

/** Fraunces Black's measures, in thousandths of its size: per character, its advance and the box of its strokes (from
 * where it starts: left, right, bottom, top). */
const GLYPHS: Record<string, readonly [number, number, number, number, number]> = {
  "0": [729, 30, 699, -19, 720], "1": [509, 36, 481, 0, 716], "2": [666, 30, 649, -19, 720],
  "3": [617, 38, 598, -19, 700], "4": [697, 15, 654, 0, 737], "5": [632, 40, 597, -19, 724],
  "6": [673, 30, 643, -19, 720], "7": [572, 35, 588, -20, 700], "8": [690, 44, 653, -19, 720],
  "9": [673, 30, 643, -19, 720], " ": [204, 0, 0, 0, 0], a: [599, 27, 599, -14, 495], b: [648, 12, 624, -14, 755],
  c: [555, 25, 527, -14, 496], d: [658, 25, 634, -14, 755], e: [558, 24, 534, -14, 496], f: [454, 28, 446, 0, 731],
  g: [616, 21, 646, -245, 622], h: [684, 27, 678, 0, 755], i: [350, 27, 332, 0, 733], j: [350, -48, 346, -233, 733],
  k: [660, 27, 668, 0, 755], l: [351, 27, 332, 0, 755], m: [1006, 27, 1001, 0, 496], n: [683, 27, 678, 0, 496],
  o: [621, 25, 596, -14, 496], p: [662, 27, 638, -233, 496], q: [649, 25, 635, -233, 496], r: [533, 27, 521, 0, 496],
  s: [532, 30, 495, -14, 496], t: [440, 10, 428, -14, 619], u: [672, 17, 644, -14, 496], v: [581, 0, 584, 0, 481],
  w: [886, 0, 889, 0, 481], x: [598, 11, 590, 0, 481], y: [604, 0, 607, -233, 481], z: [528, 23, 515, -14, 496],
  A: [785, 14, 761, 0, 700], B: [773, 44, 755, 0, 700], C: [721, 30, 692, -20, 720], D: [835, 44, 806, 0, 700],
  E: [691, 44, 686, -18, 718], F: [650, 44, 647, 0, 716], G: [783, 30, 760, -20, 720], H: [900, 45, 856, 0, 700],
  I: [460, 44, 416, 0, 700], J: [598, 25, 554, -18, 700], K: [863, 44, 850, 0, 700], L: [665, 44, 658, -18, 700],
  M: [983, 17, 959, 0, 700], N: [770, 33, 754, 0, 700], O: [803, 30, 773, -19, 720], P: [765, 44, 738, 0, 700],
  Q: [804, 29, 794, -142, 720], R: [829, 44, 807, 0, 700], S: [647, 37, 616, -18, 716], T: [744, 19, 726, 0, 716],
  U: [766, 32, 755, -19, 700], V: [756, 16, 750, 0, 700], W: [1118, 5, 1116, 0, 700], X: [752, 14, 746, 0, 700],
  Y: [709, 9, 704, 0, 700], Z: [660, 8, 640, -15, 716], á: [599, 27, 599, -14, 758], é: [558, 24, 534, -14, 758],
  í: [343, 27, 351, 0, 758], ó: [621, 25, 596, -14, 758], ú: [672, 17, 644, -14, 758], ü: [672, 17, 644, -14, 701],
  ñ: [683, 27, 678, 0, 708], Á: [785, 14, 761, 0, 946], É: [691, 44, 686, -18, 946], Í: [460, 44, 416, 0, 946],
  Ó: [803, 30, 773, -19, 946], Ú: [766, 32, 755, -19, 946], Ü: [766, 32, 755, -19, 911], Ñ: [770, 33, 754, 0, 911],
  à: [599, 27, 599, -14, 758], è: [558, 24, 534, -14, 758], ì: [343, 27, 327, 0, 758], ò: [621, 25, 596, -14, 758],
  ù: [672, 17, 644, -14, 758], â: [599, 27, 599, -14, 736], ê: [558, 24, 534, -14, 736], î: [343, 12, 327, 0, 736],
  ô: [621, 25, 596, -14, 736], û: [672, 17, 644, -14, 736], ç: [555, 25, 527, -228, 496],
  Ç: [721, 30, 692, -228, 720], ã: [599, 27, 599, -14, 708], õ: [621, 25, 596, -14, 708],
  ".": [326, 45, 282, -15, 227], ",": [339, 40, 299, -205, 206], "'": [220, 7, 213, 391, 787],
  "’": [288, 28, 274, 389, 779], "-": [398, 11, 387, 207, 343], "–": [571, 25, 546, 230, 317],
  "&": [1012, 32, 977, -24, 786], "(": [400, 75, 391, -139, 748], ")": [400, 9, 325, -139, 748],
};
/** Where the image's renderer (next/og) puts the baseline of a line as tall as the text's size: centered by the font's
 * ascender and descender (measured, 2026-10-30). */
const BASELINE = 862;
/** The margin around its strokes, in thousandths of its size. */
const MARGIN = 120;

/** Each piece as the event's page sets it ([eventSlug]/page.tsx, globals.css' .event-hero-*): its size, color and
 * tracking (thousandths of its size). */
export const LETTERINGS = {
  nombre: { size: 30, color: "#17181c", tracking: -10 },
  dias: { size: 52, color: "#007a74", tracking: -20 },
} as const;
export type LetteringKind = keyof typeof LETTERINGS;
export const LETTERING_FONT = "Fraunces";

export interface Lettering {
  url: string;
  width: number;
  height: number;
}

/** A piece's box, in px — its strokes and a margin —, where its line starts in it, and the line's height. */
export function letteringBox(kind: LetteringKind, text: string): { width: number; height: number; left: number; top: number; lineHeight: number } {
  const { size, tracking } = LETTERINGS[kind];
  let x = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ch of text) {
    const [advance, left, right, bottom, top] = GLYPHS[ch] ?? GLYPHS.o!;
    if (ch !== " ") {
      minX = Math.min(minX, x + left);
      maxX = Math.max(maxX, x + right);
      minY = Math.min(minY, bottom);
      maxY = Math.max(maxY, top);
    }
    x += advance + tracking;
  }
  const k = size / 1000;
  const margin = Math.ceil(MARGIN * k);
  return {
    width: Math.ceil((maxX - minX) * k) + 2 * margin,
    height: Math.ceil((maxY - minY) * k) + 2 * margin,
    left: margin - minX * k,
    top: margin + (maxY - BASELINE) * k,
    lineHeight: size,
  };
}

function signature(kind: LetteringKind, text: string): string | null {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`titulo:${kind}:${text}`).digest("base64url").slice(0, 22);
}

/** Whether a text and its signature go together. */
export function letteringSigned(kind: LetteringKind, text: string, given: string): boolean {
  const wanted = signature(kind, text);
  if (!wanted || given.length !== wanted.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(wanted));
}

/** Whether the font has every letter of a text — and it's a title's length. */
export function letterable(text: string): boolean {
  return /\S/.test(text) && text.length <= 48 && [...text].every((ch) => ch in GLYPHS);
}

export function isLetteringKind(kind: string | null): kind is LetteringKind {
  return kind !== null && Object.prototype.hasOwnProperty.call(LETTERINGS, kind);
}

/** A piece of the header as an image for the email (its size in px at 1×; the image is drawn at 2×), or none. */
export function lettering(base: string, kind: LetteringKind, text: string): Lettering | null {
  const value = text.trim();
  const s = letterable(value) ? signature(kind, value) : null;
  if (!s) return null;
  const { width, height } = letteringBox(kind, value);
  return { url: `${base}/api/correo/titulo?k=${kind}&t=${encodeURIComponent(value)}&s=${s}`, width, height };
}

/** An event's header as its page writes it — its name, the big days and the rest of its date —, with their images. */
export function eventHeadingOf(
  base: string,
  event: { name: string; startsAt: Date; endsAt: Date | null },
  timezone: string,
  language: string
): EventHeading {
  const date = formatHeroDate(event.startsAt, event.endsAt, timezone, language);
  return {
    name: event.name,
    days: date.days,
    month: date.month,
    detail: date.detail,
    nameImage: lettering(base, "nombre", event.name),
    daysImage: lettering(base, "dias", date.days),
  };
}
