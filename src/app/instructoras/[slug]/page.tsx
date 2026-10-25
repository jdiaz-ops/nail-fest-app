import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import { Avatar, SampleBadge, VideoCard } from "@/components/library/parts";
import { getInstructorProfile, getLibraryViewer, libraryRobots } from "@/lib/library/data";
import { getPortalUser } from "@/lib/library/portalAuth";
import { whatsappUrl, youtubeChannelUrl } from "@/lib/library/portal";
import { formatPercent } from "@/lib/cuponera/shared";
import { watchHref } from "@/lib/library/shared";
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

// An instructor's profile: who she is and her networks (her WhatsApp when
// she gave one), her videos, the cuponera brands in her videos and the
// Nail Fest events she's been part of. No classes (2026-10-24) and no brand
// requests (that's Marcolini's). Before the team approves it, she can see
// it from her portal as a preview.
export default async function InstructoraPage({ params }: { params: { slug: string } }) {
  const [viewer, portalUser] = await Promise.all([getLibraryViewer(), getPortalUser()]);
  const owner = portalUser?.instructor.slug === params.slug;
  if (!viewer.config.instructorsPublished && !viewer.staff && !owner) notFound();
  const profile = await getInstructorProfile(params.slug, viewer, new Date(), owner);
  if (!profile) notFound();
  const { instructor, videos, brands } = profile;
  const { texts, sections } = viewer.config;
  const handle = instructor.instagram ?? instructor.tiktok;
  const libraryOpen = viewer.staff || viewer.config.published;
  // Her video's card opens the scroll of her videos from it, newest first; its page while the scroll is off.
  const herList = viewer.staff || sections.shorties ? { instructora: instructor.slug, orden: "nuevo" } : null;
  const notes = [libraryStaffNote(viewer, "instructoras", instructor.sample), viewer.staff && profile.hidden ? `${profile.hidden} Solo lo ve el equipo.` : null].filter(Boolean);
  const ownerNote =
    owner && !viewer.staff
      ? profile.hidden
        ? `Así se verá tu perfil en el directorio. ${profile.hidden} Por ahora solo lo ves tú.`
        : viewer.config.instructorsPublished
          ? null
          : "Así se verá tu perfil. El directorio todavía no está abierto al público."
      : null;

  return (
    <LibraryShell section="instructoras" viewer={viewer} note={notes.length ? notes.join(" ") : null} ownerNote={ownerNote}>
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
                {instructor.online ? " · también en línea" : ""}
                {handle ? ` · @${handle}` : ""}
              </span>
              {instructor.invited && (
                <span className="bib-seal">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {texts.sealLabel}
                </span>
              )}
              {instructor.featured && <span className="bib-badge bib-badge--top">{texts.featuredLabel}</span>}
            </div>
          </div>
          {(instructor.instagram || instructor.tiktok || instructor.youtube || instructor.whatsapp) && (
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
              {instructor.youtube && (
                <a href={youtubeChannelUrl(instructor.youtube)} target="_blank" rel="noopener" className="bib-social">
                  YouTube
                </a>
              )}
              {instructor.whatsapp && (
                <a href={whatsappUrl(instructor.whatsapp)} target="_blank" rel="noopener" className="bib-social">
                  WhatsApp
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
                <VideoCard key={v.id} video={v} href={watchHref(v.slug, herList)} />
              ))}
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
