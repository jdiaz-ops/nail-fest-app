"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewSummary } from "@/lib/reviews";

// "De qué hablan los comentarios": the cached Claude summary and the
// button that regenerates it.
export default function ReviewSummaryBox({ eventId, summary, generatedLabel, commentCount }: { eventId: string; summary: ReviewSummary | null; generatedLabel: string | null; commentCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/events/${eventId}/resenas/resumen`, { method: "POST" });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "No se pudo generar el resumen.");
      return;
    }
    router.refresh();
  }

  return (
    <section style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>De qué hablan los comentarios</div>
        <button type="button" onClick={generate} disabled={busy || commentCount === 0} style={{ height: 32, padding: "0 12px", border: "1px solid #e3e1dc", borderRadius: 8, background: "#fff", font: "inherit", fontSize: 12, fontWeight: 700, cursor: commentCount === 0 ? "default" : "pointer", color: commentCount === 0 ? "#8a8478" : "#17181c" }}>
          {busy ? "Generando…" : summary ? "Actualizar" : "Generar resumen"}
        </button>
      </div>
      {summary && summary.themes.length > 0 ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5 }}>
            {summary.themes.map((t) => (
              <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.label}>
                  {t.label}
                </span>
                <div style={{ flex: "1 1 auto", height: 6, background: "#ece8e1", borderRadius: 999 }}>
                  <div style={{ width: `${Math.round(t.share * 100)}%`, height: "100%", background: t.sentiment === "negative" ? "#c2185b" : t.sentiment === "mixed" ? "#8a5a1f" : "#00beb5", borderRadius: 999 }} />
                </div>
                <span style={{ width: 34, textAlign: "right", color: "#5b5f6b" }}>{Math.round(t.share * 100)} %</span>
              </div>
            ))}
          </div>
          {summary.highlights.length > 0 && (
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              <strong>Lo que más valoran:</strong> {summary.highlights.join(" · ")}
            </div>
          )}
          {summary.toFix.length > 0 && (
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#a3212b" }}>
              <strong>Lo que piden corregir:</strong> {summary.toFix.join(" · ")}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 11.5, color: "#5b5f6b" }}>
            Generado con Claude sobre {summary.commentCount} comentarios{generatedLabel ? ` · ${generatedLabel}` : ""}. Lo rojo es lo que toca corregir en la próxima edición.
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: "#5b5f6b", lineHeight: 1.5 }}>
          {commentCount === 0 ? "Todavía no hay comentarios con texto." : `${commentCount} comentarios con texto. Pulsa "Generar resumen" para agruparlos por tema.`}
        </p>
      )}
      {error && <div style={{ fontSize: 12, color: "#c2185b" }}>{error}</div>}
    </section>
  );
}
