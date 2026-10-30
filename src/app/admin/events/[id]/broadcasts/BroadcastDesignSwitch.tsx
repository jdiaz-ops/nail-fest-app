"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// On or off: Nail Fest's design for all of this event's emails (2026-10-30,
// Event.broadcastDesign) — from their next send, the scheduled ones too.
export default function BroadcastDesignSwitch({ eventId, on, nextPreview }: { eventId: string; on: boolean; nextPreview: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(next: boolean) {
    if (next && !confirm("Desde ahora, todos los correos de este evento salen con el diseño Nail Fest, también los que ya están programados. ¿Encenderlo?")) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/events/${eventId}/broadcast-design`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: next }),
    });
    const answer = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(answer.message ?? "No se pudo cambiar.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: "12px 16px", margin: "0 0 18px" }}>
      <strong style={{ fontSize: 14 }}>Diseño Nail Fest</strong>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: 999,
          color: on ? "#1f7a4d" : "#6b6f7a",
          background: on ? "#e6f4ec" : "#eceae6",
        }}
      >
        {on ? "Encendido" : "Apagado"}
      </span>
      <span style={{ flex: 1, minWidth: 240, fontSize: 13.5, color: "#3a3d45" }}>
        {on
          ? "Todos los correos de este evento salen con el diseño, también los programados."
          : "Los correos salen como siempre. Con el diseño, lo que ya escribiste se arma solo dentro del marco del evento."}
        {nextPreview && (
          <>
            {" "}
            <a href={nextPreview} target="_blank" rel="noreferrer">
              Ver el próximo con el diseño ↗
            </a>
          </>
        )}
      </span>
      <button type="button" className={on ? "secondary" : "primary"} disabled={busy} onClick={() => void send(!on)} style={{ width: "auto", padding: "8px 16px", fontSize: 13.5 }}>
        {busy ? "Guardando…" : on ? "Apagar" : "Encender"}
      </button>
      {message && <p style={{ width: "100%", margin: 0, fontSize: 13, color: "#c2185b" }}>{message}</p>}
    </div>
  );
}
