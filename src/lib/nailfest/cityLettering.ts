import { createHmac, timingSafeEqual } from "crypto";

// The city in Nail Fest's script for its emails' header (2026-10-30, the
// team: «Cúcuta» didn't look like the rest of Nail Fest's graphics, whose
// banners write it in Satisfy, in their teal). Gmail shows no fonts of its
// own, so it goes as an image, drawn by app/api/correo/ciudad (signed: it
// draws only what we asked for). Its box is measured here, from the font's
// own measures, for the email's <img> to keep its proportions: no letter cut,
// nothing out of line. A city with a letter the font doesn't have stays text.

/** Satisfy's measures, in thousandths of its size: per character, its advance and the box of its strokes (from where
 * it starts: left, right, bottom, top — its loops and joins reach past its advance and under the line). */
const GLYPHS: Record<string, readonly [number, number, number, number, number]> = {
  "0": [489, 29, 451, -23, 736], "1": [272, 14, 258, -16, 729], "2": [448, -30, 433, -29, 736],
  "3": [463, -5, 444, -25, 736], "4": [452, -1, 431, -20, 731], "5": [444, -2, 465, -25, 726],
  "6": [478, 34, 434, -24, 734], "7": [406, 46, 447, -15, 729], "8": [444, -11, 439, -24, 735],
  "9": [463, 19, 435, -23, 735], " ": [280, 0, 0, 0, 0], a: [436, -18, 518, -15, 413], b: [415, 13, 517, -16, 707],
  c: [363, -10, 443, -25, 412], d: [483, -12, 565, -22, 698], e: [372, -9, 449, -23, 409],
  f: [325, -96, 427, -473, 698], g: [460, -15, 534, -489, 403], h: [466, -10, 534, -20, 686],
  i: [274, 19, 353, -13, 644], j: [268, -211, 354, -443, 654], k: [440, -21, 515, -30, 695],
  l: [219, -15, 225, -19, 686], m: [718, -7, 798, -23, 386], n: [462, -21, 535, -24, 389],
  o: [394, -5, 495, -20, 396], p: [451, -105, 522, -425, 388], q: [463, -5, 504, -454, 390],
  r: [406, -77, 484, -32, 463], s: [352, 11, 278, -33, 446], t: [302, -71, 422, -22, 692],
  u: [469, 0, 552, -16, 379], v: [428, 9, 528, -23, 394], w: [646, 10, 745, -22, 400], x: [399, -51, 439, -25, 407],
  y: [406, -18, 364, -424, 385], z: [448, -32, 514, -436, 397], A: [553, -110, 501, -234, 735],
  B: [607, -5, 584, -186, 749], C: [549, -2, 555, -182, 738], D: [633, -6, 603, -183, 735],
  E: [523, -31, 539, -182, 736], F: [586, 38, 578, -185, 734], G: [612, 13, 575, -190, 738],
  H: [649, -12, 659, -185, 727], I: [537, -75, 530, -183, 733], J: [501, -82, 591, -192, 730],
  K: [497, -50, 538, -273, 734], L: [492, -102, 532, -197, 734], M: [733, -102, 724, -184, 729],
  N: [541, -42, 634, -178, 738], O: [567, 6, 520, -190, 747], P: [553, -50, 570, -173, 738],
  Q: [583, 21, 548, -186, 737], R: [561, -35, 578, -247, 739], S: [475, -50, 496, -192, 765],
  T: [424, 30, 540, -180, 726], U: [574, 10, 614, -183, 725], V: [504, 45, 569, -189, 731],
  W: [817, 21, 803, -189, 741], X: [579, -50, 684, -184, 742], Y: [532, 5, 572, -183, 733],
  Z: [455, -80, 495, -178, 728], á: [436, -18, 518, -15, 607], é: [372, -9, 449, -23, 607],
  í: [274, 19, 353, -13, 607], ó: [394, -5, 495, -20, 598], ú: [469, 0, 552, -16, 577], ü: [469, 0, 552, -16, 545],
  ñ: [462, -21, 535, -24, 552], Á: [553, -110, 514, -234, 927], É: [523, -31, 539, -182, 927],
  Í: [537, -75, 533, -183, 927], Ó: [567, 6, 520, -190, 927], Ú: [574, 10, 614, -183, 896],
  Ü: [574, 10, 614, -183, 867], Ñ: [541, -42, 634, -178, 861], à: [436, -18, 518, -15, 605],
  è: [372, -9, 449, -23, 605], ì: [274, 15, 353, -13, 605], ò: [394, -5, 495, -20, 596], ù: [469, 0, 552, -16, 575],
  â: [436, -18, 518, -15, 588], ê: [372, -9, 449, -23, 588], î: [274, 4, 353, -13, 577], ô: [394, -5, 495, -20, 577],
  û: [469, 0, 552, -16, 567], ç: [363, -10, 443, -230, 412], Ç: [549, -2, 555, -392, 738],
  ã: [436, -18, 518, -15, 562], õ: [394, -5, 495, -20, 552], ".": [214, -32, 105, -23, 78],
  ",": [200, -32, 93, -123, 77], "'": [113, 39, 189, 438, 736], "’": [154, 59, 184, 455, 677],
  "-": [354, -16, 341, 260, 350], "–": [354, -16, 341, 260, 350], "&": [461, -52, 432, -50, 743],
  "(": [234, 16, 324, -116, 829], ")": [204, -110, 197, -116, 829],
};
/** Its kerning: what each pair moves the second letter. */
const KERN: Record<string, number> = {
  "-X": -40, "AG": -10, "AT": 20, "BB": -30, "BD": -20, "BG": -10, "BO": -10, "BQ": -10, "BÓ": -10, "CD": -10,
  "CN": 10, "CT": 30, "CÑ": 10, "DB": -20, "DD": -40, "DE": -10, "DF": -10, "DN": 10, "DR": -10, "DS": -10,
  "DT": -20, "DX": -20, "DZ": -10, "DÉ": -10, "DÑ": 10, "EB": -10, "ED": -10, "EG": -10, "EH": -10, "EN": 10,
  "EÑ": 10, "F,": -40, "F.": -40, "FE": -10, "FG": -20, "FH": -20, "FI": -30, "FJ": -20, "FL": -20, "FO": -10,
  "FS": -10, "FÉ": -10, "FÍ": -30, "FÓ": -10, "GB": -10, "GD": -40, "GF": -10, "GG": -10, "GH": -10, "GL": -20,
  "GM": 20, "GN": 10, "GP": -10, "GÑ": 10, "HD": -10, "HL": -10, "HT": 10, "HU": -10, "HÚ": -10, "IB": -20,
  "ID": -30, "IF": -10, "IL": -40, "JG": -20, "JL": -20, "KB": -10, "KC": -10, "KG": -10, "KO": -10, "KS": 10,
  "KU": -10, "KÇ": -10, "KÓ": -10, "KÚ": -10, "LA": 70, "LD": 20, "LE": 30, "LF": 20, "LG": 10, "LH": 30, "LJ": 20,
  "LK": 60, "LM": 60, "LN": 50, "LO": 10, "LP": 60, "LR": 30, "LT": 60, "LW": 10, "LÉ": 30, "LÑ": 50, "LÁ": 70,
  "LÓ": 10, "MG": -10, "MJ": 20, "MN": 20, "MÑ": 20, "NC": 10, "NE": 30, "NM": 20, "NN": 20, "NO": 10, "NÇ": 10,
  "NÉ": 30, "NÑ": 20, "NÓ": 10, "OB": -20, "OD": -20, "OF": -20, "OG": -10, "OH": -10, "OK": -10, "OL": -10,
  "OT": -10, "OW": -10, "P,": -80, "P.": -80, "PA": -10, "PD": -10, "PH": -10, "PI": -60, "PJ": -40, "PK": -10,
  "PM": -50, "PÁ": -10, "PÍ": -60, "QB": -10, "QD": -10, "QF": -10, "QH": -10, "RI": -10, "RÍ": -10, "SD": -10,
  "SH": -10, "SK": -10, "TA": -20, "TC": -20, "TH": -10, "TI": -40, "TJ": -30, "TL": -50, "TM": -20, "TO": -10,
  "TÇ": -20, "TÁ": -20, "TÍ": -40, "TÓ": -10, "V,": -30, "V.": -30, "VG": -15, "VI": -30, "VJ": -10, "VÍ": -30,
  "W,": -30, "W.": -30, "WB": -10, "WD": -20, "WE": -10, "WG": -10, "WH": -20, "WÉ": -10, "X-": -40, "YD": -10,
  "YH": -20, "v,": -80, "v.": -80, "w,": -60, "w.": -60, "y,": -30, "y.": -30, "ÇD": -10, "ÇN": 10, "ÇT": 30,
  "ÉB": -10, "ÉD": -10, "ÉG": -10, "ÉH": -10, "ÉN": 10, "ÑC": 10, "ÑE": 30, "ÑM": 20, "ÑN": 20, "ÑO": 10, "ÁG": -10,
  "ÁT": 20, "ÍB": -20, "ÍD": -30, "ÍF": -10, "ÍL": -40, "ÓB": -20, "ÓD": -20, "ÓF": -20, "ÓG": -10, "ÓH": -10,
  "ÓK": -10, "ÓL": -10, "ÓT": -10, "ÓW": -10,
};
/** Where the image's renderer (next/og) puts the baseline of a line as tall as the text's size: 0.9 of it down
 * (measured, 2026-10-30). */
const BASELINE = 900;

/** Its size in the header, and its teal (the banners'). */
export const LETTERING = { size: 54, color: "#00a8a8", font: "Satisfy" } as const;
/** The margin around its strokes, in thousandths of its size. */
const MARGIN = 80;

export interface CityLettering {
  url: string;
  width: number;
  height: number;
}

/** The city's box at a size, in px — its strokes and a margin —, where its line starts in it, and the line's height. */
export function letteringBox(city: string, size: number): { width: number; height: number; left: number; top: number; lineHeight: number } {
  let x = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let prev = "";
  for (const ch of city) {
    x += KERN[prev + ch] ?? 0;
    const [advance, left, right, bottom, top] = GLYPHS[ch] ?? GLYPHS.o!;
    if (ch !== " ") {
      minX = Math.min(minX, x + left);
      maxX = Math.max(maxX, x + right);
      minY = Math.min(minY, bottom);
      maxY = Math.max(maxY, top);
    }
    x += advance;
    prev = ch;
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

function signature(city: string): string | null {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`ciudad:${city}`).digest("base64url").slice(0, 22);
}

/** Whether a city and its signature go together. */
export function letteringSigned(city: string, given: string): boolean {
  const wanted = signature(city);
  if (!wanted || given.length !== wanted.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(wanted));
}

/** Whether the font has every letter of a city — and it's a city's length. */
export function letterable(city: string): boolean {
  return city.length > 0 && city.length <= 32 && [...city].every((ch) => ch in GLYPHS);
}

/** The city in the script, as an image for the email (its size in px at 1×; the image is drawn at 2×), or none. */
export function cityLettering(base: string, city: string): CityLettering | null {
  const text = city.trim();
  const s = letterable(text) ? signature(text) : null;
  if (!s) return null;
  const { width, height } = letteringBox(text, LETTERING.size);
  return { url: `${base}/api/correo/ciudad?c=${encodeURIComponent(text)}&s=${s}`, width, height };
}
