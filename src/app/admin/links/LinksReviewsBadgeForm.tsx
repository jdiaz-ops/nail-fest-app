"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

// The rating pill under the logo on nailfest.lat/links — see
// OrgSettings.linksPageReviewsBadge. Hidden below three approved reviews.
export default function LinksReviewsBadgeForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      await postSettings({ linksPageReviewsBadge: enabled });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ ...cardStyle, marginTop: 20 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>Mostrar insignia de reseñas</span>
      </label>
      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "6px 0 14px" }}>
        Debajo del logo y el eslogan, antes de los botones: estrellas, promedio y número de reseñas verificadas en puerta de todas las ediciones. Al tocarla abre nailfest.lat/resenas. Con menos de 3 reseñas aprobadas no se muestra.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={save} style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {status === "saved" && <span style={{ color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </div>
    </div>
  );
}
