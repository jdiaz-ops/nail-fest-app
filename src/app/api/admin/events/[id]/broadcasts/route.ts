import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { sendEventBroadcast } from "@/lib/broadcasts";
import { countEventBroadcastRecipients } from "@/lib/broadcastRecipients";

// Creates an event-scoped broadcast from EventBroadcastComposer.tsx —
// "Correos del evento". Same sanitizeEventDescription allowlist as the
// event description/confirmation editors (same TipTap editor produces
// it) — this HTML lands in a real inbox, so it goes through the same
// server-side gate regardless of who's typing.
const bodySchema = z
  .object({
    ticketTypeId: z.string().nullable().optional(),
    subject: z.string().min(1),
    bodyHtml: z.string().min(1),
    scheduleKind: z.enum(["IMMEDIATE", "AT_DATETIME", "BEFORE_EVENT_START", "AFTER_EVENT_END"]),
    scheduledAt: z.string().datetime().optional(),
    scheduleOffsetMinutes: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleKind === "AT_DATETIME" && !data.scheduledAt) {
      ctx.addIssue({ code: "custom", message: "scheduledAt required for AT_DATETIME", path: ["scheduledAt"] });
    }
    if ((data.scheduleKind === "BEFORE_EVENT_START" || data.scheduleKind === "AFTER_EVENT_END") && data.scheduleOffsetMinutes == null) {
      ctx.addIssue({ code: "custom", message: "scheduleOffsetMinutes required", path: ["scheduleOffsetMinutes"] });
    }
  });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
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
