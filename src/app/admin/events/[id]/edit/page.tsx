import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import EventForm from "../../EventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { id: params.id } }), getOrgSettings()]);
  if (!event) notFound();

  const baseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "") || "https://tu-dominio.com";

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Editar evento</h1>
      <EventForm
        initial={{
          id: event.id,
          name: event.name,
          city: event.city,
          venueName: event.venueName ?? "",
          venueAddress: event.venueAddress ?? "",
          startsAtLocal: utcToZonedInputValue(event.startsAt, orgSettings.timezone),
          endsAtLocal: event.endsAt ? utcToZonedInputValue(event.endsAt, orgSettings.timezone) : "",
          capacity: event.capacity != null ? String(event.capacity) : "",
          status: event.status,
          slug: event.slug,
        }}
        timezone={orgSettings.timezone}
        baseUrl={baseUrl}
      />
    </div>
  );
}
