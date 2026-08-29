import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { DEFAULT_REGISTER_BUTTON_LABEL } from "@/lib/events";
import { listTicketTypes } from "@/lib/ticketTypes";
import EventForm from "../../EventForm";
import TicketTypesSection from "../../TicketTypesSection";
import EventDecisionStats from "../../EventDecisionStats";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const [event, orgSettings, ticketTypes] = await Promise.all([
    db.event.findUnique({ where: { id: params.id } }),
    getOrgSettings(),
    listTicketTypes(params.id),
  ]);
  if (!event) notFound();

  const baseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "") || "https://tu-dominio.com";

  return (
    <div>
      <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid #e3e1dc" }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Estadísticas de {event.name}</h2>
        <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 20 }}>
          Solo de este evento — venta, de dónde viene la gente, y a quién le está llegando. Para consultar en vivo
          parado en la puerta, ve al Dashboard del escáner en su lugar.
        </p>
        <EventDecisionStats eventId={event.id} />
      </div>

      <EventForm
        title="Editar evento"
        initial={{
          id: event.id,
          name: event.name,
          city: event.city,
          venueName: event.venueName ?? "",
          venueAddress: event.venueAddress ?? "",
          description: event.description ?? "",
          imageUrl: event.imageUrl,
          registerButtonLabel: event.registerButtonLabel ?? DEFAULT_REGISTER_BUTTON_LABEL,
          startsAtLocal: utcToZonedInputValue(event.startsAt, orgSettings.timezone),
          endsAtLocal: event.endsAt ? utcToZonedInputValue(event.endsAt, orgSettings.timezone) : "",
          capacity: event.capacity != null ? String(event.capacity) : "",
          status: event.status,
          slug: event.slug,
        }}
        timezone={orgSettings.timezone}
        baseUrl={baseUrl}
      />

      <div style={{ marginTop: 32, maxWidth: 900 }}>
        <TicketTypesSection
          eventId={event.id}
          initialTicketTypes={ticketTypes.map((t) => ({
            id: t.id,
            name: t.name,
            quantity: t.quantity,
            price: t.price,
            bookingFee: t.bookingFee,
            description: t.description ?? "",
            status: t.status,
            minPerOrder: t.minPerOrder,
            maxPerOrder: t.maxPerOrder,
            issuance: t.issuance,
            hideUntil: t.hideUntil ? t.hideUntil.toISOString() : null,
            hideAfter: t.hideAfter ? t.hideAfter.toISOString() : null,
            hideWhenSoldOut: t.hideWhenSoldOut,
            showRemainingOnPage: t.showRemainingOnPage,
            excludeFromLowestPrice: t.excludeFromLowestPrice,
          }))}
        />
      </div>
    </div>
  );
}
