"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AgentOption {
  id: string;
  label: string;
}

export default function WhatsAppAssignAgent({
  conversationId,
  agents,
  assignedToId,
}: {
  conversationId: string;
  agents: AgentOption[];
  assignedToId: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleChange(value: string) {
    setSaving(true);
    await fetch(`/api/admin/whatsapp/conversations/${conversationId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUserId: value || null }),
    });
    setSaving(false);
    router.refresh();
    window.dispatchEvent(new Event("whatsapp-inbox-refresh"));
  }

  return (
    <select value={assignedToId ?? ""} onChange={(e) => handleChange(e.target.value)} disabled={saving} style={{ width: "100%" }}>
      <option value="">Sin asignar</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label}
        </option>
      ))}
    </select>
  );
}
