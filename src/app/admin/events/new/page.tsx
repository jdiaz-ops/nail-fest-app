import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import EventForm from "../EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const [orgSettings, events] = await Promise.all([
    getOrgSettings(),
    db.event.findMany({ orderBy: { startsAt: "desc" } }),
  ]);
  const baseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "") || "https://tu-dominio.com";

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Nuevo evento</h1>
      <EventForm
        initial={{
          name: "",
          city: "",
          venueName: "",
          venueAddress: "",
          description: "",
          imageUrl: null,
          startsAtLocal: "",
          endsAtLocal: "",
          capacity: "",
          status: "DRAFT",
          slug: "",
        }}
        timezone={orgSettings.timezone}
        baseUrl={baseUrl}
        duplicateFrom={events.map((ev) => ({
          id: ev.id,
          name: ev.name,
          city: ev.city,
          venueName: ev.venueName ?? "",
          venueAddress: ev.venueAddress ?? "",
          description: ev.description ?? "",
          imageUrl: ev.imageUrl,
          capacity: ev.capacity != null ? String(ev.capacity) : "",
        }))}
      />
    </div>
  );
}
