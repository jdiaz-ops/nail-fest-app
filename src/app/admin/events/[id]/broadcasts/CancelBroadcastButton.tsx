"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// «Anular» a scheduled email (the team, 2026-11-07): after a confirmation,
// it won't go out to anyone; it stays on the list as «Anulado».
export default function CancelBroadcastButton({ url, subject, when }: { url: string; subject: string; when: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function handle() {
    if (!confirm(`¿Anular «${subject}»${when ? ` (programado para ${when})` : ""}? No se enviará a nadie. Queda en la lista como «Anulado».`)) return;
    setBusy(true);
    const res = await fetch(url, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body?.message ?? "No se pudo anular. Vuelve a intentarlo.");
    }
    router.refresh();
  }
  return (
    <button type="button" onClick={handle} disabled={busy} style={{ background: "none", border: "none", color: "#a3212b", cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}>
      {busy ? "Anulando…" : "Anular"}
    </button>
  );
}
