"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Meta" — the admin's own targets for an event (see Event.goalRegistrations
// & co.) and, org-wide, who gets the Monday briefing. Saved through
// /api/admin/events/[id]/goals and /api/admin/settings; the report page
// re-renders with the new goal on save.

interface Props {
  eventId: string;
  goalRegistrations: number | null;
  goalAttendance: number | null;
  referenceEventId: string | null;
  referenceOptions: { id: string; name: string }[];
  briefingEmails: string[];
}

export default function GoalsForm(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(props.goalRegistrations == null && props.goalAttendance == null);
  const [goalRegistrations, setGoalRegistrations] = useState(props.goalRegistrations?.toString() ?? "");
  const [goalAttendance, setGoalAttendance] = useState(props.goalAttendance?.toString() ?? "");
  const [referenceEventId, setReferenceEventId] = useState(props.referenceEventId ?? "");
  const [briefingEmails, setBriefingEmails] = useState(props.briefingEmails.join(", "));
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toInt = (v: string) => (v.trim() ? Number(v.replace(/\D/g, "")) || null : null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const emails = briefingEmails.split(/[,\s;]+/).map((e) => e.trim()).filter(Boolean);
    const [a, b] = await Promise.all([
      fetch(`/api/admin/events/${props.eventId}/goals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalRegistrations: toInt(goalRegistrations), goalAttendance: toInt(goalAttendance), referenceEventId: referenceEventId || null }),
      }),
      fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ briefingEmails: emails }) }),
    ]);
    setSaving(false);
    if (a.ok && b.ok) {
      setMsg("Guardado ✓");
      setOpen(false);
      router.refresh();
    } else {
      setMsg(!b.ok ? "No se pudo guardar — revisa que los correos del briefing sean válidos." : "No se pudo guardar la meta.");
    }
  }

  async function sendTest() {
    setSendingTest(true);
    setMsg(null);
    const res = await fetch(`/api/reports/weekly-briefing?eventId=${props.eventId}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setSendingTest(false);
    setMsg(res.ok ? `Briefing enviado a ${body.sentTo?.join(", ") || "nadie — agrega un correo arriba y guarda"}.` : "No se pudo enviar el briefing.");
  }

  const input: React.CSSProperties = { maxWidth: 160 };

  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, background: "#fff", padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Meta del evento</strong>
        <span style={{ fontSize: 13, color: "#5b5f6b" }}>
          {props.goalRegistrations ? `${props.goalRegistrations.toLocaleString("es-CO")} inscritos` : "sin meta de inscritos"}
          {" · "}
          {props.goalAttendance ? `${props.goalAttendance.toLocaleString("es-CO")} en puerta` : "sin meta de puerta"}
          {props.referenceEventId && ` · referencia: ${props.referenceOptions.find((o) => o.id === props.referenceEventId)?.name ?? "—"}`}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="secondary" style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 13, width: "auto" }}>
          {open ? "Cerrar" : "Editar"}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Meta de inscritos</label>
              <input inputMode="numeric" value={goalRegistrations} onChange={(e) => setGoalRegistrations(e.target.value)} placeholder="8000" style={input} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Meta en puerta (entradas)</label>
              <input inputMode="numeric" value={goalAttendance} onChange={(e) => setGoalAttendance(e.target.value)} placeholder="2000" style={input} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Evento de referencia (escenario base)</label>
              <select value={referenceEventId} onChange={(e) => setReferenceEventId(e.target.value)}>
                <option value="">Automático (el del medio)</option>
                {props.referenceOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Briefing semanal — correos (todos los eventos, separados por coma)</label>
            <input value={briefingEmails} onChange={(e) => setBriefingEmails(e.target.value)} placeholder="tu@correo.com, socio@correo.com" />
            <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
              Cada lunes a las 8 a. m. llega un resumen por evento próximo: inscritos de la semana, ritmo, proyección, puerta y una acción
              sugerida.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="primary" onClick={save} disabled={saving} style={{ width: "auto", padding: "8px 18px" }}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="secondary" onClick={sendTest} disabled={sendingTest} style={{ width: "auto", padding: "8px 14px" }}>
              {sendingTest ? "Enviando…" : "Enviarme el briefing ahora (prueba)"}
            </button>
          </div>
        </div>
      )}
      {msg && <p style={{ fontSize: 13, margin: "8px 0 0" }}>{msg}</p>}
    </div>
  );
}
