"use client";

import { useMemo, useState } from "react";
import { postSettings, cardStyle, saveButtonStyle, pageGridStyle, sidePanelStyle, sidePanelLabelStyle } from "../shared";

export default function BannedEmailsForm({ initialEmails }: { initialEmails: string[] }) {
  const [text, setText] = useState(initialEmails.join("\n"));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const emails = useMemo(() => text.split("\n").map((line) => line.trim()).filter(Boolean), [text]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bannedEmails = emails.map((e) => e.toLowerCase());
    setStatus("saving");
    try {
      await postSettings({ bannedEmails });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={pageGridStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div className="field">
          <label htmlFor="bannedEmails">Un correo por línea</label>
          <textarea
            id="bannedEmails"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="alguien@ejemplo.com"
            style={{ fontFamily: "inherit", resize: "vertical" }}
          />
        </div>
        <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && (
          <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>
            Error al guardar — revisa que cada línea sea un correo válido
          </span>
        )}
      </form>

      <aside style={sidePanelStyle}>
        <div style={sidePanelLabelStyle}>Estado</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{emails.length}</div>
        <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: 2 }}>
          {emails.length === 1 ? "correo bloqueado" : "correos bloqueados"}
          {text !== initialEmails.join("\n") && " (sin guardar)"}
        </p>
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 16, marginBottom: 0 }}>
          Estos correos no pueden completar el formulario de registro para ningún evento — se
          rechazan antes de crear el contacto.
        </p>
      </aside>
    </div>
  );
}
