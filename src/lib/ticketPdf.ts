import PDFDocument from "pdfkit";
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
const FAINT = "#8a8478";

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

    // Header band.
    doc.rect(0, 0, pageWidth, 92).fill(TEAL);
    doc
      .fillColor(TEAL_DARK_TEXT)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("TU ENTRADA", 50, 28, { characterSpacing: 1 });
    doc.fontSize(20).text(data.eventName, 50, 44, { width: pageWidth - 100 });

    // Event details.
    let y = 125;
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

    // QR block, centered.
    const qrSize = 220;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = y + 20;
    doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });

    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`CÓDIGO ${data.confirmationCode}`, 0, qrY + qrSize + 14, { align: "center", width: pageWidth });

    doc
      .fillColor(FAINT)
      .font("Helvetica")
      .fontSize(9)
      .text(
        "Presenta este código QR en la entrada. Puedes reingresar las veces que necesites durante el evento.",
        75,
        qrY + qrSize + 34,
        { align: "center", width: pageWidth - 150 }
      );

    doc.end();
  });
}
