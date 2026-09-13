"use client";

import { useState } from "react";

// Triggers /api/admin/broadcasts/[id]/tag-engagement — see that route's
// own comment. Meant to be tapped a few days after sending, once opens
// have mostly settled, not right after the send finishes.
export default function TagEngagementButton({ broadcastId }: { broadcastId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<{ opened: { label: string; count: number }; notOpened: { label: string; count: number } } | null>(
    null
  );

  async function run() {
    setState("loading");
    const res = await fetch(`/api/admin/broadcasts/${broadcastId}/tag-engagement`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setResult(body);
      setState("idle");
    } else {
      setState("error");
    }
  }

  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 14, marginBottom: 28 }}>
      <p style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 4px" }}>Etiquetar por apertura</p>
      <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "0 0 10px" }}>
        Crea dos etiquetas ("Abrió" / "No abrió" para este correo) que ya puedes usar en el constructor de segmentos
        para dirigir la próxima ola. Hazlo unos días después de enviar, no de inmediato — dale tiempo a que la gente
        abra.
      </p>
      <button type="button" onClick={run} disabled={state === "loading"}>
        {state === "loading" ? "Etiquetando..." : "Etiquetar por apertura"}
      </button>
      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "8px 0 0" }}>No se pudo etiquetar. Intenta de nuevo.</p>}
      {result && (
        <p style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          ✓ {result.opened.count} etiquetados <strong>{result.opened.label}</strong>, {result.notOpened.count} etiquetados{" "}
          <strong>{result.notOpened.label}</strong>.
        </p>
      )}
    </div>
  );
}
