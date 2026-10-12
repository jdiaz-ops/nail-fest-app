"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface RaffleWinnerRow {
  kind: "WINNER" | "BACKUP";
  position: number;
  personName: string;
  phone: string | null;
  message: string;
}

// The per-event sorteo: its terms (editable until drawn), the draw button,
// and afterwards the acta with each winner's prepared WhatsApp text. The
// app never sends these messages — the admin copies them.
export default function RaffleBox({
  eventId,
  prizeCount,
  prizeLabel,
  closesAtInput,
  closesLabel,
  drawnLabel,
  participants,
  optIns,
  winners,
  isAdmin,
}: {
  eventId: string;
  prizeCount: number;
  prizeLabel: string;
  closesAtInput: string; // datetime-local value in the org timezone
  closesLabel: string;
  drawnLabel: string | null;
  participants: number | null;
  optIns: number;
  winners: RaffleWinnerRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(prizeCount);
  const [label, setLabel] = useState(prizeLabel);
  const [closes, setCloses] = useState(closesAtInput);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/admin/events/${eventId}/resenas/sorteo`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prizeCount: count, prizeLabel: label, closesAt: new Date(closes).toISOString() }) });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Guardado." : body.error || "No se pudo guardar.");
    if (res.ok) router.refresh();
  }

  async function draw() {
    if (!confirm(`¿Hacer el sorteo ahora? Se eligen ${count} ganadoras y ${count} suplentes entre ${optIns} participantes. No se puede repetir.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/events/${eventId}/resenas/sorteo`, { method: "POST" });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error || "No se pudo hacer el sorteo.");
      return;
    }
    router.refresh();
  }

  return (
    <section style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>Sorteo entre las reseñas</div>
      {drawnLabel ? (
        <>
          <div style={{ fontSize: 12.5, color: "#5b5f6b", lineHeight: 1.5 }}>
            Hecho el {drawnLabel} entre {participants ?? 0} participantes · {prizeCount} {prizeLabel}. El acta quedó guardada con su semilla.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {winners.map((w) => (
              <div key={`${w.kind}-${w.position}`} style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{w.kind === "WINNER" ? `Ganadora ${w.position}` : `Suplente ${w.position}`}</strong> · {w.personName}
                  {w.phone ? ` · ${w.phone}` : ""}
                </div>
                <textarea readOnly value={w.message} rows={3} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, border: "1px solid #e3e1dc", borderRadius: 8, padding: 8, font: "inherit" }} />
                <button type="button" onClick={() => navigator.clipboard?.writeText(w.message)} style={{ alignSelf: "flex-start", height: 32, padding: "0 12px", border: "1px solid #e3e1dc", borderRadius: 8, background: "#fff", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Copiar mensaje
                </button>
              </div>
            ))}
            {winners.length === 0 && <div style={{ fontSize: 12.5, color: "#5b5f6b" }}>Nadie había marcado participar.</div>}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: "#5b5f6b", lineHeight: 1.5 }}>
            {optIns} {optIns === 1 ? "reseña marcó" : "reseñas marcaron"} participar · cierra el {closesLabel}. Participa toda reseña enviada a tiempo, sin importar la calificación.
          </div>
          {isAdmin && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "flex", flexDirection: "column", gap: 4 }}>
                Premios
                <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ height: 36, border: "1px solid #e3e1dc", borderRadius: 8, padding: "0 10px", font: "inherit" }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, display: "flex", flexDirection: "column", gap: 4 }}>
                Qué se gana
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={{ height: 36, border: "1px solid #e3e1dc", borderRadius: 8, padding: "0 10px", font: "inherit" }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                Cierra (hora Bogotá)
                <input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} style={{ height: 36, border: "1px solid #e3e1dc", borderRadius: 8, padding: "0 10px", font: "inherit" }} />
              </label>
              <button type="button" onClick={save} disabled={busy} style={{ height: 36, border: "1px solid #e3e1dc", borderRadius: 9, background: "#fff", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Guardar términos
              </button>
              <button type="button" onClick={draw} disabled={busy || optIns === 0} style={{ height: 36, border: "none", borderRadius: 9, background: optIns === 0 ? "#e8e6e1" : "#0b2e2c", color: optIns === 0 ? "#8a8478" : "#fff", font: "inherit", fontSize: 13, fontWeight: 700, cursor: optIns === 0 ? "default" : "pointer" }}>
                Hacer el sorteo ahora
              </button>
            </div>
          )}
        </>
      )}
      {msg && <div style={{ fontSize: 12, color: "#5b5f6b" }}>{msg}</div>}
    </section>
  );
}
