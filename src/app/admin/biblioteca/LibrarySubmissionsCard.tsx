"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminSubmission } from "@/lib/library/admin";
import { LIBRARY_THEMES, youtubeThumbnail } from "@/lib/library/shared";
import { api, CardTitle, cardStyle, mutedText, primaryButtonStyle, secondaryButtonStyle } from "../cuponera/ui";
import { FormError, rowStyle } from "./ui";

const themeLabel = (key: string) => LIBRARY_THEMES.find((t) => t.key === key)?.label ?? key;

// Editar biblioteca → Videos → "Enviados por instructoras": what they sent
// from their portal, waiting for the team. "Aceptar y editar" makes it a
// hidden library video with her ficha and opens it to finish; "No
// seleccionar" closes it. She sees where each one stands in her portal;
// nothing is sent to her.
export default function LibrarySubmissionsCard({ submissions }: { submissions: AdminSubmission[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (submissions.length === 0) return null;

  async function review(s: AdminSubmission, action: "accept" | "decline") {
    if (action === "decline" && !confirm(`¿No seleccionar «${s.title}»? En su portal saldrá como «No seleccionado».`)) return;
    setBusyId(s.id);
    setError(null);
    try {
      const body = await api<{ videoId?: string }>(`/api/admin/library/submissions/${s.id}`, { method: "POST", body: JSON.stringify({ action }) });
      if (body.videoId) router.push(`/admin/biblioteca?tab=videos&editar=${body.videoId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message === "already_reviewed" ? "Alguien del equipo ya revisó ese video." : "No se pudo. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ ...cardStyle, borderColor: "#d9cff6", background: "#faf8ff" }}>
      <CardTitle>Enviados por instructoras ({submissions.length})</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Videos que mandaron desde su portal, con su ficha. «Aceptar y editar» lo pasa a la biblioteca apagado, para que lo revises y lo prendas; en su portal sale
        «Publicado» cuando lo prendes.
      </p>
      {error && <FormError>{error}</FormError>}
      {submissions.map((s) => (
        <div key={s.id} style={{ ...rowStyle, alignItems: "flex-start" }}>
          <a href={`https://www.youtube.com/watch?v=${s.youtubeId}`} target="_blank" rel="noreferrer" title="Verlo en YouTube" style={{ flex: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
            <img src={youtubeThumbnail(s.youtubeId)} alt="" width={64} height={86} style={{ objectFit: "cover", borderRadius: 8, display: "block", background: "#efece7" }} />
          </a>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
            <div style={{ ...mutedText, fontSize: 12 }}>
              {s.instructorName} · {themeLabel(s.theme)} · {s.createdAtLabel}
            </div>
            {s.description && <p style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.45 }}>{s.description}</p>}
            {s.tags.length > 0 && <div style={{ ...mutedText, fontSize: 12, marginTop: 4 }}>Etiquetas: {s.tags.join(", ")}</div>}
            {s.products.length > 0 && <div style={{ ...mutedText, fontSize: 12, marginTop: 4 }}>Lo que usó: {s.products.join(" · ")}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" style={primaryButtonStyle} disabled={busyId === s.id} onClick={() => review(s, "accept")}>
                Aceptar y editar
              </button>
              <button type="button" style={secondaryButtonStyle} disabled={busyId === s.id} onClick={() => review(s, "decline")}>
                No seleccionar
              </button>
              <a href={`https://www.youtube.com/watch?v=${s.youtubeId}`} target="_blank" rel="noreferrer" style={{ ...secondaryButtonStyle, textDecoration: "none" }}>
                Ver en YouTube ↗
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
