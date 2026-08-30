"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SegmentOption {
  id: string;
  name: string;
  memberCount: number;
}

interface TemplateOption {
  id: string;
  name: string;
  language: string;
  status: string;
  bodyText: string | null;
  variableCount: number;
}

interface MergeTagOption {
  key: string;
  label: string;
}

interface Props {
  segments: SegmentOption[];
  templates: TemplateOption[];
  mergeTags: MergeTagOption[];
}

// Same "pick an existing named segment, never a one-off filter" posture
// as BroadcastComposer.tsx (email) — see that component's own comment.
// The one real difference from email: no free-text body — a WhatsApp
// broadcast MUST use a pre-approved template, so this maps merge tags
// onto the template's {{1}}, {{2}}, ... variables instead of writing copy.
export default function WhatsAppBroadcastComposer({ segments, templates, mergeTags }: Props) {
  const router = useRouter();
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(approvedTemplates[0]?.id ?? "");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const selectedSegment = segments.find((s) => s.id === segmentId);
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const variableSlots = useMemo(
    () => (selectedTemplate ? Array.from({ length: selectedTemplate.variableCount }, (_, i) => String(i + 1)) : []),
    [selectedTemplate]
  );

  const preview = useMemo(() => {
    if (!selectedTemplate?.bodyText) return null;
    let text = selectedTemplate.bodyText;
    for (const slot of variableSlots) {
      const tag = mergeTags.find((m) => m.key === mapping[slot]);
      text = text.split(`{{${slot}}}`).join(tag ? `[${tag.label}]` : `{{${slot}}}`);
    }
    return text;
  }, [selectedTemplate, variableSlots, mapping, mergeTags]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);

    const res = await fetch("/api/admin/whatsapp/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segmentId, templateId, variableMapping: mapping }),
    });
    const body = await res.json();
    setSending(false);
    if (res.ok) {
      setResult(
        `Enviado a ${body.sent} de ${selectedSegment?.memberCount ?? "?"} en el segmento (${body.skippedNoConsent} sin consentimiento de WhatsApp, ${body.skippedNoPhone} sin celular, ${body.failed} fallidos).`
      );
      router.refresh();
    } else {
      setResult(`Error al enviar: ${body?.error ?? "revisa la consola"}`);
    }
  }

  if (segments.length === 0) {
    return (
      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 24, maxWidth: 900 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Nueva difusión</h2>
        <p style={{ color: "#5b5f6b", marginBottom: 0 }}>
          Todavía no tienes ningún segmento guardado — primero <Link href="/admin/crm/segments">créalo en Segmentos</Link>.
        </p>
      </div>
    );
  }

  if (approvedTemplates.length === 0) {
    return (
      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 24, maxWidth: 900 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Nueva difusión</h2>
        <p style={{ color: "#5b5f6b", marginBottom: 0 }}>
          Todavía no hay ninguna plantilla <strong>aprobada</strong> — créala en el WhatsApp Manager de Meta y luego
          sincronízala en <Link href="/admin/crm/whatsapp/plantillas">Plantillas</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 16 }}>Nueva difusión</h2>

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
          Solo recibe quien dio consentimiento de WhatsApp y tiene celular registrado.
        </p>
      </div>

      <div className="field">
        <label htmlFor="templateId">Plantilla (aprobada en Meta)</label>
        <select id="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
          {approvedTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.language})
            </option>
          ))}
        </select>
      </div>

      {variableSlots.length > 0 && (
        <div style={{ border: "1px solid #e3e1dc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>Variables de la plantilla</p>
          {variableSlots.map((slot) => (
            <div className="field" key={slot}>
              <label htmlFor={`var_${slot}`}>{`{{${slot}}}`}</label>
              <select
                id={`var_${slot}`}
                value={mapping[slot] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [slot]: e.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecciona un campo
                </option>
                {mergeTags.map((tag) => (
                  <option key={tag.key} value={tag.key}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div style={{ background: "#f6f5f2", borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 14, whiteSpace: "pre-wrap" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#5b5f6b", margin: "0 0 6px" }}>Vista previa</p>
          {preview}
        </div>
      )}

      <button className="primary" type="submit" disabled={sending} style={{ width: "auto", padding: "10px 24px" }}>
        {sending ? "Enviando..." : "Enviar difusión"}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </form>
  );
}
