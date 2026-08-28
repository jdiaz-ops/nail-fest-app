"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../shared";

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
        <code>SES_FROM_TRANSACTIONAL</code>), como funciona hoy. Ese correo queda expuesto a quien
        responda, así que usa una bandeja que sí revisen.
      </p>
      <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
        {status === "saving" ? "Guardando…" : "Guardar"}
      </button>
      {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
      {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
    </form>
  );
}
