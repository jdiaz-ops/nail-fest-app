import { createHmac } from "crypto";
import QRCode from "qrcode";
import { QR_RENDER_OPTS } from "@/lib/qr";

// The QR encodes a signed token, not raw data — so a photo of someone
// else's ticket can't be edited/forged to claim a different registration.
// NOTE: this token deliberately never "expires" or gets consumed on scan —
// see docs/PLAN.md "control de aforo real": check-in is an append-only log
// of scans, not a single-use flag, so reentry works.
//
// One token per physical ticket: a registration holding N tickets (titular
// + acompañante) has N tokens, each its own QR and its own check-in.
// Ticket 1 is `<registrationId>.<sig>` — exactly the format every token
// issued before per-ticket QRs existed, so those stay valid unchanged.
// Tickets 2..N are `<registrationId>_<n>.<sig>`, derived on demand from the
// registration id (never stored) — Registration.qrToken keeps holding
// ticket 1 only.

function sign(payload: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function ticketBase(registrationId: string, ticketNumber: number): string {
  return ticketNumber === 1 ? registrationId : `${registrationId}_${ticketNumber}`;
}

export function issueQrToken(registrationId: string, ticketNumber = 1): string {
  const base = ticketBase(registrationId, ticketNumber);
  return `${base}.${sign(base)}`;
}

export function verifyQrToken(token: string): { valid: boolean; registrationId?: string; ticketNumber?: number } {
  const [base, signature] = token.split(".");
  if (!base || !signature) return { valid: false };
  // "_1" is never issued — ticket 1 only ever has the plain form, so each
  // ticket has exactly one valid token.
  const match = /^([^_]+)(?:_([2-9]|[1-9]\d+))?$/.exec(base);
  if (!match) return { valid: false };
  // Constant-time-ish comparison is nice-to-have here; length-checked
  // string compare is an acceptable simplification for a low-value token
  // (it authorizes event entry, not money movement).
  if (signature !== sign(base)) return { valid: false };
  return { valid: true, registrationId: match[1], ticketNumber: match[2] ? Number(match[2]) : 1 };
}

/** The short, human-typeable code printed under each QR — last 8 chars of
 * the registration id, uppercased (an "order number" someone can read
 * over the phone). Ticket 1 keeps the plain code every confirmation email
 * already showed; the others get "-2", "-3", … so each ticket's code is
 * its own while still reading as part of the same order. */
export function confirmationCodeFor(registrationId: string, ticketNumber = 1): string {
  const code = registrationId.slice(-8).toUpperCase();
  return ticketNumber === 1 ? code : `${code}-${ticketNumber}`;
}

export interface IssuedTicket {
  ticketNumber: number;
  qrToken: string;
  confirmationCode: string;
}

/** Every ticket of a registration, in order — ticket 1 first. */
export function ticketsFor(registrationId: string, ticketCount: number): IssuedTicket[] {
  return Array.from({ length: Math.max(1, ticketCount) }, (_, i) => ({
    ticketNumber: i + 1,
    qrToken: issueQrToken(registrationId, i + 1),
    confirmationCode: confirmationCodeFor(registrationId, i + 1),
  }));
}

/** Which of an order's tickets (tokens in ticket order) count as already
 * in: every token with a first-entry scan, plus — when Registration.
 * checkedInCount is ahead of the scan log, as it is for a historical
 * import that set the count directly with no ScanLog rows behind it —
 * enough of the rest, earliest first, to match that count. */
export function ticketsCheckedIn(tokens: string[], scannedTokens: Set<string>, checkedInCount: number): boolean[] {
  const checked = tokens.map((t) => scannedTokens.has(t));
  let missing = checkedInCount - checked.filter(Boolean).length;
  for (let i = 0; i < checked.length && missing > 0; i++) {
    if (!checked[i]) {
      checked[i] = true;
      missing--;
    }
  }
  return checked;
}

/** Who a given ticket belongs to, as shown at the door and on the ticket
 * itself — the titular's own name, or "Acompañante de …" (the companion's
 * own name is deliberately never collected). */
export function ticketHolderName(titularName: string, ticketNumber: number): string {
  return ticketNumber === 1 ? titularName : `Acompañante de ${titularName}`;
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
