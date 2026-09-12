import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { respondToZoomUrlValidation, verifyZoomWebhookSignature } from "@/lib/zoom";

// Zoom's Event Subscriptions webhook — configured in the Zoom app under
// Feature -> Event Subscriptions (a DIFFERENT setup step from the OAuth
// credentials in lib/zoom.ts's own top comment). Real-time
// meeting.participant_joined/left events, used to power the "quién está
// conectado ahora" live panel during a virtual event — see
// ZoomAttendanceLog's own schema comment for why this exists alongside
// the after-the-fact Report API attendance pull.
//
// Two request shapes hit this same URL:
//  1. "endpoint.url_validation" — Zoom's one-time handshake when the
//     subscription's URL is first saved (or re-verified). No signature to
//     check yet at this point — this IS the step that establishes trust.
//  2. Every real event after that, signed with x-zm-signature — verified
//     against the raw body before it's ever parsed for real.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const body = JSON.parse(rawBody || "{}");

  if (body.event === "endpoint.url_validation") {
    const plainToken = body.payload?.plainToken;
    if (!plainToken) {
      return NextResponse.json({ error: "missing_plainToken" }, { status: 400 });
    }
    return NextResponse.json(respondToZoomUrlValidation(plainToken));
  }

  if (!verifyZoomWebhookSignature(rawBody, req.headers.get("x-zm-request-timestamp"), req.headers.get("x-zm-signature"))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (body.event === "meeting.participant_joined" || body.event === "meeting.participant_left") {
    await handleParticipantEvent(body).catch((err) => console.error("zoom webhook: participant event failed", err));
  }
  // Any other subscribed event type (meeting.started, meeting.ended, ...)
  // — not handled yet, not an error, just nothing to do with it today.

  return NextResponse.json({ ok: true });
}

interface ZoomParticipantEventBody {
  event: "meeting.participant_joined" | "meeting.participant_left";
  payload: {
    object: {
      id: string; // meeting's numeric id, as a string — matches Event.zoomMeetingId
      participant: {
        id: string; // this join session's own participant id
        email?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
}

async function handleParticipantEvent(body: ZoomParticipantEventBody): Promise<void> {
  const { object } = body.payload;
  const participant = object.participant;

  const event = await db.event.findFirst({ where: { zoomMeetingId: object.id } });
  if (!event) return; // a meeting id we don't recognize — nothing to log against

  const email = participant.email?.trim().toLowerCase();
  const registration = email
    ? await db.registration.findFirst({
        where: { eventId: event.id, person: { email } },
      })
    : null;

  if (body.event === "meeting.participant_joined") {
    await db.zoomAttendanceLog.create({
      data: {
        eventId: event.id,
        registrationId: registration?.id ?? null,
        participantEmail: email ?? null,
        zoomParticipantId: participant.id,
        joinedAt: participant.join_time ? new Date(participant.join_time) : new Date(),
      },
    });
    return;
  }

  // meeting.participant_left — find that SAME join session (still open,
  // no leftAt yet) and close it. updateMany, not update: a left event for
  // a join we somehow never logged (a webhook delivery gap) matches
  // nothing, which is fine to just skip rather than throw on.
  await db.zoomAttendanceLog.updateMany({
    where: { eventId: event.id, zoomParticipantId: participant.id, leftAt: null },
    data: { leftAt: participant.leave_time ? new Date(participant.leave_time) : new Date() },
  });
}
