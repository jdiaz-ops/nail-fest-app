"use client";

import { useEffect, useRef, useState } from "react";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import { CONFIRMATION_MERGE_TAGS } from "@/lib/confirmationTemplate";
import TestSendBox from "./TestSendBox";

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
// when nothing more specific overrides it. `design` (an event with a
// designed email of its own — Manicuristas Imparables', 2026-10-29; Nail
// Fest's for an event at a place, 2026-10-30) adds a third choice: that
// email, with its preview, and only its subject — and, since 2026-10-30, its
// «Compartir por WhatsApp» message, and Nail Fest's «Antes de ir» — to edit.
// `testUrl` (an event's, 2026-10-30) adds «Enviarme una prueba»: what's on
// screen right now, saved or not, to the team's own inbox.
export type EventDesign = {
  kind: "IMPARABLES" | "NAIL_FEST";
  initial: boolean;
  previewUrl: string;
  shareText: string;
  /** Nail Fest's «Antes de ir», the event's own or the default ones. */
  tips?: string[];
};

const DESIGN_COPY = {
  IMPARABLES: {
    label: "Diseño del congreso",
    note: "(El correo de Manicuristas Imparables, con los colores del evento: se llena solo con los datos de cada compra)",
    sample: "Vista previa con datos de ejemplo (Laura, el precio de hoy, un código de muestra). No se envía a nadie.",
  },
  NAIL_FEST: {
    label: "Diseño Nail Fest presencial",
    note: "(El correo de Nail Fest para el evento: su entrada con el código QR, los días y el lugar con «Cómo llegar». Se llena solo con los datos de cada inscripción)",
    sample: "Vista previa con datos de ejemplo (Laura, una entrada de muestra). No se envía a nadie.",
  },
} as const;

const MAX_TIPS = 5;

export default function ConfirmationTemplateEditor({
  scope,
  initialHtml,
  initialSubject,
  design,
  testUrl,
  onSave,
}: {
  scope: "event" | "global";
  initialHtml: string | null;
  initialSubject: string | null;
  design?: EventDesign;
  testUrl?: string;
  onSave: (html: string, subject: string, design: boolean, extras?: { shareText?: string; tips?: string[] }) => Promise<{ ok: boolean }>;
}) {
  const [useOverride, setUseOverride] = useState(scope === "global" ? true : initialHtml != null || initialSubject != null);
  const [useDesign, setUseDesign] = useState(Boolean(design?.initial));
  const [html, setHtml] = useState(initialHtml ?? STARTER_HTML);
  const [subject, setSubject] = useState(initialSubject ?? STARTER_SUBJECT);
  const [shareText, setShareText] = useState(design?.shareText ?? "");
  const [tips, setTips] = useState<string[]>(design?.tips ?? []);
  // The preview follows «Antes de ir» as it's typed, a moment after.
  const [previewTips, setPreviewTips] = useState(tips);
  useEffect(() => {
    const t = setTimeout(() => setPreviewTips(tips), 700);
    return () => clearTimeout(t);
  }, [tips]);
  const withTips = design?.kind === "NAIL_FEST";
  const ownTips = tips.map((t) => t.trim()).filter(Boolean);
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
    const result = useDesign
      ? // The designed email keeps whatever body the event had, for coming back to it.
        await onSave(html === STARTER_HTML && initialHtml == null ? "" : html, subject || STARTER_SUBJECT, true, {
          shareText,
          ...(withTips ? { tips: ownTips } : {}),
        })
      : await onSave(useOverride ? html || STARTER_HTML : "", useOverride ? subject || STARTER_SUBJECT : "", false);
    setSaving(false);
    setMessage(result.ok ? "Guardado." : "No se pudo guardar.");
  }

  async function handleRevert() {
    if (!confirm("¿Volver al diseño original? Se borra el contenido personalizado.")) return;
    setSaving(true);
    setMessage(null);
    const result = await onSave("", "", false);
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
            <input
              type="radio"
              checked={!useOverride && !useDesign}
              onChange={() => {
                setUseOverride(false);
                setUseDesign(false);
              }}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>Confirmación global</strong>
              <br />
              <span style={{ fontSize: 12, color: "#5b5f6b" }}>
                (Aplica a todos los eventos — edítala en Configuración → Confirmación)
              </span>
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontWeight: 400 }}>
            <input
              type="radio"
              checked={useOverride && !useDesign}
              onChange={() => {
                setUseOverride(true);
                setUseDesign(false);
              }}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>Confirmación específica del evento</strong>
              <br />
              <span style={{ fontSize: 12, color: "#5b5f6b" }}>(Aplica solo a este evento)</span>
            </span>
          </label>
          {design && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, fontWeight: 400 }}>
              <input type="radio" checked={useDesign} onChange={() => setUseDesign(true)} style={{ marginTop: 3 }} />
              <span>
                <strong>{DESIGN_COPY[design.kind].label}</strong>
                <br />
                <span style={{ fontSize: 12, color: "#5b5f6b" }}>{DESIGN_COPY[design.kind].note}</span>
              </span>
            </label>
          )}
        </div>
      )}

      {useDesign && design && (
        <>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="confirmationSubjectDesign">Asunto del correo</label>
            <input id="confirmationSubjectDesign" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={STARTER_SUBJECT} />
          </div>
          <div className="field" style={{ marginBottom: 16, maxWidth: 660 }}>
            <label htmlFor="confirmationShareText">Mensaje al compartir por WhatsApp</label>
            <textarea id="confirmationShareText" rows={3} maxLength={500} value={shareText} onChange={(e) => setShareText(e.target.value)} />
            <span style={{ fontSize: 12, color: "#5b5f6b" }}>
              {withTips
                ? "Lo que queda escrito cuando alguien toca «Compartir por WhatsApp» en «¿Vas con una colega?». El enlace a la inscripción va solo, al final."
                : "Lo que queda escrito cuando alguien toca «Compartir por WhatsApp» en el correo. El enlace a la página va solo, al final."}
            </span>
          </div>
          {withTips && (
            <div className="field" style={{ marginBottom: 16, maxWidth: 660 }}>
              <label htmlFor="confirmationTip0">Antes de ir</label>
              <div style={{ display: "grid", gap: 6 }}>
                {tips.map((tip, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 18, fontSize: 13, fontWeight: 700, color: "#5b5f6b", textAlign: "right" }}>{i + 1}</span>
                    <input
                      id={`confirmationTip${i}`}
                      type="text"
                      maxLength={200}
                      value={tip}
                      onChange={(e) => setTips((all) => all.map((t, j) => (j === i ? e.target.value : t)))}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      aria-label={`Quitar el punto ${i + 1}`}
                      onClick={() => setTips((all) => all.filter((_, j) => j !== i))}
                      style={{ border: "1px solid #e3e1dc", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              {tips.length < MAX_TIPS && (
                <button
                  type="button"
                  onClick={() => setTips((all) => [...all, ""])}
                  style={{ alignSelf: "flex-start", marginTop: 8, border: "1px dashed #c9c6bf", background: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
                >
                  + Agregar un punto
                </button>
              )}
              <span style={{ fontSize: 12, color: "#5b5f6b" }}>
                Lo que conviene saber antes de llegar, en frases cortas. Sin ninguno, van los de siempre (tener la entrada a mano, entrar y salir con el mismo código, las novedades por WhatsApp).
              </span>
            </div>
          )}
          <p style={{ fontSize: 12, color: "#5b5f6b", marginBottom: 8 }}>{DESIGN_COPY[design.kind].sample}</p>
          <iframe
            src={withTips ? `${design.previewUrl}?antes=${encodeURIComponent(JSON.stringify(previewTips.map((t) => t.trim()).filter(Boolean)))}` : design.previewUrl}
            title="Vista previa del correo"
            style={{ display: "block", width: "100%", maxWidth: 660, height: 1100, border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff" }}
          />
        </>
      )}

      {useOverride && !useDesign && (
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

      {testUrl && (
        <TestSendBox
          url={testUrl}
          body={{
            mode: useDesign ? "design" : useOverride ? "event" : "global",
            html,
            subject,
            ...(useDesign ? { shareText, ...(withTips ? { tips: ownTips } : {}) } : {}),
          }}
          note="Se envía lo que ves ahora, aunque no lo hayas guardado: con datos de ejemplo y «[Prueba]» al comienzo del asunto."
        />
      )}

      {message && <p style={{ fontSize: 13, color: "#0e6b4c", marginTop: 8 }}>{message}</p>}

      {/* Buttons their own size (button.primary is full-width everywhere else). */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="primary" type="button" disabled={saving} onClick={handleSave} style={{ width: "auto", padding: "10px 24px" }}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {scope === "global" && (
          <button className="secondary" type="button" disabled={saving} onClick={handleRevert} style={{ width: "auto", padding: "10px 18px" }}>
            Revertir al diseño original
          </button>
        )}
      </div>
    </div>
  );
}
