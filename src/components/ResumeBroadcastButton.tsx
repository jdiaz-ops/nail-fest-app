"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Reanudar envío" for an email broadcast stuck in SENDING — see
// /api/admin/events/[id]/broadcasts/[broadcastId]/resume.
export default function ResumeBroadcastButton({ url }: { url: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function handle() {
    setBusy(true);
    const res = await fetch(url, { method: "POST" });
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
  return (
    <button type="button" onClick={handle} disabled={busy} style={{ background: "none", border: "none", color: "#0e6b4c", cursor: "pointer", fontSize: 13, padding: 0, fontWeight: 600 }}>
      {busy ? "Reanudando…" : "Reanudar envío"}
    </button>
  );
}
