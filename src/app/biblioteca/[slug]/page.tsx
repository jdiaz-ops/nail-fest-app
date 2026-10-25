import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import VideoPlayer from "@/components/library/VideoPlayer";
import UsedProducts from "@/components/library/UsedProducts";
import ShareButton from "@/components/library/ShareButton";
import ViewPing from "@/components/library/ViewPing";
import { Avatar, SampleBadge, VideoCard } from "@/components/library/parts";
import { getLibraryVideoPage, getLibraryViewer, libraryRobots } from "@/lib/library/data";
import { VIEWS_SHOWN_FROM, formatDuration, formatLength, formatViews, themeOf, toneOf, topicKey, type LibraryTheme } from "@/lib/library/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const viewer = await getLibraryViewer();
  const page = viewer.config.published || viewer.staff ? await getLibraryVideoPage(params.slug, viewer) : null;
  if (!page) return { title: "Biblioteca · Nail Fest", robots: { index: false, follow: false } };
  const robots = await libraryRobots("biblioteca");
  return {
    title: `${page.video.title} · Biblioteca Nail Fest`,
    description: page.video.description ?? undefined,
    robots: page.hidden || page.video.sample ? { index: false, follow: false } : robots,
  };
}

// A video's page: the video (played from YouTube), who teaches it, its
// themes, subcategory and topics (a topic opens its cortos), "Lo que usó" with the
// cuponera's discounts, the step by step behind the free sign-up, and more
// of the same theme.
export default async function BibliotecaVideoPage({ params }: { params: { slug: string } }) {
  const viewer = await getLibraryViewer();
  if (!viewer.config.published && !viewer.staff) notFound();
  const page = await getLibraryVideoPage(params.slug, viewer);
  if (!page) notFound();
  const { video } = page;
  const { texts, sections } = viewer.config;
  const theme = themeOf(video.theme);
  const signupHref = `/biblioteca/registro?volver=${encodeURIComponent(`/biblioteca/${video.slug}`)}`;
  const length = video.durationSeconds != null ? (video.kind === "maraton" ? formatLength(video.durationSeconds) : formatDuration(video.durationSeconds)) : null;
  const notes = [libraryStaffNote(viewer, "biblioteca", video.sample || page.related.some((v) => v.sample)), page.hidden ? "Este video está oculto: solo lo ve el equipo." : null].filter(Boolean);
  const discounted = page.products.some((p) => p.discountPercent != null && p.code);

  return (
    <LibraryShell section="biblioteca" viewer={viewer} note={notes.length ? notes.join(" ") : null}>
      <div className="bib-stage">
        <div className="bib-stage-inner">
          <Link href={`/biblioteca/buscar?tema=${video.theme}`} className="bib-crumb">
            ← Biblioteca · {theme.label}
          </Link>
          <VideoPlayer
            youtubeId={video.youtubeId}
            title={video.title}
            wide={video.kind === "maraton"}
            tone={toneOf(video.slug)}
            durationLabel={length}
            locked={video.gated && !viewer.unlocked}
            lockedLabel={texts.lockedLabel}
            signupHref={signupHref}
            signupButton={texts.signupButton}
          />
        </div>
      </div>

      <div className="bib-wrap bib-wrap--narrow">
        <div className="bib-info">
          <h1 className={`bib-title ${fraunces.className}`}>{video.title}</h1>
          <div className="bib-meta">
            {video.sample && <SampleBadge />}
            {video.themes.map((key) => (
              <Link key={key} href={`/biblioteca/buscar?tema=${key}`} className="bib-tag">
                {key === video.theme ? theme.label : themeOf(key).label}
              </Link>
            ))}
            {video.subcategories.map((sub) => (
              <Link key={sub.key} href={`/biblioteca/buscar?tema=${sub.theme}&sub=${sub.key}`} className="bib-tag">
                {sub.name}
              </Link>
            ))}
            {video.tags
              .filter((tag) => !video.themes.includes(topicKey(tag) as LibraryTheme) && !video.subcategories.some((s) => s.key === topicKey(tag)))
              .map((tag) => (
                <Link
                  key={tag}
                  href={sections.shorties ? `/biblioteca/cortos?tema=${topicKey(tag)}` : `/biblioteca/buscar?q=${encodeURIComponent(tag)}`}
                  className="bib-tag"
                >
                  {tag}
                </Link>
              ))}
            {video.views >= VIEWS_SHOWN_FROM && <span>· {formatViews(video.views)}</span>}
          </div>
          {video.instructor ? (
            <div className="bib-by">
              <Avatar person={video.instructor} className="bib-by-face" />
              <span className="bib-by-text">
                <b>{video.instructor.name}</b>
                <small>
                  {video.instructor.city} · {texts.sealLabel}
                </small>
              </span>
              {video.instructor.slug && (viewer.staff || viewer.config.instructorsPublished) && (
                <Link href={`/instructoras/${video.instructor.slug}`} className="bib-btn bib-btn-line bib-btn-sm">
                  Ver perfil
                </Link>
              )}
            </div>
          ) : (
            video.teachersNote && <p className="bib-sub">Con {video.teachersNote}</p>
          )}
          {video.description && <p className="bib-desc">{video.description}</p>}
          <div className="bib-acts">
            <ShareButton title={video.title} />
          </div>
        </div>

        {sections.used && page.products.length > 0 && (
          <section className="bib-section">
            <h2 className={`bib-h2 ${fraunces.className}`}>{texts.usedTitle}</h2>
            {discounted && <p className="bib-sub">{texts.usedSubtitle}</p>}
            <UsedProducts products={page.products} buyLabel={texts.buyButton} />
          </section>
        )}

        {sections.steps && page.steps.length > 0 && (
          <section className="bib-section" id="paso-a-paso">
            {viewer.unlocked ? (
              <>
                <h2 className={`bib-h2 ${fraunces.className}`}>{texts.stepsTitle}</h2>
                <ol className="bib-steps">
                  {page.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="bib-gate">
                <h3 className={fraunces.className}>{texts.stepsTitle}</h3>
                <p>{texts.stepsLockedText}</p>
                <Link href={signupHref} className="bib-btn bib-btn-dark">
                  {texts.stepsButton}
                </Link>
              </div>
            )}
          </section>
        )}
      </div>

      {sections.related && page.related.length > 0 && (
        <div className="bib-wrap">
          <section className="bib-section bib-section--last">
            <div className="bib-head">
              <h2 className={`bib-h2 ${fraunces.className}`}>{texts.relatedTitle}</h2>
              <Link href={`/biblioteca/buscar?tema=${video.theme}`}>Más de {theme.label}</Link>
            </div>
            <div className="bib-rail">
              {page.related.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </section>
        </div>
      )}
      {!video.sample && !page.hidden && <ViewPing videoId={video.id} />}
    </LibraryShell>
  );
}
