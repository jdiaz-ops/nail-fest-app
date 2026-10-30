"use client";

import ConfirmationTemplateEditor, { type EventDesign } from "../../ConfirmationTemplateEditor";

export default function SaveEventConfirmationClient({
  eventId,
  initialHtml,
  initialSubject,
  design,
}: {
  eventId: string;
  initialHtml: string | null;
  initialSubject: string | null;
  design: Omit<EventDesign, "previewUrl"> | null;
}) {
  async function handleSave(html: string, subject: string, useDesign: boolean, extras: { shareText?: string } = {}): Promise<{ ok: boolean }> {
    const res = await fetch(`/api/admin/events/${eventId}/confirmation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationEmailHtml: html,
        confirmationEmailSubject: subject,
        confirmationEmailDesign: useDesign && design ? design.kind : null,
        ...(extras.shareText !== undefined ? { shareText: extras.shareText } : {}),
      }),
    });
    return { ok: res.ok };
  }

  return (
    <ConfirmationTemplateEditor
      scope="event"
      initialHtml={initialHtml}
      initialSubject={initialSubject}
      design={design ? { ...design, previewUrl: `/api/admin/events/${eventId}/confirmation/preview` } : undefined}
      testUrl={`/api/admin/events/${eventId}/confirmation/test`}
      onSave={handleSave}
    />
  );
}
