"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";

type ScheduleKind = "IMMEDIATE" | "AT_DATETIME" | "BEFORE_EVENT_START" | "AFTER_EVENT_END";

const UNIT_TO_MINUTES: Record<"minutos" | "horas" | "días", number> = { minutos: 1, horas: 60, días: 1440 };

type EditingBroadcast = {
  id: string;
  ticketTypeId: string | null;
  subject: string;
  bodyHtml: string;
  attachTicketPdf: boolean;
  scheduleKind: ScheduleKind;
  scheduledAt: string | null; // ISO, or null when scheduleKind isn't AT_DATETIME
  scheduleOffsetMinutes: number | null;
};

// Inverse of `new Date(scheduledAtLocal)` in handleSubmit below — that
// call treats a bare "YYYY-MM-DDTHH:mm" string as the BROWSER's own
// local time (no timezone in the string), so pre-filling from a stored
// UTC instant has to use the browser's local Date getters too, not
// OrgSettings' timezone (a different admin's browser, or a device set
// to a different zone than the org's, would otherwise see the wrong
// time — and re-saving without touching this field would silently
// shift it).
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Inverse of `offsetValue * UNIT_TO_MINUTES[offsetUnit]` in handleSubmit
// — only the total minutes are persisted, so pre-filling the two-field
// value+unit picker has to pick back the largest whole unit that
// reconstructs it exactly (an admin who set "2 días" shouldn't see "2880
// minutos" when they come back to edit).
function minutesToOffset(totalMinutes: number): { value: number; unit: "minutos" | "horas" | "días" } {
  if (totalMinutes > 0 && totalMinutes % 1440 === 0) return { value: totalMinutes / 1440, unit: "días" };
  if (totalMinutes > 0 && totalMinutes % 60 === 0) return { value: totalMinutes / 60, unit: "horas" };
  return { value: totalMinutes, unit: "minutos" };
}

export default function EventBroadcastComposer({
  eventId,
  ticketTypes,
  allBuyersCount,
  initial,
  editing,
}: {
  eventId: string;
  ticketTypes: { id: string; name: string; count: number }[];
  allBuyersCount: number;
  // Set when this composer opened from "Duplicar" on an existing
  // broadcast (see the [id]/broadcasts list's own comment) — pre-fills
  // the form with that broadcast's content so the admin only has to
  // review/tweak it, not retype it. scheduleKind/scheduledAt are
  // deliberately NOT copied — this is always a brand-new send the admin
  // configures fresh (a stale scheduled date from the original wouldn't
  // make sense to inherit silently), same as the plain "new" case.
  initial?: { ticketTypeId: string | null; subject: string; bodyHtml: string; attachTicketPdf: boolean };
  // Set when this composer opened from "Editar" on an existing QUEUED
  // broadcast (see the list's own "Editar" link, shown only for QUEUED
  // rows). Unlike `initial`, this ALSO pre-fills the existing schedule
  // — a queued send's whole point is that its schedule might need
  // changing, e.g. the event's date moved — and switches submit to a
  // PATCH against that broadcast instead of creating a new one.
  // Mutually exclusive with `initial` — a composer is either plain-new,
  // a duplicate, or an edit, never two of those at once.
  editing?: EditingBroadcast;
}) {
  const router = useRouter();
  const [ticketTypeId, setTicketTypeId] = useState(editing?.ticketTypeId ?? initial?.ticketTypeId ?? "");
  const [subject, setSubject] = useState(editing?.subject ?? initial?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(editing?.bodyHtml ?? initial?.bodyHtml ?? "");
  const [attachTicketPdf, setAttachTicketPdf] = useState(editing?.attachTicketPdf ?? initial?.attachTicketPdf ?? false);
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>(editing?.scheduleKind ?? "IMMEDIATE");
  const [scheduledAtLocal, setScheduledAtLocal] = useState(
    editing?.scheduledAt ? toLocalInputValue(new Date(editing.scheduledAt)) : ""
  );
  const initialOffset = editing?.scheduleOffsetMinutes != null ? minutesToOffset(editing.scheduleOffsetMinutes) : null;
  const [offsetValue, setOffsetValue] = useState(initialOffset?.value ?? 2);
  const [offsetUnit, setOffsetUnit] = useState<"minutos" | "horas" | "días">(initialOffset?.unit ?? "horas");
  const [testTo, setTestTo] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipientCount = ticketTypeId ? ticketTypes.find((t) => t.id === ticketTypeId)?.count ?? 0 : allBuyersCount;

  async function handleSendTest() {
    if (!testTo.trim() || !subject.trim() || !bodyHtml.trim()) return;
    setTestSending(true);
    setTestMessage(null);
    const res = await fetch(`/api/admin/events/${eventId}/broadcasts/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, bodyHtml, to: testTo.split(",").map((s) => s.trim()).filter(Boolean) }),
    });
    const body = await res.json().catch(() => ({}));
    setTestSending(false);
    setTestMessage(res.ok && body.ok ? "Correo de prueba enviado." : "No se pudo enviar la prueba.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim() || !bodyHtml.trim()) {
      setError("Falta el asunto o el mensaje.");
      return;
    }
    setSending(true);
    const payload: Record<string, unknown> = {
      ticketTypeId: ticketTypeId || null,
      subject,
      bodyHtml,
      attachTicketPdf,
      scheduleKind,
    };
    if (scheduleKind === "AT_DATETIME") {
      if (!scheduledAtLocal) {
        setError("Elige una fecha y hora.");
        setSending(false);
        return;
      }
      payload.scheduledAt = new Date(scheduledAtLocal).toISOString();
    }
    if (scheduleKind === "BEFORE_EVENT_START" || scheduleKind === "AFTER_EVENT_END") {
      payload.scheduleOffsetMinutes = offsetValue * UNIT_TO_MINUTES[offsetUnit];
    }

    const url = editing ? `/api/admin/events/${eventId}/broadcasts/${editing.id}` : `/api/admin/events/${eventId}/broadcasts`;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      router.push(`/admin/events/${eventId}/broadcasts`);
      router.refresh();
    } else {
      setError(body.message || (editing ? "No se pudo guardar el correo — revisa los datos." : "No se pudo crear el broadcast — revisa los datos."));
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 700 }}>
      <div className="field">
        <label>Destinatarios</label>
        <select value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)}>
          <option value="">Todos los que compraron entrada ({allBuyersCount})</option>
          {ticketTypes.map((t) => (
            <option key={t.id} value={t.id}>
              Solo {t.name} ({t.count})
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
          Se enviará a {recipientCount} {recipientCount === 1 ? "persona" : "personas"} — es correo
          operativo del evento (mismo canal que la entrada), no requiere consentimiento de marketing.
        </p>
      </div>

      <div className="field">
        <label>Asunto</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>

      <div className="field">
        <label>Mensaje</label>
        <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
      </div>

      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={attachTicketPdf} onChange={(e) => setAttachTicketPdf(e.target.checked)} />
          <span>Adjuntar la entrada en PDF</span>
        </label>
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
          Cada destinatario recibe su propia entrada (con su código QR real), no un ejemplo genérico.
        </p>
        <a
          href="/api/admin/preview-ticket-pdf"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", fontSize: 13, marginTop: 6 }}
        >
          Ver ejemplo del PDF ↗
        </a>
      </div>

      <div className="field">
        <label>Enviar correo de prueba (separa varios con coma)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="tucorreo@ejemplo.com" style={{ flex: 1 }} />
          <button type="button" className="secondary" disabled={testSending} onClick={handleSendTest} style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
            {testSending ? "Enviando…" : "Enviar prueba"}
          </button>
        </div>
        {testMessage && <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>{testMessage}</p>}
      </div>

      <div className="field">
        <label>Enviar</label>
        <select value={scheduleKind} onChange={(e) => setScheduleKind(e.target.value as ScheduleKind)}>
          <option value="IMMEDIATE">Inmediatamente</option>
          <option value="AT_DATETIME">A una fecha y hora programada</option>
          <option value="BEFORE_EVENT_START">A un intervalo antes de que empiece el evento</option>
          <option value="AFTER_EVENT_END">A un intervalo después de que termine el evento</option>
        </select>
      </div>

      {scheduleKind === "AT_DATETIME" && (
        <div className="field">
          <label>Fecha y hora</label>
          <input type="datetime-local" value={scheduledAtLocal} onChange={(e) => setScheduledAtLocal(e.target.value)} required />
        </div>
      )}

      {(scheduleKind === "BEFORE_EVENT_START" || scheduleKind === "AFTER_EVENT_END") && (
        <div className="field">
          <label>{scheduleKind === "BEFORE_EVENT_START" ? "Cuánto antes" : "Cuánto después"}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              min={1}
              value={offsetValue}
              onChange={(e) => setOffsetValue(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 100 }}
            />
            <select value={offsetUnit} onChange={(e) => setOffsetUnit(e.target.value as typeof offsetUnit)}>
              <option value="minutos">minutos</option>
              <option value="horas">horas</option>
              <option value="días">días</option>
            </select>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#a3212b", fontSize: 13 }}>{error}</p>}

      <button className="primary" type="submit" disabled={sending} style={{ padding: "10px 24px", marginTop: 8 }}>
        {sending
          ? editing
            ? "Guardando…"
            : "Enviando…"
          : scheduleKind === "IMMEDIATE"
            ? "Enviar ahora"
            : editing
              ? "Guardar cambios"
              : "Programar envío"}
      </button>
    </form>
  );
}
