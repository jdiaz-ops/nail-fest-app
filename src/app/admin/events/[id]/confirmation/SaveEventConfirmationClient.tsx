"use client";

import ConfirmationTemplateEditor from "../../ConfirmationTemplateEditor";

export default function SaveEventConfirmationClient({
  eventId,
  initialHtml,
  initialSubject,
  designAvailable,
  initialDesign,
  initialShareText,
}: {
  eventId: string;
  initialHtml: string | null;
  initialSubject: string | null;
  designAvailable: boolean;
  initialDesign: boolean;
  initialShareText: string;
}) {
  async function handleSave(html: string, subject: string, design: boolean, shareText?: string): Promise<{ ok: boolean }> {
    const res = await fetch(`/api/admin/events/${eventId}/confirmation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationEmailHtml: html,
        confirmationEmailSubject: subject,
        confirmationEmailDesign: design ? "IMPARABLES" : null,
        ...(shareText !== undefined ? { shareText } : {}),
      }),
    });
    return { ok: res.ok };
  }

  return (
    <ConfirmationTemplateEditor
      scope="event"
      initialHtml={initialHtml}
      initialSubject={initialSubject}
      design={designAvailable ? { initial: initialDesign, previewUrl: `/api/admin/events/${eventId}/confirmation/preview`, shareText: initialShareText } : undefined}
      testUrl={`/api/admin/events/${eventId}/confirmation/test`}
      onSave={handleSave}
    />
  );
}
