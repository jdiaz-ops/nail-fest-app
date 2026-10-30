import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarEventOf } from "@/lib/imparables/confirmation";
import { icsCalendar } from "@/lib/imparables/confirmationEmail";
import { inPersonCalendarEvent } from "@/lib/nailfest/confirmation";

export const dynamic = "force-dynamic";

// The event as an .ics file (2026-10-29): what «iPhone · Outlook» in
// Manicuristas Imparables' confirmation email opens — the phone or Outlook
// adds it to the calendar, with a reminder an hour before. An event at a
// place (Nail Fest's in-person confirmation, 2026-10-30): at its place, with
// its hours.
export async function GET(_req: Request, { params }: { params: { eventSlug: string } }) {
  const event = await db.event.findUnique({ where: { slug: params.eventSlug } });
  if (!event || event.status === "DRAFT") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const inPerson = event.theme !== "IMPARABLES" && event.format !== "VIRTUAL";
  return new NextResponse(icsCalendar(inPerson ? inPersonCalendarEvent(event) : calendarEventOf(event)), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
