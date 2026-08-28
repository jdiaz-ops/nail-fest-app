import { Fraunces } from "next/font/google";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import EventsTable from "./EventsTable";

export const dynamic = "force-dynamic";

// Same slab-serif display heading as /admin/settings and /admin/crm — see
// settings/layout.tsx's own comment on the Ticket Tailor screenshot review
// this matches.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "900"] });

export default async function EventsPage() {
  const [events, aforo, orgSettings] = await Promise.all([
    db.event.findMany({ orderBy: { startsAt: "desc" } }),
    db.registration.groupBy({ by: ["eventId"], _sum: { ticketCount: true } }),
    getOrgSettings(),
  ]);

  const issuedByEvent = new Map(aforo.map((a) => [a.eventId, a._sum.ticketCount ?? 0]));

  const rows = events.map((ev) => ({
    id: ev.id,
    slug: ev.slug,
    name: ev.name,
    city: ev.city,
    venueName: ev.venueName,
    venueAddress: ev.venueAddress,
    status: ev.status,
    startsAt: ev.startsAt.toISOString(),
    endsAt: ev.endsAt?.toISOString() ?? null,
    capacity: ev.capacity,
    issued: issuedByEvent.get(ev.id) ?? 0,
  }));

  return (
    <div>
      <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 28, marginBottom: 4 }}>Eventos</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 24 }}>
        Cada evento es independiente — su propia página de registro, su propio cupo, su propio
        Draft/Published.
      </p>
      <EventsTable events={rows} timezone={orgSettings.timezone} language={orgSettings.language} />
    </div>
  );
}
