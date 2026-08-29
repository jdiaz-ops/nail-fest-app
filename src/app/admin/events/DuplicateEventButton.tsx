"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Copiar a nuevo evento" — see lib/events.ts's duplicateEvent for what
// gets copied. Lands the admin straight on the new (draft) event's own
// edit page — dates default to +7 days and need changing before they'd
// publish it anyway, so that's the first real thing to fix.
export default function DuplicateEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirm("¿Copiar este evento? Se crea un evento nuevo, en borrador, con la misma configuración y tipos de entrada — sin las inscripciones ni estadísticas, que empiezan en cero.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/events/${eventId}/duplicate`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && body.id) {
      router.push(`/admin/events/${body.id}/edit`);
    } else {
      alert("No se pudo copiar el evento — intenta de nuevo.");
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
        color: "#1c1310",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Copiando…" : "Copiar a nuevo evento"}
    </button>
  );
}
