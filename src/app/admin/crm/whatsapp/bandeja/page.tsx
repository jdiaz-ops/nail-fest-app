// The right pane's empty state — shown at /bandeja itself, before a
// conversation is picked from the list that now lives in layout.tsx. The
// list, its filters and its data used to live here; see git history
// (this file, pre-split-view) if that's ever needed again.
export default function WhatsAppBandejaEmptyPage() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        color: "#8a8478",
        textAlign: "center",
        padding: 24,
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 600, color: "#5b5f6b", margin: 0 }}>Selecciona una conversación</p>
      <p style={{ fontSize: 13, maxWidth: 280, margin: 0 }}>
        Elegí un chat de la lista a la izquierda para ver los mensajes y responder.
      </p>
    </div>
  );
}
