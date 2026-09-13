import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { Prisma } from "@prisma/client";
import { manicuristasImparablesSalesPage } from "@/lib/salesPage/manicuristasImparables";

// The one-tap counterpart to scripts/seed-manicuristas-sales-page.ts —
// same content, same guardrails, for when there's no terminal handy (an
// admin on their phone). ADMIN-only: this writes public-facing landing
// content, not a per-registration action a COORDINADOR would normally do.
//
// Touches ONLY this one event's salesPageContent column — never any other
// field (startsAt, zoomMeetingId, format, description, etc. stay exactly
// as they are), and refuses to overwrite an already-set salesPageContent
// unless force is set, same as the CLI script.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const eventId = typeof body?.eventId === "string" ? body.eventId : null;
  const force = body?.force === true;
  if (!eventId) return NextResponse.json({ error: "missing_event_id" }, { status: 400 });

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (event.salesPageContent && !force) {
    return NextResponse.json({ error: "already_has_sales_page_content" });
  }

  await db.event.update({
    where: { id: eventId },
    data: { salesPageContent: manicuristasImparablesSalesPage as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true });
}
