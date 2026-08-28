"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle, pageGridStyle, sidePanelStyle, sidePanelLabelStyle } from "../shared";

export default function ContactPreferencesForm({ initialReplyToEmail }: { initialReplyToEmail: string }) {
  const [replyToEmail, setReplyToEmail] = useState(initialReplyToEmail);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({ replyToEmail });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={pageGridStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div className="field">
          <label htmlFor="replyTo">Correo de respuesta (Reply-To)</label>
          <input
            id="replyTo"
            type="email"
            value={replyToEmail}
            onChange={(e) => setReplyToEmail(e.target.value)}
            placeholder="hola@nailfest.co"
          />
        </div>
        <p style={{ fontSize: 13, color: "#5b5f6b" }}>
          Vacío = las respuestas van a la dirección de envío por defecto (
          <code>SES_FROM_TRANSACTIONAL</code>), como funciona hoy. Ese correo queda expuesto a
          quien responda, así que usa una bandeja que sí revisen.
        </p>
        <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </form>

      <aside style={sidePanelStyle}>
        <div style={sidePanelLabelStyle}>Así se ve un correo saliente</div>
        <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 8, padding: 12, fontSize: 13 }}>
          <p style={{ margin: "0 0 4px" }}>
            <span style={{ color: "#8a8478" }}>De:</span> tickets@nailfest.co
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: "#8a8478" }}>Responder a:</span>{" "}
            <strong>{replyToEmail || "(misma que De:)"}</strong>
          </p>
        </div>
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 12, marginBottom: 0 }}>
          Si alguien le da &quot;Responder&quot; a su entrada, el correo llega a esta dirección.
        </p>
      </aside>
    </div>
  );
}
