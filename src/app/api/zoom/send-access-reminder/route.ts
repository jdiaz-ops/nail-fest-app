import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { zoomAccessReminderCallbackUrl, verifyQstashSignature } from "@/lib/qstash";
import { sendZoomAccessReminder } from "@/lib/whatsapp/sendZoomAccessReminder";

// QStash's callback for one registration's Zoom access reminder (see
// lib/registrationConfirmation.ts / lib/qstash.ts's
// scheduleZoomAccessReminder) — same signature-verification shape as
// /api/abandoned-cart/send.
//
// Every check below is a legitimate "nothing to do, return ok" case, not
// an error: the registration is no longer CONFIRMED (voided, refunded,
// deleted since this was scheduled), the event's format was changed away
// from VIRTUAL/HYBRID, or there's no zoomJoinUrl to send (Zoom
// registration never succeeded, or was cleared). Only a real send
// failure returns non-2xx so QStash retries with its own backoff — and
// sendZoomAccessReminder itself never throws (see its own comment), so
// "failure" here means the lookup/gating above, not the WhatsApp call.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQstashSignature(rawBody, req.headers.get("upstash-signature"), zoomAccessReminderCallbackUrl()))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const registrationId = body?.registrationId as string | undefined;
  if (!registrationId) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { person: true, event: true },
  });

  if (!registration || registration.status !== "CONFIRMED" || !registration.zoomJoinUrl || registration.event.format === "IN_PERSON") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await sendZoomAccessReminder({ person: registration.person, event: registration.event, zoomJoinUrl: registration.zoomJoinUrl });
  return NextResponse.json({ ok: true });
}
