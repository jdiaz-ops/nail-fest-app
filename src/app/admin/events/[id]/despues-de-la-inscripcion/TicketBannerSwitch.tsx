"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// On or off: Manicuristas Imparables' banner on this event's tickets
// (2026-11-04). Off for every event until the team turns it on; on, it
// shows only while the congress's sales are open.
export default function TicketBannerSwitch({ eventId, on, open }: { eventId: string; on: boolean; open: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(next: boolean) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/events/${eventId}/banner-imparables`, {
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

  const line = !open
    ? on
      ? "Encendido, pero hoy no hay venta de Manicuristas Imparables abierta: no sale en ninguna entrada."
      : "Hoy no hay venta de Manicuristas Imparables abierta: aunque lo enciendas, no sale."
    : on
      ? `Sale abajo en las entradas de este evento, en todos los correos que las llevan, hasta que cierre la venta de Manicuristas Imparables (${open}).`
      : "Las entradas de este evento salen sin el banner. Así se verían con él:";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: "#fff",
        border: "1px solid #e3e1dc",
        borderRadius: 12,
        padding: "12px 16px",
        margin: "0 0 14px",
        maxWidth: 660,
      }}
    >
      <b style={{ width: "100%", fontSize: 14 }}>Banner de Manicuristas Imparables en la entrada</b>
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
      <span style={{ flex: 1, minWidth: 220, fontSize: 13.5, color: "#3a3d45" }}>{line}</span>
      <button
        type="button"
        className={on ? "secondary" : "primary"}
        disabled={busy}
        onClick={() => void send(!on)}
        style={{ width: "auto", padding: "8px 16px", fontSize: 13.5 }}
      >
        {busy ? "Guardando…" : on ? "Apagar" : "Encender"}
      </button>
      {message && <p style={{ width: "100%", margin: 0, fontSize: 13, color: "#c2185b" }}>{message}</p>}
    </div>
  );
}
