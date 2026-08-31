"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WhatsAppReplyBox from "./WhatsAppReplyBox";

// Reply / Note tabs on the same thread — WhatChimp's own pattern (see the
// screenshots this was built from). A note never touches WhatsApp, it's
// purely internal (WhatsAppNote, not a WhatsAppMessage) — kept as a
// separate small composer here so WhatsAppReplyBox's own 24h-window logic
// stays untouched.
export default function WhatsAppThreadComposer({ conversationId, windowOpen }: { conversationId: string; windowOpen: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"reply" | "note">("reply");
  const [noteText, setNoteText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSending(true);
    const res = await fetch(`/api/admin/whatsapp/conversations/${conversationId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteText }),
    });
    setSending(false);
    if (res.ok) {
      setNoteText("");
      router.refresh();
      window.dispatchEvent(new Event("whatsapp-inbox-refresh"));
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, borderBottom: "1px solid #e3e1dc" }}>
        {(["reply", "note"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid #0e6b4c" : "2px solid transparent",
              color: tab === t ? "#0e6b4c" : "#5b5f6b",
              fontWeight: tab === t ? 600 : 400,
              padding: "6px 2px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {t === "reply" ? "Responder" : "Nota interna"}
          </button>
        ))}
      </div>

      {tab === "reply" ? (
        <WhatsAppReplyBox conversationId={conversationId} windowOpen={windowOpen} />
      ) : (
        <form onSubmit={handleAddNote} style={{ display: "flex", gap: 8 }}>
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Nota solo visible para el equipo — nunca se envía por WhatsApp..."
            style={{ flex: 1, padding: "10px 12px", border: "1px solid #e3e1dc", borderRadius: 8 }}
          />
          <button className="primary" type="submit" disabled={sending} style={{ width: "auto", padding: "10px 20px" }}>
            {sending ? "..." : "Agregar"}
          </button>
        </form>
      )}
    </div>
  );
}
