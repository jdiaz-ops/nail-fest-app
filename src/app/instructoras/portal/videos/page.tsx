import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import VideoSubmitForm from "@/components/portal/VideoSubmitForm";
import { PortalIcon } from "@/components/portal/icons";
import { db } from "@/lib/db";
import { getLibrarySettings } from "@/lib/library/settings";
import { requirePortalPage } from "@/lib/library/portalAuth";
import { LIBRARY_THEMES, youtubeThumbnail } from "@/lib/library/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mis videos · Instructoras Nail Fest", robots: { index: false, follow: false } };

const themeLabel = (key: string) => LIBRARY_THEMES.find((t) => t.key === key)?.label ?? key;
const day = (d: Date) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" }).replace(".", "");

type Pill = { label: string; className: string };

/** Where a video she sent stands, as she reads it. */
function pillOf(s: { status: string; video: { visible: boolean } | null }): Pill {
  if (s.status === "DECLINED") return { label: "No seleccionado", className: "pt-pill--no" };
  if (s.status === "PUBLISHED" && s.video?.visible) return { label: "Publicado", className: "pt-pill--live" };
  if (s.status === "PUBLISHED" && s.video) return { label: "Elegido · se publica pronto", className: "pt-pill--review" };
  if (s.status === "PUBLISHED") return { label: "Retirado", className: "pt-pill--no" };
  return { label: "En revisión", className: "pt-pill--review" };
}

// "Mis videos": her videos already in the library (the ones she sent and
// the ones the team loaded for her), what she has sent and where each one
// stands, and the form to send another (components/portal/VideoSubmitForm).
// While El Taller is hidden (2026-10-25), it takes her back to her portal.
export default async function MisVideosPage() {
  const { instructor, account } = await requirePortalPage();
  const [settings, videos, submissions] = await Promise.all([
    getLibrarySettings(),
    db.libraryVideo.findMany({ where: { instructorId: instructor.id, visible: true }, orderBy: { publishedAt: "desc" } }),
    db.instructorVideoSubmission.findMany({ where: { instructorId: instructor.id }, orderBy: { createdAt: "desc" }, include: { video: { select: { visible: true, slug: true } } } }),
  ]);
  if (!settings.published) redirect("/instructoras/portal");

  return (
    <PortalShell instructor={instructor} tab="videos" videos>
      <div className="pt-wrap">
        <h1 className={`pt-h1 ${fraunces.className}`}>Mis videos</h1>
        <div className="pt-card pt-card--accent">
          <p>
            Envía tus videos con su ficha. El equipo elige cuáles salen en El Taller, en las redes y en el correo de Nail Fest, siempre con tu nombre y tus redes. No
            hay pagos ni garantía de publicación.
          </p>
        </div>

        {videos.length > 0 && (
          <div className="pt-card">
            <h2 className="pt-h3">En El Taller</h2>
            {videos.map((v) => (
              <div key={v.id} className="pt-video">
                <span className="pt-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
                  <img src={youtubeThumbnail(v.youtubeId)} alt="" loading="lazy" />
                </span>
                <span>
                  <b>{v.title}</b>
                  <small>
                    {themeLabel(v.theme)}
                  </small>
                  {settings.published && (
                    <Link href={`/biblioteca/${v.slug}`} className="pt-link">
                      Ver en El Taller
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {submissions.length > 0 && (
          <div className="pt-card">
            <h2 className="pt-h3">Enviados</h2>
            {submissions.map((s) => {
              const pill = pillOf(s);
              return (
                <div key={s.id} className="pt-video">
                  <span className="pt-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
                    <img src={youtubeThumbnail(s.youtubeId)} alt="" loading="lazy" />
                  </span>
                  <span>
                    <b>{s.title}</b>
                    <small>
                      {themeLabel(s.theme)} · enviado el {day(s.createdAt)}
                    </small>
                    <span className={`pt-pill ${pill.className}`}>
                      {pill.className === "pt-pill--live" && <PortalIcon name="check" size={13} />}
                      {pill.label}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <VideoSubmitForm needsContentTerms={!account.contentTermsAcceptedAt} />
      </div>
    </PortalShell>
  );
}
