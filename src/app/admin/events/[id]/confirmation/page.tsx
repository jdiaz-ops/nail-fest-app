import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { defaultShareText } from "@/lib/imparables/confirmation";
import { NAIL_FEST_DESIGN, defaultNailFestShareText, eventDays } from "@/lib/nailfest/confirmation";
import { defaultTips } from "@/lib/nailfest/confirmationEmail";
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
  const tz = orgSettings.timezone;
  // The event's own designed email: Manicuristas Imparables' for its events
  // (2026-10-29), Nail Fest's for one at a place (2026-10-30).
  const design = event.theme === "IMPARABLES" ? "IMPARABLES" : event.format !== "VIRTUAL" ? NAIL_FEST_DESIGN : null;

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
        design={
          design === "IMPARABLES"
            ? { kind: design, initial: event.confirmationEmailDesign === design, shareText: event.shareText ?? defaultShareText(event, tz) }
            : design === NAIL_FEST_DESIGN
              ? {
                  kind: design,
                  initial: event.confirmationEmailDesign === design,
                  shareText: event.shareText ?? defaultNailFestShareText(event, tz),
                  tips: event.confirmationTips.length ? event.confirmationTips : defaultTips(eventDays(event, tz).length > 1),
                }
              : null
        }
      />
    </div>
  );
}
