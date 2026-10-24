"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// "Retirar de esta edición" and its "Deshacer" (lib/registrationWithdrawal.ts)
// — one tap, no confirm: nothing is sent to the person, and the undo sits
// right where the button was.
export default function RegistrationEditionToggle({
  registrationId,
  state,
  withdrawnBy,
  conversationId,
}: {
  registrationId: string;
  state: "in" | "out";
  /** "Juan · 24 oct": who took them out and when. */
  withdrawnBy: string | null;
  /** The Bandeja chat it's tapped in, for the thread's internal note. */
  conversationId?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the page says after a refresh wins (a teammate may have changed it).
  useEffect(() => setCurrent(state), [state]);

  async function toggle() {
    const undo = current === "out";
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registrations/${registrationId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo, conversationId }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || "No se pudo guardar. Vuelve a intentarlo.");
      setCurrent(undo ? "in" : "out");
      router.refresh();
      window.dispatchEvent(new Event("whatsapp-inbox-refresh"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }

  const errorLine = error && (
    <p role="alert" style={{ fontSize: 11, color: "#a3212b", margin: "4px 0 0" }}>
      {error}
    </p>
  );

  if (current === "in") {
    return (
      <div>
        <button type="button" onClick={toggle} disabled={busy} style={{ width: "auto", padding: "5px 10px", fontSize: 12, color: "#a3212b" }}>
          {busy ? "Retirando…" : "Retirar de esta edición"}
        </button>
        {errorLine}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: "#a3212b" }}>Se retiró de esta edición</span>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          style={{ padding: 0, border: 0, background: "none", color: "var(--link)", fontSize: 12, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}
        >
          {busy ? "Deshaciendo…" : "Deshacer"}
        </button>
      </span>
      <span style={{ fontSize: 11, lineHeight: 1.4, color: "#8a8478" }}>
        {withdrawnBy && state === "out" ? `${withdrawnBy}. ` : ""}Ya no le llegan mensajes de este evento ni cuenta en sus estadísticas.
      </span>
      {errorLine}
    </div>
  );
}
