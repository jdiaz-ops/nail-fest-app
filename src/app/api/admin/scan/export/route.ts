import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// Last-resort paper backup — for when the app/phone/software fails
// entirely, not just the network (a dead battery, a broken screen, the
// browser itself misbehaving). Admin-only: this is a printable roster
// with names, not something a door phone needs day-to-day.
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "missing_event_id" }, { status: 400 });
  }
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  const registrations = await db.registration.findMany({
    where: { eventId, status: "CONFIRMED" },
    orderBy: [{ person: { lastName: "asc" } }, { person: { firstName: "asc" } }],
    include: { person: true, ticketType: true },
  });

  const header = ["Nombre", "Correo", "Tipo de entrada", "Cantidad", "Escaneados", "Estado"];
  const rows = registrations.map((r) => [
    [r.person.firstName, r.person.lastName].filter(Boolean).join(" ") || r.person.email,
    r.person.email,
    r.ticketType?.name ?? "—",
    String(r.ticketCount),
    String(r.checkedInCount),
    r.checkedInCount > 0 ? "Ya entró" : "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-lista-respaldo.csv"`,
    },
  });
}
