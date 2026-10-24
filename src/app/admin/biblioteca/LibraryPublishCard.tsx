"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, CardTitle, cardStyle, mutedText, Switch } from "../cuponera/ui";

// Whether nailfest.lat/biblioteca and nailfest.lat/instructoras are public
// — each with its own switch, saved on the spot (same as the cuponera's).
export default function LibraryPublishCard({ published, instructorsPublished }: { published: boolean; instructorsPublished: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ published, instructorsPublished });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: "published" | "instructorsPublished", next: boolean) {
    const where = key === "published" ? "la biblioteca en nailfest.lat/biblioteca" : "el directorio en nailfest.lat/instructoras";
    if (next && !confirm(`¿Publicar ${where}? Cualquier persona podrá verla. Los ejemplos inventados nunca se muestran al público.`)) return;
    if (!next && !confirm("¿Volver a ocultarla? Solo el equipo podrá verla.")) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/library/settings", { method: "PATCH", body: JSON.stringify({ [key]: next }) });
      setState((s) => ({ ...s, [key]: next }));
      router.refresh();
    } catch {
      setError("No se pudo cambiar. Vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }

  const line = (key: "published" | "instructorsPublished", label: string, url: string) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0", borderTop: "1px solid #efece7" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ ...mutedText, fontSize: 12 }}>
          {state[key] ? `Pública: cualquier persona la ve en ${url}.` : "Oculta: solo el equipo con sesión iniciada la ve; las demás personas ven «página no encontrada»."}
        </div>
      </div>
      <Switch checked={state[key]} disabled={busy} label={state[key] ? `${label}: pública` : `${label}: oculta`} onChange={(next) => toggle(key, next)} />
    </div>
  );

  return (
    <div style={cardStyle}>
      <CardTitle>Publicación</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Mientras se va llenando, el equipo ve ejemplos inventados (marcados «Ejemplo») en las secciones que todavía tienen poco. Al público
        solo se le muestra lo real.
      </p>
      {line("published", "Biblioteca", "nailfest.lat/biblioteca")}
      {line("instructorsPublished", "Instructoras", "nailfest.lat/instructoras")}
      {error && <p style={{ color: "#b0225c", fontSize: 13, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
