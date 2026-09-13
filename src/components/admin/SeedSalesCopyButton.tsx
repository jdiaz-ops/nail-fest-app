"use client";

import { useState } from "react";

// One-tap trigger for /api/admin/dev/seed-sales-copy — the phone-friendly
// counterpart to scripts/seed-manicuristas-sales-page.ts. Same content,
// same "don't overwrite something already written by hand" guardrail.
export default function SeedSalesCopyButton({
  eventId,
  hasDescription,
  descriptionLength,
}: {
  eventId: string;
  hasDescription: boolean;
  descriptionLength: number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error" | "blocked">(
    hasDescription ? "blocked" : "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function run(force: boolean) {
    setState("loading");
    setMessage(null);
    const res = await fetch("/api/admin/dev/seed-sales-copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, force }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setState("done");
      return;
    }
    if (body?.error === "already_has_description") {
      setState("blocked");
      return;
    }
    setState("error");
    setMessage("No se pudo cargar la copy. Intenta de nuevo.");
  }

  if (state === "done") {
    return <p style={{ color: "var(--accent-ink, #0b2e2c)", fontWeight: 600 }}>✓ Listo — la Descripción ya tiene la landing de venta.</p>;
  }

  if (state === "blocked") {
    return (
      <div>
        <p style={{ fontSize: 13.5, color: "#5b5f6b", margin: "0 0 8px" }}>
          Este evento ya tiene una Descripción guardada ({descriptionLength} caracteres) — no la voy a sobrescribir sin
          confirmar.
        </p>
        <button type="button" onClick={() => run(true)} style={{ background: "#c2185b", color: "#fff" }}>
          Sobrescribir de todas formas
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => run(false)} disabled={state === "loading"}>
        {state === "loading" ? "Cargando..." : "Cargar landing de venta"}
      </button>
      {message && <p style={{ fontSize: 12, color: "#c2185b", margin: "6px 0 0" }}>{message}</p>}
    </div>
  );
}
