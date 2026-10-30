"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "./RichTextEditor";
import type { EditorOptions } from "@/lib/sequences/admin";
import { DELAY_UNITS, LINK_TARGETS, SEQUENCE_EMAIL_TAGS, describeDelay, splitDelay, type DelayUnit } from "@/lib/sequences/shared";

// A sequence's editor (CRM → Secuencias, 2026-10-30): its name, the segment
// whose people get it, the event its links are about, and its steps — a
// WhatsApp template or an email, each so long after she entered the segment.
// Each step can be tried out on the team's own email or WhatsApp before
// anything is turned on (SequenceSwitch does that, on the sequence's page).

export interface SavedStep {
  id: string;
  channel: "EMAIL" | "WHATSAPP";
  delayMinutes: number;
  subject: string | null;
  bodyHtml: string | null;
  buttonText: string | null;
  buttonTarget: string | null;
  templateId: string | null;
  variableMapping: Record<string, string> | null;
}

interface StepDraft {
  key: string;
  id?: string;
  channel: "EMAIL" | "WHATSAPP";
  amount: number;
  unit: DelayUnit;
  subject: string;
  bodyHtml: string;
  buttonText: string;
  buttonTarget: "" | "checkout" | "event";
  templateId: string;
  variableMapping: Record<string, string>;
  testTo: string;
  testMessage: string | null;
}

let keys = 0;
const nextKey = () => `paso-${++keys}`;

function draftOf(step: SavedStep): StepDraft {
  const { amount, unit } = splitDelay(step.delayMinutes);
  return {
    key: nextKey(),
    id: step.id,
    channel: step.channel,
    amount,
    unit,
    subject: step.subject ?? "",
    bodyHtml: step.bodyHtml ?? "",
    buttonText: step.buttonText ?? "",
    buttonTarget: step.buttonTarget === "event" || step.buttonTarget === "checkout" ? step.buttonTarget : "",
    templateId: step.templateId ?? "",
    variableMapping: step.variableMapping ?? {},
    testTo: "",
    testMessage: null,
  };
}

const blank = (channel: StepDraft["channel"], amount: number, unit: DelayUnit): StepDraft => ({
  key: nextKey(),
  channel,
  amount,
  unit,
  subject: "",
  bodyHtml: "",
  buttonText: "",
  buttonTarget: "checkout",
  templateId: "",
  variableMapping: {},
  testTo: "",
  testMessage: null,
});

// A new sequence starts as the abandoned carts' usual one, to edit: a WhatsApp right away, an email the next day.
function starterSteps(): StepDraft[] {
  return [
    blank("WHATSAPP", 0, "minutes"),
    {
      ...blank("EMAIL", 1, "days"),
      subject: "{{NOMBRE}}, tu cupo para {{EVENTO_NOMBRE}} te está esperando",
      bodyHtml:
        "<p>Hola, {{NOMBRE}}:</p><p>Vimos que empezaste tu inscripción a {{EVENTO_NOMBRE}} y no alcanzaste a terminarla. Tu cupo todavía está disponible.</p><p>Si tuviste algún problema con el pago, escríbenos por WhatsApp y te ayudamos.</p>",
      buttonText: "Terminar mi inscripción",
    },
  ];
}

const secondary: React.CSSProperties = { width: "auto", background: "#fff", border: "1px solid #e3e1dc", borderRadius: 8, color: "#17181c", fontWeight: 600, cursor: "pointer" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: 18, marginBottom: 14 };
const hint: React.CSSProperties = { fontSize: 12.5, color: "#5b5f6b", margin: "4px 0 0" };
const minutesOf = (s: StepDraft) => Math.max(0, Math.round(s.amount || 0)) * (DELAY_UNITS.find((u) => u.value === s.unit)?.minutes ?? 1);

export default function SequenceEditor({
  sequence,
  options,
}: {
  sequence: { id: string; name: string; segmentId: string; eventId: string | null; steps: SavedStep[] } | null;
  options: EditorOptions;
}) {
  const router = useRouter();
  const [name, setName] = useState(sequence?.name ?? "");
  const [segmentId, setSegmentId] = useState(sequence?.segmentId ?? "");
  const [eventId, setEventId] = useState(sequence?.eventId ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(() => (sequence ? sequence.steps.map(draftOf) : starterSteps()));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function update(key: string, patch: Partial<StepDraft>) {
    setSteps((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function pickSegment(id: string) {
    setSegmentId(id);
    // One event's abandoned carts: its links come along, unless an event was already chosen.
    const cartEventId = options.segments.find((s) => s.id === id)?.cartEventId;
    if (cartEventId && !eventId) setEventId(cartEventId);
  }

  const payloadStep = (s: StepDraft) => ({
    id: s.id,
    channel: s.channel,
    delayMinutes: minutesOf(s),
    subject: s.subject,
    bodyHtml: s.bodyHtml,
    buttonText: s.buttonText,
    buttonTarget: s.buttonTarget || null,
    templateId: s.templateId || null,
    variableMapping: s.variableMapping,
  });

  async function save() {
    setSaving(true);
    setMessage(null);
    const body = { name, segmentId, eventId: eventId || null, steps: steps.map(payloadStep) };
    const res = await fetch(sequence ? `/api/admin/sequences/${sequence.id}` : "/api/admin/sequences", {
      method: sequence ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const answer = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({ ok: false, text: answer.message ?? "No se pudo guardar." });
      return;
    }
    if (!sequence) {
      router.push(`/admin/crm/secuencias/${answer.id}`);
      return;
    }
    setMessage({ ok: true, text: "Guardado." });
    router.refresh();
  }

  async function test(s: StepDraft) {
    update(s.key, { testMessage: "Enviando…" });
    const res = await fetch("/api/admin/sequences/prueba", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: payloadStep(s), eventId: eventId || null, sequenceName: name, to: s.testTo }),
    });
    const answer = await res.json().catch(() => ({}));
    update(s.key, { testMessage: res.ok ? `Prueba enviada a ${(answer.sent as string[]).join(", ")}.` : answer.message ?? "No se pudo enviar la prueba." });
  }

  const ordered = useMemo(() => [...steps].sort((a, b) => minutesOf(a) - minutesOf(b)), [steps]);

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={card}>
        <div className="field">
          <label>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Carritos abandonados Imparables" />
        </div>
        <div className="field">
          <label>Segmento</label>
          <select value={segmentId} onChange={(e) => pickSegment(e.target.value)}>
            <option value="">— Elige el segmento —</option>
            {options.segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p style={hint}>Quien entra al segmento empieza la secuencia, una sola vez. Si sale (por ejemplo, porque compró), no le llega nada más.</p>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Evento</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— Ninguno —</option>
            {options.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
          <p style={hint}>Para el nombre, la fecha y los enlaces de los mensajes: el checkout y la página del evento.</p>
        </div>
      </div>

      <h2 style={{ fontSize: 16, margin: "22px 0 10px" }}>Pasos</h2>
      {ordered.map((s, i) => {
        const template = options.templates.find((t) => t.id === s.templateId);
        const slots = template ? Array.from({ length: template.variableCount }, (_, n) => String(n + 1)) : [];
        let preview = template?.bodyText ?? "";
        for (const slot of slots) {
          const tag = options.whatsappTags.find((t) => t.key === s.variableMapping[slot]);
          preview = preview.split(`{{${slot}}}`).join(tag ? `[${tag.label}]` : `{{${slot}}}`);
        }
        return (
          <div key={s.key} style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>
                Paso {i + 1} · {describeDelay(minutesOf(s))}
              </strong>
              <div style={{ display: "flex", gap: 6 }}>
                {(["WHATSAPP", "EMAIL"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update(s.key, { channel: c, testMessage: null })}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: "1px solid #e3e1dc",
                      background: s.channel === c ? "#17181c" : "#fff",
                      color: s.channel === c ? "#fff" : "#17181c",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {c === "WHATSAPP" ? "WhatsApp" : "Correo"}
                  </button>
                ))}
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSteps((all) => all.filter((x) => x.key !== s.key))}
                    style={{ marginLeft: 6, background: "none", border: "none", color: "#c2185b", fontSize: 13, cursor: "pointer" }}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <label>Cuándo</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min={0}
                  value={s.amount}
                  onChange={(e) => update(s.key, { amount: Number(e.target.value) })}
                  style={{ width: 90 }}
                />
                <select value={s.unit} onChange={(e) => update(s.key, { unit: e.target.value as DelayUnit })} style={{ width: 130 }}>
                  {DELAY_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 13, color: "#5b5f6b" }}>después de entrar al segmento (0: apenas entra)</span>
              </div>
            </div>

            {s.channel === "EMAIL" ? (
              <>
                <div className="field">
                  <label>Asunto</label>
                  <input value={s.subject} onChange={(e) => update(s.key, { subject: e.target.value })} />
                </div>
                <div className="field">
                  <label>Texto</label>
                  <div style={{ border: "1px solid #e3e1dc", borderRadius: 8, background: "#fff" }}>
                    <RichTextEditor value={s.bodyHtml} onChange={(html) => update(s.key, { bodyHtml: html })} />
                  </div>
                  <p style={hint}>Puedes escribir {SEQUENCE_EMAIL_TAGS.map((t) => `{{${t.key}}}`).join(", ")}: cada persona ve los suyos.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field">
                    <label>Botón (opcional)</label>
                    <input value={s.buttonText} onChange={(e) => update(s.key, { buttonText: e.target.value })} placeholder="Terminar mi inscripción" />
                  </div>
                  <div className="field">
                    <label>A dónde lleva</label>
                    <select value={s.buttonTarget} onChange={(e) => update(s.key, { buttonTarget: e.target.value as StepDraft["buttonTarget"] })}>
                      {LINK_TARGETS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>Plantilla de WhatsApp</label>
                  <select value={s.templateId} onChange={(e) => update(s.key, { templateId: e.target.value, variableMapping: {} })}>
                    <option value="">— Elige una plantilla aprobada —</option>
                    {options.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.language})
                      </option>
                    ))}
                  </select>
                  {options.templates.length === 0 && <p style={hint}>No hay plantillas aprobadas todavía: créalas en WhatsApp → Plantillas.</p>}
                </div>
                {slots.map((slot) => (
                  <div className="field" key={slot}>
                    <label>{`{{${slot}}}`}</label>
                    <select value={s.variableMapping[slot] ?? ""} onChange={(e) => update(s.key, { variableMapping: { ...s.variableMapping, [slot]: e.target.value } })}>
                      <option value="">— Elige con qué se llena —</option>
                      {options.whatsappTags.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {template?.hasLinkButton && (
                  <div className="field">
                    <label>El botón con enlace lleva a</label>
                    <select value={s.buttonTarget || "checkout"} onChange={(e) => update(s.key, { buttonTarget: e.target.value as StepDraft["buttonTarget"] })}>
                      {LINK_TARGETS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p style={hint}>En Meta, el botón de la plantilla debe apuntar a https://nailfest.lat/{"{{1}}"}.</p>
                  </div>
                )}
                {preview && (
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, background: "#f0efec", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>{preview}</div>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #e3e1dc", paddingTop: 12 }}>
              <input
                value={s.testTo}
                onChange={(e) => update(s.key, { testTo: e.target.value })}
                placeholder={s.channel === "EMAIL" ? "Tu correo, para la prueba" : "Tu WhatsApp, para la prueba"}
                style={{ flex: "1 1 220px", padding: "8px 10px", border: "1px solid #e3e1dc", borderRadius: 8 }}
              />
              <button type="button" onClick={() => test(s)} disabled={!s.testTo.trim()} style={{ ...secondary, padding: "8px 14px" }}>
                Enviar prueba
              </button>
              {s.testMessage && <span style={{ fontSize: 13, color: "#5b5f6b" }}>{s.testMessage}</span>}
            </div>
          </div>
        );
      })}

      {steps.length < 10 && (
        <button
          type="button"
          onClick={() => setSteps((all) => [...all, blank("EMAIL", 2, "days")])}
          style={{ ...secondary, padding: "8px 14px", marginBottom: 20 }}
        >
          + Agregar paso
        </button>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="primary" type="button" onClick={save} disabled={saving} style={{ width: "auto", padding: "10px 24px" }}>
          {saving ? "Guardando…" : sequence ? "Guardar cambios" : "Guardar secuencia"}
        </button>
        {message && <span style={{ fontSize: 14, color: message.ok ? "#1f7a4d" : "#c2185b" }}>{message.text}</span>}
      </div>
      {!sequence && <p style={{ ...hint, marginTop: 10 }}>Se guarda apagada: no le llega nada a nadie hasta que la enciendas.</p>}
    </div>
  );
}
