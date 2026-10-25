import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import UsedProducts from "@/components/library/UsedProducts";
import { PeopleRow, SearchIcon, VideoRow } from "@/components/library/parts";
import { getLibraryViewer, libraryRobots, searchLibrary, searchParamsOf, type LibrarySearchParams } from "@/lib/library/data";
import { LIBRARY_THEMES, themeOf, type UsedProduct } from "@/lib/library/shared";
import { highlightParts } from "@/lib/cuponera/browse";
import { discountPercent, type CuponeraProduct } from "@/lib/cuponera/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type Tab = "todo" | "videos" | "instructoras" | "productos";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = searchParamsOf(searchParams);
  return { title: `${titleOf(params)} · Biblioteca Nail Fest`, robots: (await libraryRobots("biblioteca")) ?? { index: false, follow: true } };
}

function titleOf(params: LibrarySearchParams, subName: string | null = null): string {
  if (params.query) return `Resultados para «${params.query}»`;
  if (params.kind === "maraton") return "Grabaciones de maratones";
  const parts = [params.theme ? themeOf(params.theme).label : null, subName].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Todos los videos";
}

/** The same search with one filter changed (null removes it); another theme
 * leaves the subcategory behind. */
function hrefWith(params: LibrarySearchParams, change: Partial<Record<"q" | "tema" | "sub" | "tipo" | "ver", string | null>>): string {
  const current: Record<string, string | null> = { q: params.query || null, tema: params.theme, sub: "tema" in change ? null : params.sub, tipo: params.kind, ...change };
  const query = Object.entries(current)
    .filter((e): e is [string, string] => Boolean(e[1]))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `/biblioteca/buscar${query ? `?${query}` : ""}`;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map(([part, bold], i) => (bold ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
    </>
  );
}

function asUsed(p: CuponeraProduct): UsedProduct {
  return {
    key: p.id,
    brand: p.brand,
    name: p.name,
    imageUrl: p.imageUrl,
    icon: p.icon,
    color: p.color,
    tint: p.tint,
    discountPercent: discountPercent(p.price, p.before),
    code: p.code,
    url: p.url,
  };
}

// nailfest.lat/biblioteca/buscar — the library's search and its browsing
// by theme, its subcategories or kind (?q= &tema= &sub= &tipo=). A search
// looks in the videos, the instructors and, while the cuponera is live, its
// products.
export default async function BibliotecaBuscarPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getLibraryViewer();
  if (!viewer.config.published && !viewer.staff) notFound();
  const params = searchParamsOf(searchParams);
  const result = await searchLibrary(params, viewer);
  const { texts } = viewer.config;
  const rawTab = Array.isArray(searchParams.ver) ? searchParams.ver[0] : searchParams.ver;
  const tab: Tab = rawTab === "videos" || rawTab === "instructoras" || rawTab === "productos" ? rawTab : "todo";
  const searching = params.query.length > 0;
  const total = result.videos.length + result.instructors.length + result.products.length;
  const hasExamples = result.videos.some((v) => v.sample) || result.instructors.some((i) => i.sample);
  const show = (t: Tab) => tab === "todo" || tab === t;
  const subName = result.subcategories.find((s) => s.key === params.sub)?.name ?? null;

  return (
    <LibraryShell section="biblioteca" viewer={viewer} note={libraryStaffNote(viewer, "biblioteca", hasExamples)}>
      <div className="bib-sbar">
        <div className="bib-sbar-inner">
          <form className="bib-search" role="search" action="/biblioteca/buscar" method="get">
            <SearchIcon />
            <label htmlFor="bib-q" className="bib-sr">
              Buscar en la biblioteca
            </label>
            <input id="bib-q" name="q" type="search" placeholder={texts.searchPlaceholder} defaultValue={params.query} enterKeyHint="search" autoComplete="off" />
            {params.theme && <input type="hidden" name="tema" value={params.theme} />}
            {params.sub && <input type="hidden" name="sub" value={params.sub} />}
            {params.kind && <input type="hidden" name="tipo" value={params.kind} />}
          </form>
        </div>
      </div>

      <div className="bib-wrap">
        <h1 className={`bib-h1 ${fraunces.className}`}>{titleOf(params, subName)}</h1>
        <p className="bib-found">
          {searching ? (
            <>
              <b>{total === 1 ? "1 resultado" : `${total} resultados`}</b> para «{params.query}»
            </>
          ) : (
            <b>{result.videos.length === 1 ? "1 video" : `${result.videos.length} videos`}</b>
          )}
        </p>

        {searching ? (
          <div className="bib-chips">
            {(
              [
                ["todo", "Todo", total],
                ["videos", "Videos", result.videos.length],
                ["instructoras", "Instructoras", result.instructors.length],
                ["productos", "Productos", result.products.length],
              ] as const
            )
              .filter(([key, , count]) => key === "todo" || count > 0)
              .map(([key, label, count]) => (
                <Link key={key} href={hrefWith(params, { ver: key === "todo" ? null : key })} className={`bib-chip${tab === key ? " is-on" : ""}`}>
                  {key === "todo" ? label : `${label} (${count})`}
                </Link>
              ))}
          </div>
        ) : (
          <>
            <div className="bib-chips">
              <Link href={hrefWith(params, { tema: null })} className={`bib-chip${params.theme ? "" : " is-on"}`}>
                Todos los temas
              </Link>
              {LIBRARY_THEMES.map((t) => (
                <Link key={t.key} href={hrefWith(params, { tema: t.key })} className={`bib-chip${params.theme === t.key ? " is-on" : ""}`}>
                  {t.label}
                </Link>
              ))}
            </div>
            {params.theme && result.subcategories.length > 0 && (
              <div className="bib-chips" aria-label={`Subcategorías de ${themeOf(params.theme).label}`}>
                <Link href={hrefWith(params, { sub: null })} className={`bib-chip${params.sub ? "" : " is-on"}`}>
                  Todo {themeOf(params.theme).label}
                </Link>
                {result.subcategories.map((s) => (
                  <Link key={s.key} href={hrefWith(params, { sub: s.key })} className={`bib-chip${params.sub === s.key ? " is-on" : ""}`}>
                    {s.name} <small>{s.count}</small>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {show("videos") && result.videos.length > 0 && (
          <section className="bib-section">
            {searching && <h2 className={`bib-h2 ${fraunces.className}`}>Videos</h2>}
            <div className="bib-rows">
              {result.videos.map((v) => (
                <VideoRow key={v.id} video={v} title={searching ? <Highlighted text={v.title} query={params.query} /> : v.title} />
              ))}
            </div>
          </section>
        )}

        {show("instructoras") && result.instructors.length > 0 && (
          <section className="bib-section">
            <h2 className={`bib-h2 ${fraunces.className}`}>Instructoras</h2>
            <PeopleRow people={result.instructors} />
          </section>
        )}

        {show("productos") && result.products.length > 0 && (
          <section className="bib-section">
            <h2 className={`bib-h2 ${fraunces.className}`}>En la cuponera</h2>
            <UsedProducts products={result.products.map(asUsed)} buyLabel={texts.buyButton} />
          </section>
        )}

        {(searching ? total : result.videos.length) === 0 && (
          <p className="bib-empty">
            {searching ? "No encontramos nada con esas palabras. Prueba con otra técnica o con el nombre de una instructora." : texts.emptyText}
          </p>
        )}
        <div className="bib-section--last" />
      </div>
    </LibraryShell>
  );
}
