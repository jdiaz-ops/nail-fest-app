"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppBroadcastRowActions({ id, hasFailed }: { id: string; hasFailed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRetry() {
    setBusy(true);
    const res = await fetch(`/api/admin/whatsapp/broadcasts/${id}/retry`, { method: "POST" });
    setBusy(false);
    if (res.ok) router.refresh();
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
      {hasFailed && (
        <button type="button" onClick={handleRetry} disabled={busy} style={{ background: "none", border: "none", color: "#0e6b4c", cursor: "pointer", fontSize: 13, padding: 0 }}>
          Reintentar fallidos
        </button>
      )}
      <button type="button" onClick={handleDelete} disabled={busy} style={{ background: "none", border: "none", color: "#c2185b", cursor: "pointer", fontSize: 13, padding: 0 }}>
        Borrar
      </button>
    </div>
  );
}
