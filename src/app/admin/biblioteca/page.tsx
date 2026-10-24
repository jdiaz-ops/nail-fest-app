import Link from "next/link";
import { requirePageUser } from "@/lib/auth/guard";
import { getLibraryAdminData } from "@/lib/library/admin";
import LibraryPublishCard from "./LibraryPublishCard";
import LibraryVideosEditor from "./LibraryVideosEditor";
import LibraryInstructorsEditor from "./LibraryInstructorsEditor";
import LibraryClassesEditor from "./LibraryClassesEditor";
import LibraryLeadsList from "./LibraryLeadsList";
import LibraryTextsForm from "./LibraryTextsForm";

export const dynamic = "force-dynamic";

const TABS = ["videos", "instructoras", "clases", "registros", "textos"] as const;
type Tab = (typeof TABS)[number];

// "Editar biblioteca" — the editor of nailfest.lat/biblioteca and
// nailfest.lat/instructoras, a top-level nav item next to Editar cuponera
// (ADMIN-only, same as it). Videos, instructors, their classes, what people
// send from the forms, and every text and section of the pages.
export default async function AdminBibliotecaPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requirePageUser(["ADMIN"]);
  const data = await getLibraryAdminData();
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as Tab) : "videos";
  const upcomingClasses = data.classes.filter((c) => !c.past).length;
  const pending = Object.values(data.pendingLeads).reduce((a, b) => a + b, 0);
  const labels: Record<Tab, string> = {
    videos: `Videos (${data.videos.length})`,
    instructoras: `Instructoras (${data.instructors.length})`,
    clases: `Clases (${upcomingClasses})`,
    registros: pending > 0 ? `Registros (${pending} sin atender)` : "Registros",
    textos: "Textos y secciones",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Editar biblioteca</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 4 }}>
        La biblioteca de videos en nailfest.lat/biblioteca y el directorio de Instructoras Nail Fest en nailfest.lat/instructoras: los videos y
        grabaciones, las instructoras y sus clases, lo que llega de los formularios y los textos de cada página.
      </p>
      <p style={{ fontSize: 13, marginTop: 0 }}>
        <a href="/biblioteca" target="_blank" rel="noreferrer">
          Ver la biblioteca ↗
        </a>
        {" · "}
        <a href="/instructoras" target="_blank" rel="noreferrer">
          Ver las instructoras ↗
        </a>
      </p>

      <LibraryPublishCard published={data.settings.published} instructorsPublished={data.settings.instructorsPublished} />

      <nav aria-label="Secciones de Editar biblioteca" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 24 }}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/biblioteca?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #e3e1dc",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              background: t === tab ? "#17181c" : "#fff",
              color: t === tab ? "#fff" : "#17181c",
            }}
          >
            {labels[t]}
          </Link>
        ))}
      </nav>

      {tab === "videos" && <LibraryVideosEditor videos={data.videos} instructors={data.instructors} products={data.cuponeraProducts} />}
      {tab === "instructoras" && <LibraryInstructorsEditor instructors={data.instructors} />}
      {tab === "clases" && <LibraryClassesEditor classes={data.classes} instructors={data.instructors} />}
      {tab === "registros" && <LibraryLeadsList leads={data.leads} pending={data.pendingLeads} />}
      {tab === "textos" && (
        <LibraryTextsForm texts={data.settings.texts} sections={data.settings.sections} popularSearches={data.settings.popularSearches} usual={data.settings.usual} />
      )}
    </div>
  );
}
