import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { DEFAULT_REGISTER_BUTTON_LABEL } from "@/lib/events";
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
      <EventForm
        title="Nuevo evento"
        initial={{
          name: "",
          city: "",
          venueName: "",
          venueAddress: "",
          description: "",
          imageUrl: null,
          registerButtonLabel: DEFAULT_REGISTER_BUTTON_LABEL,
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
          registerButtonLabel: ev.registerButtonLabel ?? DEFAULT_REGISTER_BUTTON_LABEL,
          capacity: ev.capacity != null ? String(ev.capacity) : "",
        }))}
      />
    </div>
  );
}
