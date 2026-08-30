"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const LANGUAGES = [
  { code: "es", label: "Español" },
  { code: "es_CO", label: "Español (Colombia)" },
  { code: "es_MX", label: "Español (México)" },
  { code: "es_ES", label: "Español (España)" },
  { code: "en_US", label: "Inglés (EE. UU.)" },
];

// Same numbering Meta expects — {{1}}, {{2}}, ... in order, no skips.
function detectVariables(bodyText: string): number[] {
  const numbers = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return [...new Set(numbers)].sort((a, b) => a - b);
}

type ButtonMode = "none" | "quick_reply" | "cta";

interface WhatsAppTemplateButtonInput {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}

export default function WhatsAppTemplateCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("es");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY">("UTILITY");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [examples, setExamples] = useState<Record<number, string>>({});
  const [buttonMode, setButtonMode] = useState<ButtonMode>("none");
  const [quickReplies, setQuickReplies] = useState<string[]>([""]);
  const [ctaUrlEnabled, setCtaUrlEnabled] = useState(false);
  const [ctaUrlText, setCtaUrlText] = useState("");
  const [ctaUrlValue, setCtaUrlValue] = useState("");
  const [ctaPhoneEnabled, setCtaPhoneEnabled] = useState(false);
  const [ctaPhoneText, setCtaPhoneText] = useState("");
  const [ctaPhoneValue, setCtaPhoneValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const variables = useMemo(() => detectVariables(bodyText), [bodyText]);

  function buildButtons(): WhatsAppTemplateButtonInput[] {
    if (buttonMode === "quick_reply") {
      return quickReplies.filter((t) => t.trim()).map((text) => ({ type: "QUICK_REPLY" as const, text }));
    }
    if (buttonMode === "cta") {
      const buttons: WhatsAppTemplateButtonInput[] = [];
      if (ctaUrlEnabled && ctaUrlText && ctaUrlValue) buttons.push({ type: "URL", text: ctaUrlText, url: ctaUrlValue });
      if (ctaPhoneEnabled && ctaPhoneText && ctaPhoneValue) buttons.push({ type: "PHONE_NUMBER", text: ctaPhoneText, phoneNumber: ctaPhoneValue });
      return buttons;
    }
    return [];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage(null);

    const res = await fetch("/api/admin/whatsapp/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        language,
        category,
        headerText: headerText || undefined,
        bodyText,
        bodyExamples: variables.map((n) => examples[n] ?? ""),
        footerText: footerText || undefined,
        buttons: buildButtons(),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("idle");
      setMessage(`Enviada a Meta para revisión — quedó como ${body.template.status}. Aparece en la lista de abajo; el estado se actualiza al sincronizar.`);
      setName("");
      setHeaderText("");
      setBodyText("");
      setFooterText("");
      setExamples({});
      setButtonMode("none");
      setQuickReplies([""]);
      setCtaUrlEnabled(false);
      setCtaUrlText("");
      setCtaUrlValue("");
      setCtaPhoneEnabled(false);
      setCtaPhoneText("");
      setCtaPhoneValue("");
      router.refresh();
    } else {
      setStatus("error");
      setMessage(body?.message ?? (body?.issues ? "Revisa los campos." : `Error: ${body?.error ?? "algo salió mal"}`));
    }
  }

  if (!open) {
    return (
      <button className="primary" type="button" onClick={() => setOpen(true)} style={{ width: "auto", padding: "10px 24px" }}>
        Crear plantilla nueva
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 700, border: "1px solid #e3e1dc", borderRadius: 10, padding: 20 }}>
      <h3 style={{ marginTop: 0, fontSize: 16 }}>Crear plantilla</h3>
      <p style={{ fontSize: 13, color: "#5b5f6b" }}>
        Se envía directo a Meta para revisión (igual que crearla en el WhatsApp Manager) — puede tardar minutos u horas
        en aprobarse. No sirve para AUTHENTICATION (esas tienen un formato especial de un solo uso) — créala directo en
        Meta si necesitas una.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label htmlFor="tplName">Nombre</label>
          <input
            id="tplName"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            placeholder="confirmacion_evento"
            required
          />
          <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>Solo minúsculas, números y guion bajo.</p>
        </div>
        <div className="field">
          <label htmlFor="tplLanguage">Idioma</label>
          <select id="tplLanguage" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="tplCategory">Categoría</label>
        <select id="tplCategory" value={category} onChange={(e) => setCategory(e.target.value as "MARKETING" | "UTILITY")}>
          <option value="UTILITY">Utilidad (confirmaciones, recordatorios operativos)</option>
          <option value="MARKETING">Marketing (promociones, novedades)</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="tplHeader">Encabezado (opcional, solo texto)</label>
        <input id="tplHeader" value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="🎉 Nail Fest 2026" maxLength={60} />
      </div>

      <div className="field">
        <label htmlFor="tplBody">Cuerpo</label>
        <textarea
          id="tplBody"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={4}
          required
          placeholder="Hola {{1}}, tu registro para {{2}} está confirmado."
          style={{ padding: 10, border: "1px solid #e3e1dc", borderRadius: 8, width: "100%" }}
        />
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
          Usa {"{{1}}"}, {"{{2}}"}, ... para las variables — en orden, sin saltar números.
        </p>
      </div>

      {variables.length > 0 && (
        <div style={{ border: "1px solid #e3e1dc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>Ejemplos (obligatorios para que Meta la revise)</p>
          {variables.map((n) => (
            <div className="field" key={n}>
              <label htmlFor={`tplExample_${n}`}>{`Ejemplo de {{${n}}}`}</label>
              <input
                id={`tplExample_${n}`}
                value={examples[n] ?? ""}
                onChange={(e) => setExamples((prev) => ({ ...prev, [n]: e.target.value }))}
                required
              />
            </div>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor="tplFooter">Pie de página (opcional)</label>
        <input id="tplFooter" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Nail Fest Colombia" maxLength={60} />
      </div>

      <div className="field">
        <label>Botones (opcional)</label>
        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
          {(["none", "quick_reply", "cta"] as ButtonMode[]).map((mode) => (
            <label key={mode} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400, cursor: "pointer" }}>
              <input type="radio" name="buttonMode" checked={buttonMode === mode} onChange={() => setButtonMode(mode)} />
              {mode === "none" ? "Ninguno" : mode === "quick_reply" ? "Respuestas rápidas" : "Botones de acción"}
            </label>
          ))}
        </div>

        {buttonMode === "quick_reply" && (
          <div style={{ border: "1px solid #e3e1dc", borderRadius: 8, padding: 12 }}>
            {quickReplies.map((text, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={text}
                  onChange={(e) => setQuickReplies((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))}
                  placeholder="Sí, voy"
                  style={{ flex: 1 }}
                />
                {quickReplies.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setQuickReplies((prev) => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: "#c2185b", cursor: "pointer" }}
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
            {quickReplies.length < 3 && (
              <button type="button" onClick={() => setQuickReplies((prev) => [...prev, ""])} style={{ background: "none", border: "none", color: "#0e6b4c", cursor: "pointer", fontSize: 13, padding: 0 }}>
                + Agregar respuesta
              </button>
            )}
          </div>
        )}

        {buttonMode === "cta" && (
          <div style={{ border: "1px solid #e3e1dc", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400, cursor: "pointer", marginBottom: 6 }}>
                <input type="checkbox" checked={ctaUrlEnabled} onChange={(e) => setCtaUrlEnabled(e.target.checked)} />
                Botón de enlace
              </label>
              {ctaUrlEnabled && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={ctaUrlText} onChange={(e) => setCtaUrlText(e.target.value)} placeholder="Ver evento" style={{ flex: 1 }} />
                  <input value={ctaUrlValue} onChange={(e) => setCtaUrlValue(e.target.value)} placeholder="https://nailfest.co/..." style={{ flex: 2 }} />
                </div>
              )}
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400, cursor: "pointer", marginBottom: 6 }}>
                <input type="checkbox" checked={ctaPhoneEnabled} onChange={(e) => setCtaPhoneEnabled(e.target.checked)} />
                Botón para llamar
              </label>
              {ctaPhoneEnabled && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={ctaPhoneText} onChange={(e) => setCtaPhoneText(e.target.value)} placeholder="Llamar" style={{ flex: 1 }} />
                  <input value={ctaPhoneValue} onChange={(e) => setCtaPhoneValue(e.target.value)} placeholder="+573001234567" style={{ flex: 2 }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="primary" type="submit" disabled={status === "saving"} style={{ width: "auto", padding: "10px 24px" }}>
          {status === "saving" ? "Enviando..." : "Enviar a Meta para revisión"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#5b5f6b", cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
      {message && <p style={{ marginTop: 12, color: status === "error" ? "#c2185b" : "#2e7a57" }}>{message}</p>}
    </form>
  );
}
