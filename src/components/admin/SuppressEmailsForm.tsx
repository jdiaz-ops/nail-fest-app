"use client";

import { useState } from "react";
import EmailFileUploadButton from "./EmailFileUploadButton";

// Extracts emails from whatever gets pasted — a clean one-per-line list,
// or a raw CSV export with other columns (name, bounce reason, date...)
// copy-pasted as-is. Simpler and more robust than parsing a specific CSV
// shape: this just finds anything that looks like an email, anywhere in
// the text, and ignores everything else.
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export default function SuppressEmailsForm() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<{ submitted: number; matched: number; notFound: number } | null>(null);

  const found = text.match(EMAIL_PATTERN) ?? [];
  const previewCount = new Set(found.map((e) => e.trim().toLowerCase())).size;

  async function submit() {
    if (found.length === 0) return;
    setState("loading");
    setResult(null);
    const res = await fetch("/api/admin/crm/suppress-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: found }),
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
      <div style={{ marginBottom: 10 }}>
        <EmailFileUploadButton
          onText={(fileText, name) => {
            setText(fileText);
            setFileName(name);
          }}
        />
        {fileName && <span style={{ fontSize: 12.5, color: "#5b5f6b", marginLeft: 10 }}>{fileName} cargado abajo ↓</span>}
      </div>
      <p style={{ fontSize: 12, color: "#5b5f6b", margin: "0 0 8px" }}>o pega la lista directamente aquí:</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pega aquí la lista — puede ser un correo por línea, o el CSV completo exportado de Brevo (nombre, razón, fecha, lo que sea): solo se toma lo que parezca un correo, el resto se ignora."
        rows={12}
        style={{
          width: "100%",
          maxWidth: 640,
          padding: 10,
          border: "1px solid #e3e1dc",
          borderRadius: 8,
          fontFamily: "monospace",
          fontSize: 12.5,
        }}
      />
      <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "8px 0 12px" }}>
        {previewCount > 0 ? `${previewCount} correos detectados.` : "Pega la lista arriba para ver cuántos correos detecta."}
      </p>
      <button type="button" onClick={submit} disabled={found.length === 0 || state === "loading"}>
        {state === "loading" ? "Suprimiendo..." : `Suprimir ${previewCount > 0 ? previewCount : ""} correos`}
      </button>
      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "10px 0 0" }}>Algo salió mal. Intenta de nuevo.</p>}
      {result && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "#e6f9f7", border: "1px solid #b7e8e3", borderRadius: 8 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 4px" }}>✓ Listo</p>
          <p style={{ fontSize: 13, margin: 0 }}>
            {result.submitted} correos enviados · {result.matched} encontrados y suprimidos de marketing ·{" "}
            {result.notFound} no estaban en la base (no hay nada que hacer con esos).
          </p>
        </div>
      )}
    </div>
  );
}
