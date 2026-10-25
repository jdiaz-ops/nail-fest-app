"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, CardTitle, cardStyle, mutedText, Switch } from "../cuponera/ui";

type Key = "published" | "instructorsPublished" | "portalOpen";

// Whether nailfest.lat/biblioteca and nailfest.lat/instructoras are public,
// and whether anyone can make a profile in the instructors' portal — each
// with its own switch, saved on the spot (same as the cuponera's).
export default function LibraryPublishCard({ published, instructorsPublished, portalOpen }: { published: boolean; instructorsPublished: boolean; portalOpen: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ published, instructorsPublished, portalOpen });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: Key, next: boolean) {
    if (key === "portalOpen") {
      if (next && !confirm("¿Abrir el registro? Cualquier instructora podrá crear su perfil en nailfest.lat/instructoras/unirme. Cada perfil sale solo cuando el equipo lo aprueba.")) return;
      if (!next && !confirm("¿Cerrar el registro? Nadie nuevo podrá crear su perfil; las que ya tienen cuenta siguen entrando.")) return;
    } else {
      const where = key === "published" ? "El Taller en nailfest.lat/biblioteca" : "el directorio en nailfest.lat/instructoras";
      if (next && !confirm(`¿Publicar ${where}? Cualquier persona podrá verla. Los ejemplos inventados nunca se muestran al público.`)) return;
      if (!next && !confirm("¿Volver a ocultarla? Solo el equipo podrá verla.")) return;
    }
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

  const line = (key: Key, label: string, on: string, off: string) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0", borderTop: "1px solid #efece7" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ ...mutedText, fontSize: 12 }}>{state[key] ? on : off}</div>
      </div>
      <Switch checked={state[key]} disabled={busy} label={`${label}: ${state[key] ? on.split(":")[0] : off.split(":")[0]}`} onChange={(next) => toggle(key, next)} />
    </div>
  );
  const hidden = "Oculta: solo el equipo con sesión iniciada la ve; las demás personas ven «página no encontrada».";

  return (
    <div style={cardStyle}>
      <CardTitle>Publicación</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Mientras se va llenando, el equipo ve ejemplos inventados (marcados «Ejemplo») en las secciones que todavía tienen poco. Al público
        solo se le muestra lo real.
      </p>
      {line("published", "El Taller", "Público: cualquier persona lo ve en nailfest.lat/biblioteca.", hidden)}
      {line("instructorsPublished", "Instructoras", "Pública: cualquier persona la ve en nailfest.lat/instructoras.", hidden)}
      {line(
        "portalOpen",
        "Registro de instructoras",
        "Abierto: cualquier instructora crea su perfil en nailfest.lat/instructoras/unirme y el equipo lo aprueba antes de que salga.",
        "Cerrado: solo el equipo ve la página de registro. Las instructoras que invites con su enlace igual pueden entrar a su portal.",
      )}
      {error && <p style={{ color: "#b0225c", fontSize: 13, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
