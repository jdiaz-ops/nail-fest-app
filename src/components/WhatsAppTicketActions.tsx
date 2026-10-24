import WhatsAppSendTicketButton from "./WhatsAppSendTicketButton";
import WhatsAppSendZoomLinkButton from "./WhatsAppSendZoomLinkButton";
import RegistrationEditionToggle from "./RegistrationEditionToggle";

export interface TicketActionRegistration {
  id: string;
  eventName: string;
  ticketCount: number;
  /** Set when the registration belongs to another CRM contact with this
   * same phone (registered again with another email) — say whose it is. */
  ownerEmail: string | null;
  showZoomLink: boolean;
  /** Its event is still ahead: "Retirar de esta edición" ("in"), or
   * "Deshacer" ("out", nothing to resend then) — see
   * lib/registrationWithdrawal.ts. */
  edition: { state: "in" | "out"; withdrawnBy: string | null } | null;
}

// "Me regala nuevamente la boleta": the resend buttons right above the
// composer, where a phone can see them — the CRM's desktop sidebar is
// hidden on a phone and the scan app has no sidebar at all. "No puedo
// ir" gets its one tap here too. Renders nothing when the chat has no
// registration to show.
export default function WhatsAppTicketActions({ conversationId, withinWindow, registrations }: { conversationId: string; withinWindow: boolean; registrations: TicketActionRegistration[] }) {
  if (registrations.length === 0) return null;
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10, background: "#faf9f7" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Entradas</div>
      {!withinWindow && registrations.some((r) => r.edition?.state !== "out") && (
        <p style={{ fontSize: 12, color: "#8a5a1f", margin: 0 }}>Ventana cerrada: para reenviar la entrada, primero reabre la conversación con una plantilla (abajo) y espera su respuesta.</p>
      )}
      {registrations.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, minWidth: 0 }}>
            {r.eventName}
            {r.ticketCount > 1 ? ` · ${r.ticketCount} boletas` : ""}
            {r.ownerEmail && <span style={{ color: "#8a5a1f" }}> · a nombre de {r.ownerEmail}</span>}
          </span>
          {((withinWindow && r.edition?.state !== "out") || r.edition) && (
            <span style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
              {withinWindow && r.edition?.state !== "out" && (
                <>
                  <WhatsAppSendTicketButton conversationId={conversationId} registrationId={r.id} />
                  {r.showZoomLink && <WhatsAppSendZoomLinkButton conversationId={conversationId} registrationId={r.id} />}
                </>
              )}
              {r.edition && <RegistrationEditionToggle registrationId={r.id} state={r.edition.state} withdrawnBy={r.edition.withdrawnBy} conversationId={conversationId} />}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
