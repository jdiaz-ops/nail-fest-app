import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import { PeopleRow, PlayIcon, RecordingCard, SearchForm, ThemeIcon, VideoCard } from "@/components/library/parts";
import { getLibraryHome, getLibraryViewer, libraryRobots } from "@/lib/library/data";
import { LIBRARY_THEMES, SHORTIES_SHOWN_FROM, toneOf, youtubeThumbnail } from "@/lib/library/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Biblioteca · Nail Fest",
    description: "Técnicas, negocio y bioseguridad explicadas por las instructoras Nail Fest, con los productos que usan y sus descuentos.",
    robots: await libraryRobots("biblioteca"),
  };
}

function SectionHead({ title, href, label }: { title: string; href?: string; label?: string }) {
  return (
    <div className="bib-head">
      <h2 className={`bib-h2 ${fraunces.className}`}>{title}</h2>
      {href && label && <Link href={href}>{label}</Link>}
    </div>
  );
}

// nailfest.lat/biblioteca — the library's front page: the search, the way
// into Shorties, the themes, what's new and most watched, the
// marathons' recordings (open to everyone: LIBRARY_SIGNUP), and the instructors. Each
// section can be renamed or switched off in Editar biblioteca; a video's
// page lives in ./[slug], the search and the themes in ./buscar, the feed in
// ./shorties.
export default async function BibliotecaPage() {
  const viewer = await getLibraryViewer();
  if (!viewer.config.published && !viewer.staff) notFound();
  const home = await getLibraryHome(viewer);
  const { texts, sections } = viewer.config;
  const shown = [...home.newest, ...home.mostViewed, ...home.recordings];
  const hasExamples = shown.some((v) => v.sample) || home.instructors.some((i) => i.sample);
  const themes = LIBRARY_THEMES.filter((t) => (home.themeCounts[t.key] ?? 0) > 0);
  const showSignup = sections.signup && viewer.asksSignup;
  const showShorties = sections.shorties && sections.shortiesBanner && (viewer.staff || home.shorties >= SHORTIES_SHOWN_FROM);
  // The three cards fanned out in Shorties' box: the newest shorts' stills.
  const fan = [0, 1, 2].map((i) => home.newest[i] ?? null);

  return (
    <LibraryShell section="biblioteca" viewer={viewer} note={libraryStaffNote(viewer, "biblioteca", hasExamples)}>
      <section className="bib-hero">
        <div className="bib-hero-inner">
          <h1 className={`bib-hero-title ${fraunces.className}`}>{texts.homeTitle}</h1>
          <p className="bib-hero-lede">{texts.homeLede}</p>
          <SearchForm action="/biblioteca/buscar" placeholder={texts.searchPlaceholder} label="Buscar en la biblioteca" />
          {viewer.config.popularSearches.length > 0 && (
            <div className="bib-popular">
              <span>Lo más buscado:</span>
              {viewer.config.popularSearches.map((q) => (
                <Link key={q} href={`/biblioteca/buscar?q=${encodeURIComponent(q)}`} className="bib-pchip">
                  {q}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="bib-wrap">
        {showShorties && (
          <Link href="/biblioteca/cortos" className="bib-shortsbox">
            <span className="bib-shortsbox-text">
              {sections.shortiesBadge && <em className="bib-new">{texts.shortiesBadgeLabel}</em>}
              <b className={fraunces.className}>{texts.shortiesTitle}</b>
              <span>{texts.shortiesBannerText}</span>
              <span className="bib-btn bib-btn-main bib-btn-sm">{texts.shortiesBannerButton}</span>
            </span>
            <span className="bib-fan" aria-hidden="true">
              {fan.map((v, i) => (
                <span key={v?.id ?? i} className={`bib-fan-card bib-ph-${v ? toneOf(v.slug) : [6, 2, 4][i]}`}>
                  {v?.youtubeId && (
                    // eslint-disable-next-line @next/next/no-img-element -- YouTube's still
                    <img src={youtubeThumbnail(v.youtubeId)} alt="" loading="lazy" decoding="async" />
                  )}
                  {i === 2 && (
                    <span className="bib-fan-play">
                      <PlayIcon />
                    </span>
                  )}
                </span>
              ))}
            </span>
          </Link>
        )}
        {showShorties && home.cortosTopics.length > 1 && (
          <nav className="bib-topics" aria-label={`${texts.shortiesTitle} por tema`}>
            <span className="bib-label">{texts.shortiesTitle} por tema</span>
            <div className="bib-chips bib-chips--scroll">
              {home.cortosTopics.slice(0, 12).map((t) => (
                <Link key={t.key} href={`/biblioteca/cortos?tema=${t.key}`} className="bib-chip">
                  {t.label}
                </Link>
              ))}
            </div>
          </nav>
        )}

        {shown.length === 0 && <p className="bib-empty">{texts.emptyText}</p>}

        {sections.themes && themes.length > 0 && (
          <section className="bib-section" aria-label={texts.themesTitle}>
            <h2 className={`bib-h2 ${fraunces.className}`}>{texts.themesTitle}</h2>
            <div className="bib-themes">
              {themes.map((t) => {
                const count = home.themeCounts[t.key] ?? 0;
                return (
                  <Link key={t.key} href={`/biblioteca/buscar?tema=${t.key}`} className={`bib-theme ${t.tile}`}>
                    <span className="bib-theme-ic">
                      <ThemeIcon icon={t.icon} />
                    </span>
                    <span>
                      <b>{t.label}</b>
                      <small>{count === 1 ? "1 video" : `${count} videos`}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {sections.newest && home.newest.length > 0 && (
          <section className="bib-section">
            <SectionHead title={texts.newestTitle} href="/biblioteca/buscar?tipo=video" label="Ver todo" />
            <div className="bib-rail">
              {home.newest.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </section>
        )}

        {sections.mostViewed && home.mostViewed.length > 0 && (
          <section className="bib-section" id="lo-mas-visto">
            <SectionHead title={texts.mostViewedTitle} />
            <div className="bib-rail">
              {home.mostViewed.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </section>
        )}

        {((sections.recordings && home.recordings.length > 0) || showSignup) && (
          <div className="bib-split">
            {sections.recordings && home.recordings.length > 0 && (
              <section className="bib-section">
                <SectionHead title={texts.recordingsTitle} href="/biblioteca/buscar?tipo=maraton" label="Ver todas" />
                <div className="bib-mcards">
                  {home.recordings.map((v) => (
                    <RecordingCard key={v.id} video={v} lockedLabel={texts.lockedLabel} locked={v.gated && viewer.asksSignup} />
                  ))}
                </div>
              </section>
            )}
            {showSignup && (
              <section className="bib-section">
                <div className="bib-signup">
                  <h3 className={fraunces.className}>{texts.signupTitle}</h3>
                  <p>{texts.signupText}</p>
                  <Link href="/biblioteca/registro" className="bib-btn bib-btn-main">
                    {texts.signupButton}
                  </Link>
                </div>
              </section>
            )}
          </div>
        )}

        {sections.instructorsRow && home.instructors.length > 0 && (
          <section className="bib-section bib-section--last">
            <SectionHead title={texts.instructorsRowTitle} href="/instructoras" label="Ver instructoras" />
            <PeopleRow people={home.instructors} />
          </section>
        )}
      </div>
    </LibraryShell>
  );
}
