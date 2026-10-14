"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WhatsAppReopenTemplatePicker, { type ReopenTemplateOption } from "./WhatsAppReopenTemplatePicker";

// The free-text reply, inside Meta's 24h window; outside it (or the
// moment Meta says it's closed, error 131047) the template picker takes
// its place.
export default function WhatsAppReplyBox({
  conversationId,
  windowOpen,
  reopenTemplates,
  firstName,
}: {
  conversationId: string;
  windowOpen: boolean;
  reopenTemplates: ReopenTemplateOption[];
  firstName: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedByMeta, setClosedByMeta] = useState(false);

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
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body?.message ?? "No se pudo enviar.");
    router.refresh();
    if (res.status === 409) setClosedByMeta(true);
  }

  if (!windowOpen || closedByMeta) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <WhatsAppReopenTemplatePicker conversationId={conversationId} templates={reopenTemplates} firstName={firstName} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe una respuesta..."
          style={{ flex: 1, padding: "10px 12px", border: "1px solid #e3e1dc", borderRadius: 8 }}
        />
        <button className="primary" type="submit" disabled={sending} style={{ width: "auto", padding: "10px 20px" }}>
          {sending ? "..." : "Enviar"}
        </button>
      </div>
      {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
    </form>
  );
}
