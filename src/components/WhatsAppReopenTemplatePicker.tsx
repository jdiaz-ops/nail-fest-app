"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { renderTemplateBody } from "@/lib/whatsapp/templateText";

export interface ReopenTemplateOption {
  id: string;
  name: string;
  bodyText: string | null;
  variableCount: number;
  quickReplies: string[];
}

function initialVariables(template: ReopenTemplateOption | null, firstName: string): string[] {
  if (!template) return [];
  return Array.from({ length: template.variableCount }, (_, i) => (i === 0 ? firstName : ""));
}

// What the composer shows when Meta's 24h window is closed: pick an
// APPROVED template, fill its variables ({{1}} starts as the person's
// first name), see it rendered, send. The reply goes through
// /api/admin/whatsapp/conversations/[id]/send-template.
export default function WhatsAppReopenTemplatePicker({ conversationId, templates, firstName }: { conversationId: string; templates: ReopenTemplateOption[]; firstName: string }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((t) => t.id === templateId) ?? null;
  const [variables, setVariables] = useState<string[]>(() => initialVariables(template, firstName));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setVariables(initialVariables(template, firstName));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the inputs when the chosen template changes
  }, [templateId]);

  async function send() {
    if (!template) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/admin/whatsapp/conversations/${conversationId}/send-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: template.id, variables }),
    });
    setSending(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setSent(true);
      router.refresh();
      window.dispatchEvent(new Event("whatsapp-inbox-refresh"));
    } else {
      setError(body?.message ?? "No se pudo enviar la plantilla.");
    }
  }

  const inputStyle = { padding: "8px 10px", border: "1px solid #e3e1dc", borderRadius: 8, font: "inherit", fontSize: 13.5, background: "#fff" };

  return (
    <div style={{ background: "#fdf1e6", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#8a5a1f" }}>Ventana cerrada</div>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5b5f6b", lineHeight: 1.45 }}>
          Han pasado más de 24 h desde su último mensaje. WhatsApp solo deja reabrir la conversación con una plantilla aprobada; en cuanto responda, vuelves a poder escribirle libremente.
        </p>
      </div>

      {templates.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "#8a5a1f" }}>
          No hay ninguna plantilla aprobada para esto. Crea la plantilla de reapertura en <a href="/admin/crm/whatsapp/plantillas">Plantillas</a> (hay una sugerida lista para enviar a revisión).
        </p>
      ) : sent ? (
        <p style={{ margin: 0, fontSize: 13, color: "#0e6b4c", fontWeight: 600 }}>Plantilla enviada. Cuando la persona responda, la ventana se abre de nuevo.</p>
      ) : (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600 }}>
            Plantilla
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inputStyle}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {template && template.variableCount > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {variables.map((v, i) => (
                <label key={i} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600 }}>
                  {`Variable {{${i + 1}}}`}
                  <input value={v} onChange={(e) => setVariables((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} style={inputStyle} />
                </label>
              ))}
            </div>
          )}
          {template && (
            <div style={{ background: "#ffe4d1", borderRadius: 12, padding: "10px 14px", fontSize: 14, whiteSpace: "pre-wrap", alignSelf: "flex-start", maxWidth: "80%" }}>
              {renderTemplateBody(template.bodyText, variables) || template.name}
              {template.quickReplies.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {template.quickReplies.map((q) => (
                    <span key={q} style={{ fontSize: 12, background: "#fff", borderRadius: 999, padding: "3px 10px", color: "#007a74", fontWeight: 600 }}>
                      ↩ {q}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          <button className="primary" type="button" onClick={send} disabled={sending || !template || variables.some((v) => !v.trim())} style={{ width: "auto", padding: "10px 20px", alignSelf: "flex-start" }}>
            {sending ? "Enviando…" : "Enviar plantilla"}
          </button>
        </>
      )}
    </div>
  );
}
