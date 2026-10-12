"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

type Mode = "block" | "badge" | "off";
type Position = "after_hero" | "before_logos";

// Reseñas on the home: the full block, the rating pill, or nothing — and
// where (see OrgSettings.homepageReviews). Either form stays hidden below
// three approved reviews, so turning it on never shows an empty section.
export default function HomepageReviewsEditor({ initialMode, initialPosition }: { initialMode: Mode; initialPosition: Position }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      await postSettings({ homepageReviews: mode, homepageReviewsPosition: position });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const radio = (value: Mode, label: string, help: string) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="radio" name="homepageReviews" checked={mode === value} onChange={() => setMode(value)} style={{ marginTop: 3 }} />
      <span>
        <strong>{label}</strong>
        <span style={{ display: "block", fontSize: 13, color: "#5b5f6b" }}>{help}</span>
      </span>
    </label>
  );

  return (
    <div style={{ ...cardStyle, marginTop: 20 }}>
      <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Reseñas de asistentes</label>
      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 14px" }}>
        Promedio y reseñas verificadas en puerta de todas las ediciones. Con menos de 3 reseñas aprobadas no se muestra nada, elijas lo que elijas. Se moderan en cada evento, pestaña Reseñas.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {radio("block", "Bloque completo", "Título, promedio con distribución de estrellas y tarjetas con fotos.")}
        {radio("badge", "Solo la insignia", "Una línea: estrellas, promedio y número de reseñas. Al tocarla abre nailfest.lat/resenas.")}
        {radio("off", "No mostrar", "Las reseñas siguen existiendo en nailfest.lat/resenas y en los bloques de cada landing.")}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
        <span>Dónde</span>
        <select value={position} onChange={(e) => setPosition(e.target.value as Position)} disabled={mode === "off"} style={{ width: "auto" }}>
          <option value="after_hero">Justo debajo del hero</option>
          <option value="before_logos">Antes de las marcas aliadas</option>
        </select>
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button type="button" onClick={save} style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {status === "saved" && <span style={{ color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </div>
    </div>
  );
}
