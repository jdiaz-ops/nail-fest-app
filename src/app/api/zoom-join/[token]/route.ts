import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyQrToken } from "@/lib/ticket";

// The stable "base URL" a WhatsApp template's dynamic URL button points
// at — see ZOOM_ACCESS_REMINDER's own template setup in docs/
// WHATSAPP_SETUP.md. Exists because Zoom's own join_url can't be that
// base itself: it's a completely different domain/meetingId per EVENT
// (not just per person), so it could never be baked into one WhatsApp
// template that's meant to keep working for every future congress —
// same reasoning as /api/ticket-pdf/[token] existing instead of pointing
// the ticket button straight at some external PDF host.
//
// Reuses the SAME signed qrToken already sent as this registration's
// ticket token (see lib/ticket.ts's issueQrToken/verifyQrToken) rather
// than inventing a second per-registration token — it's already the
// credential Meta's dynamic URL button fills in for the ticket-PDF case,
// same trust boundary applies here (the token IS the credential, same
// as /api/ticket-pdf's own comment).
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const { valid, registrationId } = verifyQrToken(params.token);
  if (!valid || !registrationId) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  const registration = await db.registration.findUnique({ where: { id: registrationId }, include: { event: true } });
  if (!registration || registration.status !== "CONFIRMED") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Should never actually be null by the time ZOOM_ACCESS_REMINDER sends
  // this button (see registrationConfirmation.ts's own comment — the
  // link is generated and persisted well before that reminder fires),
  // but a person could tap an old message after something changed
  // (event format edited away from virtual, registration cancelled and
  // re-created, etc.) — falls back to the event's own public page
  // rather than a dead end.
  if (!registration.zoomJoinUrl) {
    return NextResponse.redirect(`${process.env.APP_BASE_URL || ""}/${registration.event.slug}`);
  }

  return NextResponse.redirect(registration.zoomJoinUrl);
}
