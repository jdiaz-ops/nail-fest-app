import { readFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { listNames } from "./blocks";
import type { DiplomaData } from "./diplomaText";

// Manicuristas Imparables' digital diploma (the team, 2026-11-04; the ticket's «Diploma digital con tu nombre»):
// one A4 page, landscape, to save, print or share — the congress's tiara, «Manicuristas Imparables» as on its cover,
// «Diploma de participación», her name, what it was and when, its speakers, Nail Fest as who organizes it and the
// diploma's number (her ticket's code), and between them the brands that support it (the team, 2026-11-04: «4 espacios
// y logo de las 4 marcas que apoyan»), the cover's «Con el apoyo de». Bone and chocolate with gold, in the page's faces
// (Cinzel, Manrope), so it prints well at home. Served from her page («Tu congreso», /api/diploma/[token]) once the
// congress is over.

// The page's colors (globals.css, --imp-*).
const C = {
  ground: "#f7f3ec",
  glow: "#f0e4cd",
  chocolate: "#3b2418",
  medio: "#5a4030",
  bronze: "#8c6a3e",
  bronzeDark: "#6e5230",
  gold: "#c9a46a",
  warm: "#5e564c",
  soft: "#6f665b",
};

// A4, landscape, in points.
const W = 841.89;
const H = 595.28;

type Assets = { cinzelBold: Buffer; cinzelBlack: Buffer; medium: Buffer; bold: Buffer; heavy: Buffer; logo: Buffer };
let assets: Assets | null | undefined;
// Its faces and the logo, read once (they ship with every function: next.config.js' outputFileTracingIncludes).
function loadAssets(): Assets | null {
  if (assets !== undefined) return assets;
  try {
    const dir = path.join(process.cwd(), "src/lib/imparables/diplomaAssets");
    const read = (file: string) => readFileSync(path.join(dir, file));
    assets = {
      cinzelBold: read("Cinzel-Bold.ttf"),
      cinzelBlack: read("Cinzel-Black.ttf"),
      medium: read("Manrope-Medium.ttf"),
      bold: read("Manrope-Bold.ttf"),
      heavy: read("Manrope-ExtraBold.ttf"),
      logo: read("logo-chocolate.png"),
    };
  } catch (err) {
    console.error("diploma: its faces couldn't be read — Times and Helvetica instead", err);
    assets = null;
  }
  return assets;
}

const PUBLIC_DIR = path.join(process.cwd(), "public");
const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** A brand's logo: from this site's own files (public/…) or from where it was uploaded — only a PNG or a JPEG, what a
 * PDF takes; null when it can't be read (its name goes in its place). */
export async function logoOf(url: string): Promise<Buffer | null> {
  let bytes: Buffer | null = null;
  if (url.startsWith("/") && !url.startsWith("//")) {
    const file = path.join(PUBLIC_DIR, decodeURIComponent(url.split(/[?#]/)[0]!));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return null;
    // On the server only the brands' folder ships with the function (next.config.js); any other file of the site, from the site.
    bytes = await readFile(file).catch(() => null);
  }
  if (!bytes) {
    try {
      const res = await fetch(new URL(url, baseUrl()), { signal: AbortSignal.timeout(5000) });
      if (res.ok) bytes = Buffer.from(await res.arrayBuffer());
    } catch {
      bytes = null;
    }
  }
  if (!bytes) return null;
  const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return png || jpeg ? bytes : null;
}

export async function renderDiplomaPdf(data: DiplomaData): Promise<Buffer> {
  const found = loadAssets();
  const logos = await Promise.all(data.sponsors.map((sponsor) => logoOf(sponsor.url)));
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      info: { Title: `Diploma · ${data.eventName} · ${data.name}`, Author: "Nail Fest", Subject: `${data.eventName}, ${data.date}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const F = found
      ? { display: "display", displayHeavy: "displayHeavy", medium: "medium", bold: "bold", heavy: "heavy" }
      : { display: "Times-Bold", displayHeavy: "Times-Bold", medium: "Helvetica", bold: "Helvetica-Bold", heavy: "Helvetica-Bold" };
    if (found) {
      doc.registerFont("display", found.cinzelBold);
      doc.registerFont("displayHeavy", found.cinzelBlack);
      doc.registerFont("medium", found.medium);
      doc.registerFont("bold", found.bold);
      doc.registerFont("heavy", found.heavy);
    }
    const ascent = (font: string, size: number) => {
      doc.font(font).fontSize(size);
      return ((doc as unknown as { _font: { ascender: number } })._font.ascender / 1000) * size;
    };
    const width = (text: string, font: string, size: number, spacing = 0) => {
      doc.font(font).fontSize(size);
      return doc.widthOfString(text, { characterSpacing: spacing });
    };
    // One line, centered on the page, set by its baseline.
    const centered = (text: string, font: string, size: number, color: string, baseline: number, spacing = 0) => {
      const w = width(text, font, size, spacing);
      doc
        .font(font)
        .fontSize(size)
        .fillColor(color)
        .text(text, (W - w) / 2 + spacing / 2, baseline - ascent(font, size), { lineBreak: false, characterSpacing: spacing });
    };
    const gold = (x1: number, y1: number, x2: number, y2: number) => {
      const g = doc.linearGradient(x1, y1, x2, y2);
      g.stop(0, "#f0d9a6").stop(0.4, "#d8b77a").stop(0.65, "#c9a46a").stop(1, "#a8844e");
      return g;
    };
    const diamond = (x: number, y: number, size: number) => {
      doc.save().translate(x, y).rotate(45).rect(-size / 2, -size / 2, size, size).fill(C.gold).restore();
    };

    // The ground, a glow of gold behind the name, and the frame: chocolate outside, gold inside.
    doc.rect(0, 0, W, H).fill(C.ground);
    const glow = doc.radialGradient(W / 2, 250, 0, W / 2, 250, 430);
    glow.stop(0, C.glow).stop(1, C.ground);
    doc.rect(0, 0, W, H).fill(glow);
    doc.rect(18, 18, W - 36, H - 36).lineWidth(2.4).stroke(C.chocolate);
    doc.rect(27, 27, W - 54, H - 54).lineWidth(0.8).stroke(C.gold);
    for (const [x, y] of [
      [27, 27],
      [W - 27, 27],
      [27, H - 27],
      [W - 27, H - 27],
    ] as const) {
      diamond(x, y, 7);
    }

    // A paragraph centered line by line, with runs in other faces (pdfkit's own centering breaks with them): it breaks
    // only at spaces, so «Imparables,» stays together.
    type Run = { text: string; font: string };
    const paragraph = (runs: Run[], size: number, color: string, maxW: number, firstBaseline: number, lineHeight: number): number => {
      const words: Run[][] = [[]];
      for (const run of runs) {
        for (const piece of run.text.split(/(?<= )/)) {
          if (!piece) continue;
          words[words.length - 1]!.push({ text: piece, font: run.font });
          if (piece.endsWith(" ")) words.push([]);
        }
      }
      const wordW = (word: Run[], trim: boolean) =>
        word.reduce((sum, run, i) => sum + width(trim && i === word.length - 1 ? run.text.trimEnd() : run.text, run.font, size), 0);
      const lines: Run[][][] = [[]];
      let lineW = 0;
      for (const word of words.filter((w) => w.length)) {
        if (lineW > 0 && lineW + wordW(word, true) > maxW) {
          lines.push([]);
          lineW = 0;
        }
        lines[lines.length - 1]!.push(word);
        lineW += wordW(word, false);
      }
      lines.forEach((line, i) => {
        const runsOf = line.flat();
        const last = runsOf.length - 1;
        const total = runsOf.reduce((sum, run, j) => sum + width(j === last ? run.text.trimEnd() : run.text, run.font, size), 0);
        let x = (W - total) / 2;
        const baseline = firstBaseline + i * lineHeight;
        for (const run of runsOf) {
          doc.font(run.font).fontSize(size).fillColor(color).text(run.text, x, baseline - ascent(run.font, size), { lineBreak: false });
          x += width(run.text, run.font, size);
        }
      });
      return firstBaseline + (lines.length - 1) * lineHeight;
    };

    // The tiara (ImpArt.tsx's), in gold.
    const star: [number, number][] = [[95, 8], [99.4, 19], [111, 19.6], [101.9, 26.8], [105, 38], [95, 31.6], [85, 38], [88.1, 26.8], [79, 19.6], [90.6, 19]];
    const tiaraW = 108;
    const k = tiaraW / 190;
    doc.save();
    doc.translate((W - tiaraW) / 2, 56).scale(k);
    doc.path("M6 48 Q95 -4 184 48").lineWidth(2.6).strokeColor(C.gold).stroke();
    doc.path("M30 46 Q95 12 160 46").lineWidth(1.2).strokeOpacity(0.7).strokeColor(C.gold).stroke();
    doc.strokeOpacity(1);
    doc.polygon(...star).fill(gold(80, 8, 110, 38));
    doc.restore();

    // «MANICURISTAS / IMPARABLES», as on the cover.
    if (data.pre) centered(data.pre.toLocaleUpperCase("es"), F.heavy, 10, C.bronze, 108, 5.4);
    centered(data.big.toLocaleUpperCase("es"), F.displayHeavy, 44, C.chocolate, 154, 2);

    // A short gold rule with a diamond.
    doc.moveTo(W / 2 - 74, 174).lineTo(W / 2 - 10, 174).lineWidth(0.8).stroke(C.gold);
    doc.moveTo(W / 2 + 10, 174).lineTo(W / 2 + 74, 174).lineWidth(0.8).stroke(C.gold);
    diamond(W / 2, 174, 5);

    centered("DIPLOMA DE PARTICIPACIÓN", F.bold, 9, C.bronzeDark, 199, 3.6);
    centered("Nail Fest certifica que", F.medium, 12.5, C.warm, 237);

    // Her name, as big as fits.
    let nameSize = 38;
    const nameMax = 620;
    const nameW = width(data.name, F.display, nameSize, 0.5);
    if (nameW > nameMax) nameSize *= nameMax / nameW;
    centered(data.name, F.display, nameSize, C.chocolate, 290, 0.5);
    const ruleW = Math.min(660, Math.max(300, width(data.name, F.display, nameSize, 0.5) + 70));
    doc
      .moveTo((W - ruleW) / 2, 305)
      .lineTo((W + ruleW) / 2, 305)
      .lineWidth(0.9)
      .stroke(C.gold);

    // What it was and when — the congress's name in bold —, and its speakers.
    const said = paragraph(
      [
        { text: "participó en ", font: F.medium },
        { text: data.eventName, font: F.heavy },
        { text: `, ${data.kind}, el ${data.date}.`, font: F.medium },
      ],
      12.5,
      C.medio,
      560,
      335,
      19
    );
    if (data.speakers.length) {
      paragraph([{ text: `Con las charlas de ${listNames(data.speakers)}.`, font: F.medium }], 9.5, C.soft, 600, said + 27, 14.5);
    }

    // A gold seal under the speakers: the tiara's star and the day.
    const sealY = 434;
    doc.circle(W / 2, sealY, 27).lineWidth(1.2).stroke(C.gold);
    doc.circle(W / 2, sealY, 23.5).lineWidth(0.5).stroke(C.gold);
    doc.save();
    doc.translate(W / 2 - 95 * 0.54, sealY - 9 - 23 * 0.54).scale(0.54);
    doc.polygon(...star).fill(gold(80, 8, 110, 38));
    doc.restore();
    if (data.stamp) centered(data.stamp, F.bold, 5.4, C.bronzeDark, sealY + 11.5, 0.3);

    // The footer, in three: who organizes it, the brands that support it, and the diploma's number.
    const footer = 480;
    const label = (text: string, x: number) =>
      doc.font(F.heavy).fontSize(7.5).fillColor(C.soft).text(text, x, footer, { lineBreak: false, characterSpacing: 2.4 });
    label("ORGANIZA", 92);
    if (found) doc.image(found.logo, 92, footer + 14, { height: 42 });
    else doc.font(F.heavy).fontSize(18).fillColor(C.chocolate).text("Nail Fest", 92, footer + 18, { lineBreak: false });

    const sponsors = data.sponsors.map((sponsor, i) => ({ ...sponsor, logo: logos[i] ?? null })).filter((sponsor) => sponsor.logo || sponsor.name);
    if (sponsors.length) {
      const slotW = 92;
      const slotH = 34;
      const gap = 20;
      const rowW = sponsors.length * slotW + (sponsors.length - 1) * gap;
      const supportW = width("CON EL APOYO DE", F.heavy, 7.5, 2.4);
      label("CON EL APOYO DE", (W - supportW) / 2 + 1.2);
      sponsors.forEach((sponsor, i) => {
        const x = (W - rowW) / 2 + i * (slotW + gap);
        const y = footer + 18;
        if (sponsor.logo) {
          try {
            doc.image(sponsor.logo, x, y, { fit: [slotW, slotH], align: "center", valign: "center" });
            return;
          } catch (err) {
            console.error("diploma: a brand's logo couldn't be drawn — its name instead", sponsor.url, err);
          }
        }
        doc
          .font(F.bold)
          .fontSize(10)
          .fillColor(C.medio)
          .text(sponsor.name, x, y + slotH / 2 - ascent(F.bold, 10) / 2 - 1, { width: slotW, align: "center", lineBreak: false });
      });
    }

    const numberLabel = "DIPLOMA Nº";
    label(numberLabel, W - 92 - width(numberLabel, F.heavy, 7.5, 2.4));
    const codeW = width(data.code, F.bold, 13, 1.5);
    doc
      .font(F.bold)
      .fontSize(13)
      .fillColor(C.chocolate)
      .text(data.code, W - 92 - codeW, footer + 16, { lineBreak: false, characterSpacing: 1.5 });
    const site = "nailfest.lat";
    const siteW = width(site, F.medium, 9, 0.4);
    doc
      .font(F.medium)
      .fontSize(9)
      .fillColor(C.soft)
      .text(site, W - 92 - siteW, footer + 38, { lineBreak: false, characterSpacing: 0.4 });

    doc.end();
  });
}
