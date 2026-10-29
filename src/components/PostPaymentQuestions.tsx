"use client";

import { useState } from "react";

// On "¡Pago confirmado!" (/[eventSlug]/pago): the one question the one-page
// checkout leaves for after paying (2026-10-29) — optional, saved with one
// tap (see /api/register/extra).
export default function PostPaymentQuestions({ registrationId, transactionId }: { registrationId: string; transactionId: string }) {
  const [instagram, setInstagram] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!instagram.trim()) return;
    setState("saving");
    try {
      const res = await fetch("/api/register/extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, transactionId, instagram: instagram.trim() }),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "saved") {
    return <p style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-ink)", margin: "0 0 24px" }}>¡Gracias! Te vamos a buscar en redes.</p>;
  }
  return (
    <form onSubmit={save} style={{ textAlign: "left", margin: "0 0 24px" }}>
      <label htmlFor="post-payment-instagram" style={{ display: "block", fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>
        ¿Nos dejas tu @ de Instagram o TikTok? <span style={{ fontWeight: 400, color: "#5b5f6b" }}>(opcional)</span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id="post-payment-instagram"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@tuusuario"
          autoComplete="off"
          style={{ flex: 1, minWidth: 0, padding: "11px 12px", border: "1px solid #d5d7dd", borderRadius: 10, fontSize: 16 }}
        />
        <button type="submit" disabled={state === "saving" || !instagram.trim()} style={{ padding: "0 16px", borderRadius: 10, fontWeight: 700 }}>
          {state === "saving" ? "…" : "Guardar"}
        </button>
      </div>
      {state === "error" && <p style={{ fontSize: 13, color: "#a3251f", margin: "6px 0 0" }}>No pudimos guardarlo, intenta de nuevo.</p>}
    </form>
  );
}
