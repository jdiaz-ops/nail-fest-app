// Nail Fest's «Asistiré» image for its events at a place (2026-10-30): the
// boceto the team approved, drawn on a canvas in her own browser, so her photo
// never leaves her phone — the same way as Manicuristas Imparables' (whose
// photo handling and text helpers it shares, ../imparables/asistireArt.ts).
// The site's off-white with confetti, the logo, her photo in a white frame
// with a teal shadow, «¡ASISTIRÉ!» on a pink sticker, the event, its days and
// place, and where to sign up. Two sizes: a story (1080×1920) and a
// publication (1080×1350). Every position below is the boceto's own,
// measured, three times bigger.

import {
  baseline,
  blank,
  fitted,
  photoRect,
  roundedRect,
  spaced,
  type AsistireFonts,
  type AsistireFormat,
  type AsistireLayers,
  type Placement,
} from "../imparables/asistireArt";

export interface NailFestAsistireTexts {
  /** The event's name in two colors: «Nail Fest», in ink, and «Cúcuta», in teal. */
  name: [string, string];
  /** «Sábado 7 y domingo 8 de noviembre» */
  date: string;
  /** «Centro de Convenciones · Cúcuta» (empty without a place) */
  place: string;
  /** «Inscríbete gratis en » */
  invite: string;
  /** «nailfest.lat/cucuta» */
  link: string;
}

export const MOTTO = "Donde se reúne el mundo de las uñas";
const SHOUT = "¡ASISTIRÉ!";

// The site's colors (globals.css :root) and the confirmation email's.
const C = {
  paper: "#faf9f7",
  ink: "#17181c",
  grey: "#5b5f6b",
  teal: "#00beb5",
  tealDeep: "#0f7d75",
  peach: "#ffc5a8",
  pink: "#f6a5b8",
  mint: "#e6f9f7",
  mintLine: "#b7e8e3",
  white: "#ffffff",
};

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
type Bit = { x: number; y: number; w: number; h: number; color: string } & ({ round: true } | { turn: number });

interface Layout {
  width: number;
  height: number;
  confetti: Bit[];
  /** The logo's top left and width; its height is the picture's own. */
  logo: { x: number; y: number; w: number };
  /** Her photo's frame, white border included. */
  frame: Box & { round: number; border: number; offset: number };
  sticker: { cx: number; top: number; height: number; size: number; padX: number; textTop: number; textHeight: number; radius: number; offset: number };
  /** The story's lines, centered under the photo; the publication's, a column beside it (logo included), centered on it. */
  text:
    | { kind: "centered"; margin: number; name: Line; date: Line; place: Line }
    | { kind: "column"; x: number; width: number; afterLogo: number; afterName: number; afterDate: number; name: Line; date: Line; place: Line };
  pill: Line & { padX: number };
  motto: Line;
}

const LOGO_RATIO = 655 / 816;

export const LAYOUTS: Record<AsistireFormat, Layout> = {
  historia: {
    width: 1080,
    height: 1920,
    confetti: [
      { x: 96, y: 96, w: 36, h: 36, color: C.teal, round: true },
      { x: 906, y: 135, w: 30, h: 54, color: C.peach, turn: 18 },
      { x: 972, y: 846, w: 30, h: 30, color: C.pink, round: true },
      { x: 54, y: 999, w: 27, h: 48, color: C.teal, turn: -22 },
      { x: 75, y: 1728, w: 24, h: 24, color: C.peach, round: true },
    ],
    logo: { x: 396, y: 72, w: 288 },
    frame: { x: 186, y: 357, w: 708, h: 846, round: 78, border: 15, offset: 24 },
    sticker: { cx: 540, top: 1101, height: 177, size: 90, padX: 54, textTop: 1119, textHeight: 135, radius: 36, offset: 12 },
    text: {
      kind: "centered",
      margin: 60,
      name: { top: 1323, height: 104, size: 99 },
      date: { top: 1452, height: 67.5, size: 45 },
      place: { top: 1536, height: 58.5, size: 39 },
    },
    pill: { top: 1644, height: 102, size: 36, padX: 42 },
    motto: { top: 1782, height: 49.5, size: 33 },
  },
  publicacion: {
    width: 1080,
    height: 1350,
    confetti: [
      { x: 75, y: 81, w: 30, h: 30, color: C.teal, round: true },
      { x: 960, y: 108, w: 27, h: 48, color: C.peach, turn: 18 },
      { x: 993, y: 864, w: 27, h: 27, color: C.pink, round: true },
    ],
    logo: { x: 588, y: 0, w: 252 },
    frame: { x: 66, y: 174, w: 450, h: 588, round: 78, border: 15, offset: 24 },
    sticker: { cx: 300, top: 696, height: 132, size: 66, padX: 36, textTop: 711, textHeight: 99, radius: 36, offset: 12 },
    text: {
      kind: "column",
      x: 588,
      width: 426,
      afterLogo: 30,
      afterName: 18,
      afterDate: 6,
      name: { top: 0, height: 81.9, size: 78 },
      date: { top: 0, height: 58.5, size: 39 },
      place: { top: 0, height: 54, size: 36 },
    },
    pill: { top: 963, height: 102, size: 36, padX: 42 },
    motto: { top: 1101, height: 49.5, size: 33 },
  },
};

/** Her photo's box: the frame inside its white border. */
export function photoBox(format: AsistireFormat): Box & { round: number } {
  const f = LAYOUTS[format].frame;
  return { x: f.x + f.border, y: f.y + f.border, w: f.w - 2 * f.border, h: f.h - 2 * f.border, round: f.round - f.border };
}

export function asistireLayers(format: AsistireFormat, texts: NailFestAsistireTexts, fonts: AsistireFonts, logo: HTMLImageElement | null): AsistireLayers {
  const L = LAYOUTS[format];
  const under = blank(L.width, L.height);
  const over = blank(L.width, L.height);
  drawUnder(under.getContext("2d")!, L, texts, fonts, logo);
  drawSticker(over.getContext("2d")!, L, fonts);
  return { format, under, over };
}

/** The whole image: the layers and, between them, her photo in its frame — or, before she picks one, «Tu foto aquí». */
export function drawAsistire(ctx: CanvasRenderingContext2D, layers: AsistireLayers, photo: HTMLCanvasElement | null, placement: Placement, fonts: AsistireFonts) {
  const L = LAYOUTS[layers.format];
  const box = photoBox(layers.format);
  ctx.clearRect(0, 0, L.width, L.height);
  ctx.drawImage(layers.under, 0, 0);
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, box.x, box.y, box.w, box.h, [box.round, box.round, box.round, box.round]);
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

function rounded(ctx: CanvasRenderingContext2D, b: Box, r: number) {
  ctx.beginPath();
  roundedRect(ctx, b.x, b.y, b.w, b.h, [r, r, r, r]);
}

function drawConfetti(ctx: CanvasRenderingContext2D, bits: Bit[]) {
  for (const b of bits) {
    ctx.fillStyle = b.color;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    if ("turn" in b) ctx.rotate((b.turn * Math.PI) / 180);
    ctx.beginPath();
    if ("round" in b) ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
    else roundedRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, [6, 6, 6, 6]);
    ctx.fill();
    ctx.restore();
  }
}

/** The frame: its soft shadow, the teal one beside it, and the white border. */
function drawFrame(ctx: CanvasRenderingContext2D, L: Layout) {
  const f = L.frame;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 90;
  ctx.shadowOffsetY = 42;
  ctx.fillStyle = C.white;
  rounded(ctx, { x: f.x + 30, y: f.y + 30, w: f.w - 60, h: f.h - 60 }, f.round - 30);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.teal;
  rounded(ctx, { x: f.x + f.offset, y: f.y + f.offset, w: f.w, h: f.h }, f.round);
  ctx.fill();
  ctx.fillStyle = C.white;
  rounded(ctx, f, f.round);
  ctx.fill();
}

/** Words cut into lines no wider than max: at most `most` of them, the last one shortened with «…» if it has to. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, most: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= most) return lines;
  const kept = lines.slice(0, most);
  let last = `${kept[most - 1]} ${lines.slice(most).join(" ")}`;
  while (last.length > 1 && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1).trimEnd();
  kept[most - 1] = `${last}…`;
  return kept;
}

/** The size that keeps a text in `most` lines of max wide (down to 70% of its own), and those lines. */
function wrapped(ctx: CanvasRenderingContext2D, weight: number, size: number, family: string, text: string, max: number, most: number): { size: number; lines: string[] } {
  for (let s = size; s >= Math.floor(size * 0.7); s--) {
    ctx.font = `${weight} ${s}px ${family}`;
    const words = text.split(/\s+/).filter(Boolean);
    const lines = wrap(ctx, text, max, most + 1);
    if (lines.length <= most && words.every((w) => ctx.measureText(w).width <= max)) return { size: s, lines };
  }
  const s = Math.floor(size * 0.7);
  ctx.font = `${weight} ${s}px ${family}`;
  return { size: s, lines: wrap(ctx, text, max, most) };
}

function drawUnder(ctx: CanvasRenderingContext2D, L: Layout, t: NailFestAsistireTexts, f: AsistireFonts, logo: HTMLImageElement | null) {
  const cx = L.width / 2;
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, L.width, L.height);
  drawConfetti(ctx, L.confetti);
  drawFrame(ctx, L);
  const [pre, accent] = t.name;

  if (L.text.kind === "centered") {
    const T = L.text;
    const room = L.width - 2 * T.margin;
    if (logo) ctx.drawImage(logo, L.logo.x, L.logo.y, L.logo.w, L.logo.w * LOGO_RATIO);

    // «Nail Fest Cúcuta», one line in two colors.
    const head = pre && accent ? `${pre} ` : pre;
    const size = fitted(ctx, 900, T.name.size, f.display, `${head}${accent}`, room);
    const y = baseline(ctx, T.name.top, T.name.height, size);
    const wHead = ctx.measureText(head).width;
    const x = cx - (wHead + ctx.measureText(accent).width) / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = C.ink;
    ctx.fillText(head, x, y);
    ctx.fillStyle = C.tealDeep;
    ctx.fillText(accent, x + wHead, y);

    ctx.textAlign = "center";
    ctx.fillStyle = C.ink;
    const dateSize = fitted(ctx, 700, T.date.size, f.body, t.date, room);
    ctx.fillText(t.date, cx, baseline(ctx, T.date.top, T.date.height, dateSize));
    if (t.place) {
      ctx.fillStyle = C.grey;
      const placeSize = fitted(ctx, 600, T.place.size, f.body, t.place, room);
      ctx.fillText(t.place, cx, baseline(ctx, T.place.top, T.place.height, placeSize));
    }
  } else {
    const T = L.text;
    const logoH = L.logo.w * LOGO_RATIO;
    // Both lines of the name at one size, the one where the longer fits.
    ctx.font = `900 ${T.name.size}px ${f.display}`;
    const widest = Math.max(ctx.measureText(pre).width, ctx.measureText(accent).width);
    const nameSize = widest > T.width ? Math.floor((T.name.size * T.width) / widest) : T.name.size;
    const names = [pre, accent].filter(Boolean);
    const date = wrapped(ctx, 700, T.date.size, f.body, t.date, T.width, 2);
    const place = t.place ? wrapped(ctx, 600, T.place.size, f.body, t.place, T.width, 2) : { size: T.place.size, lines: [] };
    const lh = (line: Line, size: number) => (line.height * size) / line.size;
    const height =
      logoH +
      T.afterLogo +
      names.length * lh(T.name, nameSize) +
      T.afterName +
      date.lines.length * lh(T.date, date.size) +
      (place.lines.length ? T.afterDate + place.lines.length * lh(T.place, place.size) : 0);
    // Centered on the photo, as the boceto's two columns are.
    let top = L.frame.y + L.frame.h / 2 - height / 2;
    if (logo) ctx.drawImage(logo, T.x, top, L.logo.w, logoH);
    top += logoH + T.afterLogo;

    ctx.textAlign = "left";
    ctx.font = `900 ${nameSize}px ${f.display}`;
    names.forEach((line, i) => {
      ctx.fillStyle = i === 0 && names.length > 1 ? C.ink : C.tealDeep;
      ctx.fillText(line, T.x, baseline(ctx, top, lh(T.name, nameSize), nameSize));
      top += lh(T.name, nameSize);
    });
    top += T.afterName;
    ctx.font = `700 ${date.size}px ${f.body}`;
    ctx.fillStyle = C.ink;
    for (const line of date.lines) {
      ctx.fillText(line, T.x, baseline(ctx, top, lh(T.date, date.size), date.size));
      top += lh(T.date, date.size);
    }
    top += T.afterDate;
    ctx.font = `600 ${place.size}px ${f.body}`;
    ctx.fillStyle = C.grey;
    for (const line of place.lines) {
      ctx.fillText(line, T.x, baseline(ctx, top, lh(T.place, place.size), place.size));
      top += lh(T.place, place.size);
    }
  }

  drawPill(ctx, L, t, f);
  ctx.textAlign = "center";
  ctx.fillStyle = C.grey;
  const mottoSize = fitted(ctx, 400, L.motto.size, f.body, MOTTO, L.width - 120);
  ctx.fillText(MOTTO, cx, baseline(ctx, L.motto.top, L.motto.height, mottoSize));
}

/** «Inscríbete gratis en nailfest.lat/cucuta» on ink. */
function drawPill(ctx: CanvasRenderingContext2D, L: Layout, t: NailFestAsistireTexts, f: AsistireFonts) {
  const p = L.pill;
  const cx = L.width / 2;
  let size = p.size;
  const measure = (): [number, number] => {
    ctx.font = `700 ${size}px ${f.body}`;
    const invite = ctx.measureText(t.invite).width;
    ctx.font = `800 ${size}px ${f.body}`;
    return [invite, ctx.measureText(t.link).width];
  };
  let [invite, link] = measure();
  const room = L.width - 120 - 2 * p.padX;
  if (invite + link > room) {
    size = Math.floor((size * room) / (invite + link));
    [invite, link] = measure();
  }
  const w = invite + link + 2 * p.padX;
  ctx.beginPath();
  roundedRect(ctx, cx - w / 2, p.top, w, p.height, [p.height / 2, p.height / 2, p.height / 2, p.height / 2]);
  ctx.fillStyle = C.ink;
  ctx.fill();
  const y = baseline(ctx, p.top, p.height, size);
  const x = cx - (invite + link) / 2;
  ctx.textAlign = "left";
  ctx.font = `700 ${size}px ${f.body}`;
  ctx.fillStyle = C.white;
  ctx.fillText(t.invite, x, y);
  ctx.font = `800 ${size}px ${f.body}`;
  ctx.fillStyle = C.peach;
  ctx.fillText(t.link, x + invite, y);
}

/** «¡ASISTIRÉ!» on the pink sticker, tilted, over the photo's foot, with its teal shadow. */
function drawSticker(ctx: CanvasRenderingContext2D, L: Layout, f: AsistireFonts) {
  const s = L.sticker;
  const spacing = s.size * 0.02;
  ctx.font = `900 ${s.size}px ${f.display}`;
  const w = spaced(ctx, SHOUT, 0, 0, spacing, false) + spacing + 2 * s.padX;
  const h = s.height;
  const cy = s.top + h / 2;
  const r: [number, number, number, number] = [s.radius, s.radius, s.radius, s.radius];
  ctx.save();
  ctx.translate(s.cx, cy);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.fillStyle = C.teal;
  ctx.beginPath();
  roundedRect(ctx, -w / 2 + s.offset, -h / 2 + s.offset, w, h, r);
  ctx.fill();
  ctx.fillStyle = C.pink;
  ctx.beginPath();
  roundedRect(ctx, -w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.fillStyle = C.ink;
  spaced(ctx, SHOUT, 0, baseline(ctx, s.textTop - cy, s.textHeight, s.size), spacing);
  ctx.restore();
}

/** The frame before her photo: a silhouette, a camera and «Tu foto aquí». */
function drawEmpty(ctx: CanvasRenderingContext2D, box: Box, f: AsistireFonts) {
  ctx.fillStyle = C.mint;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  // A head and shoulders, drawn 600 wide and 760 tall, standing on the frame's foot.
  const s = box.w / 600;
  const top = box.y + box.h - 760 * s;
  ctx.save();
  ctx.translate(box.x, top);
  ctx.scale(s, s);
  ctx.fillStyle = C.mintLine;
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

  const cx = box.x + box.w / 2;
  const icon = 72 * s;
  ctx.save();
  ctx.translate(cx - icon / 2, top + 300 * s - icon * 0.62);
  ctx.scale(icon / 24, icon / 24);
  ctx.strokeStyle = C.tealDeep;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(new Path2D("M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.4-2h6.6l1.4 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"));
  ctx.beginPath();
  ctx.arc(12, 12.5, 3.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.tealDeep;
  ctx.textAlign = "center";
  const size = 36 * s;
  ctx.font = `800 ${size}px ${f.body}`;
  ctx.fillText("Tu foto aquí", cx, baseline(ctx, top + 300 * s + icon * 0.5, 49 * s, size));
}
