import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrgSettings } from "@/lib/settings";
import { formatHeroDate, formatHeroHours } from "@/lib/eventHeroDate";
import { formatEventScheduleLines } from "@/lib/eventSchedule";
import MetaPixelScript from "@/components/MetaPixelScript";
import LandingBlocksContent from "@/components/landingBlocks/LandingBlocksContent";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { publicEventName } from "@/lib/eventDisplayName";

export const dynamic = "force-dynamic";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"] });

// Campaign parameters a visitor arrived with — carried onto the
// "Quiero mi entrada" link so a registration that starts on a topic page
// is still attributed to the ad or link that brought them.
const ATTRIBUTION_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ttclid", "gclid"];

async function loadPage(eventSlug: string, pageSlug: string) {
  const event = await db.event.findUnique({ where: { slug: eventSlug } });
  if (!event) return null;
  const page = await db.infoPage.findUnique({ where: { eventId_slug: { eventId: event.id, slug: pageSlug } } });
  if (!page) return null;
  return { event, page };
}

export async function generateMetadata({ params }: { params: { eventSlug: string; pageSlug: string } }): Promise<Metadata> {
  const found = await loadPage(params.eventSlug, params.pageSlug);
  if (!found) return {};
  const { event, page } = found;
  return {
    title: `${page.title} · ${publicEventName(event)}`,
    description: page.intro || undefined,
    openGraph: { title: `${page.title} · ${publicEventName(event)}`, description: page.intro || undefined, images: event.imageUrl ? [event.imageUrl] : undefined },
  };
}

// A topic page of an event (see the InfoPage model): the event's name as a
// way back, the page's own title and blocks, and — unless turned off — a
// "Quiero mi entrada" button that opens the event page's registration form.
export default async function InfoPagePublic({
  params,
  searchParams,
}: {
  params: { eventSlug: string; pageSlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const found = await loadPage(params.eventSlug, params.pageSlug);
  if (!found) notFound();
  const { event, page } = found;

  // Unpublished page, or a page of an unpublished event: only a logged-in
  // admin sees it (a preview), everyone else gets a 404.
  const isDraft = !page.published || event.status === "DRAFT";
  if (isDraft) {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") notFound();
  }

  const [orgSettings, metaConnection] = await Promise.all([
    getOrgSettings(),
    db.metaConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { pixelId: true } }),
  ]);
  const blocks = parseLandingBlocks(page.blocks).filter((b) => !b.hidden);
  const heroDate = formatHeroDate(event.startsAt, event.endsAt, orgSettings.timezone, orgSettings.language);
  const hours = formatHeroHours(event.scheduleDays, orgSettings.timezone, orgSettings.language) ?? formatEventScheduleLines(event, orgSettings.timezone, orgSettings.language);

  const registerParams = new URLSearchParams({ registrar: "1" });
  for (const key of ATTRIBUTION_PARAMS) {
    const value = searchParams[key];
    if (typeof value === "string" && value) registerParams.set(key, value);
  }
  const registerHref = `/${event.slug}?${registerParams.toString()}`;
  const registerLabel = event.registerButtonLabel || "Registrarme GRATIS";

  return (
    <main className="info-page">
      {!isDraft && <MetaPixelScript pixelId={metaConnection?.pixelId ?? null} />}

      {isDraft && (
        <p className="info-page-draft">Borrador — solo tú (admin) ves esta página. Publícala desde Admin → Páginas.</p>
      )}

      {/* The brand on top, right before the page's own title — the admin's
          choice over a "← event name" back link and a footer logo. */}
      <header className="info-page-brand">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark, same as the event page's */}
        <img src="/logo.png" alt={orgSettings.name} className="info-page-brand-logo" />
        <p className="info-page-brand-tagline">Donde se reúne el mundo de las uñas</p>
      </header>
      <h1 className={`info-page-title ${fraunces.className}`}>{page.title}</h1>
      {page.intro && <p className="info-page-intro">{page.intro}</p>}

      {page.showTopRegisterButton && (
        <a href={registerHref} className="info-page-cta">
          {registerLabel}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      )}

      {blocks.length > 0 && (
        <div className="info-page-blocks">
          <LandingBlocksContent blocks={blocks} venue={{ name: event.venueName ?? "", address: event.venueAddress ?? "", hours }} />
        </div>
      )}

      {page.showRegisterButton && (
        <section className="event-closing">
          <div className="event-closing-inner">
            <h2 className={`event-closing-title ${fraunces.className}`}>
              {event.closingText || `Nos vemos el ${heroDate.days} ${heroDate.month} en ${event.city}.`}
            </h2>
            <a href={registerHref} className="event-closing-button" style={{ textDecoration: "none", textAlign: "center" }}>
              {registerLabel}
            </a>
          </div>
          <div className="event-closing-footer" aria-hidden="true" />
        </section>
      )}
    </main>
  );
}
