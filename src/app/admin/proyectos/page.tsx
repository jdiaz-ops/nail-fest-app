import Link from "next/link";
import type { CSSProperties } from "react";
import { requirePageUser } from "@/lib/auth/guard";
import { getCuponeraSettings } from "@/lib/cuponera/settings";
import { db } from "@/lib/db";
import { getLibrarySettings } from "@/lib/library/settings";
import { LIBRARY_ADMIN_NAME } from "@/lib/library/texts";

export const dynamic = "force-dynamic";

// Proyectos (2026-10-25): Nail Fest's projects beyond the events, in one
// tab — the cuponera, the instructors' directory and the reviews — each
// with whether it's public and the way into its editor. The team
// (COORDINADOR) sees the ones its role opens: the reviews.

const card: CSSProperties = { background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: 22, display: "flex", flexDirection: "column", gap: 10 };
const pill = (on: boolean): CSSProperties => ({
  alignSelf: "flex-start",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: on ? "#e3f6ee" : "#f0efec",
  color: on ? "#0d6e4f" : "#5b5f6b",
});
const open: CSSProperties = { alignSelf: "flex-start", padding: "8px 18px", borderRadius: 999, background: "#12966b", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" };

interface Project {
  name: string;
  what: string;
  states: { label: string; on: boolean }[];
  editor: { href: string; label: string };
  page: string;
}

export default async function ProjectsPage() {
  const user = await requirePageUser(["ADMIN", "COORDINADOR"]);
  const admin = user.role === "ADMIN";
  const [cuponera, library, toReview] = await Promise.all([
    admin ? getCuponeraSettings() : null,
    admin ? getLibrarySettings() : null,
    db.review.count({ where: { status: "PENDING", isSample: false } }),
  ]);

  const projects: Project[] = [
    ...(cuponera
      ? [
          {
            name: "Cuponera",
            what: "Los descuentos de las marcas, cada uno con su código, en nailfest.lat/cuponera.",
            states: [{ label: cuponera.published ? "Pública" : "Oculta: solo la ve el equipo", on: cuponera.published }],
            editor: { href: "/admin/cuponera", label: "Editar cuponera" },
            page: "/cuponera",
          },
        ]
      : []),
    ...(library
      ? [
          {
            name: "Directorio de instructoras",
            what: "Los perfiles de las instructoras por ciudad y especialidad, en nailfest.lat/instructoras, y su portal para manejarlos.",
            states: [
              { label: library.instructorsPublished ? "Público" : "Oculto: solo lo ve el equipo", on: library.instructorsPublished },
              { label: library.portalOpen ? "Registro abierto" : "Registro cerrado", on: library.portalOpen },
            ],
            editor: { href: "/admin/biblioteca?tab=instructoras", label: LIBRARY_ADMIN_NAME },
            page: "/instructoras",
          },
        ]
      : []),
    {
      name: "Reseñas",
      what: "Lo que cuentan las asistentes de cada evento, con sus fotos, en nailfest.lat/resenas.",
      states: [
        { label: "Siempre pública", on: true },
        ...(toReview > 0 ? [{ label: toReview === 1 ? "1 por revisar" : `${toReview} por revisar`, on: false }] : []),
      ],
      editor: { href: "/admin/resenas", label: "Abrir reseñas" },
      page: "/resenas",
    },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Proyectos</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0 }}>Los proyectos de Nail Fest fuera de los eventos, cada uno con su estado.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 20 }}>
        {projects.map((p) => (
          <section key={p.name} style={card} aria-label={p.name}>
            <h2 style={{ fontSize: 17, margin: 0 }}>{p.name}</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {p.states.map((s) => (
                <span key={s.label} style={pill(s.on)}>
                  {s.label}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 13.5, color: "#5b5f6b", margin: 0, lineHeight: 1.5, flex: 1 }}>{p.what}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <Link href={p.editor.href} style={open}>
                {p.editor.label}
              </Link>
              <a href={p.page} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#007a74" }}>
                Ver la página ↗
              </a>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
