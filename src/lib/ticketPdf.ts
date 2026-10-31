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

// One self-contained, printable ticket — attached to every confirmation
// send (sendTicketEmail.ts), to event emails that carry it (broadcasts.ts)
// and sent by WhatsApp (/api/ticket-pdf/[token]), so someone can save or
// print it, or show it at the door without the email. Since 2026-10-30 the
// team's boceto 3: the ticket as a festival one — the event's teal with its
// logo, «Nail Fest Cúcuta», the big «7 y 8», where, her name and what kind;
// beside it the white stub with its QR, its code and whom it lets in —, then
// when and where, and the peach line on showing the QR. No cutting marks
// and no banner (the team). Two tickets of an order share a page (hers and
// her companion's), two per page beyond. In the event page's faces (Fraunces
// Black, Inter); Helvetica if they can't be read, never no ticket.
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
}

// One page per ticket of the order: `qrToken` is ticket 1 (the one stored
// on the registration), and for a multi-ticket order the rest are derived
// from it — every caller gets the full set of QRs without passing them in.
// A token that doesn't verify (the admin's fixed-sample preview) just
// renders its one ticket.
function pagesFor(data: TicketPdfData): { qrToken: string; confirmationCode: string; ticketNumber: number }[] {
  const count = data.ticketCount ?? 1;
  const { valid, registrationId } = verifyQrToken(data.qrToken);
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
    // Where a line's baseline falls under its top, for setting two faces on one baseline.
    const ascent = (font: string, size: number) => {
      doc.font(font).fontSize(size);
      return ((doc as unknown as { _font: { ascender: number } })._font.ascender / 1000) * size;
    };
    // A line set by its baseline.
    const onBaseline = (text: string, font: string, size: number, color: string, x: number, baseline: number, o: PDFKit.Mixins.TextOptions = {}) => {
      const top = baseline - ascent(font, size);
      doc.font(font).fontSize(size).fillColor(color).text(text, x, top, { lineBreak: false, ...o });
    };

    function ticket(x: number, y: number, h: number, index: number, compact: boolean) {
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
      const padX = compact ? 21 : 22.5;
      const padY = compact ? 16.5 : 19.5;
      const ix = x + padX;
      const iw = mainW - 2 * padX;
      let cy = y + padY;
      const logoW = compact ? 69 : 78;
      const logoH = found ? (logoW - 15) * (209 / 260) + 9 : 0;
      if (found) {
        doc.roundedRect(ix, cy, logoW, logoH, 10.5).fill(CREAM);
        doc.image(found.logo, ix + 7.5, cy + 4.5, { width: logoW - 15 });
      }
      const label = several ? `ENTRADA ${page.ticketNumber} DE ${pages.length}` : "TU ENTRADA";
      doc.font(F.heavy).fontSize(9);
      const labelW = doc.widthOfString(label, { characterSpacing: 1.6 });
      onBaseline(label, F.heavy, 9, PEACH, ix + iw - labelW, cy + (found ? logoH / 2 : 0) + 3.2, { characterSpacing: 1.6 });
      cy += (found ? logoH : 10) + (compact ? 9 : 13.5);

      let nameSize = compact ? 24.75 : 28.5;
      doc.font(F.display).fontSize(nameSize);
      const nameW = doc.widthOfString(data.eventName);
      if (nameW > iw) nameSize *= iw / nameW;
      onBaseline(data.eventName, F.display, nameSize, "#ffffff", ix, cy + nameSize * 0.82);
      cy += nameSize * 1.06;

      const daysSize = compact ? 30 : 34.5;
      const monthSize = compact ? 11.5 : 12.75;
      const baseline = cy + daysSize * 0.8;
      onBaseline(hero.days, F.display, daysSize, PEACH, ix, baseline);
      doc.font(F.display).fontSize(daysSize);
      const daysW = doc.widthOfString(hero.days);
      onBaseline(`${hero.month} · ${year}`, F.bold, monthSize, "#ffffff", ix + daysW + 7.5, baseline, { width: iw - daysW - 7.5, ellipsis: true });
      cy = baseline + daysSize * 0.2 + 3;
      if (placeLine) {
        doc.font(F.regular).fontSize(10.5).fillColor(MINT_TEXT).text(placeLine, ix, cy, { width: iw, lineBreak: false, ellipsis: true });
        cy += 10.5 * 1.25;
      }

      // Who and what kind, on the bottom; the line over them.
      const bottom = y + h - padY;
      const typeName = data.ticketTypeName ?? "Entrada";
      let typeSize = compact ? 12 : 12.75;
      doc.font(F.bold).fontSize(typeSize);
      const typeW = Math.min(doc.widthOfString(typeName), iw * 0.42);
      if (doc.widthOfString(typeName) > typeW) typeSize *= typeW / doc.widthOfString(typeName);
      const holder = ticketHolderName(attendeeName, page.ticketNumber);
      const holderW = iw - typeW - 12;
      let holderSize = compact ? 14.25 : 15.75;
      doc.font(F.bold).fontSize(holderSize);
      let holderH = doc.heightOfString(holder, { width: holderW, lineGap: -1.5 });
      const room = bottom - cy - 9.75 * 1.3 - 14;
      if (holderH > room) {
        holderSize = Math.max(11, holderSize * 0.86);
        doc.fontSize(holderSize);
        holderH = doc.heightOfString(holder, { width: holderW, lineGap: -1.5 });
      }
      const holderTop = bottom - holderH;
      doc.font(F.bold).fontSize(holderSize).fillColor("#ffffff").text(holder, ix, holderTop, { width: holderW, lineGap: -1.5 });
      doc.font(F.regular).fontSize(9.75).fillColor(MINT_TEXT).text("Asistente", ix, holderTop - 9.75 * 1.3, { lineBreak: false });
      const typeTop = bottom - typeSize * 1.2;
      doc.font(F.bold).fontSize(typeSize).fillColor("#ffffff").text(typeName, ix + iw - typeW, typeTop, { width: typeW, align: "right", lineBreak: false });
      doc.font(F.regular).fontSize(9.75).fillColor(MINT_TEXT).text("Entrada", ix + iw - typeW, typeTop - 9.75 * 1.3, { width: typeW, align: "right", lineBreak: false });
      const rule = Math.min(holderTop, typeTop) - 9.75 * 1.3 - 8;
      doc.save();
      doc.moveTo(ix, rule).lineTo(ix + iw, rule).lineWidth(0.75).strokeOpacity(0.25).strokeColor("#ffffff").stroke();
      doc.restore();

      // The stub: its QR, its code, whom it lets in.
      const qr = compact ? 127.5 : 142.5;
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

    function footer() {
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
        doc.font(f).fontSize(9.75).fillColor(c).text(t, x, PAGE_H - 42, { lineBreak: false });
        x += widths[i]!;
      });
    }

    // Up to two tickets a page.
    for (let first = 0; first < pages.length; first += 2) {
      const onPage = pages.length - first >= 2 ? 2 : 1;
      const compact = several;
      doc.addPage({ size: "A4", margin: 0 });
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(PAGE_BG);
      const h = compact ? 229.5 : 247.5;
      let y = compact ? 30 : 39;
      for (let i = 0; i < onPage; i++) {
        ticket(MX, y, h, first + i, compact);
        y += h + 16.5;
      }
      y += (compact ? 18 : 25.5) - 16.5;
      y = boxes(y, compact);
      showLine(y + (compact ? 12 : 13.5), compact);
      footer();
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
  };
}
