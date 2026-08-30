"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Borrar evento" — see lib/events.ts's deleteEvent for the real rule:
// only succeeds when the event never had a real registration. An event
// with real people always comes back as a 409 here with a clear reason
// instead of silently failing, so the admin knows to use Borrador
// (Estado) instead of trying to delete.
export default function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        "¿Borrar este evento? Esto es permanente — se pierde el evento, sus tipos de entrada y sus correos programados. Solo funciona si el evento nunca tuvo ninguna inscripción real."
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      router.push("/admin/events");
      router.refresh();
    } else if (res.status === 409 && body.message) {
      alert(body.message);
    } else {
      alert("No se pudo borrar el evento — intenta de nuevo.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "8px 12px",
        borderRadius: 8,
        fontSize: 14,
        border: "none",
        background: "transparent",
        color: "#a3212b",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Borrando…" : "Borrar evento"}
    </button>
  );
}
