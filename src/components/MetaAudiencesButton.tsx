"use client";

import { useState } from "react";

type AudienceResult = { id: string } | { error: string };
type Results = {
  landing: AudienceResult;
  checkout: AudienceResult;
  purchasers: AudienceResult;
  purchasersSync?: AudienceResult;
};

function line(label: string, result: AudienceResult): string {
  return "id" in result ? `✅ ${label}: ${result.id}` : `⚠️ ${label}: ${result.error}`;
}

export default function MetaAudiencesButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    setError(null);
    setResults(null);
    const res = await fetch("/api/admin/meta-audiences", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setStatus("done");
      setResults({
        landing: body.landing,
        checkout: body.checkout,
        purchasers: body.purchasers,
        purchasersSync: body.purchasersSync,
      });
    } else {
      setStatus("error");
      setError(body.error ?? "Algo salió mal creando las audiencias.");
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <button className="primary" onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? "Creando..." : "Crear audiencias semilla"}
      </button>
      {results && (
        <pre
          style={{
            marginTop: 12,
            fontSize: 13,
            whiteSpace: "pre-wrap",
            background: "#f0efec",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {[
            line("Landing visitors", results.landing),
            line("Checkout started", results.checkout),
            line("Purchasers", results.purchasers),
            results.purchasersSync ? line("Purchasers — sync", results.purchasersSync) : null,
          ]
            .filter(Boolean)
            .join("\n")}
        </pre>
      )}
      {error && <p style={{ marginTop: 12, color: "#c2185b", fontSize: 14 }}>{error}</p>}
    </div>
  );
}
