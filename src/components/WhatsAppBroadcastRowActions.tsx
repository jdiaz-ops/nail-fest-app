"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Row actions for one difusión. No retry button here any more: retries
// run on their own after a send (lib/autoRetry.ts) and the Fallidos page
// offers a manual one only once those are through. "Reanudar envío"
// shows only for a send that is stuck (see isBroadcastStuck in
// lib/broadcastProgress.ts) — the chunk watchdog normally resumes a
// crashed send by itself.
export default function WhatsAppBroadcastRowActions({ id, isStuck }: { id: string; isStuck?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
      {isStuck && (
        <button type="button" onClick={handleResume} disabled={busy} style={{ background: "none", border: "none", color: "#0e6b4c", cursor: "pointer", fontSize: 13, padding: 0, fontWeight: 600 }}>
          {busy ? "Reanudando…" : "Reanudar envío"}
        </button>
      )}
      <button type="button" onClick={handleDelete} disabled={busy} style={{ background: "none", border: "none", color: "#c2185b", cursor: "pointer", fontSize: 13, padding: 0 }}>
        Borrar
      </button>
    </div>
  );
}
