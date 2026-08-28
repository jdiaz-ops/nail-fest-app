"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle, pageGridStyle, sidePanelStyle, sidePanelLabelStyle } from "../shared";

export default function PrivacyPolicyForm({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({ privacyPolicyText: text });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;

  return (
    <div style={pageGridStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div className="field">
          <label htmlFor="privacyText">Texto (texto plano — párrafos separados por línea en blanco)</label>
          <textarea
            id="privacyText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            style={{ fontFamily: "inherit", resize: "vertical" }}
          />
        </div>
        <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </form>

      <aside style={sidePanelStyle}>
        <div style={sidePanelLabelStyle}>Estado</div>
        <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 12px" }}>
          {text.trim() ? `${paragraphs} párrafo${paragraphs === 1 ? "" : "s"}, ${text.trim().length} caracteres` : "Vacío todavía"}
        </p>
        <a href="/privacidad" target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
          Ver la página pública →
        </a>
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 12, marginBottom: 0 }}>
          Se publica en <code>/privacidad</code>, enlazada desde el pie del formulario de
          registro.
        </p>
      </aside>
    </div>
  );
}
