import Link from "next/link";
import { requirePageUser } from "@/lib/auth/guard";
import { getLibraryAdminData } from "@/lib/library/admin";
import { LIBRARY_ADMIN_NAME, VIDEOS_HIDDEN } from "@/lib/library/texts";
import { countYoutubeToReview, getYoutubeAdminData } from "@/lib/library/youtubeImport";
import LibraryPublishCard from "./LibraryPublishCard";
import LibraryVideosEditor from "./LibraryVideosEditor";
import LibraryInstructorsEditor from "./LibraryInstructorsEditor";
import LibraryLeadsList from "./LibraryLeadsList";
import LibrarySubmissionsCard from "./LibrarySubmissionsCard";
import LibraryTextsForm from "./LibraryTextsForm";
import LibraryYoutubeImport from "./LibraryYoutubeImport";

export const dynamic = "force-dynamic";

// No "Clases" tab since 2026-10-24: profiles don't carry classes (its
// editor, LibraryClassesEditor, stays for if they come back). No Videos and
// YouTube tabs while the videos are hidden (VIDEOS_HIDDEN): their editors
// stay, with everything in them, for when they come back.
const ALL_TABS = ["videos", "youtube", "instructoras", "registros", "textos"] as const;
type Tab = (typeof ALL_TABS)[number];
const TABS: readonly Tab[] = VIDEOS_HIDDEN ? ["instructoras", "registros", "textos"] : ALL_TABS;
const FIRST_TAB: Tab = VIDEOS_HIDDEN ? "instructoras" : "videos";

// "Editar biblioteca" — the editor of nailfest.lat/biblioteca and
// nailfest.lat/instructoras, a top-level nav item next to Editar cuponera
// (ADMIN-only, same as it). Videos (and the ones instructors send from
// their portal), instructors (and the profiles waiting for review), what
// people send from the forms, and every text and section of the pages.
export default async function AdminBibliotecaPage({ searchParams }: { searchParams: { tab?: string; editar?: string } }) {
  await requirePageUser(["ADMIN"]);
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as Tab) : FIRST_TAB;
  const [data, youtubeToReview, youtube] = await Promise.all([
    getLibraryAdminData(),
    VIDEOS_HIDDEN ? 0 : countYoutubeToReview(),
    tab === "youtube" ? getYoutubeAdminData() : null,
  ]);
  const pending = Object.values(data.pendingLeads).reduce((a, b) => a + b, 0);
  // Each profile to approve and each password request is one thing to do.
  const toReview = data.instructors.filter((i) => i.status === "review").length + data.instructors.filter((i) => i.account?.resetRequestedLabel).length;
  const labels: Record<Tab, string> = {
    videos: data.submissions.length > 0 ? `Videos (${data.videos.length} · ${data.submissions.length} por revisar)` : `Videos (${data.videos.length})`,
    youtube: youtubeToReview > 0 ? `YouTube (${youtubeToReview} por revisar)` : "YouTube",
    instructoras: toReview > 0 ? `Instructoras (${data.instructors.length} · ${toReview} por revisar)` : `Instructoras (${data.instructors.length})`,
    registros: pending > 0 ? `Registros (${pending} sin atender)` : "Registros",
    textos: "Textos y secciones",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>{LIBRARY_ADMIN_NAME}</h1>
      {VIDEOS_HIDDEN ? (
        <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 4 }}>
          El directorio de instructoras en nailfest.lat/instructoras: los perfiles de las instructoras (y los que llegan del portal para revisar), lo
          que llega de los formularios y los textos de cada página.
        </p>
      ) : (
        <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 4 }}>
          El Taller (los videos) en nailfest.lat/biblioteca y el directorio de instructoras en nailfest.lat/instructoras: los videos y grabaciones (y
          los que envían las instructoras), los perfiles de las instructoras (y los que llegan del portal para revisar), lo que llega de los
          formularios y los textos de cada página.
        </p>
      )}
      <p style={{ fontSize: 13, marginTop: 0 }}>
        {!VIDEOS_HIDDEN && (
          <>
            <a href="/biblioteca" target="_blank" rel="noreferrer">
              Ver El Taller ↗
            </a>
            {" · "}
          </>
        )}
        <a href="/instructoras" target="_blank" rel="noreferrer">
          Ver las instructoras ↗
        </a>
      </p>

      <LibraryPublishCard
        library={!VIDEOS_HIDDEN}
        published={data.settings.published}
        instructorsPublished={data.settings.instructorsPublished}
        portalOpen={data.settings.portalOpen}
      />

      <nav aria-label={`Secciones de ${LIBRARY_ADMIN_NAME}`} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 24 }}>
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

      {tab === "videos" && (
        <>
          <LibrarySubmissionsCard submissions={data.submissions} />
          <LibraryVideosEditor
            key={searchParams.editar ?? "videos"}
            videos={data.videos}
            instructors={data.instructors}
            products={data.cuponeraProducts}
            subcategories={data.subcategories}
            openId={searchParams.editar ?? null}
          />
        </>
      )}
      {tab === "youtube" && youtube && <LibraryYoutubeImport data={youtube} instructors={data.instructors.map((i) => ({ id: i.id, name: i.name }))} />}
      {tab === "instructoras" && <LibraryInstructorsEditor instructors={data.instructors} />}
      {tab === "registros" && <LibraryLeadsList leads={data.leads} pending={data.pendingLeads} />}
      {tab === "textos" && (
        <LibraryTextsForm texts={data.settings.texts} sections={data.settings.sections} popularSearches={data.settings.popularSearches} usual={data.settings.usual} />
      )}
    </div>
  );
}
