"use client";

import { useState } from "react";

export default function ResendTicketForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    await fetch("/api/resend-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    // Same message whether or not the email matched anything — see the
    // API route's own comment on why.
    setStatus("done");
  }

  if (status === "done") {
    return <p>Si ese correo tiene una entrada activa, ya te la reenviamos — revisa tu bandeja.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="resendEmail">Correo electrónico</label>
        <input id="resendEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <button className="primary" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Enviando…" : "Reenviar mi entrada"}
      </button>
    </form>
  );
}
