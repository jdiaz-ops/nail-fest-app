import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import SaveEventConfirmationClient from "./SaveEventConfirmationClient";

export const dynamic = "force-dynamic";

// Confirmación del evento — el correo que se envía al completar la
// inscripción en la landing page, con posibilidad de reemplazar la
// plantilla global solo para este evento. Ver Event.confirmationEmailHtml
// y sendTicketEmail.ts para la cadena real de resolución.
export default async function EventConfirmationPage({ params }: { params: { id: string } }) {
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Confirmación del evento</h2>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 20 }}>
        El correo que recibe cada persona al completar su inscripción para {event.name} — incluye su entrada.
      </p>
      <SaveEventConfirmationClient eventId={event.id} initialHtml={event.confirmationEmailHtml} />
    </div>
  );
}
