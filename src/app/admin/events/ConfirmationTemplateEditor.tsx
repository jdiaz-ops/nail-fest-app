"use client";

import { useRef, useState } from "react";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import { CONFIRMATION_MERGE_TAGS } from "@/lib/confirmationTemplate";

const STARTER_HTML =
  "<p>Hola,</p><p>Tu registro para <strong>{{EVENTO_NOMBRE}}</strong> quedó confirmado.</p>" +
  "<p>Fecha: {{EVENTO_FECHA_RANGO}}<br/>Lugar: {{EVENTO_LUGAR_NOMBRE}} — {{EVENTO_LUGAR_DIRECCION}}</p>" +
  "<p>Presenta el código QR de abajo en la entrada. Puedes reingresar las veces que necesites durante el evento.</p>" +
  "{{ENTRADAS}}<p>Nos vemos ahí.</p>";

// Shared by /admin/events/[id]/confirmation (per-event override) and
// /admin/settings/confirmation (the account-wide default it falls back
// to) — same editor either way, see sendTicketEmail.ts for the actual
// fallback chain this feeds. `scope="event"` adds the Global/Event-
// specific radio the reference screenshots showed; `scope="global"`
// has no such toggle — the account-wide template just always applies
// when nothing more specific overrides it.
export default function ConfirmationTemplateEditor({
  scope,
  initialHtml,
  onSave,
}: {
  scope: "event" | "global";
  initialHtml: string | null;
  onSave: (html: string) => Promise<{ ok: boolean }>;
}) {
  const [useOverride, setUseOverride] = useState(scope === "global" ? true : initialHtml != null);
  const [html, setHtml] = useState(initialHtml ?? STARTER_HTML);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);

  function insertTag(key: string) {
    editorRef.current?.insertAtCursor(`{{${key}}} `);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await onSave(useOverride ? html || STARTER_HTML : "");
    setSaving(false);
    setMessage(result.ok ? "Guardado." : "No se pudo guardar.");
  }

  async function handleRevert() {
    if (!confirm("¿Volver al diseño original? Se borra el contenido personalizado.")) return;
    setSaving(true);
    setMessage(null);
    const result = await onSave("");
    setSaving(false);
    setHtml(STARTER_HTML);
    setMessage(result.ok ? "Se volvió al diseño original." : "No se pudo revertir.");
  }

  return (
    <div>
      {scope === "event" && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Contenido del correo</div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontWeight: 400 }}>
            <input type="radio" checked={!useOverride} onChange={() => setUseOverride(false)} style={{ marginTop: 3 }} />
            <span>
              <strong>Confirmación global</strong>
              <br />
              <span style={{ fontSize: 12, color: "#5b5f6b" }}>
                (Aplica a todos los eventos — edítala en Configuración → Confirmación)
              </span>
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontWeight: 400 }}>
            <input type="radio" checked={useOverride} onChange={() => setUseOverride(true)} style={{ marginTop: 3 }} />
            <span>
              <strong>Confirmación específica del evento</strong>
              <br />
              <span style={{ fontSize: 12, color: "#5b5f6b" }}>(Aplica solo a este evento)</span>
            </span>
          </label>
        </div>
      )}

      {useOverride && (
        <>
          <p style={{ fontSize: 12, color: "#5b5f6b", marginBottom: 8 }}>
            Haz clic en una etiqueta para insertarla donde esté el cursor — se reemplaza por el dato real de cada
            evento al enviarse.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {CONFIRMATION_MERGE_TAGS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => insertTag(t.key)}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", cursor: "pointer" }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <RichTextEditor ref={editorRef} value={html} onChange={setHtml} />
        </>
      )}

      {message && <p style={{ fontSize: 13, color: "#0e6b4c", marginTop: 8 }}>{message}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="primary" type="button" disabled={saving} onClick={handleSave} style={{ padding: "10px 24px" }}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {scope === "global" && (
          <button className="secondary" type="button" disabled={saving} onClick={handleRevert} style={{ padding: "10px 18px" }}>
            Revertir al diseño original
          </button>
        )}
      </div>
    </div>
  );
}
