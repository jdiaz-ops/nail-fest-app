"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Stars from "@/components/reviews/Stars";

export interface ModerationRow {
  id: string;
  rating: number;
  comment: string | null;
  instagramHandle: string | null;
  publishConsent: boolean;
  raffleOptIn: boolean;
  status: "PENDING" | "APPROVED" | "HIDDEN";
  featured: boolean;
  createdLabel: string;
  scannedLabel: string | null;
  personId: string;
  personName: string;
  city: string | null;
  photos: string[];
  isSample: boolean;
  // Shown on the global queue (/admin/resenas), where rows mix events.
  eventName?: string;
  eventId?: string;
}

const TABS: { key: "PENDING" | "APPROVED" | "FEATURED" | "HIDDEN"; label: string }[] = [
  { key: "PENDING", label: "Pendientes" },
  { key: "APPROVED", label: "Aprobadas" },
  { key: "FEATURED", label: "Destacadas" },
  { key: "HIDDEN", label: "Ocultas" },
];

// The moderation queue: tabs by state, one card per review with its
// photos, the door-scan proof, the consent flag and the actions.
export default function ReviewModerationList({ rows }: { rows: ModerationRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("PENDING");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "hide" | "pending" | "feature" | "unfeature") {
    setBusy(id);
    const res = await fetch(`/api/admin/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "No se pudo guardar.");
      return;
    }
    router.refresh();
  }

  const visible = rows.filter((r) => (tab === "FEATURED" ? r.featured : r.status === tab));
  const count = (key: (typeof TABS)[number]["key"]) => rows.filter((r) => (key === "FEATURED" ? r.featured : r.status === key)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{ fontSize: 13, fontWeight: tab === t.key ? 700 : 600, padding: "8px 14px", borderRadius: 999, border: tab === t.key ? "1px solid #0b2e2c" : "1px solid #e3e1dc", background: tab === t.key ? "#0b2e2c" : "#fff", color: tab === t.key ? "#fff" : "#5b5f6b", cursor: "pointer" }}
          >
            {t.label} · {count(t.key)}
          </button>
        ))}
      </div>

      {visible.length === 0 && <p style={{ color: "#5b5f6b", fontSize: 14 }}>Nada en esta lista.</p>}

      {visible.map((r) => (
        <article key={r.id} style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {r.photos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0 0 auto" }}>
              {r.photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- attendee-uploaded Blob photo */}
                  <img src={url} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", display: "block", background: "#f0efec" }} />
                </a>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 320px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Stars rating={r.rating} size={15} />
              <Link href={`/admin/crm/personas/${r.personId}`} style={{ fontSize: 14, fontWeight: 800 }}>
                {r.personName}
              </Link>
              <span style={{ fontSize: 12, color: "#5b5f6b" }}>
                {r.city ? `${r.city} · ` : ""}
                {r.instagramHandle ? `@${r.instagramHandle} · ` : ""}
                {r.createdLabel}
              </span>
              {r.eventName && r.eventId && (
                <Link href={`/admin/events/${r.eventId}/resenas`} style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#f6f5f2", color: "#17181c", textDecoration: "none" }}>
                  {r.eventName}
                </Link>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#e6f9f7", color: "#0b2e2c" }}>{r.scannedLabel ? `Asistió · escaneada ${r.scannedLabel}` : "Asistió"}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: r.publishConsent ? "#e8f6ef" : "#f6f5f2", color: r.publishConsent ? "#0e6b4c" : "#5b5f6b" }}>Permiso de publicar · {r.publishConsent ? "sí" : "no"}</span>
              {r.raffleOptIn && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#fdf1e6", color: "#8a5a1f" }}>En el sorteo</span>}
              {r.featured && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#ffc5a8", color: "#1c1310" }}>Destacada</span>}
              {r.isSample && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#fbe9ea", color: "#a3212b" }}>Muestra</span>}
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.comment ?? <span style={{ color: "#8a8478" }}>Sin comentario, solo calificación.</span>}</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {r.status !== "APPROVED" && (
                <button type="button" disabled={busy === r.id} onClick={() => act(r.id, "approve")} style={{ height: 36, padding: "0 14px", border: "none", borderRadius: 9, background: "#0e6b4c", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Aprobar
                </button>
              )}
              {r.publishConsent && !r.featured && (
                <button type="button" disabled={busy === r.id} onClick={() => act(r.id, "feature")} style={{ height: 36, padding: "0 14px", border: "1px solid #e3e1dc", borderRadius: 9, background: "#fff", color: "#17181c", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {r.status === "APPROVED" ? "Destacar" : "Aprobar y destacar"}
                </button>
              )}
              {r.featured && (
                <button type="button" disabled={busy === r.id} onClick={() => act(r.id, "unfeature")} style={{ height: 36, padding: "0 14px", border: "1px solid #e3e1dc", borderRadius: 9, background: "#fff", color: "#17181c", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Quitar destacado
                </button>
              )}
              {r.status !== "HIDDEN" ? (
                <button type="button" disabled={busy === r.id} onClick={() => act(r.id, "hide")} style={{ height: 36, padding: "0 10px", border: "none", background: "transparent", color: "#c2185b", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Ocultar
                </button>
              ) : (
                <button type="button" disabled={busy === r.id} onClick={() => act(r.id, "pending")} style={{ height: 36, padding: "0 10px", border: "none", background: "transparent", color: "#5b5f6b", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Volver a pendientes
                </button>
              )}
              {!r.publishConsent && <span style={{ fontSize: 12, color: "#5b5f6b" }}>Sin permiso: cuenta en el promedio, no se muestra con nombre.</span>}
              {r.publishConsent && (
                <a href={`/api/admin/reviews/${r.id}/tarjeta`} style={{ fontSize: 13, fontWeight: 700, marginLeft: "auto" }}>
                  Tarjeta para Instagram
                </a>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
