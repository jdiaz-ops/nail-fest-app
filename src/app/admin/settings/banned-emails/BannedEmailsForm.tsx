"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../shared";

export default function BannedEmailsForm({ initialEmails }: { initialEmails: string[] }) {
  const [text, setText] = useState(initialEmails.join("\n"));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bannedEmails = text
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean);
    setStatus("saving");
    try {
      await postSettings({ bannedEmails });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div className="field">
        <label htmlFor="bannedEmails">Un correo por línea</label>
        <textarea
          id="bannedEmails"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="alguien@ejemplo.com"
          style={{ fontFamily: "inherit", resize: "vertical" }}
        />
      </div>
      <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
        {status === "saving" ? "Guardando…" : "Save"}
      </button>
      {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
      {status === "error" && (
        <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>
          Error al guardar — revisa que cada línea sea un correo válido
        </span>
      )}
    </form>
  );
}
