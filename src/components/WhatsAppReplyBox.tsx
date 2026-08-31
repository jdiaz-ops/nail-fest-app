"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppReplyBox({ conversationId, windowOpen }: { conversationId: string; windowOpen: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/admin/whatsapp/conversations/${conversationId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSending(false);
    if (res.ok) {
      setText("");
      router.refresh();
      window.dispatchEvent(new Event("whatsapp-inbox-refresh"));
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body?.message ?? "No se pudo enviar.");
    }
  }

  if (!windowOpen) {
    return (
      <p style={{ color: "#8a5a1f", background: "#fdf1e6", borderRadius: 8, padding: 12, fontSize: 14 }}>
        Han pasado más de 24h desde su último mensaje — para escribirle de nuevo hace falta enviarle una plantilla
        aprobada (ver <a href="/admin/crm/whatsapp/difusiones">Difusiones</a>), no texto libre.
      </p>
    );
  }

  return (
    <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escribe una respuesta..."
        style={{ flex: 1, padding: "10px 12px", border: "1px solid #e3e1dc", borderRadius: 8 }}
      />
      <button className="primary" type="submit" disabled={sending} style={{ width: "auto", padding: "10px 20px" }}>
        {sending ? "..." : "Enviar"}
      </button>
      {error && <p style={{ color: "#c2185b", fontSize: 13 }}>{error}</p>}
    </form>
  );
}
