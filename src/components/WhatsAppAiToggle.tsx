"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Lets a staff member take a thread back from the LLM agent at any time
// (or hand it back), independent of the agent's own escalate_to_human
// tool call and the auto-disable-on-manual-reply behavior — see
// WhatsAppConversation.aiAutoReplyEnabled's own schema comment for the
// three write paths.
export default function WhatsAppAiToggle({ conversationId, enabled }: { conversationId: string; enabled: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    await fetch(`/api/admin/whatsapp/conversations/${conversationId}/ai-toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setSaving(false);
    router.refresh();
    window.dispatchEvent(new Event("whatsapp-inbox-refresh"));
  }

  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: saving ? "default" : "pointer" }}>
        <input type="checkbox" checked={enabled} disabled={saving} onChange={handleToggle} />
        <span>{enabled ? "Respondiendo automático" : "En manos de un humano"}</span>
      </label>
      <p style={{ fontSize: 11, color: "#8a8478", margin: "4px 0 0" }}>
        {enabled
          ? "El agente de IA contesta solo en este hilo. Se desactiva solo si el cliente pide un humano, o si vos respondés manualmente."
          : "El agente de IA no va a contestar en este hilo hasta que lo reactives."}
      </p>
    </div>
  );
}
