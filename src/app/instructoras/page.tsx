import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import { InstructorTile, SearchIcon } from "@/components/library/parts";
import { getInstructorCards, getLibraryViewer, libraryRobots } from "@/lib/library/data";
import { rankBy } from "@/lib/library/search";
import { queryWords, type InstructorCard } from "@/lib/library/shared";
import { normalizeText } from "@/lib/cuponera/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Instructoras · Nail Fest",
    description: "Educadoras de uñas elegidas por Nail Fest: sus técnicas, sus clases y cómo contactarlas.",
    robots: await libraryRobots("instructoras"),
  };
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.slice(0, 80) ?? "";

/** Distinct values in the order they first appear, compared without accents. */
function distinct(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) if (v.trim() && !seen.has(normalizeText(v))) seen.set(normalizeText(v), v.trim());
  return [...seen.values()];
}

// nailfest.lat/instructoras — the curated directory of Instructoras Nail
// Fest: filters by city and specialty, a card per instructor (featured
// first, then the most active) and the two ways in — instructors who want
// to apply, brands looking for one. Profiles live in ./[slug], the forms in
// ./solicitud.
export default async function InstructorasPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getLibraryViewer();
  if (!viewer.config.instructorsPublished && !viewer.staff) notFound();
  const { texts, sections } = viewer.config;
  const all = await getInstructorCards(viewer);
  const city = one(searchParams.ciudad);
  const specialty = one(searchParams.especialidad);
  const query = one(searchParams.q).trim();

  const cities = distinct(all.map((i) => i.city));
  const specialties = distinct(all.flatMap((i) => i.specialties));
  let shown: InstructorCard[] = all.filter(
    (i) =>
      (!city || normalizeText(i.city) === normalizeText(city)) &&
      (!specialty || i.specialties.some((s) => normalizeText(s) === normalizeText(specialty))),
  );
  const words = queryWords(query);
  if (words.length) {
    shown = rankBy(shown, words, (i) => [
      { text: i.name, weight: 5 },
      { text: i.city, weight: 3 },
      { text: i.specialties.join(" "), weight: 3 },
      { text: i.bio, weight: 1 },
    ]);
  }
  const href = (change: Record<string, string | null>) => {
    const params = Object.entries({ q: query || null, ciudad: city || null, especialidad: specialty || null, ...change })
      .filter((e): e is [string, string] => Boolean(e[1]))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/instructoras${params ? `?${params}` : ""}`;
  };

  return (
    <LibraryShell section="instructoras" viewer={viewer} note={libraryStaffNote(viewer, "instructoras", all.some((i) => i.sample))}>
      <section className="bib-hero">
        <div className="bib-hero-inner">
          <h1 className={`bib-hero-title ${fraunces.className}`}>{texts.directoryTitle}</h1>
          <p className="bib-hero-lede">{texts.directoryLede}</p>
          <form className="bib-search" role="search" action="/instructoras" method="get">
            <SearchIcon />
            <label htmlFor="bib-q" className="bib-sr">
              Buscar instructoras
            </label>
            <input id="bib-q" name="q" type="search" placeholder={texts.directorySearchPlaceholder} defaultValue={query} enterKeyHint="search" autoComplete="off" />
            {city && <input type="hidden" name="ciudad" value={city} />}
            {specialty && <input type="hidden" name="especialidad" value={specialty} />}
          </form>
        </div>
      </section>

      <div className="bib-wrap">
        {all.length === 0 ? (
          <p className="bib-empty">{texts.directoryEmptyText}</p>
        ) : (
          <>
            {sections.filters && (
              <div className="bib-filters">
                <div className="bib-filter">
                  <span className="bib-label">Ciudad</span>
                  <div className="bib-chips bib-chips--scroll">
                    <Link href={href({ ciudad: null })} className={`bib-chip${city ? "" : " is-on"}`}>
                      Todas
                    </Link>
                    {cities.map((c) => (
                      <Link key={c} href={href({ ciudad: c })} className={`bib-chip${normalizeText(c) === normalizeText(city) ? " is-on" : ""}`}>
                        {c}
                      </Link>
                    ))}
                  </div>
                </div>
                {specialties.length > 0 && (
                  <div className="bib-filter">
                    <span className="bib-label">Especialidad</span>
                    <div className="bib-chips bib-chips--scroll">
                      <Link href={href({ especialidad: null })} className={`bib-chip${specialty ? "" : " is-on"}`}>
                        Todas
                      </Link>
                      {specialties.map((s) => (
                        <Link key={s} href={href({ especialidad: s })} className={`bib-chip${normalizeText(s) === normalizeText(specialty) ? " is-on" : ""}`}>
                          {s}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bib-count">
              <b>{shown.length === 1 ? "1 instructora" : `${shown.length} instructoras`}</b>
              <span>{words.length ? `Para «${query}»` : "Ordenadas por actividad"}</span>
            </div>

            {shown.length > 0 ? (
              <div className="bib-igrid">
                {shown.map((i) => (
                  <InstructorTile key={i.id} instructor={i} featuredLabel={texts.featuredLabel} />
                ))}
              </div>
            ) : (
              <p className="bib-empty">
                Ninguna instructora coincide con esa búsqueda. <Link href="/instructoras">Ver todas</Link>
              </p>
            )}
          </>
        )}

        {sections.teachCta && (
          <div className="bib-ctas bib-ctas--one">
            <div className="bib-cta bib-cta--teach">
              <h2 className={fraunces.className}>{texts.teachTitle}</h2>
              <p>{texts.teachText}</p>
              <Link href="/instructoras/solicitud?tipo=postulacion" className="bib-btn bib-btn-dark">
                {texts.teachButton}
              </Link>
            </div>
          </div>
        )}
      </div>
    </LibraryShell>
  );
}
