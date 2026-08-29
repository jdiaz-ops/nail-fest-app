"use client";

import ConfirmationTemplateEditor from "../../ConfirmationTemplateEditor";

export default function SaveEventConfirmationClient({ eventId, initialHtml }: { eventId: string; initialHtml: string | null }) {
  async function handleSave(html: string): Promise<{ ok: boolean }> {
    const res = await fetch(`/api/admin/events/${eventId}/confirmation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationEmailHtml: html }),
    });
    return { ok: res.ok };
  }

  return <ConfirmationTemplateEditor scope="event" initialHtml={initialHtml} onSave={handleSave} />;
}
