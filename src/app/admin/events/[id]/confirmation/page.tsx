import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { defaultShareText } from "@/lib/imparables/confirmation";
import SaveEventConfirmationClient from "./SaveEventConfirmationClient";

export const dynamic = "force-dynamic";

// Confirmación del evento — el correo que se envía al completar la
// inscripción en la landing page, con posibilidad de reemplazar la
// plantilla global solo para este evento. Ver Event.confirmationEmailHtml
// y sendTicketEmail.ts para la cadena real de resolución.
// ADMIN-only — see EventModuleShell's own comment.
export default async function EventConfirmationPage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { id: params.id } }), getOrgSettings()]);
  if (!event) notFound();

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Confirmación del evento</h2>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 20 }}>
        El correo que recibe cada persona al completar su inscripción para {event.name} — incluye su entrada.
      </p>
      <SaveEventConfirmationClient
        eventId={event.id}
        initialHtml={event.confirmationEmailHtml}
        initialSubject={event.confirmationEmailSubject}
        // Manicuristas Imparables' own designed email, for its events (2026-10-29).
        designAvailable={event.theme === "IMPARABLES"}
        initialDesign={event.confirmationEmailDesign === "IMPARABLES"}
        initialShareText={event.shareText ?? defaultShareText(event, orgSettings.timezone)}
      />
    </div>
  );
}
