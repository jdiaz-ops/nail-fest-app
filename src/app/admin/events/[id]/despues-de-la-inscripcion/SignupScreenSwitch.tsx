"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// On or off: Nail Fest's own screen right after signing up, for this event
// (2026-10-30). Off, everyone keeps seeing the usual one.
export default function SignupScreenSwitch({ eventId, on }: { eventId: string; on: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(next: boolean) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/events/${eventId}/signup-screen`, {
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
        {on ? "Encendida" : "Apagada"}
      </span>
      <span style={{ flex: 1, minWidth: 220, fontSize: 13.5, color: "#3a3d45" }}>
        {on
          ? "Quien se inscribe ve esta pantalla, con su entrada y el código QR ahí mismo."
          : "Quien se inscribe todavía ve la pantalla de siempre. Así se vería esta:"}
      </span>
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
