"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../shared";

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

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div className="field">
        <label htmlFor="privacyText">Texto (texto plano — párrafos separados por línea en blanco)</label>
        <textarea
          id="privacyText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          style={{ fontFamily: "inherit", resize: "vertical" }}
        />
      </div>
      <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
        {status === "saving" ? "Guardando…" : "Guardar"}
      </button>
      {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
      {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
    </form>
  );
}
