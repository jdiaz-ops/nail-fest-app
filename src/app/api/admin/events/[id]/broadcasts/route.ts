import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { sendEventBroadcast } from "@/lib/broadcasts";
import { countEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { eventBroadcastBodySchema } from "@/lib/eventBroadcastSchema";

// Creates an event-scoped broadcast from EventBroadcastComposer.tsx —
// "Correos del evento". Same sanitizeEventDescription allowlist as the
// event description/confirmation editors (same TipTap editor produces
// it) — this HTML lands in a real inbox, so it goes through the same
// server-side gate regardless of who's typing.
//
// Validation itself lives in lib/eventBroadcastSchema.ts, shared with
// the sibling [broadcastId]/route.ts (PATCH — "Editar" on a still-QUEUED
// broadcast) so the two never drift.

// sendEventBroadcast now sends the first chunk synchronously (see its own
// comment) — real headroom for that, not the framework default.
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  const parsed = eventBroadcastBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const broadcast = await db.emailBroadcast.create({
    data: {
      eventId: event.id,
      ticketTypeId: data.ticketTypeId || null,
      subject: data.subject,
      bodyHtml: sanitizeEventDescription(data.bodyHtml),
      attachTicketPdf: data.attachTicketPdf,
      scheduleKind: data.scheduleKind,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      scheduleOffsetMinutes: data.scheduleOffsetMinutes ?? null,
      status: data.scheduleKind === "IMMEDIATE" ? "SENDING" : "QUEUED",
    },
  });

  if (data.scheduleKind === "IMMEDIATE") {
    const result = await sendEventBroadcast(broadcast.id);
    return NextResponse.json({ ok: true, broadcastId: broadcast.id, sentNow: true, ...result });
  }

  const recipientCount = await countEventBroadcastRecipients(event.id, data.ticketTypeId || null);
  return NextResponse.json({ ok: true, broadcastId: broadcast.id, sentNow: false, recipientCount });
}
