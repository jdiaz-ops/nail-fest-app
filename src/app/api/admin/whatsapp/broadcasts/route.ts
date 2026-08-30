import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp/broadcasts";

// Segment-only, same scope as /api/broadcasts (email's own general CRM
// broadcast route) — an event-scoped WhatsApp send (like
// EventBroadcastComposer.tsx's email equivalent) is real schema support
// (WhatsAppBroadcast.eventId exists) but not a second composer surface
// built here; picking an "everyone registered for X" segment in
// /admin/crm/segments covers the same audience today.
const bodySchema = z.object({
  segmentId: z.string().min(1),
  templateId: z.string().min(1),
  variableMapping: z.record(z.string()).default({}),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { segmentId, templateId, variableMapping } = parsed.data;

  const [segment, template] = await Promise.all([
    db.segmentDefinition.findUnique({ where: { id: segmentId } }),
    db.whatsAppTemplate.findUnique({ where: { id: templateId } }),
  ]);
  if (!segment) return NextResponse.json({ error: "segment_not_found" }, { status: 404 });
  if (!template) return NextResponse.json({ error: "template_not_found" }, { status: 404 });

  const broadcast = await db.whatsAppBroadcast.create({
    data: { segmentId: segment.id, templateId: template.id, variableMapping, status: "SENDING" },
  });

  try {
    const result = await sendWhatsAppBroadcast(broadcast.id);
    return NextResponse.json({ ok: true, broadcastId: broadcast.id, ...result });
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
