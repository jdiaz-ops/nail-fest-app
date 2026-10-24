import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import PreviewLink from "@/components/cuponera/PreviewLink";
import { Avatar, SampleBadge, VideoCard, classDayParts } from "@/components/library/parts";
import { getInstructorProfile, getLibraryViewer, libraryRobots } from "@/lib/library/data";
import { formatPercent } from "@/lib/cuponera/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const viewer = await getLibraryViewer();
  const profile = viewer.config.instructorsPublished || viewer.staff ? await getInstructorProfile(params.slug, viewer) : null;
  if (!profile) return { title: "Instructoras · Nail Fest", robots: { index: false, follow: false } };
  const robots = await libraryRobots("instructoras");
  return {
    title: `${profile.instructor.name} · Instructoras Nail Fest`,
    description: profile.instructor.bio ?? undefined,
    robots: profile.hidden || profile.instructor.sample ? { index: false, follow: false } : robots,
  };
}

const timeFormatter = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

// An instructor's profile: who she is and her networks, her videos, her
// upcoming classes (each one straight to her own sign-up link — Nail Fest
// shows them, doesn't take bookings: 2026-10-25), the cuponera brands in her
// videos and the Nail Fest events she's been part of. No brand requests:
// that's Marcolini's.
export default async function InstructoraPage({ params }: { params: { slug: string } }) {
  const viewer = await getLibraryViewer();
  if (!viewer.config.instructorsPublished && !viewer.staff) notFound();
  const profile = await getInstructorProfile(params.slug, viewer);
  if (!profile) notFound();
  const { instructor, videos, classes, brands } = profile;
  const { texts, sections } = viewer.config;
  const handle = instructor.instagram ?? instructor.tiktok;
  const libraryOpen = viewer.staff || viewer.config.published;
  const notes = [
    libraryStaffNote(viewer, "instructoras", instructor.sample),
    profile.hidden ? "Este perfil está oculto: solo lo ve el equipo." : null,
  ].filter(Boolean);

  return (
    <LibraryShell section="instructoras" viewer={viewer} note={notes.length ? notes.join(" ") : null}>
      <div className="bib-band">
        <div className="bib-band-inner">
          <Link href="/instructoras" className="bib-back">
            ← Todas las instructoras
          </Link>
        </div>
      </div>

      <div className="bib-wrap bib-wrap--narrow">
        <div className="bib-profile">
          <Avatar person={instructor} className="bib-profile-face" />
          <div>
            <h1 className={`bib-profile-name ${fraunces.className}`}>{instructor.name}</h1>
            <div className="bib-who">
              {instructor.sample && <SampleBadge />}
              <span>
                {instructor.city}
                {handle ? ` · @${handle}` : ""}
              </span>
              <span className="bib-seal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {texts.sealLabel}
              </span>
              {instructor.featured && <span className="bib-badge bib-badge--top">{texts.featuredLabel}</span>}
            </div>
          </div>
          {(instructor.instagram || instructor.tiktok) && (
            <div className="bib-socials">
              {instructor.instagram && (
                <a href={`https://www.instagram.com/${instructor.instagram}/`} target="_blank" rel="noopener" className="bib-social">
                  Instagram
                </a>
              )}
              {instructor.tiktok && (
                <a href={`https://www.tiktok.com/@${instructor.tiktok}`} target="_blank" rel="noopener" className="bib-social">
                  TikTok
                </a>
              )}
            </div>
          )}
          {instructor.bio && <p className="bib-desc">{instructor.bio}</p>}
          {instructor.specialties.length > 0 && (
            <div className="bib-tags">
              {instructor.specialties.map((s) => (
                <span key={s} className="bib-tag">
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="bib-stats">
            <div>
              <b className={fraunces.className}>{videos.length}</b>
              <span>{videos.length === 1 ? "video" : "videos"}</span>
            </div>
            <div>
              <b className={fraunces.className}>{classes.length}</b>
              <span>{classes.length === 1 ? "próxima clase" : "próximas clases"}</span>
            </div>
            <div>
              <b className={fraunces.className}>{instructor.appearances.length}</b>
              <span>{instructor.appearances.length === 1 ? "evento Nail Fest" : "eventos Nail Fest"}</span>
            </div>
          </div>
        </div>

        {sections.profileVideos && libraryOpen && videos.length > 0 && (
          <section className="bib-section">
            <h2 className={`bib-h2 ${fraunces.className}`}>{texts.profileVideosTitle}</h2>
            <div className="bib-vgrid">
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </section>
        )}

        {sections.classes && classes.length > 0 && (
          <section className="bib-section">
            <h2 className={`bib-h2 ${fraunces.className}`}>{texts.classesTitle}</h2>
            <p className="bib-sub">{texts.classesNote}</p>
            <div className="bib-classes">
              {classes.map((c) => {
                const { day, month } = classDayParts(c.startsAt);
                return (
                  <div key={c.id} className="bib-class">
                    <span className="bib-date">
                      <b className={fraunces.className}>{day}</b>
                      <span>{month}</span>
                    </span>
                    <span className="bib-class-text">
                      <b>{c.title}</b>
                      <small>{[c.place, timeFormatter.format(new Date(c.startsAt)), c.priceLabel].filter(Boolean).join(" · ")}</small>
                    </span>
                    {(c.url || instructor.sample) && (
                      <PreviewLink
                        href={c.url}
                        preview="Ejemplo: aquí se abriría el enlace de inscripción de la instructora (su WhatsApp, su página o su formulario)."
                        className="bib-btn bib-btn-main bib-btn-sm"
                        ariaLabel={`Inscribirme en «${c.title}» (abre el enlace de la instructora)`}
                      >
                        Inscribirme
                      </PreviewLink>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {sections.profileProducts && brands.length > 0 && (
          <section className="bib-section">
            <h2 className={`bib-h2 ${fraunces.className}`}>{texts.profileProductsTitle}</h2>
            <p className="bib-sub">Con descuento en la Cuponera Nail Fest.</p>
            <div className="bib-used">
              {brands.map((b) => (
                <div key={b.key} className="bib-used-item">
                  <span className="bib-used-img bib-used-img--round">{b.name.trim().charAt(0).toUpperCase()}</span>
                  <span className="bib-used-text">
                    <b>
                      {b.name} · {formatPercent(b.discountPercent)} de descuento
                    </b>
                    <small>
                      con el código <code className="cup-code-chip">{b.code}</code>
                    </small>
                  </span>
                  <Link href="/cuponera" className="bib-btn bib-btn-line bib-btn-sm">
                    Ver
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {sections.appearances && instructor.appearances.length > 0 && (
          <section className="bib-section">
            <h2 className={`bib-h2 ${fraunces.className}`}>{texts.appearancesTitle}</h2>
            <div className="bib-events">
              {instructor.appearances.map((a) => {
                const [name, ...rest] = a.split(" · ");
                return (
                  <div key={a} className="bib-event">
                    <b>{name}</b>
                    {rest.length > 0 && <span>{rest.join(" · ")}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </LibraryShell>
  );
}
