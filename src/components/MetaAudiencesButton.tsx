"use client";

import { useState } from "react";

export default function MetaAudiencesButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    setMessage(null);
    const res = await fetch("/api/admin/meta-audiences", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setStatus("done");
      setMessage(
        `Listo — Landing visitors (${body.landing}), Checkout started (${body.checkout}), Purchasers (${body.purchasers})`
      );
    } else {
      setStatus("error");
      setMessage(body.error ?? "Algo salió mal creando las audiencias.");
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <button className="primary" onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? "Creando..." : "Crear audiencias semilla"}
      </button>
      {message && (
        <p style={{ marginTop: 12, color: status === "error" ? "#c2185b" : "#2e7a57", fontSize: 14 }}>
          {message}
        </p>
      )}
    </div>
  );
}
