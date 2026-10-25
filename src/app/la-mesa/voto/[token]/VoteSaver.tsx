"use client";

import { useCallback, useEffect, useState } from "react";

// Records the tap once the page is on screen (POST /api/la-mesa/voto): a
// mail scanner that only fetches the link never gets here. A preview's tap
// records nothing and says so.
export default function VoteSaver({ token, preview, saved }: { token: string; preview: boolean; saved: string }) {
  const [state, setState] = useState<"saving" | "saved" | "failed">("saving");

  const save = useCallback(async () => {
    setState("saving");
    try {
      const res = await fetch("/api/la-mesa/voto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      setState(res.ok ? "saved" : "failed");
    } catch {
      setState("failed");
    }
  }, [token]);

  useEffect(() => {
    if (!preview) void save();
  }, [preview, save]);

  const line = { margin: 0, fontSize: 14, lineHeight: 1.5, color: "#5b5f6b" } as const;
  if (preview) return <p style={line}>Vista previa: desde aquí no se guarda ningún voto.</p>;
  if (state === "saving") return <p style={line}>Guardando tu respuesta…</p>;
  if (state === "saved") return <p style={{ ...line, color: "#0d6e4f", fontWeight: 700 }}>✓ {saved}</p>;
  return (
    <p role="alert" style={{ ...line, color: "#b0225c" }}>
      No pudimos guardar tu respuesta.{" "}
      <button type="button" onClick={() => void save()} style={{ border: "none", background: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>
        Vuelve a intentarlo
      </button>
    </p>
  );
}
