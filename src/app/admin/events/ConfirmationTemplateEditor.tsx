"use client";

import { useRef, useState } from "react";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import { CONFIRMATION_MERGE_TAGS } from "@/lib/confirmationTemplate";

// EVENTO_UBICACION_LINEA / EVENTO_ACCESO_VIRTUAL_BOTON / EVENTO_INSTRUCCION_ENTRADA
// (see lib/confirmationTemplate.ts) each already resolve to the right
// copy for IN_PERSON, VIRTUAL and HYBRID — so this one starter works for
// every event format without an admin having to write their own
// conditional; it just renders empty where something doesn't apply
// (e.g. no Zoom button on a presencial event).
const STARTER_HTML =
  "<p>Hola,</p><p>Tu registro para <strong>{{EVENTO_NOMBRE}}</strong> quedó confirmado.</p>" +
  "<p>Fecha: {{EVENTO_FECHA_RANGO}}<br/>{{EVENTO_UBICACION_LINEA}}</p>" +
  "{{EVENTO_ACCESO_VIRTUAL_BOTON}}" +
  "<p>{{EVENTO_INSTRUCCION_ENTRADA}}</p>" +
  "{{ENTRADAS}}<p>Nos vemos ahí.</p>";

// Same subject for every event, format included, until an admin
// overrides it — matches what sendTicketEmail.ts falls back to when
// neither Event.confirmationEmailSubject nor OrgSettings.
// confirmationEmailSubject is set. Only a small subset of merge tags
// work here (see renderSubjectFromTemplate's own comment on why it's a
// separate, simpler substitution than the body's).
const STARTER_SUBJECT = "Tu entrada para {{EVENTO_NOMBRE}}";
const SUBJECT_MERGE_TAGS = ["EVENTO_NOMBRE", "EVENTO_FECHA_RANGO", "EVENTO_FORMATO"];

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
  initialSubject,
  onSave,
}: {
  scope: "event" | "global";
  initialHtml: string | null;
  initialSubject: string | null;
  onSave: (html: string, subject: string) => Promise<{ ok: boolean }>;
}) {
  const [useOverride, setUseOverride] = useState(scope === "global" ? true : initialHtml != null || initialSubject != null);
  const [html, setHtml] = useState(initialHtml ?? STARTER_HTML);
  const [subject, setSubject] = useState(initialSubject ?? STARTER_SUBJECT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);

  function insertTag(key: string) {
    editorRef.current?.insertAtCursor(`{{${key}}} `);
  }

  function insertSubjectTag(key: string) {
    setSubject((s) => `${s}{{${key}}}`);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await onSave(useOverride ? html || STARTER_HTML : "", useOverride ? subject || STARTER_SUBJECT : "");
    setSaving(false);
    setMessage(result.ok ? "Guardado." : "No se pudo guardar.");
  }

  async function handleRevert() {
    if (!confirm("¿Volver al diseño original? Se borra el contenido personalizado.")) return;
    setSaving(true);
    setMessage(null);
    const result = await onSave("", "");
    setSaving(false);
    setHtml(STARTER_HTML);
    setSubject(STARTER_SUBJECT);
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
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="confirmationSubject">Asunto del correo</label>
            <input id="confirmationSubject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={STARTER_SUBJECT} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {SUBJECT_MERGE_TAGS.map((key) => {
                const tag = CONFIRMATION_MERGE_TAGS.find((t) => t.key === key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => insertSubjectTag(key)}
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", cursor: "pointer" }}
                  >
                    {tag?.label ?? key}
                  </button>
                );
              })}
            </div>
          </div>

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
