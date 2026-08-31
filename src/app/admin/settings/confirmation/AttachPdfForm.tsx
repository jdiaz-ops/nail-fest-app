"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../shared";

// Our previous ticketing platform's own "Attach ticket vouchers as a PDF"
// checkbox — one account-wide on/off (see OrgSettings.attachTicketPdf's schema comment),
// separate mini-form from the rich-text template editor above it, same
// pattern as SelfServeForm.tsx.
export default function AttachPdfForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({ attachTicketPdf: enabled });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...cardStyle, marginTop: 24 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>Adjuntar la entrada como PDF</span>
      </label>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#8a8478" }}>
        Un PDF de una sola página con el evento, el asistente y el código QR — más fácil de imprimir, guardar o
        compartir que solo la imagen del QR.
      </p>
      <a
        href="/api/admin/preview-ticket-pdf"
        target="_blank"
        rel="noreferrer"
        style={{ display: "inline-block", fontSize: 13, marginBottom: 16 }}
      >
        Ver ejemplo del PDF ↗
      </a>
      <div>
        <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
      {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
    </form>
  );
}
