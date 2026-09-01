import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp/broadcasts";
import { getOrCreateLabel } from "@/lib/labels";
import { scheduleWhatsAppBroadcastSend } from "@/lib/qstash";

// Segment-only, same scope as /api/broadcasts (email's own general CRM
// broadcast route) — an event-scoped WhatsApp send (like
// EventBroadcastComposer.tsx's email equivalent) is real schema support
// (WhatsAppBroadcast.eventId exists) but not a second composer surface
// built here; picking an "everyone registered for X" segment in
// /admin/crm/segments covers the same audience today.
const bodySchema = z
  .object({
    segmentId: z.string().min(1),
    templateId: z.string().min(1),
    variableMapping: z.record(z.string()).default({}),
    // A plain name, not an id — WhatChimp's own "type a name and hit
    // enter" UX, same reasoning as getOrCreateLabel's own comment: created
    // on first use so the composer never needs a separate "manage labels"
    // step first.
    assignLabelName: z.string().optional(),
    // Segment-based Difusiones only ever needs IMMEDIATE or a fixed
    // date/time — BEFORE_EVENT_START/AFTER_EVENT_END (also valid on this
    // model, see WhatsAppBroadcast.scheduleKind) only make sense for an
    // event-scoped broadcast, which this composer doesn't create.
    scheduleKind: z.enum(["IMMEDIATE", "AT_DATETIME"]).default("IMMEDIATE"),
    scheduledAt: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleKind === "AT_DATETIME" && !data.scheduledAt) {
      ctx.addIssue({ code: "custom", message: "scheduledAt required for AT_DATETIME", path: ["scheduledAt"] });
    }
  });

// sendWhatsAppBroadcast now sends the first chunk synchronously (see its
// own comment) — real headroom for that, not the framework default.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { segmentId, templateId, variableMapping, assignLabelName, scheduleKind, scheduledAt } = parsed.data;

  const [segment, template] = await Promise.all([
    db.segmentDefinition.findUnique({ where: { id: segmentId } }),
    db.whatsAppTemplate.findUnique({ where: { id: templateId } }),
  ]);
  if (!segment) return NextResponse.json({ error: "segment_not_found" }, { status: 404 });
  if (!template) return NextResponse.json({ error: "template_not_found" }, { status: 404 });

  const assignLabel = assignLabelName ? await getOrCreateLabel(assignLabelName) : null;

  const broadcast = await db.whatsAppBroadcast.create({
    data: {
      segmentId: segment.id,
      templateId: template.id,
      variableMapping,
      assignLabelId: assignLabel?.id ?? null,
      scheduleKind,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      // A scheduled one waits for QStash's exact-time callback (see
      // lib/qstash.ts) — the daily /api/whatsapp/send-due cron only
      // covers it as a fallback if that fails to get scheduled below.
      // Same QUEUED/SENDING split as the event-scoped email broadcasts.
      status: scheduleKind === "IMMEDIATE" ? "SENDING" : "QUEUED",
    },
  });

  if (scheduleKind !== "IMMEDIATE") {
    const qstashMessageId = await scheduleWhatsAppBroadcastSend(broadcast.id, new Date(scheduledAt!));
    if (qstashMessageId) {
      await db.whatsAppBroadcast.update({ where: { id: broadcast.id }, data: { qstashMessageId } });
    }
    return NextResponse.json({
      ok: true,
      broadcastId: broadcast.id,
      sentNow: false,
      // Surfaced by the composer as a warning — the broadcast still
      // exists and will still go out (the daily cron is a real
      // fallback, not a silent failure), just not at the exact minute
      // requested if QStash didn't get configured/reachable.
      scheduleWarning: qstashMessageId
        ? null
        : "No se pudo programar la hora exacta (revisa la configuración de QStash) — de todas formas saldrá dentro de las próximas 24h por el envío de respaldo diario.",
    });
  }

  try {
    const result = await sendWhatsAppBroadcast(broadcast.id);
    return NextResponse.json({ ok: true, broadcastId: broadcast.id, sentNow: true, ...result });
  } catch (err) {
    console.error("whatsapp broadcast send failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "send_failed" }, { status: 502 });
  }
}

export async function GET() {
  const broadcasts = await db.whatsAppBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { segment: true, template: true, _count: { select: { messages: true } } },
  });
  return NextResponse.json({ broadcasts });
}
