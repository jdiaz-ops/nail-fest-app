"use client";

import { useState } from "react";
import Link from "next/link";

interface SegmentOption {
  id: string;
  name: string;
  memberCount: number;
}

interface Props {
  segments: SegmentOption[];
}

// A broadcast targets an EXISTING, named segment from /admin/crm/segments
// — this used to have its own full copy of the Incluir/Excluir filter
// builder (duplicating SegmentComposer.tsx) and silently created a brand
// new, never-synced-to-Meta SegmentDefinition named after the email
// subject on every single send. Now it just picks one already-built,
// already Meta-synced segment — same audience-definition source of truth
// as the rest of the CRM.
export default function BroadcastComposer({ segments }: Props) {
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const selected = segments.find((s) => s.id === segmentId);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);

    const res = await fetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segmentId, subject, bodyText }),
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

  if (segments.length === 0) {
    return (
      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 24, maxWidth: 900 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Nuevo broadcast</h2>
        <p style={{ color: "#5b5f6b", marginBottom: 0 }}>
          Todavía no tienes ningún segmento guardado — un broadcast siempre envía a un segmento
          real (nunca a un filtro improvisado), así que primero{" "}
          <Link href="/admin/crm/segments">créalo en Segmentos</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 16 }}>Nuevo broadcast</h2>

      <div className="field">
        <label htmlFor="segmentId">Segmento</label>
        <select id="segmentId" value={segmentId} onChange={(e) => setSegmentId(e.target.value)} required>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.memberCount} {s.memberCount === 1 ? "persona" : "personas"}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
          {selected ? `${selected.memberCount} personas coinciden hoy con este segmento` : ""} — solo recibe
          quien dio consentimiento de marketing. ¿Necesitas otro filtro?{" "}
          <Link href="/admin/crm/segments">Créalo en Segmentos</Link>.
        </p>
      </div>

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
          style={{ padding: 10, border: "1px solid #e3e1dc", borderRadius: 8, width: "100%" }}
        />
      </div>

      <button className="primary" type="submit" disabled={sending} style={{ width: "auto", padding: "10px 24px" }}>
        {sending ? "Enviando..." : "Enviar broadcast"}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </form>
  );
}
