"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppTemplateSyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("syncing");
    setMessage(null);
    const res = await fetch("/api/admin/whatsapp/templates/sync", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("idle");
      setMessage(`Sincronizado — ${body.synced} plantillas.`);
      router.refresh();
    } else {
      setStatus("error");
      setMessage(body?.error === "No WhatsAppConnection configured — see docs/WHATSAPP_SETUP.md and CRM → WhatsApp → Conexión." ? "Primero conecta WhatsApp en la pestaña Conexión." : `Error: ${body?.error ?? "algo salió mal"}`);
    }
  }

  return (
    <div>
      <button className="primary" type="button" onClick={handleSync} disabled={status === "syncing"} style={{ width: "auto", padding: "10px 24px" }}>
        {status === "syncing" ? "Sincronizando..." : "Sincronizar con Meta"}
      </button>
      {message && <p style={{ marginTop: 12, color: status === "error" ? "#c2185b" : "#2e7a57" }}>{message}</p>}
    </div>
  );
}
