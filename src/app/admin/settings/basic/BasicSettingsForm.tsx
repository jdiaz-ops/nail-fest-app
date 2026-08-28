"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle, pageGridStyle, sidePanelStyle, sidePanelLabelStyle } from "../shared";

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
    <div style={pageGridStyle}>
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

      {/* Live — reflects what's typed above, not just the last save, so
          it's an actual preview while editing rather than a stale snapshot. */}
      <aside style={sidePanelStyle}>
        <div style={sidePanelLabelStyle}>Dónde aparece</div>
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "0 0 6px" }}>Encabezado de una página de evento</p>
        <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5b5f6b" }}>
            {name || "—"} · Bogotá
          </div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>Nail Fest Bogotá</div>
        </div>
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "0 0 6px" }}>Firma del correo de confirmación</p>
        <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 8, padding: 12 }}>
          <p style={{ margin: 0, fontSize: 13 }}>Nos vemos ahí —</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{name || "—"}</p>
        </div>
      </aside>
    </div>
  );
}
