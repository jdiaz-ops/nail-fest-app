"use client";

import { useState } from "react";

interface Props {
  events: { slug: string; name: string }[];
  professionOptions: string[];
}

export default function BroadcastComposer({ events, professionOptions }: Props) {
  const [includeEvent, setIncludeEvent] = useState("");
  const [includeAttended, setIncludeAttended] = useState("");
  const [includeCity, setIncludeCity] = useState("");
  const [includeProfession, setIncludeProfession] = useState("");
  const [excludeEvent, setExcludeEvent] = useState("");
  const [excludeAttended, setExcludeAttended] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);

    const include = [
      includeEvent ? { field: "event", eventSlug: includeEvent } : null,
      includeAttended ? { field: "attended", eventSlug: includeAttended } : null,
      includeCity ? { field: "city", city: includeCity } : null,
      includeProfession ? { field: "profession", profession: includeProfession } : null,
    ].filter(Boolean);
    const exclude = [
      excludeEvent ? { field: "event", eventSlug: excludeEvent } : null,
      excludeAttended ? { field: "attended", eventSlug: excludeAttended } : null,
    ].filter(Boolean);

    const res = await fetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subject,
        filter: { include, exclude },
        subject,
        bodyText,
      }),
    });
    const body = await res.json();
    setSending(false);
    if (res.ok) {
      setResult(
        `Enviado a ${body.sent} de ${body.segmentSize} en el segmento (${body.skippedNoConsent} sin consentimiento de marketing, no recibieron nada).`
      );
    } else {
      setResult("Error al enviar — revisa la consola.");
    }
  }

  return (
    <form onSubmit={handleSend} style={{ maxWidth: 520 }}>
      <h2>Nuevo broadcast</h2>

      <fieldset style={{ marginBottom: 16, border: "1px solid #e3e1dc", borderRadius: 8, padding: 12 }}>
        <legend>Segmento</legend>

        <div className="field">
          <label>Incluir: registrados a este evento</label>
          <select value={includeEvent} onChange={(e) => setIncludeEvent(e.target.value)}>
            <option value="">(cualquiera)</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Incluir: asistió (check-in real) a este evento</label>
          <select value={includeAttended} onChange={(e) => setIncludeAttended(e.target.value)}>
            <option value="">(cualquiera)</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Incluir: ciudad</label>
          <input value={includeCity} onChange={(e) => setIncludeCity(e.target.value)} placeholder="Bogotá" />
        </div>

        <div className="field">
          <label>Incluir: profesión</label>
          <select value={includeProfession} onChange={(e) => setIncludeProfession(e.target.value)}>
            <option value="">(cualquiera)</option>
            {professionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Excluir: registrados a este evento</label>
          <select value={excludeEvent} onChange={(e) => setExcludeEvent(e.target.value)}>
            <option value="">(ninguno)</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Excluir: asistió (check-in real) a este evento</label>
          <select value={excludeAttended} onChange={(e) => setExcludeAttended(e.target.value)}>
            <option value="">(ninguno)</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: 12, color: "#5b5f6b" }}>
          Ej: profesión = Manicurista, excluir asistió = Cali 2025 → &quot;manicuristas que no
          fueron a Cali 2025&quot; (usa asistencia real, no solo registro). Solo recibe quien dio
          consentimiento de marketing.
        </p>
      </fieldset>

      <div className="field">
        <label>Asunto</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div className="field">
        <label>Cuerpo</label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={6}
          required
          style={{ padding: 10, border: "1px solid #e3e1dc", borderRadius: 8 }}
        />
      </div>

      <button className="primary" type="submit" disabled={sending}>
        {sending ? "Enviando..." : "Enviar broadcast"}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </form>
  );
}
