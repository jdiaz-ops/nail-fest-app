"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Crear reseñas de muestra" / "Borrar reseñas de muestra" — see
// lib/reviews.ts's createSampleReviews. Admin only.
export default function SampleReviewsBox({ eventId, eventSlug, count }: { eventId: string; eventSlug: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(method: "POST" | "DELETE") {
    if (method === "DELETE" && !confirm("¿Borrar las reseñas de muestra y sus personas de prueba?")) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/events/${eventId}/resenas/muestra`, { method });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error || "No se pudo.");
      return;
    }
    router.refresh();
  }

  return (
    <section style={{ background: "#fff", border: "1px dashed #c9c5bd", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>Datos de muestra</div>
      <p style={{ margin: 0, fontSize: 12.5, color: "#5b5f6b", lineHeight: 1.5 }}>
        {count > 0
          ? `Hay ${count} reseñas de muestra en este evento. Solo las ves tú y el equipo con sesión iniciada: en la home, en /${eventSlug}, en nailfest.lat/resenas y en los links. El público no las ve.`
          : "Crea 12 reseñas de prueba, con personas e inscripciones de prueba, para ver cómo quedan los bloques, la insignia y esta página. El público no las ve: solo quien tenga sesión iniciada en el admin."}
      </p>
      {count > 0 ? (
        <button type="button" onClick={() => run("DELETE")} disabled={busy} style={{ alignSelf: "flex-start", height: 36, padding: "0 14px", border: "1px solid #e3e1dc", borderRadius: 9, background: "#fff", color: "#c2185b", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {busy ? "Borrando…" : "Borrar reseñas de muestra"}
        </button>
      ) : (
        <button type="button" onClick={() => run("POST")} disabled={busy} style={{ alignSelf: "flex-start", height: 36, padding: "0 14px", border: "1px solid #e3e1dc", borderRadius: 9, background: "#fff", color: "#17181c", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {busy ? "Creando…" : "Crear 12 reseñas de muestra"}
        </button>
      )}
      {msg && <div style={{ fontSize: 12, color: "#c2185b" }}>{msg}</div>}
    </section>
  );
}
