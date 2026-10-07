"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Reintentar recuperables" on a failure breakdown page — POSTs to the
// channel's retry route, which only touches the retryable groups (see
// lib/whatsapp/failureCategories.ts / lib/email/failureCategories.ts).
export default function RetryRecoverableButton({ url, count, channel }: { url: string; count: number; channel: "whatsapp" | "email" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function handle() {
    if (!confirm(`¿Reintentar ahora el envío a ${count} ${count === 1 ? "persona" : "personas"} con fallo recuperable?`)) return;
    setBusy(true);
    const res = await fetch(url, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(body?.error === "in_progress" ? "Este envío ya está en curso. Espera un par de minutos y recarga." : body?.error || "No se pudo reintentar — intenta de nuevo.");
      return;
    }
    if (channel === "whatsapp") {
      setDone(`Reintentados ${body.retried}: ${body.sent} enviados, ${body.failed} volvieron a fallar${body.skipped ? `, ${body.skipped} omitidos (sin consentimiento o sin entrada)` : ""}.`);
    } else {
      setDone(body.started ? `Reintento en marcha para ${body.retryable} ${body.retryable === 1 ? "persona" : "personas"}. La fila del correo dirá "Enviando…" hasta terminar.` : "No había nada recuperable que reintentar.");
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        onClick={handle}
        disabled={busy || count === 0}
        style={{ alignSelf: "flex-start", background: count === 0 ? "#e8e6e1" : "#0e6b4c", color: count === 0 ? "#8a8478" : "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: count === 0 ? "default" : "pointer" }}
      >
        {busy ? "Reintentando…" : `Reintentar recuperables (${count})`}
      </button>
      {done && <span style={{ fontSize: 12, color: "#5b5f6b" }}>{done}</span>}
    </div>
  );
}
