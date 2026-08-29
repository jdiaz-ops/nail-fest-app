"use client";

import ConfirmationTemplateEditor from "../../events/ConfirmationTemplateEditor";

// Thin client wrapper — ConfirmationTemplateEditor's onSave prop is a
// function, which can't cross the server/client boundary as a prop from
// a Server Component, so this owns the actual fetch() and hands the
// editor a plain callback.
export default function SaveConfirmationClient({ initialHtml }: { initialHtml: string | null }) {
  async function handleSave(html: string): Promise<{ ok: boolean }> {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationEmailHtml: html }),
    });
    return { ok: res.ok };
  }

  return <ConfirmationTemplateEditor scope="global" initialHtml={initialHtml} onSave={handleSave} />;
}
