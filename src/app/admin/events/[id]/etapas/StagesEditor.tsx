"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pesos, type StageState } from "@/lib/imparables/stages";

export interface StageRow {
  id: string;
  name: string;
  price: number;
  cap: number | null;
  paid: number;
  /** As it reads ("18 abr 2027, 11:59 p. m."). */
  closesAt: string | null;
  /** For its input, in the account's time zone ("2027-04-18T23:59"). */
  closesAtInput: string;
  note: string;
  state: StageState;
}

export interface StageChangeRow {
  id: string;
  at: string;
  by: string;
  stage: string;
  field: string;
  before: string | null;
  after: string | null;
}

const STATE: Record<StageState, { label: string; color: string }> = {
  current: { label: "Activa", color: "#0b7a4b" },
  soldout: { label: "Cerrada por cupo", color: "#a3251f" },
  past: { label: "Cerrada por fecha", color: "#5b5f6b" },
  future: { label: "Pendiente", color: "#8a6a1f" },
};

const FIELD: Record<string, string> = { cap: "Cupo", closesAt: "Cierre", note: "Nota" };

const ERRORS: Record<string, string> = {
  invalid_cap: "El cupo es un número entero desde 1, o vacío para «sin cupo».",
  invalid_closes_at: "Revisa la fecha y hora de cierre.",
  not_found: "Esa etapa ya no existe.",
};

// /admin/events/[id]/etapas: each stage's numbers, and its cap, closing date
// and note to change — every change recorded with who and when.
export default function StagesEditor({ eventId, stages, changes }: { eventId: string; stages: StageRow[]; changes: StageChangeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ cap: "", closesAt: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function edit(row: StageRow) {
    setEditing(row.id);
    setError(null);
    setForm({ cap: row.cap === null ? "" : String(row.cap), closesAt: row.closesAtInput, note: row.note });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/events/${eventId}/etapas/${editing}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cap: form.cap.trim() ? Number(form.cap) : null, closesAt: form.closesAt, note: form.note }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(ERRORS[body?.error] ?? "No se pudo guardar. Revisa los datos.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  const cell = { padding: "10px" } as const;
  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Etapas de precio</h1>
      <p style={{ color: "#5b5f6b", fontSize: 14, margin: "0 0 20px" }}>
        Se vende la primera etapa, en orden, que no haya llegado a su fecha de cierre ni a su cupo; sin ninguna, el precio full. Solo cuentan las compras
        pagadas, y una etapa que se agota queda cerrada aunque haya un reembolso.
      </p>

      {stages.length === 0 ? (
        <p style={{ color: "#5b5f6b" }}>Este evento no tiene etapas de precio.</p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#5b5f6b", borderBottom: "1px solid #e3e1dc" }}>
                <th style={{ padding: "8px 10px" }}>Etapa</th>
                <th style={{ padding: "8px 10px" }}>Precio</th>
                <th style={{ padding: "8px 10px" }}>Cupo</th>
                <th style={{ padding: "8px 10px" }}>Vendidas</th>
                <th style={{ padding: "8px 10px" }}>Restantes</th>
                <th style={{ padding: "8px 10px" }}>Cierre</th>
                <th style={{ padding: "8px 10px" }}>Estado</th>
                <th style={{ padding: "8px 10px" }} />
              </tr>
            </thead>
            <tbody>
              {stages.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #eeece8" }}>
                  <td style={{ ...cell, fontWeight: 700 }}>
                    {row.name}
                    {row.note && <div style={{ fontWeight: 400, fontSize: 12.5, color: "#5b5f6b" }}>{row.note}</div>}
                  </td>
                  <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{pesos(row.price)}</td>
                  <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{row.cap ?? "Sin cupo"}</td>
                  <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{row.paid}</td>
                  <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{row.cap === null ? "—" : Math.max(0, row.cap - row.paid)}</td>
                  <td style={cell}>{row.closesAt ?? "—"}</td>
                  <td style={{ ...cell, fontWeight: 700, color: STATE[row.state].color }}>{STATE[row.state].label}</td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    <button type="button" className="secondary" onClick={() => edit(row)} style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <form onSubmit={save} style={{ border: "1px solid #e3e1dc", borderRadius: 12, padding: 16, marginBottom: 28, background: "#fff" }}>
          <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>{stages.find((s) => s.id === editing)?.name}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 14px" }}>
            <div className="field">
              <label htmlFor="st-cap">Cupo (vacío: sin cupo)</label>
              <input id="st-cap" type="number" min={1} value={form.cap} onChange={(e) => setForm((f) => ({ ...f, cap: e.target.value }))} placeholder="Sin cupo" />
            </div>
            <div className="field">
              <label htmlFor="st-closes">Cierre (hora Colombia)</label>
              <input id="st-closes" type="datetime-local" value={form.closesAt} onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="st-note">Nota después de la fecha (opcional)</label>
            <input id="st-note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="cierre de Nail Fest Cali" maxLength={80} />
          </div>
          {error && <p style={{ color: "#a3251f", fontSize: 14, margin: "0 0 12px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="primary" disabled={saving} style={{ width: "auto", padding: "10px 20px" }}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="secondary" onClick={() => setEditing(null)} style={{ width: "auto", padding: "10px 20px" }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Cambios</h2>
      {changes.length === 0 ? (
        <p style={{ color: "#5b5f6b", fontSize: 14 }}>Todavía nadie ha cambiado una etapa desde aquí.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 14 }}>
          {changes.map((c) => (
            <li key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #eeece8" }}>
              <span style={{ color: "#5b5f6b" }}>
                {c.at} · {c.by} ·{" "}
              </span>
              <b>{c.stage}</b> · {FIELD[c.field] ?? c.field}: {c.before || "—"} → {c.after || "—"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
