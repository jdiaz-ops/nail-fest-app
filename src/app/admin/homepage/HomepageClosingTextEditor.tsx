"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

// The last thing on the page, below the brand logo wall — free-form text,
// no rich editor. Line breaks are preserved on render (white-space:
// pre-line in globals.css) so a textarea is enough, no markdown needed.
export default function HomepageClosingTextEditor({ initialText }: { initialText: string | null }) {
  const [text, setText] = useState(initialText ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      await postSettings({ homepageClosingText: text });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ ...cardStyle, marginTop: 20 }}>
      <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Texto de cierre (opcional)</label>
      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 14px" }}>
        Se muestra al final de la página, debajo de las marcas aliadas. Vacío = no se muestra nada.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Escribe el texto que quieres mostrar al final de la página…"
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid #e3e1dc",
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button type="button" onClick={save} style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar texto"}
        </button>
        {status === "saved" && <span style={{ color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </div>
    </div>
  );
}
