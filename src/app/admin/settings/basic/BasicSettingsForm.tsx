"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../shared";

// Only "name" is real for now — timezone/date format/language are shown in
// Ticket Tailor's version but nothing in our app reads them yet (they're
// hardcoded to America/Bogota / es-CO across the codebase); adding fields
// that don't affect anything would just be a settings page that lies. Wire
// those in when something actually consumes them.
export default function BasicSettingsForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({ name });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div className="field">
        <label htmlFor="orgName">Nombre</label>
        <input id="orgName" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <p style={{ fontSize: 13, color: "#5b5f6b" }}>
        Aparece en la firma de los correos de confirmación y en el encabezado de cada página de
        evento.
      </p>
      <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
        {status === "saving" ? "Guardando…" : "Guardar"}
      </button>
      {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
      {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
    </form>
  );
}
