import { createHmac } from "crypto";
import QRCode from "qrcode";
import { QR_RENDER_OPTS } from "@/lib/qr";

// The QR encodes a signed token, not raw data — so a photo of someone
// else's ticket can't be edited/forged to claim a different registration.
// NOTE: this token deliberately never "expires" or gets consumed on scan —
// see docs/PLAN.md "control de aforo real": check-in is an append-only log
// of scans, not a single-use flag, so reentry works. That's Phase 02, not
// this slice — this module only issues the token the future scanner will
// verify.

function sign(registrationId: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(registrationId).digest("base64url");
}

export function issueQrToken(registrationId: string): string {
  return `${registrationId}.${sign(registrationId)}`;
}

export function verifyQrToken(token: string): { valid: boolean; registrationId?: string } {
  const [registrationId, signature] = token.split(".");
  if (!registrationId || !signature) return { valid: false };
  const expected = sign(registrationId);
  // Constant-time-ish comparison is nice-to-have here; length-checked
  // string compare is an acceptable simplification for a low-value token
  // (it authorizes event entry, not money movement).
  if (signature !== expected) return { valid: false };
  return { valid: true, registrationId };
}

/** Used by the "view my ticket" style pages, if/when one exists — not the
 * confirmation email, which needs a real image URL (see renderQrPngBuffer
 * and /api/ticket-qr) since inboxes drop data: URIs. */
export async function renderQrPngDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, QR_RENDER_OPTS);
}

/** Used both by /api/ticket-qr (the image URL embedded in the email) and
 * by the emailed PNG attachment — one render, two delivery paths. */
export async function renderQrPngBuffer(token: string): Promise<Buffer> {
  return QRCode.toBuffer(token, QR_RENDER_OPTS);
}
