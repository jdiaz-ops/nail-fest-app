"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../shared";

export default function ClaritySettingsForm({ initialClarityProjectId }: { initialClarityProjectId: string }) {
  const [clarityProjectId, setClarityProjectId] = useState(initialClarityProjectId);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({ clarityProjectId });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div className="field">
        <label htmlFor="clarityProjectId">Project ID de Microsoft Clarity</label>
        <input
          id="clarityProjectId"
          value={clarityProjectId}
          onChange={(e) => setClarityProjectId(e.target.value)}
          placeholder="ej. a1b2c3d4e5"
        />
      </div>
      <p style={{ fontSize: 13, color: "#5b5f6b" }}>
        Vacío = no se carga ningún script de Clarity, como funciona hoy. Con un project ID, el
        script se inyecta en todo el sitio (no solo la página del evento) — sacas el ID desde{" "}
        <a href="https://clarity.microsoft.com" target="_blank" rel="noreferrer">
          clarity.microsoft.com
        </a>{" "}
        → Settings → Setup, es gratis y sin límite de tráfico.
      </p>
      <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
        {status === "saving" ? "Guardando…" : "Guardar"}
      </button>
      {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
      {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
    </form>
  );
}
