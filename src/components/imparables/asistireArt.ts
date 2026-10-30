// Manicuristas Imparables' «Asistiré» image (2026-10-30): the boceto the team
// chose («Portada»), drawn on a canvas in her own browser, so her photo never
// leaves her phone. The cover's bone and bronze rays, the name, her photo in
// a gold arch, «¡ASISTIRÉ!» on a gold stamp, the day, and where to book. Two
// sizes: a story (1080×1920) and a publication (1080×1350). Every position
// below is the boceto's own, measured.

export type AsistireFormat = "historia" | "publicacion";

export interface AsistireTexts {
  /** «Manicuristas»: the name's first words, small, over the last one. */
  pre: string;
  /** «Imparables» */
  big: string;
  /** «Domingo 27 de junio de 2027» */
  date: string;
  /** «Congreso virtual · 100% en vivo» */
  kind: string;
  /** «nailfest.lat/imparables» */
  link: string;
}

/** The two faces' CSS families, as next/font names them (fonts.ts). */
export interface AsistireFonts {
  display: string;
  body: string;
}

/** Where her photo sits in the arch: how much bigger than just covering it, and which point of it (0–1 across, 0–1 down) is at the arch's center. */
export interface Placement {
  zoom: number;
  u: number;
  v: number;
}

export const SHOUT = "¡ASISTIRÉ!";
const INVITE = "Reserva tu cupo en ";
export const MAX_ZOOM = 3;
/** A face is usually above the middle of a photo. */
export const FIRST_PLACEMENT: Placement = { zoom: 1, u: 0.5, v: 0.42 };

// The page's colors (globals.css, --imp-*).
const C = {
  bone: "#ede8e1",
  deep: "#e9dfcf",
  line: "#dcd2c3",
  ink: "#141414",
  warm: "#5e564c",
  chocolate: "#3b2418",
  cream: "#f5f0e8",
  bronze: "#8c6a3e",
  gold: "#c9a46a",
  goldLight: "#d2b486",
};
const GOLD_STOPS: [number, string][] = [
  [0, "#f0d9a6"],
  [0.38, "#d8b77a"],
  [0.62, "#c9a46a"],
  [1, "#a8844e"],
];
/** The arch's gold edge, inside it. */
const EDGE = 6;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Line {
  top: number;
  height: number;
  size: number;
}
interface Layout {
  width: number;
  height: number;
  glow: { rx: number; ry: number };
  tiara: Box;
  pre: Line & { spacing: number };
  big: Line;
  arch: Box & { round: number; foot: number };
  frame: Box & { round: number; foot: number };
  stamp: { top: number; height: number; padX: number; radius: number; size: number; textTop: number; spacing: number };
  sparkles: Box[];
  date: Line;
  kind: Line;
  pill: Line & { padX: number };
  signature: Line & { spacing: number; gap: number };
}

export const LAYOUTS: Record<AsistireFormat, Layout> = {
  historia: {
    width: 1080,
    height: 1920,
    glow: { rx: 864, ry: 768 },
    tiara: { x: 425, y: 176, w: 230, h: 63 },
    pre: { top: 253, height: 48, size: 48, spacing: 10.56 },
    big: { top: 311, height: 140, size: 140 },
    arch: { x: 240, y: 513, w: 600, h: 760, round: 300, foot: 26 },
    frame: { x: 222, y: 495, w: 636, h: 796, round: 318, foot: 40 },
    stamp: { top: 1195, height: 146, padX: 58, radius: 22, size: 98, textTop: 1217, spacing: 3.92 },
    sparkles: [
      { x: 138, y: 1250, w: 70, h: 62 },
      { x: 890, y: 1120, w: 46, h: 40 },
    ],
    date: { top: 1405, height: 65, size: 48 },
    kind: { top: 1484, height: 46, size: 34 },
    pill: { top: 1580, height: 96, size: 32, padX: 46 },
    signature: { top: 1712, height: 40, size: 22, spacing: 3.52, gap: 14 },
  },
  publicacion: {
    width: 1080,
    height: 1350,
    glow: { rx: 864, ry: 540 },
    tiara: { x: 452, y: 70, w: 176, h: 48 },
    pre: { top: 128, height: 36, size: 36, spacing: 7.92 },
    big: { top: 172, height: 106, size: 106 },
    arch: { x: 320, y: 322, w: 440, h: 540, round: 220, foot: 22 },
    frame: { x: 306, y: 308, w: 468, h: 568, round: 234, foot: 34 },
    stamp: { top: 802, height: 109, padX: 42, radius: 18, size: 74, textTop: 818, spacing: 2.96 },
    sparkles: [
      { x: 214, y: 842, w: 54, h: 48 },
      { x: 806, y: 740, w: 36, h: 32 },
    ],
    date: { top: 955, height: 52, size: 38 },
    kind: { top: 1017, height: 38, size: 28 },
    pill: { top: 1089, height: 76, size: 26, padX: 38 },
    signature: { top: 1191, height: 32, size: 18, spacing: 2.88, gap: 14 },
  },
};

/** Her photo's box: the arch inside its gold edge. */
export function photoBox(format: AsistireFormat): Box & { round: number; foot: number } {
  const a = LAYOUTS[format].arch;
  return { x: a.x + EDGE, y: a.y + EDGE, w: a.w - 2 * EDGE, h: a.h - 2 * EDGE, round: a.round - EDGE, foot: a.foot - EDGE };
}

/** Where her photo goes on the canvas, and how big, for a placement. */
export function photoRect(box: Box, photo: { width: number; height: number }, p: Placement): Box {
  const scale = Math.max(box.w / photo.width, box.h / photo.height) * p.zoom;
  const w = photo.width * scale;
  const h = photo.height * scale;
  return { x: box.x + box.w / 2 - p.u * w, y: box.y + box.h / 2 - p.v * h, w, h };
}

/** The nearest placement that keeps the arch covered: zoom 1 to MAX_ZOOM, and no edge of the photo inside it. */
export function clampPlacement(box: Box, photo: { width: number; height: number }, p: Placement): Placement {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, p.zoom));
  const scale = Math.max(box.w / photo.width, box.h / photo.height) * zoom;
  const halfU = box.w / 2 / (photo.width * scale);
  const halfV = box.h / 2 / (photo.height * scale);
  return { zoom, u: Math.min(1 - halfU, Math.max(halfU, p.u)), v: Math.min(1 - halfV, Math.max(halfV, p.v)) };
}

/** What doesn't move with her photo, drawn once per size: under it, and over it. */
export interface AsistireLayers {
  format: AsistireFormat;
  under: HTMLCanvasElement;
  over: HTMLCanvasElement;
}

export function asistireLayers(format: AsistireFormat, texts: AsistireTexts, fonts: AsistireFonts, logo: HTMLImageElement | null): AsistireLayers {
  const L = LAYOUTS[format];
  const under = blank(L.width, L.height);
  const over = blank(L.width, L.height);
  drawUnder(under.getContext("2d")!, L, texts, fonts);
  drawOver(over.getContext("2d")!, L, texts, fonts, logo);
  return { format, under, over };
}

/** The whole image: the layers and, between them, her photo in the arch — or, before she picks one, «Tu foto aquí». */
export function drawAsistire(ctx: CanvasRenderingContext2D, layers: AsistireLayers, photo: HTMLCanvasElement | null, placement: Placement, fonts: AsistireFonts) {
  const L = LAYOUTS[layers.format];
  const box = photoBox(layers.format);
  ctx.clearRect(0, 0, L.width, L.height);
  ctx.drawImage(layers.under, 0, 0);
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, box.x, box.y, box.w, box.h, corners(box.round, box.foot));
  ctx.clip();
  if (photo) {
    const r = photoRect(box, photo, placement);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, r.x, r.y, r.w, r.h);
  } else {
    drawEmpty(ctx, box, fonts);
  }
  ctx.restore();
  ctx.drawImage(layers.over, 0, 0);
}

function blank(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function corners(round: number, foot: number): [number, number, number, number] {
  return [round, round, foot, foot];
}

function roundedRect(p: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, [tl, tr, br, bl]: [number, number, number, number]) {
  p.moveTo(x + tl, y);
  p.lineTo(x + w - tr, y);
  p.arcTo(x + w, y, x + w, y + tr, tr);
  p.lineTo(x + w, y + h - br);
  p.arcTo(x + w, y + h, x + w - br, y + h, br);
  p.lineTo(x + bl, y + h);
  p.arcTo(x, y + h, x, y + h - bl, bl);
  p.lineTo(x, y + tl);
  p.arcTo(x, y, x + tl, y, tl);
  p.closePath();
}

function gold(ctx: CanvasRenderingContext2D, top: number, bottom: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  for (const [at, color] of GOLD_STOPS) g.addColorStop(at, color);
  return g;
}

/** The alphabetic baseline that centers a line of the current font in a line box, as the page does. */
function baseline(ctx: CanvasRenderingContext2D, top: number, height: number, size: number): number {
  const m = ctx.measureText("ÁHg");
  const ascent = m.fontBoundingBoxAscent || size * 0.9;
  const descent = m.fontBoundingBoxDescent || size * 0.25;
  return top + (height - ascent - descent) / 2 + ascent;
}

/** Text with room between its letters, centered on cx; returns how wide it is (drawing nothing when asked only that). */
function spaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number, draw = true): number {
  const letters = Array.from(text);
  const widths = letters.map((ch) => ctx.measureText(ch).width);
  const width = widths.reduce((a, b) => a + b, 0) + spacing * (letters.length - 1);
  if (draw) {
    ctx.textAlign = "left";
    let x = cx - width / 2;
    letters.forEach((ch, i) => {
      ctx.fillText(ch, x, y);
      x += widths[i]! + spacing;
    });
  }
  return width;
}

/** The font at its size, or smaller if the text wouldn't fit the width. */
function fitted(ctx: CanvasRenderingContext2D, weight: number, size: number, family: string, text: string, max: number): number {
  ctx.font = `${weight} ${size}px ${family}`;
  const width = ctx.measureText(text).width;
  if (width <= max) return size;
  const smaller = Math.floor((size * max) / width);
  ctx.font = `${weight} ${smaller}px ${family}`;
  return smaller;
}

// The tiara's star (ImpArt.tsx), in its 190×52 drawing.
const STAR: [number, number][] = [
  [95, 8],
  [99.4, 19],
  [111, 19.6],
  [101.9, 26.8],
  [105, 38],
  [95, 31.6],
  [85, 38],
  [88.1, 26.8],
  [79, 19.6],
  [90.6, 19],
];

function starPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  for (const [x, y] of STAR) ctx.lineTo(x, y);
  ctx.closePath();
}

/** The arc and its star over the name. */
function drawTiara(ctx: CanvasRenderingContext2D, b: Box) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.w / 190, b.w / 190);
  ctx.strokeStyle = C.gold;
  ctx.fillStyle = C.gold;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(6, 48);
  ctx.quadraticCurveTo(95, -4, 184, 48);
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(30, 46);
  ctx.quadraticCurveTo(95, 12, 160, 46);
  ctx.stroke();
  ctx.globalAlpha = 1;
  starPath(ctx);
  ctx.fill();
  ctx.restore();
}

/** One of the little stars beside the stamp: the tiara's, alone. */
function drawSparkle(ctx: CanvasRenderingContext2D, b: Box) {
  const s = Math.min(b.w / 50, b.h / 44);
  ctx.save();
  ctx.translate(b.x + (b.w - 50 * s) / 2, b.y + (b.h - 44 * s) / 2);
  ctx.scale(s, s);
  ctx.translate(-70, 0);
  ctx.fillStyle = C.gold;
  starPath(ctx);
  ctx.fill();
  ctx.restore();
}

/** The cover's light from the top. */
function drawGlow(ctx: CanvasRenderingContext2D, L: Layout) {
  const { rx, ry } = L.glow;
  ctx.save();
  ctx.translate(L.width / 2, 0);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.7, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-L.width / 2, 0, L.width, (L.height * rx) / ry + 1);
  ctx.restore();
}

/** The cover's bronze rays from the top center, fading out like the page's. */
function drawRays(ctx: CanvasRenderingContext2D, L: Layout) {
  const layer = blank(L.width, L.height);
  const l = layer.getContext("2d")!;
  const cx = L.width / 2;
  const reach = Math.hypot(L.width, L.height);
  l.fillStyle = C.bronze;
  // A ray of 1.6° every 5°, from straight up, turning clockwise.
  for (let deg = 0; deg < 360; deg += 5) {
    l.beginPath();
    l.moveTo(cx, 0);
    l.arc(cx, 0, reach, ((deg - 90) * Math.PI) / 180, ((deg + 1.6 - 90) * Math.PI) / 180);
    l.closePath();
    l.fill();
  }
  // The fade: an ellipse 1300 wide and 1218 deep from the top center.
  l.globalCompositeOperation = "destination-in";
  l.translate(cx, 0);
  l.scale(1, 1218 / 1300);
  const fade = l.createRadialGradient(0, 0, 0, 0, 0, 1300);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.5, "rgba(0,0,0,0.5)");
  fade.addColorStop(0.85, "rgba(0,0,0,0)");
  l.fillStyle = fade;
  l.fillRect(-cx, 0, L.width, (L.height * 1300) / 1218 + 1);
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

function drawUnder(ctx: CanvasRenderingContext2D, L: Layout, t: AsistireTexts, f: AsistireFonts) {
  const cx = L.width / 2;
  ctx.fillStyle = C.bone;
  ctx.fillRect(0, 0, L.width, L.height);
  drawGlow(ctx, L);
  drawRays(ctx, L);
  drawTiara(ctx, L.tiara);

  ctx.fillStyle = C.ink;
  ctx.font = `800 ${L.pre.size}px ${f.display}`;
  spaced(ctx, t.pre.toUpperCase(), cx, baseline(ctx, L.pre.top, L.pre.height, L.pre.size), L.pre.spacing);

  const word = t.big.toUpperCase();
  const size = fitted(ctx, 900, L.big.size, f.display, word, L.width - 86);
  ctx.fillStyle = C.bronze;
  ctx.textAlign = "center";
  ctx.fillText(word, cx, baseline(ctx, L.big.top, L.big.height, size));

  // The thin gold line around the arch, then the arch, gold-edged, with its shadow.
  const fr = L.frame;
  ctx.beginPath();
  roundedRect(ctx, fr.x + 1.5, fr.y + 1.5, fr.w - 3, fr.h - 3, corners(fr.round - 1.5, fr.foot - 1.5));
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.gold;
  ctx.stroke();
  const a = L.arch;
  ctx.save();
  ctx.shadowColor = "rgba(94,66,34,0.32)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 30;
  ctx.beginPath();
  roundedRect(ctx, a.x, a.y, a.w, a.h, corners(a.round, a.foot));
  ctx.fillStyle = C.goldLight;
  ctx.fill();
  ctx.restore();
}

function drawOver(ctx: CanvasRenderingContext2D, L: Layout, t: AsistireTexts, f: AsistireFonts, logo: HTMLImageElement | null) {
  const cx = L.width / 2;
  for (const b of L.sparkles) drawSparkle(ctx, b);
  drawStamp(ctx, L, f);

  ctx.textAlign = "center";
  ctx.fillStyle = C.ink;
  const dateSize = fitted(ctx, 800, L.date.size, f.body, t.date, L.width - 120);
  ctx.fillText(t.date, cx, baseline(ctx, L.date.top, L.date.height, dateSize));
  ctx.fillStyle = C.warm;
  const kindSize = fitted(ctx, 600, L.kind.size, f.body, t.kind, L.width - 120);
  ctx.fillText(t.kind, cx, baseline(ctx, L.kind.top, L.kind.height, kindSize));

  drawPill(ctx, L, t, f);
  drawSignature(ctx, L, f, logo);
}

/** «¡ASISTIRÉ!» on gold, tilted, over the arch's foot. */
function drawStamp(ctx: CanvasRenderingContext2D, L: Layout, f: AsistireFonts) {
  const s = L.stamp;
  ctx.font = `900 ${s.size}px ${f.display}`;
  const w = spaced(ctx, SHOUT, 0, 0, s.spacing, false) + 2 * s.padX;
  const h = s.height;
  const cy = s.top + h / 2;
  const shape = (p: CanvasRenderingContext2D | Path2D, dy = 0) => roundedRect(p, -w / 2, -h / 2 + dy, w, h, corners(s.radius, s.radius));
  ctx.save();
  ctx.translate(L.width / 2, cy);
  ctx.rotate((-5 * Math.PI) / 180);
  ctx.save();
  ctx.shadowColor = "rgba(94,66,34,0.4)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 20;
  ctx.beginPath();
  shape(ctx);
  ctx.fillStyle = gold(ctx, -h / 2, h / 2);
  ctx.fill();
  ctx.restore();
  // A light line along its top edge, inside.
  const edge = new Path2D();
  shape(edge);
  shape(edge, 2);
  ctx.save();
  ctx.beginPath();
  shape(ctx);
  ctx.clip();
  ctx.fillStyle = "rgba(255,243,214,0.8)";
  ctx.fill(edge, "evenodd");
  ctx.restore();
  ctx.fillStyle = C.chocolate;
  spaced(ctx, SHOUT, 0, baseline(ctx, s.textTop - cy, s.size, s.size), s.spacing);
  ctx.restore();
}

/** «Reserva tu cupo en nailfest.lat/imparables» on chocolate. */
function drawPill(ctx: CanvasRenderingContext2D, L: Layout, t: AsistireTexts, f: AsistireFonts) {
  const p = L.pill;
  const cx = L.width / 2;
  let size = p.size;
  const measure = (): [number, number] => {
    ctx.font = `600 ${size}px ${f.body}`;
    const invite = ctx.measureText(INVITE).width;
    ctx.font = `800 ${size}px ${f.body}`;
    return [invite, ctx.measureText(t.link).width];
  };
  let [invite, link] = measure();
  const room = L.width - 80 - 2 * p.padX;
  if (invite + link > room) {
    size = Math.floor((size * room) / (invite + link));
    [invite, link] = measure();
  }
  const w = invite + link + 2 * p.padX;
  ctx.beginPath();
  roundedRect(ctx, cx - w / 2, p.top, w, p.height, corners(p.height / 2, p.height / 2));
  ctx.fillStyle = C.chocolate;
  ctx.fill();
  const y = baseline(ctx, p.top, p.height, size);
  const x = cx - (invite + link) / 2;
  ctx.textAlign = "left";
  ctx.font = `600 ${size}px ${f.body}`;
  ctx.fillStyle = C.cream;
  ctx.fillText(INVITE, x, y);
  ctx.font = `800 ${size}px ${f.body}`;
  ctx.fillStyle = C.goldLight;
  ctx.fillText(t.link, x + invite, y);
}

/** «ORGANIZA» and Nail Fest's logo, in black. */
function drawSignature(ctx: CanvasRenderingContext2D, L: Layout, f: AsistireFonts, logo: HTMLImageElement | null) {
  const s = L.signature;
  ctx.font = `800 ${s.size}px ${f.body}`;
  ctx.fillStyle = C.warm;
  // The page keeps the last letter's spacing too, before the gap.
  const label = spaced(ctx, "ORGANIZA", 0, 0, s.spacing, false) + s.spacing;
  const logoW = logo && logo.naturalWidth ? (logo.naturalWidth / logo.naturalHeight) * s.height : 0;
  const x = L.width / 2 - (label + (logoW ? s.gap + logoW : 0)) / 2;
  spaced(ctx, "ORGANIZA", x + (label - s.spacing) / 2, baseline(ctx, s.top, s.height, s.size), s.spacing);
  if (logo && logoW) ctx.drawImage(tinted(logo, logoW, s.height, "rgba(20,20,20,0.9)"), x + label + s.gap, s.top, logoW, s.height);
}

/** An image in one color, keeping its shape. */
function tinted(img: HTMLImageElement, w: number, h: number, color: string): HTMLCanvasElement {
  const canvas = blank(Math.ceil(w), Math.ceil(h));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/** The arch before her photo: a silhouette, a camera and «Tu foto aquí». */
function drawEmpty(ctx: CanvasRenderingContext2D, box: Box, f: AsistireFonts) {
  ctx.fillStyle = C.deep;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.scale(box.w / 600, box.h / 760);
  ctx.fillStyle = C.line;
  ctx.beginPath();
  ctx.arc(300, 300, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(84, 760);
  ctx.bezierCurveTo(96, 540, 196, 470, 300, 470);
  ctx.bezierCurveTo(404, 470, 504, 540, 516, 760);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // The story's photo box is the boceto's unit.
  const k = box.w / 588;
  const cx = box.x + box.w / 2;
  const top = box.y + 330 * k;
  ctx.save();
  ctx.translate(cx - 36 * k, top);
  ctx.scale(3 * k, 3 * k);
  ctx.strokeStyle = C.warm;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(new Path2D("M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.4-2h6.6l1.4 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"));
  ctx.beginPath();
  ctx.arc(12, 12.5, 3.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.warm;
  ctx.textAlign = "center";
  ctx.font = `800 ${36 * k}px ${f.body}`;
  ctx.fillText("Tu foto aquí", cx, baseline(ctx, top + 84 * k, 49 * k, 36 * k));
}
