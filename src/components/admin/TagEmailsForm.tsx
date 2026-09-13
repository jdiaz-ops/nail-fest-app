"use client";

import { useState } from "react";

// Same email-extraction approach as SuppressEmailsForm — robust to a raw
// CSV export pasted as-is, not just a clean one-per-line list.
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export default function TagEmailsForm({ defaultLabel }: { defaultLabel: string }) {
  const [label, setLabel] = useState(defaultLabel);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<{ label: string; submitted: number; matched: number; notFound: number } | null>(null);

  const found = text.match(EMAIL_PATTERN) ?? [];
  const previewCount = new Set(found.map((e) => e.trim().toLowerCase())).size;

  async function submit() {
    if (found.length === 0 || !label.trim()) return;
    setState("loading");
    setResult(null);
    const res = await fetch("/api/admin/crm/tag-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: found, label: label.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setResult(body);
      setState("idle");
    } else {
      setState("error");
    }
  }

  return (
    <div>
      <label className="field" style={{ maxWidth: 480 }}>
        <span>Nombre de la etiqueta</span>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pega aquí la lista — un correo por línea, o el CSV completo exportado de Brevo tal cual (nombre, fecha de apertura, campaña, lo que sea): solo se toma lo que parezca un correo."
        rows={12}
        style={{
          width: "100%",
          maxWidth: 640,
          padding: 10,
          border: "1px solid #e3e1dc",
          borderRadius: 8,
          fontFamily: "monospace",
          fontSize: 12.5,
          marginTop: 12,
        }}
      />
      <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "8px 0 12px" }}>
        {previewCount > 0 ? `${previewCount} correos detectados.` : "Pega la lista arriba para ver cuántos correos detecta."}
      </p>
      <button type="button" onClick={submit} disabled={found.length === 0 || !label.trim() || state === "loading"}>
        {state === "loading" ? "Etiquetando..." : `Etiquetar ${previewCount > 0 ? previewCount : ""} correos`}
      </button>
      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "10px 0 0" }}>Algo salió mal. Intenta de nuevo.</p>}
      {result && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "#e6f9f7", border: "1px solid #b7e8e3", borderRadius: 8 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 4px" }}>✓ Listo</p>
          <p style={{ fontSize: 13, margin: 0 }}>
            {result.matched} personas etiquetadas como <strong>{result.label}</strong> ({result.notFound} de la lista no estaban en la
            base). Ya puedes usar esta etiqueta en el constructor de segmentos.
          </p>
        </div>
      )}
    </div>
  );
}
