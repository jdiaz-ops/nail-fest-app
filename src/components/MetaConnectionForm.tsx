"use client";

import { useState } from "react";

export default function MetaConnectionForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/meta-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemUserToken: String(form.get("systemUserToken") ?? ""),
        adAccountId: String(form.get("adAccountId") ?? ""),
        pixelId: String(form.get("pixelId") ?? ""),
      }),
    });

    if (res.ok) {
      setStatus("done");
      e.currentTarget.reset();
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setErrorMessage(body?.issues ? "Revisa que los tres campos estén llenos y bien copiados." : "Algo salió mal guardando la conexión.");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
      <div className="field">
        <label htmlFor="systemUserToken">System User Access Token</label>
        <input id="systemUserToken" name="systemUserToken" type="password" required autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="adAccountId">Ad Account ID</label>
        <input id="adAccountId" name="adAccountId" placeholder="act_1234567890 o solo 1234567890" required />
      </div>
      <div className="field">
        <label htmlFor="pixelId">Pixel ID</label>
        <input id="pixelId" name="pixelId" required />
      </div>

      <button className="primary" type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Guardando..." : "Guardar conexión"}
      </button>

      {status === "done" && (
        <p style={{ color: "#2e7a57", marginTop: 12 }}>
          Guardado. El token queda cifrado en la base de datos — esta pantalla no lo vuelve a mostrar.
        </p>
      )}
      {status === "error" && errorMessage && (
        <p style={{ color: "#c2185b", marginTop: 12 }}>{errorMessage}</p>
      )}
    </form>
  );
}
