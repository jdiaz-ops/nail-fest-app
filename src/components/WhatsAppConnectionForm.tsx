"use client";

import { useState } from "react";

// Same shape/pattern as MetaConnectionForm.tsx.
export default function WhatsAppConnectionForm({ webhookUrl }: { webhookUrl: string }) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const res = await fetch("/api/admin/whatsapp/connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: String(form.get("accessToken") ?? ""),
        wabaId: String(form.get("wabaId") ?? ""),
        phoneNumberId: String(form.get("phoneNumberId") ?? ""),
        displayPhoneNumber: String(form.get("displayPhoneNumber") ?? ""),
        webhookVerifyToken: String(form.get("webhookVerifyToken") ?? ""),
      }),
    });

    if (res.ok) {
      setStatus("done");
      formEl.reset();
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setErrorMessage(body?.issues ? "Revisa que todos los campos estén llenos y bien copiados." : "Algo salió mal guardando la conexión.");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 700 }}>
      <div className="field">
        <label htmlFor="accessToken">Token de acceso (System User, permanente)</label>
        <input id="accessToken" name="accessToken" type="password" required autoComplete="off" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label htmlFor="wabaId">WhatsApp Business Account ID</label>
          <input id="wabaId" name="wabaId" required />
        </div>
        <div className="field">
          <label htmlFor="phoneNumberId">Phone number ID</label>
          <input id="phoneNumberId" name="phoneNumberId" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="displayPhoneNumber">Número (solo para mostrar aquí, opcional)</label>
        <input id="displayPhoneNumber" name="displayPhoneNumber" placeholder="+57 3xx xxx xxxx" />
      </div>
      <div className="field">
        <label htmlFor="webhookVerifyToken">Verify token del webhook</label>
        <input id="webhookVerifyToken" name="webhookVerifyToken" required placeholder="Invéntate una clave larga" />
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
          Pega este mismo valor en Meta App Dashboard → WhatsApp → Configuration → Webhook, junto con esta URL:{" "}
          <code style={{ background: "#f6f5f2", padding: "2px 6px", borderRadius: 4 }}>{webhookUrl}</code>
        </p>
      </div>

      <button className="primary" type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Guardando..." : "Guardar conexión"}
      </button>

      {status === "done" && (
        <p style={{ color: "#2e7a57", marginTop: 12 }}>
          Guardado. El token queda cifrado en la base de datos — esta pantalla no lo vuelve a mostrar.
        </p>
      )}
      {status === "error" && errorMessage && <p style={{ color: "#c2185b", marginTop: 12 }}>{errorMessage}</p>}
    </form>
  );
}
