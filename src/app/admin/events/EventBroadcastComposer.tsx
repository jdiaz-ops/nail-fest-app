"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";

type ScheduleKind = "IMMEDIATE" | "AT_DATETIME" | "BEFORE_EVENT_START" | "AFTER_EVENT_END";

const UNIT_TO_MINUTES: Record<"minutos" | "horas" | "días", number> = { minutos: 1, horas: 60, días: 1440 };

export default function EventBroadcastComposer({
  eventId,
  ticketTypes,
  allBuyersCount,
}: {
  eventId: string;
  ticketTypes: { id: string; name: string; count: number }[];
  allBuyersCount: number;
}) {
  const router = useRouter();
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [attachTicketPdf, setAttachTicketPdf] = useState(false);
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>("IMMEDIATE");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [offsetValue, setOffsetValue] = useState(2);
  const [offsetUnit, setOffsetUnit] = useState<"minutos" | "horas" | "días">("horas");
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

    const res = await fetch(`/api/admin/events/${eventId}/broadcasts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      router.push(`/admin/events/${eventId}/broadcasts`);
      router.refresh();
    } else {
      setError(body.message || "No se pudo crear el broadcast — revisa los datos.");
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
          Se enviará a {recipientCount} {recipientCount === 1 ? "persona" : "personas"} — solo a quien dio
          consentimiento de marketing.
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
        {sending ? "Enviando…" : scheduleKind === "IMMEDIATE" ? "Enviar ahora" : "Programar envío"}
      </button>
    </form>
  );
}
