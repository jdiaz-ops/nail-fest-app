"use client";

import { useEffect } from "react";

// Fires once when a thread is opened — a render-time side effect (marking
// read as part of a Server Component's render) is the wrong place for
// this, so it's a tiny client component instead. Renders nothing.
export default function WhatsAppMarkRead({ conversationId }: { conversationId: string }) {
  useEffect(() => {
    fetch(`/api/admin/whatsapp/conversations/${conversationId}/read`, { method: "POST" })
      .then(() => window.dispatchEvent(new Event("whatsapp-inbox-refresh")))
      .catch(() => null);
  }, [conversationId]);
  return null;
}
