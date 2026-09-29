import Link from "next/link";
import { Fraunces } from "next/font/google";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import DuplicatePageButton from "./DuplicatePageButton";

export const dynamic = "force-dynamic";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"] });

// Topic pages of each event (cronograma, expositores, el lugar…) at
// /[eventSlug]/[slug] — see the InfoPage model.
export default async function InfoPagesListPage() {
  await requirePageUser(["ADMIN"]);
  const pages = await db.infoPage.findMany({
    orderBy: [{ event: { startsAt: "desc" } }, { createdAt: "asc" }],
    include: { event: { select: { name: true, slug: true } } },
  });
  const origin = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 28, margin: "0 0 4px" }}>
          Páginas
        </h1>
        <Link
          href="/admin/pages/new"
          style={{ padding: "10px 18px", borderRadius: 999, textDecoration: "none", fontWeight: 600, background: "#1c1310", color: "#fff" }}
        >
          + Nueva página
        </Link>
      </div>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 24 }}>
        Páginas propias por tema de cada evento (cronograma, expositores, el lugar, horarios…), con los mismos bloques de la
        página del evento. Úsalas en vez de Canva en tus Links.
      </p>

      {pages.length === 0 ? (
        <p style={{ color: "#5b5f6b" }}>Todavía no hay páginas. Crea la primera con &quot;+ Nueva página&quot;.</p>
      ) : (
        <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {pages.map((p, i) => {
            const url = `${origin}/${p.event.slug}/${p.slug}`;
            return (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : "1px solid #f0efec", flexWrap: "wrap" }}
              >
                <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                  <Link href={`/admin/pages/${p.id}`} style={{ fontWeight: 600, color: "inherit" }}>
                    {p.title}
                  </Link>
                  <div style={{ fontSize: 12.5, color: "#8a8478" }}>{p.event.name}</div>
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, wordBreak: "break-all" }}>
                    {url.replace(/^https?:\/\//, "")}
                  </a>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "3px 10px",
                    background: p.published ? "#e8f6ef" : "#f0efec",
                    color: p.published ? "#0e6b4c" : "#8a8478",
                  }}
                >
                  {p.published ? "Publicada" : "Borrador"}
                </span>
                <Link href={`/admin/pages/${p.id}`} style={{ fontSize: 13 }}>
                  Editar
                </Link>
                <DuplicatePageButton pageId={p.id} title={p.title} style={{ padding: "6px 12px", fontSize: 13 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
