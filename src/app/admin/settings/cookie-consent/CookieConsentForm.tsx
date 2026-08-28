"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle, pageGridStyle, sidePanelStyle, sidePanelLabelStyle } from "../shared";

export default function CookieConsentForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({ cookieConsentEnabled: enabled });
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
          <span>Activar el aviso de cookies</span>
        </label>
        <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </form>

      <aside style={sidePanelStyle}>
        <div style={sidePanelLabelStyle}>{enabled ? "Así se ve en el sitio" : "Vista previa (desactivado)"}</div>
        <div
          style={{
            background: "#1c1310",
            color: "#fff",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            opacity: enabled ? 1 : 0.4,
          }}
        >
          <span>Usamos cookies para mostrarte publicidad relevante.</span>
          <span style={{ padding: "4px 10px", borderRadius: 999, background: "#f6c4b2", color: "#1c1310", fontWeight: 600 }}>
            Aceptar
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 12, marginBottom: 0 }}>
          Aparte del checkbox de &quot;Autorizo compartir mis datos con Meta&quot; del formulario
          de registro (ese ya está activo siempre) — esto es solo el aviso general.
        </p>
      </aside>
    </div>
  );
}
