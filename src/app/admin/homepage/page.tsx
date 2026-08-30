import { getOrgSettings } from "@/lib/settings";
import { getNextEvent } from "@/lib/nextEvent";
import { requirePageUser } from "@/lib/auth/guard";
import HomepageEditorForm from "./HomepageEditorForm";

export const dynamic = "force-dynamic";

// nailfest.co's homepage editor — top-level nav item (not nested under
// Configuración), the user asked for it there specifically. See src/app/
// page.tsx and OrgSettings.homepageImageUrl's schema comment for what's
// admin-authored here vs. computed live from the real next event.
export default async function AdminHomepagePage() {
  await requirePageUser(["ADMIN"]);
  const [orgSettings, nextEvent] = await Promise.all([getOrgSettings(), getNextEvent()]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Editar homepage</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 24 }}>
        La página principal de nailfest.co. El nombre del evento, ciudad y fechas se toman solos del próximo evento
        publicado — aquí solo editas la imagen de fondo, un eslogan opcional, y el texto del botón.
      </p>
      <HomepageEditorForm
        initialImageUrl={orgSettings.homepageImageUrl}
        initialTagline={orgSettings.homepageTagline}
        initialCtaLabel={orgSettings.homepageCtaLabel}
        nextEventLabel={nextEvent ? `${nextEvent.name} — ${nextEvent.city}` : null}
      />
    </div>
  );
}
