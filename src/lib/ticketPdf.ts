import { readFileSync } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { db } from "@/lib/db";
import { ticketNameOf } from "@/lib/imparables/tiers";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { formatHeroDate } from "@/lib/eventHeroDate";
import { parseScheduleDays } from "@/lib/eventSchedule";
import { confirmationCodeFor, renderQrPngBuffer, ticketHolderName, ticketsFor, verifyQrToken } from "@/lib/ticket";
import { publicEventName } from "@/lib/eventDisplayName";
import { COVER_HOOK, PILLARS } from "@/lib/imparables/schedule";
import { ticketBannerFor, type TicketImparablesBanner } from "@/lib/imparables/promo";

// One self-contained, printable ticket — attached to every confirmation
// send (sendTicketEmail.ts), to event emails that carry it (broadcasts.ts)
// and sent by WhatsApp (/api/ticket-pdf/[token]), so someone can save or
// print it, or show it at the door without the email. Since 2026-10-30 the
// team's boceto 3: the ticket as a festival one — the event's teal with its
// logo, «Nail Fest Cúcuta», the big «7 y 8», where, her name and what kind;
// beside it the white stub with its QR, its code and whom it lets in —, then
// when and where, and the peach line on showing the QR. No cutting marks
// (the team). Two tickets of an order share a page (hers and her
// companion's), two per page beyond. In the event page's faces (Fraunces
// Black, Inter); Helvetica if they can't be read, never no ticket. Since
// 2026-11-04, for the events the team turns it on for, Manicuristas
// Imparables' banner under the last page's tickets (the team's boceto A),
// all of it a link to the congress's page; those tickets a little shorter
// to give it room.
export interface TicketPdfData {
  firstName: string;
  lastName?: string;
  eventName: string;
  venueName?: string;
  venueAddress?: string;
  /** «Cúcuta», after the place on the ticket. */
  city?: string;
  startsAt: Date;
  endsAt?: Date;
  /** Event.scheduleDays — see lib/eventSchedule.ts: each day with its hours under «Cuándo». */
  scheduleDays?: unknown;
  ticketTypeName?: string;
  ticketCount?: number;
  confirmationCode: string;
  qrToken: string;
  timezone: string;
  language: string;
  /** Manicuristas Imparables' banner, when this event's tickets carry it (lib/imparables/promo.ts ticketBannerFor). */
  imparables?: TicketImparablesBanner | null;
}

/** The QR of every sample ticket (the admin's looks at it, a test email's): a string that opens nothing, never a
 * signed ticket token, so a screenshot of one can't be scanned as a real ticket. */
export const SAMPLE_QR_TOKEN = "VISTA-PREVIA-NO-ES-UNA-ENTRADA-REAL";

// One page per ticket of the order: `qrToken` is ticket 1 (the one stored
// on the registration), and for a multi-ticket order the rest are derived
// from it — every caller gets the full set of QRs without passing them in.
// A token that doesn't verify just renders its one ticket — but the
// sample's, an order of several's tickets (2026-11-04: the admin's look at
// two tickets with Manicuristas Imparables' banner), each with the
// sample's QR.
function pagesFor(data: TicketPdfData): { qrToken: string; confirmationCode: string; ticketNumber: number }[] {
  const count = data.ticketCount ?? 1;
  const { valid, registrationId } = verifyQrToken(data.qrToken);
  if (count > 1 && data.qrToken === SAMPLE_QR_TOKEN) {
    return Array.from({ length: count }, (_, i) => ({ qrToken: SAMPLE_QR_TOKEN, confirmationCode: i ? `${data.confirmationCode}-${i + 1}` : data.confirmationCode, ticketNumber: i + 1 }));
  }
  if (count <= 1 || !valid || !registrationId) {
    return [{ qrToken: data.qrToken, confirmationCode: data.confirmationCode, ticketNumber: 1 }];
  }
  return ticketsFor(registrationId, count).map((t) =>
    t.ticketNumber === 1 ? { ...t, qrToken: data.qrToken, confirmationCode: data.confirmationCode } : t
  );
}

const PAGE_BG = "#faf9f7";
const TEAL_DEEP = "#0f7d75";
const MINT_TEXT = "#cdebe8";
const PEACH = "#ffc5a8";
const PEACH_SOFT = "#fff1ea";
const PINK = "#f6a5b8";
const CREAM = "#fff8e0";
const INK = "#17181c";
const GREY = "#5b5f6b";
const LINE = "#e3e1dc";

// A4 in points, the boceto's px × 0.75.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 39;
const CW = PAGE_W - 2 * MX;
const STUB_W = 187.5;

// Its faces and its logo, read once (they ship with every function: next.config.js' outputFileTracingIncludes).
type Assets = { display: Buffer; regular: Buffer; bold: Buffer; heavy: Buffer; logo: Buffer };
let assets: Assets | null | undefined;
function loadAssets(): Assets | null {
  if (assets !== undefined) return assets;
  try {
    const dir = path.join(process.cwd(), "src/lib/ticketPdfAssets");
    assets = {
      display: readFileSync(path.join(process.cwd(), "src/lib/nailfest/fonts/Fraunces-Black.ttf")),
      regular: readFileSync(path.join(dir, "Inter-Regular.ttf")),
      bold: readFileSync(path.join(dir, "Inter-Bold.ttf")),
      heavy: readFileSync(path.join(dir, "Inter-ExtraBold.ttf")),
      logo: readFileSync(path.join(dir, "logo.png")),
    };
  } catch (err) {
    console.error("ticketPdf: its faces couldn't be read — Helvetica instead", err);
    assets = null;
  }
  return assets;
}

// The banner's faces (the congress's: Cinzel and Manrope) and its group photo — on bone, fading into it on the left
// and at the bottom. Without them, no banner: the ticket as always.
type BannerArt = { name: Buffer; big: Buffer; sans: Buffer; group: Buffer };
let bannerArt: BannerArt | null | undefined;
function loadBannerArt(): BannerArt | null {
  if (bannerArt !== undefined) return bannerArt;
  try {
    const fonts = path.join(process.cwd(), "src/lib/imparables/diplomaAssets");
    bannerArt = {
      name: readFileSync(path.join(fonts, "Cinzel-Bold.ttf")),
      big: readFileSync(path.join(fonts, "Cinzel-Black.ttf")),
      sans: readFileSync(path.join(fonts, "Manrope-ExtraBold.ttf")),
      group: readFileSync(path.join(process.cwd(), "src/lib/ticketPdfAssets/imparables-grupo.jpg")),
    };
  } catch (err) {
    console.error("ticketPdf: Manicuristas Imparables' banner couldn't be read — the ticket without it", err);
    bannerArt = null;
  }
  return bannerArt;
}

// The congress's colors, as its landing has them.
const IMP_BONE = "#ede8e1";
const IMP_CARD = "#f7f3ec";
const IMP_LINE = "#dcd2c3";
const IMP_GOLD = "#c9a46a";
const IMP_BRONZE = "#8c6a3e";
const IMP_INK = "#141414";
/** The banner's height, and the least room it goes in. */
const BANNER_H = 206;
const BANNER_MIN_H = 200;
/** The group photo's shape (src/lib/ticketPdfAssets/imparables-grupo.jpg, 640 × 350). */
const GROUP_RATIO = 350 / 640;
/** The tiara's star, in its 190-wide drawing. */
const STAR: [number, number][] = [[95, 8], [99.4, 19], [111, 19.6], [101.9, 26.8], [105, 38], [95, 31.6], [85, 38], [88.1, 26.8], [79, 19.6], [90.6, 19]];

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** «Cuándo»: each day with its hours — «Sábado 7 de noviembre», «10:00 a. m. a 6:00 p. m.». */
function whenLines(data: TicketPdfData): [string, string][] {
  const tz = data.timezone;
  const day = (d: Date) => cap(formatDateInTz(d, { weekday: "long", day: "numeric", month: "long" }, tz, data.language).replace(",", ""));
  const clock = (d: Date) => formatDateInTz(d, { hour: "numeric", minute: "2-digit" }, tz, data.language);
  const days = parseScheduleDays(data.scheduleDays).sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime());
  if (days.length) return days.map((d) => [day(new Date(d.opensAt)), `${clock(new Date(d.opensAt))} a ${clock(new Date(d.closesAt))}`]);
  const end = data.endsAt ?? null;
  if (!end || day(end) === day(data.startsAt)) return [[day(data.startsAt), end ? `${clock(data.startsAt)} a ${clock(end)}` : `Desde las ${clock(data.startsAt)}`]];
  return [
    [day(data.startsAt), `Desde las ${clock(data.startsAt)}`],
    [day(end), `Hasta las ${clock(end)}`],
  ];
}

export async function renderTicketPdfBuffer(data: TicketPdfData): Promise<Buffer> {
  const pages = pagesFor(data);
  const qrPngs = await Promise.all(pages.map((p) => renderQrPngBuffer(p.qrToken)));
  const attendeeName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || "—";
  const hero = formatHeroDate(data.startsAt, data.endsAt ?? null, data.timezone, data.language);
  const year = formatDateInTz(data.startsAt, { year: "numeric" }, data.timezone, data.language);
  const when = whenLines(data);
  const place = data.venueName || data.venueAddress || "";
  const placeLine = [place, data.city].filter(Boolean).join(" · ");
  const several = pages.length > 1;
  const allDays = when.length === 2 ? "los dos días" : when.length > 2 ? "todos los días" : "";
  const show = several
    ? [
        "Cada persona presenta su propio código QR en la entrada",
        `, impreso o en el celular.${allDays ? ` Sirven ${allDays}: pueden entrar y salir.` : ""}`,
      ]
    : ["Presenta el código QR en la entrada", `, impreso o en tu celular.${allDays ? ` Sirve ${allDays}: puedes entrar y salir.` : ""}`];
  const found = loadAssets();
  const art = data.imparables ? loadBannerArt() : null;
  const banner = data.imparables && art ? data.imparables : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const F = found
      ? { display: "display", regular: "regular", bold: "bold", heavy: "heavy" }
      : { display: "Helvetica-Bold", regular: "Helvetica", bold: "Helvetica-Bold", heavy: "Helvetica-Bold" };
    if (found) {
      doc.registerFont("display", found.display);
      doc.registerFont("regular", found.regular);
      doc.registerFont("bold", found.bold);
      doc.registerFont("heavy", found.heavy);
    }
    if (banner && art) {
      doc.registerFont("impName", art.name);
      doc.registerFont("impBig", art.big);
      doc.registerFont("impSans", art.sans);
    }
    // Where a line's baseline falls under its top, for setting two faces on one baseline.
    const ascent = (font: string, size: number) => {
      doc.font(font).fontSize(size);
      return ((doc as unknown as { _font: { ascender: number } })._font.ascender / 1000) * size;
    };
    // A line cut to a width, with «…».
    const fitLine = (text: string, font: string, size: number, width: number) => {
      doc.font(font).fontSize(size);
      if (doc.widthOfString(text) <= width) return text;
      let cut = text;
      while (cut.length > 1 && doc.widthOfString(`${cut}…`) > width) cut = cut.slice(0, -1);
      // At a word's end when one is near.
      const space = cut.lastIndexOf(" ");
      if (space > cut.length * 0.6) cut = cut.slice(0, space);
      return `${cut.replace(/[·,\s]+$/, "")}…`;
    };
    // A line set by its baseline.
    const onBaseline = (text: string, font: string, size: number, color: string, x: number, baseline: number, o: PDFKit.Mixins.TextOptions = {}) => {
      const top = baseline - ascent(font, size);
      doc.font(font).fontSize(size).fillColor(color).text(text, x, top, { lineBreak: false, ...o });
    };

    function ticket(x: number, y: number, h: number, index: number, compact: boolean, tight: boolean) {
      const page = pages[index]!;
      const mainW = CW - STUB_W;
      const seam = x + mainW;
      doc.save();
      doc.roundedRect(x, y, CW, h, 15).clip();
      doc.rect(x, y, mainW, h).fill(TEAL_DEEP);
      doc.rect(seam, y, STUB_W, h).fill("#ffffff");
      doc.restore();
      doc.save();
      doc.moveTo(seam + 1, y + 14).lineTo(seam + 1, y + h - 14).lineWidth(2).dash(5, { space: 4 }).strokeColor(LINE).stroke();
      doc.restore();
      doc.circle(seam, y, 11.25).fill(PAGE_BG);
      doc.circle(seam, y + h, 11.25).fill(PAGE_BG);

      // The teal part.
      const padX = tight ? 20 : compact ? 21 : 22.5;
      const padY = tight ? 14 : compact ? 16.5 : 19.5;
      const ix = x + padX;
      const iw = mainW - 2 * padX;
      let cy = y + padY;
      const logoW = tight ? 54 : compact ? 69 : 78;
      const logoH = found ? (logoW - 15) * (209 / 260) + 9 : 0;
      if (found) {
        doc.roundedRect(ix, cy, logoW, logoH, 10.5).fill(CREAM);
        doc.image(found.logo, ix + 7.5, cy + 4.5, { width: logoW - 15 });
      }
      const label = several ? `ENTRADA ${page.ticketNumber} DE ${pages.length}` : "TU ENTRADA";
      doc.font(F.heavy).fontSize(9);
      const labelW = doc.widthOfString(label, { characterSpacing: 1.6 });
      onBaseline(label, F.heavy, 9, PEACH, ix + iw - labelW, cy + (found ? logoH / 2 : 0) + 3.2, { characterSpacing: 1.6 });
      cy += (found ? logoH : 10) + (tight ? 7 : compact ? 9 : 13.5);

      let nameSize = tight ? 23 : compact ? 24.75 : 28.5;
      doc.font(F.display).fontSize(nameSize);
      const nameW = doc.widthOfString(data.eventName);
      if (nameW > iw) nameSize *= iw / nameW;
      onBaseline(data.eventName, F.display, nameSize, "#ffffff", ix, cy + nameSize * 0.82);
      cy += nameSize * 1.06;

      const daysSize = tight ? 27 : compact ? 30 : 34.5;
      const monthSize = tight ? 11 : compact ? 11.5 : 12.75;
      const baseline = cy + daysSize * 0.8;
      onBaseline(hero.days, F.display, daysSize, PEACH, ix, baseline);
      doc.font(F.display).fontSize(daysSize);
      const daysW = doc.widthOfString(hero.days);
      onBaseline(`${hero.month} · ${year}`, F.bold, monthSize, "#ffffff", ix + daysW + 7.5, baseline, { width: iw - daysW - 7.5, ellipsis: true });
      cy = baseline + daysSize * 0.2 + 3;
      // The place, on one line («…» when it's longer: «Dónde» has it whole).
      const placeH = placeLine ? 10.5 * 1.25 : 0;

      // Who and what kind, on the bottom; the line over them.
      const bottom = y + h - padY;
      const typeName = data.ticketTypeName ?? "Entrada";
      let typeSize = compact ? 12 : 12.75;
      doc.font(F.bold).fontSize(typeSize);
      const typeW = Math.min(doc.widthOfString(typeName), iw * 0.42);
      if (doc.widthOfString(typeName) > typeW) typeSize *= typeW / doc.widthOfString(typeName);
      const holder = ticketHolderName(attendeeName, page.ticketNumber);
      const holderW = iw - typeW - 12;
      let holderSize = tight ? 13.5 : compact ? 14.25 : 15.75;
      doc.font(F.bold).fontSize(holderSize);
      let holderH = doc.heightOfString(holder, { width: holderW, lineGap: -1.5 });
      const room = bottom - cy - placeH - 9.75 * 1.3 - 14;
      if (holderH > room) {
        holderSize = Math.max(11, holderSize * 0.86);
        doc.fontSize(holderSize);
        holderH = doc.heightOfString(holder, { width: holderW, lineGap: -1.5 });
      }
      // Still too long (a long name, the shorter tickets under the banner): the place's room too, the name at 11.
      if (holderH > room && holderSize > 11) {
        holderSize = 11;
        doc.fontSize(holderSize);
        holderH = doc.heightOfString(holder, { width: holderW, lineGap: -1.5 });
      }
      const holderTop = bottom - holderH;
      const typeTop = bottom - typeSize * 1.2;
      const rule = Math.min(holderTop, typeTop) - 9.75 * 1.3 - 8;
      if (placeLine && cy + placeH <= rule - 3) {
        doc.font(F.regular).fontSize(10.5).fillColor(MINT_TEXT).text(fitLine(placeLine, F.regular, 10.5, iw), ix, cy, { lineBreak: false });
      }
      doc.font(F.bold).fontSize(holderSize).fillColor("#ffffff").text(holder, ix, holderTop, { width: holderW, lineGap: -1.5 });
      doc.font(F.regular).fontSize(9.75).fillColor(MINT_TEXT).text("Asistente", ix, holderTop - 9.75 * 1.3, { lineBreak: false });
      doc.font(F.bold).fontSize(typeSize).fillColor("#ffffff").text(typeName, ix + iw - typeW, typeTop, { width: typeW, align: "right", lineBreak: false });
      doc.font(F.regular).fontSize(9.75).fillColor(MINT_TEXT).text("Entrada", ix + iw - typeW, typeTop - 9.75 * 1.3, { width: typeW, align: "right", lineBreak: false });
      doc.save();
      doc.moveTo(ix, rule).lineTo(ix + iw, rule).lineWidth(0.75).strokeOpacity(0.25).strokeColor("#ffffff").stroke();
      doc.restore();

      // The stub: its QR, its code, whom it lets in.
      const qr = tight ? 106 : compact ? 127.5 : 142.5;
      // centered in the stub: the QR, its code (9.4 × 1.2) and the pill (16.5), apart by 7.5 and 6
      const qy = y + (h - (qr + 7.5 + 9.4 * 1.2 + 6 + 16.5)) / 2;
      doc.image(qrPngs[index]!, seam + (STUB_W - qr) / 2, qy, { width: qr, height: qr });
      const codeY = qy + qr + 7.5;
      doc.font(F.bold).fontSize(9.4).fillColor(GREY).text(`CÓDIGO ${page.confirmationCode}`, seam, codeY, { width: STUB_W, align: "center", characterSpacing: 1.3, lineBreak: false });
      const admits = several ? 1 : Math.max(1, data.ticketCount ?? 1);
      const pill = admits === 1 ? "ADMITE 1 PERSONA" : `ADMITE ${admits} PERSONAS`;
      doc.font(F.heavy).fontSize(9.4);
      const pillW = doc.widthOfString(pill, { characterSpacing: 0.6 }) + 18;
      const pillH = 16.5;
      const pillX = seam + (STUB_W - pillW) / 2;
      const pillY = codeY + 9.4 * 1.2 + 6;
      doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill(PINK);
      onBaseline(pill, F.heavy, 9.4, "#ffffff", pillX + 9, pillY + pillH / 2 + 9.4 * 0.36, { characterSpacing: 0.6 });
    }

    // «Cuándo» and «Dónde», side by side, as tall as the taller.
    function boxes(y: number, compact: boolean): number {
      const gap = 13.5;
      const w = (CW - gap) / 2;
      const pad = compact ? 12 : 15;
      const padX = compact ? 15 : 16.5;
      const tw = w - 2 * padX;
      const eyebrow = 9 * 1.3;
      const measure = (rows: [string, string | null][]) =>
        rows.reduce((sum, [title, sub]) => {
          doc.font(F.bold).fontSize(12);
          const t = doc.heightOfString(title, { width: tw }) + 6;
          doc.font(F.regular).fontSize(10.5);
          return sum + t + (sub ? doc.heightOfString(sub, { width: tw }) + 1.5 : 0);
        }, 0);
      const whereRows: [string, string | null][] = place
        ? [[place, [data.venueName ? data.venueAddress : null, data.city].filter(Boolean).join(", ") || null]]
        : [[data.city || "Por anunciar", null]];
      const h = 2 * pad + eyebrow + Math.max(measure(when), measure(whereRows));
      const box = (x: number, title: string, rows: [string, string | null][]) => {
        doc.roundedRect(x, y, w, h, 13.5).fillAndStroke("#ffffff", LINE);
        doc.lineWidth(0.75);
        doc.font(F.heavy).fontSize(9).fillColor(TEAL_DEEP).text(title, x + padX, y + pad, { characterSpacing: 1.45, lineBreak: false });
        let cy = y + pad + eyebrow;
        for (const [t, sub] of rows) {
          cy += 6;
          doc.font(F.bold).fontSize(12).fillColor(INK).text(t, x + padX, cy, { width: tw });
          cy += doc.heightOfString(t, { width: tw });
          if (sub) {
            cy += 1.5;
            doc.font(F.regular).fontSize(10.5).fillColor(GREY).text(sub, x + padX, cy, { width: tw });
            cy += doc.heightOfString(sub, { width: tw });
          }
        }
      };
      doc.lineWidth(0.75);
      box(MX, "CUÁNDO", when);
      box(MX + w + gap, "DÓNDE", whereRows);
      return y + h;
    }

    // The peach line on showing the QR.
    function showLine(y: number, compact: boolean): number {
      const padX = compact ? 15 : 16.5;
      const pad = compact ? 10.5 : 13.5;
      const tw = CW - 2 * padX;
      doc.font(F.bold).fontSize(11.25);
      const h = doc.heightOfString(show.join(""), { width: tw, lineGap: 2 }) + 2 * pad;
      doc.roundedRect(MX, y, CW, h, 13.5).fill(PEACH_SOFT);
      doc.font(F.bold).fontSize(11.25).fillColor(INK).text(show[0]!, MX + padX, y + pad, { width: tw, lineGap: 2, continued: true });
      doc.font(F.regular).fillColor(INK).text(show[1]!, { width: tw, lineGap: 2 });
      return y + h;
    }

    // Lower when the banner is on the page.
    function footer(low = false) {
      const parts: [string, string, string][] = [
        ["Donde se reúne el mundo de las uñas · ", F.regular, GREY],
        ["@nailfest_co", F.bold, TEAL_DEEP],
        [" · nailfest.lat", F.regular, GREY],
      ];
      const widths = parts.map(([t, f]) => {
        doc.font(f).fontSize(9.75);
        return doc.widthOfString(t);
      });
      let x = (PAGE_W - widths.reduce((a, b) => a + b, 0)) / 2;
      parts.forEach(([t, f, c], i) => {
        doc.font(f).fontSize(9.75).fillColor(c).text(t, x, PAGE_H - (low ? 32 : 42), { lineBreak: false });
        x += widths[i]!;
      });
    }

    // Manicuristas Imparables' banner (the team's boceto A, 2026-11-04): the landing's cover — bone and its rays,
    // the mark with its pillars, the promise and a button on the left; the group photo on the right, the day over
    // it. All of it opens the congress's page.
    function imparablesBanner(y: number, h: number) {
      const promo = banner!;
      const x = MX;
      const w = CW;
      const leftW = w * 0.52;
      const cx = x + leftW / 2;
      const pw = w * 0.535;
      const px = x + w - pw + 4;
      const ph = pw * GROUP_RATIO;
      const widthOf = (text: string, font: string, size: number, spacing = 0) => {
        doc.font(font).fontSize(size);
        return doc.widthOfString(text, { characterSpacing: spacing }) - spacing;
      };
      // One line, centered on `mx`, never wrapped.
      const mid = (text: string, font: string, size: number, color: string, mx: number, top: number, spacing = 0) => {
        const tw = widthOf(text, font, size, spacing);
        doc.font(font).fontSize(size).fillColor(color).text(text, mx - tw / 2, top, { lineBreak: false, characterSpacing: spacing });
      };

      // The ground: bone, its rays from above the mark — fading out downward and before the photo —, the photo.
      doc.save();
      doc.roundedRect(x, y, w, h, 14).clip();
      doc.rect(x, y, w, h).fill(IMP_BONE);
      doc.save();
      doc.fillColor("#ffffff").fillOpacity(0.6);
      const ry = y - 14;
      for (let deg = 3; deg < 180; deg += 6) {
        const a = (deg * Math.PI) / 180;
        const d = (1.2 * Math.PI) / 180;
        doc.polygon([cx, ry], [cx + Math.cos(a - d) * 900, ry + Math.sin(a - d) * 900], [cx + Math.cos(a + d) * 900, ry + Math.sin(a + d) * 900]).fill();
      }
      doc.restore();
      const down = doc.linearGradient(0, y + h * 0.4, 0, y + h);
      down.stop(0, IMP_BONE, 0).stop(1, IMP_BONE, 1);
      doc.rect(x, y + h * 0.4, w, h * 0.6).fill(down);
      const across = doc.linearGradient(px - 30, 0, px, 0);
      across.stop(0, IMP_BONE, 0).stop(1, IMP_BONE, 1);
      doc.rect(px - 30, y, 30, h).fill(across);
      doc.rect(px, y, x + w - px, h).fill(IMP_BONE);
      doc.image(art!.group, px, y + h - ph + 1, { width: pw });
      doc.restore();
      doc.save();
      doc.roundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 14).lineWidth(1).strokeColor(IMP_LINE).stroke();
      doc.restore();

      // The mark: the tiara, MANICURISTAS, IMPARABLES and its pillars.
      const big = Math.min(33, (33 * (leftW - 44)) / widthOf("IMPARABLES", "impBig", 33));
      const top = y + 16;
      const tw = big * 1.62;
      doc.save();
      doc.translate(cx - tw / 2, top).scale(tw / 190);
      doc.path("M6 48 Q95 -4 184 48").lineWidth(2.6).strokeColor(IMP_GOLD).stroke();
      doc.path("M30 46 Q95 12 160 46").lineWidth(1.2).strokeOpacity(0.7).strokeColor(IMP_GOLD).stroke();
      doc.polygon(...STAR).fillOpacity(1).fill(IMP_GOLD);
      doc.restore();
      mid("MANICURISTAS", "impName", big * 0.318, IMP_INK, cx, top + big * 0.45, big * 0.097);
      mid("IMPARABLES", "impBig", big, IMP_BRONZE, cx, top + big * 0.75);
      const pillars = Math.max(7, big * 0.224);
      mid(PILLARS.toUpperCase(), "impName", pillars, IMP_INK, cx, top + big * 1.93, big * 0.055);

      // The promise and the button.
      let cy = top + big * 1.93 + pillars * 1.3 + 11;
      doc.font("impSans").fontSize(12.5).fillColor(IMP_INK).text(COVER_HOOK.join(" "), x + 20, cy, { width: leftW - 40, align: "center", lineGap: 1.2 });
      cy = doc.y + 11;
      const label = "Aprende cómo lo hicieron";
      const lw = widthOf(label, "impSans", 11);
      const bw = lw + 44;
      const bx = cx - bw / 2;
      doc.roundedRect(bx, cy, bw, 28, 9).fill(IMP_GOLD);
      doc.font("impSans").fontSize(11).fillColor(IMP_INK).text(label, bx + 14, cy + (28 - 11 * 1.25) / 2 + 1, { lineBreak: false });
      const ax = bx + 14 + lw + 7.5;
      const ay = cy + 14;
      doc.save();
      doc.moveTo(ax, ay).lineTo(ax + 9.5, ay).moveTo(ax + 5.8, ay - 3.7).lineTo(ax + 9.5, ay).lineTo(ax + 5.8, ay + 3.7);
      doc.lineWidth(1.7).lineCap("round").lineJoin("round").strokeColor(IMP_INK).stroke();
      doc.restore();

      // The day and what it is, over the photo.
      const pill = `${promo.date} · ${promo.note}`;
      const pillW = widthOf(pill, "impSans", 8.6) + 22;
      const pillX = x + w - 14 - pillW;
      doc.roundedRect(pillX, y + 13, pillW, 20, 10).lineWidth(0.8).fillAndStroke(IMP_CARD, IMP_LINE);
      mid(pill, "impSans", 8.6, IMP_INK, pillX + pillW / 2, y + 13 + (20 - 8.6 * 1.25) / 2 + 0.6);

      doc.link(x, y, w, h, promo.url);
    }

    // Up to two tickets a page; Manicuristas Imparables' banner, when it goes, under the last page's — the tickets a
    // little shorter so it has room, and on no page if it still doesn't fit.
    for (let first = 0; first < pages.length; first += 2) {
      const onPage = pages.length - first >= 2 ? 2 : 1;
      const compact = several;
      const tight = compact && banner !== null;
      doc.addPage({ size: "A4", margin: 0 });
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(PAGE_BG);
      const h = tight ? 186 : compact ? 229.5 : 247.5;
      const gap = tight ? 10 : 16.5;
      let y = tight ? 22 : compact ? 30 : 39;
      for (let i = 0; i < onPage; i++) {
        ticket(MX, y, h, first + i, compact, tight);
        y += h + gap;
      }
      y += (tight ? 12 : compact ? 18 : 25.5) - gap;
      y = boxes(y, compact);
      const shown = showLine(y + (tight ? 9 : compact ? 12 : 13.5), compact);
      const top = shown + 10;
      const room = PAGE_H - 44 - top;
      const withBanner = banner !== null && first + 2 >= pages.length && room >= BANNER_MIN_H;
      if (withBanner) imparablesBanner(top, Math.min(room, BANNER_H));
      footer(withBanner);
    }
    doc.end();
  });
}

/** Loads everything renderTicketPdfBuffer needs straight from a
 * registration id — shared by /api/ticket-pdf/[token] (the public URL
 * WhatsApp document sends point at) and anywhere else that needs "just
 * render this person's ticket" without duplicating the field mapping
 * sendTicketEmail.ts already does inline for the email attachment. Same
 * confirmationCode derivation as that file (last 8 chars of the
 * registration id, uppercased) — kept identical so the code shown to
 * someone never disagrees between the email and a WhatsApp resend.
 * Returns null for anything that isn't a real, confirmed, QR-issued
 * registration — never partially renders a ticket for a draft/cancelled
 * one. */
export async function buildTicketPdfDataForRegistration(registrationId: string): Promise<TicketPdfData | null> {
  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { person: true, event: true, ticketType: true },
  });
  if (!registration || !registration.qrToken || registration.status !== "CONFIRMED") return null;

  const orgSettings = await getOrgSettings();
  return {
    firstName: registration.person.firstName ?? "",
    lastName: registration.person.lastName ?? undefined,
    eventName: publicEventName(registration.event),
    venueName: registration.event.venueName ?? undefined,
    venueAddress: registration.event.venueAddress ?? undefined,
    city: registration.event.city || undefined,
    startsAt: registration.event.startsAt,
    endsAt: registration.event.endsAt ?? undefined,
    scheduleDays: registration.event.scheduleDays,
    // Her ticket level's name, when she has one (lib/imparables/tiers.ts).
    ticketTypeName: ticketNameOf(registration),
    ticketCount: registration.ticketCount ?? undefined,
    confirmationCode: confirmationCodeFor(registration.id),
    qrToken: registration.qrToken,
    timezone: orgSettings.timezone,
    language: orgSettings.language,
    imparables: await ticketBannerFor(registration.event),
  };
}
