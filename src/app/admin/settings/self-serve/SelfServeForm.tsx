"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle, pageGridStyle, sidePanelStyle, sidePanelLabelStyle } from "../shared";

export default function SelfServeForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({ selfServeResendEnabled: enabled });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={pageGridStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Cualquiera puede reenviarse su(s) entrada(s) escribiendo su correo</span>
        </label>
        <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </form>

      <aside style={sidePanelStyle}>
        <div style={sidePanelLabelStyle}>Estado</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: enabled ? "#12966b" : "#b5b0a6",
              display: "inline-block",
            }}
          />
          <span style={{ fontWeight: 600 }}>{enabled ? "Activo" : "Desactivado"}</span>
        </div>
        {enabled ? (
          <a href="/reenviar" target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            Ver la página pública →
          </a>
        ) : (
          <p style={{ fontSize: 13, color: "#5b5f6b", margin: 0 }}>
            <code>/reenviar</code> muestra &quot;no disponible por ahora&quot; mientras esté
            desactivado.
          </p>
        )}
      </aside>
    </div>
  );
}
