import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { sendEventBroadcast } from "@/lib/broadcasts";
import { countEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { eventBroadcastBodySchema } from "@/lib/eventBroadcastSchema";

// Same real send path as immediate creation — see sendEventBroadcast's
// own comment (PDF rendering per recipient can be slow on a big list).
export const maxDuration = 60;

// "Editar" from the broadcasts list (the link only ever shows on a
// QUEUED row — see that page's own comment). Same validation as
// creating one (eventBroadcastBodySchema, shared with the sibling POST
// route so the two never drift), but updates the existing row instead of creating a
// new one, and — unlike "Duplicar" — DOES let the schedule itself
// change (the whole point of editing a queued send is often exactly
// that: the event's date moved, so the reminder's own date needs to
// move with it).
//
// Only a QUEUED broadcast is editable: once it's SENDING/SENT/CANCELLED
// its content has already gone out (or is actively going out), so
// changing it here would be misleading, not useful. The updateMany +
// status:"QUEUED" guard (rather than a plain findUnique + update)
// closes the tiny real race with the daily send-due cron — see that
// route's own comment on why it's daily, not realtime — atomically: if
// the cron already flipped this broadcast to SENDING between our own
// status check above and this write, the update just matches zero rows
// instead of clobbering an in-flight send.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; broadcastId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  const existing = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: event.id } });
  if (!existing) return NextResponse.json({ error: "broadcast_not_found" }, { status: 404 });
  if (existing.status !== "QUEUED") {
    return NextResponse.json(
      { error: "not_editable", message: "Este correo ya no se puede editar — ya se envió o se está enviando." },
      { status: 409 }
    );
  }

  const parsed = eventBroadcastBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const { count } = await db.emailBroadcast.updateMany({
    where: { id: existing.id, eventId: event.id, status: "QUEUED" },
    data: {
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
  if (count === 0) {
    return NextResponse.json(
      { error: "not_editable", message: "Este correo ya no se puede editar — ya se envió o se está enviando." },
      { status: 409 }
    );
  }

  if (data.scheduleKind === "IMMEDIATE") {
    const result = await sendEventBroadcast(existing.id);
    return NextResponse.json({ ok: true, broadcastId: existing.id, sentNow: true, ...result });
  }

  const recipientCount = await countEventBroadcastRecipients(event.id, data.ticketTypeId || null);
  return NextResponse.json({ ok: true, broadcastId: existing.id, sentNow: false, recipientCount });
}
