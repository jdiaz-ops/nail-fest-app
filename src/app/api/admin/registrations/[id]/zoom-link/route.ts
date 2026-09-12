import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { registerParticipant } from "@/lib/zoom";

// The "Generar ahora" action in the Issued tickets modal (see
// IssuedTicketsTable.tsx) — visibility into whether Zoom registration
// already ran for this person (Registration.zoomJoinUrl), plus a manual
// retry when it hasn't (or the automatic attempt at confirmation time
// failed — see lib/registrationConfirmation.ts's own best-effort
// comment). Never called automatically; an admin explicitly asks for
// this, same posture as "Reenviar correo".
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const registration = await db.registration.findUnique({
    where: { id: params.id },
    include: { person: true, event: true },
  });
  if (!registration) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (registration.event.format === "IN_PERSON" || !registration.event.zoomMeetingId) {
    return NextResponse.json({ error: "not_a_virtual_event" }, { status: 400 });
  }
  if (registration.zoomJoinUrl) {
    // Already have one — return it as-is rather than calling Zoom again
    // and potentially creating a duplicate registrant record for no
    // reason.
    return NextResponse.json({ ok: true, zoomJoinUrl: registration.zoomJoinUrl });
  }

  const joinUrl = await registerParticipant(registration.event.zoomMeetingId, registration.event.zoomIsWebinar, {
    email: registration.person.email,
    firstName: registration.person.firstName ?? "",
    lastName: registration.person.lastName ?? "",
  }).catch((err) => {
    console.error("admin zoom-link generate: registerParticipant failed", params.id, err);
    return null;
  });
  if (!joinUrl) {
    return NextResponse.json({ error: "zoom_registration_failed" }, { status: 502 });
  }

  await db.registration.update({ where: { id: registration.id }, data: { zoomJoinUrl: joinUrl } });
  return NextResponse.json({ ok: true, zoomJoinUrl: joinUrl });
}
