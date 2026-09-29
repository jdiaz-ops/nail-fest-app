"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Asks for the copy's title — its address is built from that title — and
// opens the new page's editor. The copy starts as a draft.
export default function DuplicatePageButton({ pageId, title, style }: { pageId: string; title: string; style?: React.CSSProperties }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const newTitle = window.prompt("Título de la copia (la dirección se crea con este nombre):", `${title} (copia)`)?.trim();
    if (!newTitle) return;
    setBusy(true);
    const res = await fetch(`/api/admin/pages/${pageId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    }).catch(() => null);
    setBusy(false);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok || !body?.id) {
      alert("No se pudo duplicar la página. Intenta de nuevo.");
      return;
    }
    router.push(`/admin/pages/${body.id}`);
    router.refresh();
  }

  return (
    <button type="button" className="secondary" onClick={handleClick} disabled={busy} style={{ width: "auto", padding: "10px 16px", ...style }}>
      {busy ? "Duplicando…" : "Duplicar"}
    </button>
  );
}
