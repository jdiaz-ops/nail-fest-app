import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { ticketHolderName, ticketsCheckedIn, ticketsFor } from "@/lib/ticket";

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
//
// One entry per TICKET, not per registration — a 2-ticket order is two
// entries ("María Pérez" and "Acompañante de María Pérez"), each with its
// own QR token and its own checked-in state, so the Lista tab can check in
// a companion on their own (including someone holding an older ticket
// email that only carried the titular's QR).
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

  const [registrations, firstScans] = await Promise.all([
    db.registration.findMany({
      where: { eventId, status: "CONFIRMED", qrToken: { not: null } },
      select: {
        id: true,
        qrToken: true,
        ticketCount: true,
        checkedInCount: true,
        person: { select: { firstName: true, lastName: true } },
        ticketType: { select: { name: true } },
      },
    }),
    db.scanLog.findMany({
      where: { registration: { eventId }, result: "VALID_FIRST" },
      select: { token: true },
    }),
  ]);
  const scannedTokens = new Set(firstScans.map((s) => s.token));

  const entries = registrations.flatMap((r) => {
    const titular = [r.person.firstName, r.person.lastName].filter(Boolean).join(" ");
    // Ticket 1 is the stored token as-is (the one every ticket email
    // already carries); the others are derived — see lib/ticket.ts.
    const tickets = ticketsFor(r.id, r.ticketCount).map((t) => (t.ticketNumber === 1 ? { ...t, qrToken: r.qrToken as string } : t));
    const checked = ticketsCheckedIn(
      tickets.map((t) => t.qrToken),
      scannedTokens,
      r.checkedInCount
    );
    return tickets.map((t, i) => ({
      token: t.qrToken,
      personName: titular ? ticketHolderName(titular, t.ticketNumber) : undefined,
      ticketTypeName: r.ticketType?.name,
      ticketCount: 1,
      checkedInCount: checked[i] ? 1 : 0,
    }));
  });

  return NextResponse.json({
    eventId: event.id,
    eventName: event.name,
    generatedAt: new Date().toISOString(),
    entries,
  });
}
