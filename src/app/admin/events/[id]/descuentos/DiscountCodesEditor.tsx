"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pesos } from "@/lib/imparables/stages";

export interface DiscountCodeRow {
  id: string;
  code: string;
  label: string;
  ticketTypeName: string | null;
  maxUses: number | null;
  uses: number;
  discountedCents: number;
  expires: string | null;
  expired: boolean;
  active: boolean;
  note: string | null;
}

const ERRORS: Record<string, string> = {
  invalid_code: "El código va de 3 a 30 letras o números, sin espacios (se guarda en mayúsculas).",
  percent_too_big: "El porcentaje va de 1 a 95.",
  amount_too_small: "El monto va desde $1.000.",
  code_taken: "Ese código ya existe en este evento.",
  invalid_ticket_type: "Esa entrada no es de este evento.",
};

// /admin/events/[id]/descuentos: create a code, see each one's uses, turn
// one off or back on.
export default function DiscountCodesEditor({ eventId, ticketTypes, codes }: { eventId: string; ticketTypes: { id: string; name: string }[]; codes: DiscountCodeRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", kind: "percent", value: "", ticketTypeId: "", maxUses: "", expiresOn: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/events/${eventId}/discount-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        kind: form.kind,
        value: Number(form.value),
        ticketTypeId: form.ticketTypeId || null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiresOn: form.expiresOn || null,
        note: form.note || null,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(ERRORS[body?.error] ?? "No se pudo crear el código. Revisa los datos.");
      return;
    }
    setForm({ code: "", kind: form.kind, value: "", ticketTypeId: "", maxUses: "", expiresOn: "", note: "" });
    router.refresh();
  }

  async function toggle(row: DiscountCodeRow) {
    await fetch(`/api/admin/events/${eventId}/discount-codes/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    }).catch(() => null);
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Códigos de descuento</h1>
      <p style={{ color: "#5b5f6b", fontSize: 14, margin: "0 0 20px" }}>
        Se escriben en el checkout del evento. Un código cuenta como usado solo cuando el pago se aprueba.
      </p>

      <form onSubmit={create} style={{ border: "1px solid #e3e1dc", borderRadius: 12, padding: 16, marginBottom: 24, background: "#fff" }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Nuevo código</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 14px" }}>
          <div className="field">
            <label htmlFor="dc-code">Código</label>
            <input id="dc-code" value={form.code} onChange={set("code")} placeholder="IMPARABLE10" required style={{ textTransform: "uppercase" }} />
          </div>
          <div className="field">
            <label htmlFor="dc-kind">Tipo</label>
            <select id="dc-kind" value={form.kind} onChange={set("kind")}>
              <option value="percent">Porcentaje</option>
              <option value="amount">Monto fijo (COP)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="dc-value">{form.kind === "percent" ? "Porcentaje (1–95)" : "Monto en pesos"}</label>
            <input id="dc-value" type="number" min={1} value={form.value} onChange={set("value")} placeholder={form.kind === "percent" ? "10" : "20000"} required />
          </div>
          <div className="field">
            <label htmlFor="dc-ticket">Entrada</label>
            <select id="dc-ticket" value={form.ticketTypeId} onChange={set("ticketTypeId")}>
              <option value="">Cualquiera del evento</option>
              {ticketTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dc-max">Máximo de usos (opcional)</label>
            <input id="dc-max" type="number" min={1} value={form.maxUses} onChange={set("maxUses")} placeholder="Sin límite" />
          </div>
          <div className="field">
            <label htmlFor="dc-exp">Vence (opcional)</label>
            <input id="dc-exp" type="date" value={form.expiresOn} onChange={set("expiresOn")} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="dc-note">Nota interna (opcional)</label>
          <input id="dc-note" value={form.note} onChange={set("note")} placeholder="Ej.: influencer @..., campaña de mayo" maxLength={120} />
        </div>
        {error && <p style={{ color: "#a3251f", fontSize: 14, margin: "0 0 12px" }}>{error}</p>}
        <button type="submit" className="primary" disabled={saving} style={{ width: "auto", padding: "10px 20px" }}>
          {saving ? "Creando…" : "Crear código"}
        </button>
      </form>

      {codes.length === 0 ? (
        <p style={{ color: "#5b5f6b" }}>Este evento todavía no tiene códigos.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#5b5f6b", borderBottom: "1px solid #e3e1dc" }}>
                <th style={{ padding: "8px 10px" }}>Código</th>
                <th style={{ padding: "8px 10px" }}>Descuento</th>
                <th style={{ padding: "8px 10px" }}>Entrada</th>
                <th style={{ padding: "8px 10px" }}>Usos</th>
                <th style={{ padding: "8px 10px" }}>Descontado</th>
                <th style={{ padding: "8px 10px" }}>Vence</th>
                <th style={{ padding: "8px 10px" }} />
              </tr>
            </thead>
            <tbody>
              {codes.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #eeece8", opacity: row.active && !row.expired ? 1 : 0.55 }}>
                  <td style={{ padding: "10px", fontWeight: 700, letterSpacing: "0.04em" }}>
                    {row.code}
                    {row.note && <div style={{ fontWeight: 400, letterSpacing: 0, fontSize: 12.5, color: "#5b5f6b" }}>{row.note}</div>}
                  </td>
                  <td style={{ padding: "10px" }}>{row.label}</td>
                  <td style={{ padding: "10px" }}>{row.ticketTypeName ?? "Cualquiera"}</td>
                  <td style={{ padding: "10px", fontVariantNumeric: "tabular-nums" }}>
                    {row.uses}
                    {row.maxUses != null ? ` / ${row.maxUses}` : ""}
                  </td>
                  <td style={{ padding: "10px", fontVariantNumeric: "tabular-nums" }}>{pesos(row.discountedCents / 100)}</td>
                  <td style={{ padding: "10px" }}>{row.expires ? `${row.expires}${row.expired ? " (vencido)" : ""}` : "—"}</td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    <button type="button" className="secondary" onClick={() => toggle(row)} style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}>
                      {row.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
