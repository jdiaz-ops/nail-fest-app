"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The name this event's emails come from, as the inbox shows it (the team, 2026-11-04: «deja una casilla… para ver
// cuál está configurado»): the one it has now, to see and to change — all its emails, from the next one on.
export default function SenderNameField({ eventId, name, fallback, address }: { eventId: string; name: string; fallback: string; address: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = value.trim() !== name;

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/events/${eventId}/remitente`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });
    const answer = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ ok: false, text: answer.message ?? "No se pudo guardar." });
      return;
    }
    setValue(answer.name ?? value);
    setMessage({ ok: true, text: "Guardado. Los próximos correos salen con este nombre." });
    router.refresh();
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: "12px 16px", margin: "0 0 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label htmlFor="remitente" style={{ fontSize: 14, fontWeight: 700 }}>
          Nombre del remitente
        </label>
        <input
          id="remitente"
          value={value}
          maxLength={80}
          placeholder={fallback}
          onChange={(e) => setValue(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: "8px 10px", fontSize: 14 }}
        />
        <button type="button" className="primary" disabled={busy || !changed} onClick={() => void save()} style={{ width: "auto", padding: "8px 16px", fontSize: 13.5 }}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "#5b5f6b" }}>
        Así aparece en la bandeja de entrada:{" "}
        <b style={{ color: "#1a1a1a" }}>
          {value.trim() || fallback}
          {address ? ` <${address}>` : ""}
        </b>
        . Vale para todos los correos de este evento: la confirmación, los correos del evento, el de cierre y sus pruebas. Si lo dejas vacío, sale «{fallback}».
      </p>
      {message && <p style={{ margin: "6px 0 0", fontSize: 13, color: message.ok ? "#1f7a4d" : "#c2185b" }}>{message.text}</p>}
    </div>
  );
}
