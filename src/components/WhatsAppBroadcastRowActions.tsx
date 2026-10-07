"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppBroadcastRowActions({ id, hasFailed, isSending }: { id: string; hasFailed: boolean; isSending?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Only the failures a retry can fix (see lib/whatsapp/failureCategories.ts)
  // — dead numbers and users Meta is shielding are left alone.
  async function handleRetry() {
    setBusy(true);
    const res = await fetch(`/api/admin/whatsapp/broadcasts/${id}/retry`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(body?.error || "No se pudo reintentar — intenta de nuevo.");
      return;
    }
    alert(
      `Reintentados ${body.retried}: ${body.sent} enviados, ${body.failed} volvieron a fallar.` +
        (body.skippedNotRetryable ? ` ${body.skippedNotRetryable} no se tocaron (número sin WhatsApp o frenado por Meta) — ver "Fallidos".` : "")
    );
    router.refresh();
  }

  // A send stuck in SENDING (an invocation died mid-chunk before the
  // watchdog existed) — picks up from the persisted cursor, skipping
  // anyone already messaged.
  async function handleResume() {
    setBusy(true);
    const res = await fetch(`/api/admin/whatsapp/broadcasts/${id}/resume`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    alert(
      body?.error === "in_progress"
        ? "Este envío ya está en curso — otra ejecución lo está procesando. Espera un par de minutos y recarga la página antes de volver a reanudar."
        : "No se pudo reanudar — intenta de nuevo."
    );
  }

  async function handleDelete() {
    if (!confirm("¿Borrar esta difusión y su historial de envío? Esto no revoca nada ya enviado en WhatsApp.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/whatsapp/broadcasts/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {isSending && (
        <button type="button" onClick={handleResume} disabled={busy} style={{ background: "none", border: "none", color: "#0e6b4c", cursor: "pointer", fontSize: 13, padding: 0, fontWeight: 600 }}>
          {busy ? "Reanudando…" : "Reanudar envío"}
        </button>
      )}
      {hasFailed && (
        <button type="button" onClick={handleRetry} disabled={busy} style={{ background: "none", border: "none", color: "#0e6b4c", cursor: "pointer", fontSize: 13, padding: 0 }}>
          Reintentar recuperables
        </button>
      )}
      <button type="button" onClick={handleDelete} disabled={busy} style={{ background: "none", border: "none", color: "#c2185b", cursor: "pointer", fontSize: 13, padding: 0 }}>
        Borrar
      </button>
    </div>
  );
}
