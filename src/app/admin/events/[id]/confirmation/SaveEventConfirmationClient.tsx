"use client";

import ConfirmationTemplateEditor from "../../ConfirmationTemplateEditor";

export default function SaveEventConfirmationClient({
  eventId,
  initialHtml,
  initialSubject,
}: {
  eventId: string;
  initialHtml: string | null;
  initialSubject: string | null;
}) {
  async function handleSave(html: string, subject: string): Promise<{ ok: boolean }> {
    const res = await fetch(`/api/admin/events/${eventId}/confirmation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationEmailHtml: html, confirmationEmailSubject: subject }),
    });
    return { ok: res.ok };
  }

  return <ConfirmationTemplateEditor scope="event" initialHtml={initialHtml} initialSubject={initialSubject} onSave={handleSave} />;
}
