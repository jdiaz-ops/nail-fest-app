"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppSendZoomLinkButton({
  conversationId,
  registrationId,
}: {
  conversationId: string;
  registrationId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus("sending");
    setError(null);
    const res = await fetch(`/api/admin/whatsapp/conversations/${conversationId}/send-zoom-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId }),
    });
    if (res.ok) {
      setStatus("idle");
      router.refresh();
      window.dispatchEvent(new Event("whatsapp-inbox-refresh"));
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setError(
        body?.error === "zoom_link_not_available"
          ? "Todavía no se ha podido generar el link de Zoom para esta persona."
          : body?.message ?? "No se pudo enviar el link."
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "sending"}
        style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
      >
        {status === "sending" ? "Enviando..." : "Enviar link de Zoom por WhatsApp"}
      </button>
      {error && <p style={{ fontSize: 11, color: "#c2185b", margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}
