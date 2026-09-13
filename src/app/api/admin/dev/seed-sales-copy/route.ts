import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { MANICURISTAS_SALES_PAGE_HTML } from "@/lib/salesCopy/manicuristasImparables";

// The one-tap counterpart to scripts/seed-manicuristas-sales-page.ts —
// same content, same guardrails, for when there's no terminal handy (an
// admin on their phone). ADMIN-only: this writes public-facing landing
// copy, not a per-registration action a COORDINADOR would normally do.
//
// Touches ONLY this one event's description column — never any other
// field (startsAt, zoomMeetingId, format, etc. stay exactly as they are),
// and refuses to overwrite a non-empty description unless force is set,
// same as the CLI script.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const eventId = typeof body?.eventId === "string" ? body.eventId : null;
  const force = body?.force === true;
  if (!eventId) return NextResponse.json({ error: "missing_event_id" }, { status: 400 });

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (event.description && event.description.trim() && !force) {
    return NextResponse.json({
      error: "already_has_description",
      currentLength: event.description.length,
    });
  }

  await db.event.update({
    where: { id: eventId },
    data: { description: sanitizeEventDescription(MANICURISTAS_SALES_PAGE_HTML) },
  });

  return NextResponse.json({ ok: true });
}
