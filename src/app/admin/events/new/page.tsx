import { getOrgSettings } from "@/lib/settings";
import EventForm from "../EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const orgSettings = await getOrgSettings();
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
          startsAtLocal: "",
          endsAtLocal: "",
          capacity: "",
          status: "DRAFT",
          slug: "",
        }}
        timezone={orgSettings.timezone}
        baseUrl={baseUrl}
      />
    </div>
  );
}
