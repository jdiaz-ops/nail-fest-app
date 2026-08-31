"use client";

import { useState } from "react";

// Fixes the "shadow delivery" gotcha — see subscribeAppToWaba's own
// comment in lib/whatsapp/meta.ts. A connection saved before this app
// added the automatic subscribe call (or where that call failed the
// first time) needs this run manually, once, using the token already on
// file.
export default function WhatsAppSubscribeAppButton() {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setStatus("saving");
    setMessage(null);
    const res = await fetch("/api/admin/whatsapp/connection/subscribe", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("done");
      setMessage("Listo — esta app ya está suscrita para recibir los mensajes de este WABA.");
    } else {
      setStatus("error");
      setMessage(`No se pudo suscribir: ${body?.error ?? "revisa la consola"}`);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={status === "saving"} style={{ width: "auto", padding: "8px 16px" }}>
        {status === "saving" ? "Suscribiendo..." : "Suscribir esta app al WABA"}
      </button>
      <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
        Necesario para que la Bandeja reciba mensajes reales — sin esto, Meta puede seguir mandando los mensajes
        entrantes solo a otras apps ya suscritas (ej. WhatChimp), aunque nuestra conexión esté guardada. No afecta a
        WhatChimp ni a nada más — solo agrega esta app a la lista.
      </p>
      {message && <p style={{ fontSize: 13, color: status === "error" ? "#c2185b" : "#2e7a57", marginTop: 8 }}>{message}</p>}
    </div>
  );
}
