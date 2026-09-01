import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// What the scanner PWA downloads onto the phone BEFORE the event (or in
// the background whenever it has a connection) so it can keep validating
// tickets when the connection drops mid-event — see lib/offlineScan.ts.
// Both roles: STAFF's own phone is exactly what needs this.
//
// Deliberately minimal — token + just enough to show at the door
// (name, ticket type) — no email, phone, city, profession. This sits
// unencrypted in the phone's localStorage, so it gets the same
// data-minimization treatment as everything else in this app that
// touches real people's data (see Ley 1581 discussion elsewhere in this
// codebase's history).
export async function GET(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "STAFF", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "missing_event_id" }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, name: true } });
  if (!event) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  const registrations = await db.registration.findMany({
    where: { eventId, status: "CONFIRMED", qrToken: { not: null } },
    select: {
      qrToken: true,
      ticketCount: true,
      checkedInCount: true,
      person: { select: { firstName: true, lastName: true } },
      ticketType: { select: { name: true } },
    },
  });

  const entries = registrations.map((r) => ({
    token: r.qrToken as string,
    personName: [r.person.firstName, r.person.lastName].filter(Boolean).join(" ") || undefined,
    ticketTypeName: r.ticketType?.name,
    ticketCount: r.ticketCount,
    checkedInCount: r.checkedInCount,
  }));

  return NextResponse.json({
    eventId: event.id,
    eventName: event.name,
    generatedAt: new Date().toISOString(),
    entries,
  });
}
