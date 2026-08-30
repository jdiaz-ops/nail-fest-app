"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LabelRow {
  id: string;
  name: string;
}

export default function WhatsAppPersonLabels({ conversationId, labels }: { conversationId: string; labels: LabelRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/whatsapp/conversations/${conversationId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body?.message ?? "No se pudo agregar la etiqueta.");
    }
  }

  async function handleRemove(labelId: string) {
    setBusy(true);
    await fetch(`/api/admin/whatsapp/conversations/${conversationId}/labels/${labelId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {labels.map((l) => (
          <span
            key={l.id}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "#f0efec", borderRadius: 999, padding: "3px 10px" }}
          >
            {l.name}
            <button type="button" onClick={() => handleRemove(l.id)} disabled={busy} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a8478", padding: 0, lineHeight: 1 }}>
              ×
            </button>
          </span>
        ))}
        {labels.length === 0 && <span style={{ fontSize: 12, color: "#8a8478" }}>Sin etiquetas.</span>}
      </div>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 6 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Escribe y presiona Enter"
          style={{ flex: 1, fontSize: 13, padding: "6px 8px", border: "1px solid #e3e1dc", borderRadius: 6 }}
        />
      </form>
      {error && <p style={{ fontSize: 12, color: "#c2185b", margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}
