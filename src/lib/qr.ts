import QRCode from "qrcode";

// Generic QR rendering, shared by lib/ticket.ts (signed entry tokens) and
// the scanner "download the app" link (a plain URL) — same visual
// settings either way, just different string content.
export const QR_RENDER_OPTS = { errorCorrectionLevel: "M" as const, margin: 1, width: 480 };

export async function renderQrPngDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, QR_RENDER_OPTS);
}
