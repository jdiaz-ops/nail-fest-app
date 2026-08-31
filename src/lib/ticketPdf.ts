import PDFDocument from "pdfkit";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { renderQrPngBuffer } from "@/lib/ticket";

// One self-contained, printable ticket — same fields and the same teal
// accent as the inline "Tu entrada" voucher block in the email
// (confirmationTemplate.ts's renderVoucherHtml), just as a PDF instead of
// an HTML table, so someone can save/print it or show it from a PDF
// viewer at the door without needing the email itself. Attached to every
// confirmation send (sendTicketEmail.ts) in place of the old bare
// QR-only PNG — a lone QR with no event/attendee info printed on it is
// useless once separated from the email it came in.
export interface TicketPdfData {
  firstName: string;
  lastName?: string;
  eventName: string;
  venueName?: string;
  venueAddress?: string;
  startsAt: Date;
  endsAt?: Date;
  ticketTypeName?: string;
  ticketCount?: number;
  confirmationCode: string;
  qrToken: string;
  timezone: string;
  language: string;
}

const TEAL = "#00beb5";
const TEAL_DARK_TEXT = "#0b2e2c";
const INK = "#1a1a1a";
const MUTED = "#5b5f6b";

export async function renderTicketPdfBuffer(data: TicketPdfData): Promise<Buffer> {
  const qrPng = await renderQrPngBuffer(data.qrToken);
  const attendeeName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || "—";
  const dateOpts = { dateStyle: "full" as const, timeStyle: "short" as const };
  const rangeWhen = [
    formatDateInTz(data.startsAt, dateOpts, data.timezone, data.language),
    data.endsAt ? ` – ${formatDateInTz(data.endsAt, dateOpts, data.timezone, data.language)}` : "",
  ].join("");
  const ticketTypeLine =
    data.ticketTypeName && (data.ticketCount ?? 1) > 1
      ? `${data.ticketTypeName} · x${data.ticketCount}`
      : data.ticketTypeName;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const headerTextWidth = pageWidth - 100;
    const tagline = "Donde se reúne el mundo de las uñas";

    // Header band — measure text heights first (font/fontSize calls only
    // set state, nothing renders until .text()) so the teal band itself
    // can be drawn BEHIND the text at the right height, however many
    // lines the event name wraps to.
    const labelY = 24;
    const titleY = labelY + 18;
    doc.font("Helvetica-Bold").fontSize(20);
    const titleHeight = doc.heightOfString(data.eventName, { width: headerTextWidth });
    const taglineY = titleY + titleHeight + 6;
    doc.font("Helvetica").fontSize(11);
    const taglineHeight = doc.heightOfString(tagline, { width: headerTextWidth });
    const bandHeight = taglineY + taglineHeight + 20;

    doc.rect(0, 0, pageWidth, bandHeight).fill(TEAL);
    doc.fillColor(TEAL_DARK_TEXT).font("Helvetica-Bold").fontSize(10).text("TU ENTRADA", 50, labelY, { characterSpacing: 1 });
    doc.fontSize(20).text(data.eventName, 50, titleY, { width: headerTextWidth });
    doc.font("Helvetica").fontSize(11).text(tagline, 50, taglineY, { width: headerTextWidth });

    // Event details.
    let y = bandHeight + 33;
    const labelX = 50;
    const valueX = 150;
    const valueWidth = pageWidth - valueX - 50;

    function row(label: string, value: string) {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(label, labelX, y, { width: 90 });
      const height = doc.font("Helvetica").fontSize(11).heightOfString(value, { width: valueWidth });
      doc.text(value, valueX, y, { width: valueWidth });
      y += Math.max(20, height + 6);
    }

    row("Fecha", rangeWhen);
    if (data.venueName || data.venueAddress) {
      row("Lugar", [data.venueName, data.venueAddress].filter(Boolean).join(" — "));
    }
    row("Asistente", attendeeName);
    if (ticketTypeLine) row("Entrada", ticketTypeLine);

    // Instruction — bigger, above the QR (was a small line below it).
    const instruction = "Presenta este código QR (impreso o digital) en la entrada del evento.";
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13);
    const instructionHeight = doc.heightOfString(instruction, { align: "center", width: pageWidth - 150 });
    const instructionY = y + 20;
    doc.text(instruction, 75, instructionY, { align: "center", width: pageWidth - 150 });

    // QR block, centered.
    const qrSize = 220;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = instructionY + instructionHeight + 20;
    doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });

    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`CÓDIGO ${data.confirmationCode}`, 0, qrY + qrSize + 14, { align: "center", width: pageWidth });

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
    eventName: registration.event.name,
    venueName: registration.event.venueName ?? undefined,
    venueAddress: registration.event.venueAddress ?? undefined,
    startsAt: registration.event.startsAt,
    endsAt: registration.event.endsAt ?? undefined,
    ticketTypeName: registration.ticketType?.name,
    ticketCount: registration.ticketCount ?? undefined,
    confirmationCode: registration.id.slice(-8).toUpperCase(),
    qrToken: registration.qrToken,
    timezone: orgSettings.timezone,
    language: orgSettings.language,
  };
}
