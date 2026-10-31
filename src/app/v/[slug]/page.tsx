import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { imparablesPageData } from "@/lib/imparables/page";
import { liveVersion, specialPriceFor, specialSold } from "@/lib/imparables/versions";
import { isTieredVersion, withTierBlocks } from "@/lib/imparables/tiers";
import { isTransformationVersion, withTransformationBlocks } from "@/lib/imparables/transformacion";
import ImparablesPage from "@/components/imparables/ImparablesPage";

export const dynamic = "force-dynamic";

// A version of an event's page (nailfest.lat/v/<slug>, 2026-10-30, see
// lib/imparables/versions.ts): the congress's page with the version's own
// cover where it says so, and its special price for the stage on sale. Kept
// out of search engines: it's only for whoever has its link or its QR.
// Paused, or outside its dates, its link goes to the main page — keeping the
// visit's own query (its utm_) — at the normal price.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { event } = await liveVersion(params.slug);
  if (!event) return { robots: { index: false, follow: false } };
  const name = publicEventName(event);
  const base = process.env.APP_BASE_URL;
  return {
    title: `${name} · Nail Fest`,
    robots: { index: false, follow: false },
    ...(base ? { metadataBase: new URL(base) } : {}),
    openGraph: { title: name, images: [{ url: "/imparables/og-27-junio-hueso.jpg", width: 1200, height: 630 }] },
  };
}

function query(searchParams: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) for (const one of Array.isArray(v) ? v : v ? [v] : []) q.append(k, one);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function VersionPage({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const { version, event } = await liveVersion(params.slug);
  if (!event) notFound();
  if (!version || event.status === "DRAFT" || event.theme !== "IMPARABLES") redirect(`/${event.slug}${query(searchParams)}`);

  const orgSettings = await getOrgSettings();
  const now = new Date();
  const data = await imparablesPageData(event, orgSettings.timezone, now);
  const special = specialPriceFor(version, data.sales, await specialSold(version.id));
  // A version that sells the ticket levels (lib/imparables/tiers.ts, 2026-10-31): «Desde» its stage's price, its
  // guarantee — also in the questions —, and Círculo and Élite in its checkout.
  const levels = isTieredVersion(version.slug);
  // A version that sells the transformation (lib/imparables/transformacion.ts, 2026-10-31): its words and sections.
  const transformation = isTransformationVersion(version.slug);
  // Its own count of visits, next to the main page's (LandingView).
  await db.landingView.create({ data: { eventId: event.id, country: headers().get("x-vercel-ip-country"), landingVersionId: version.id } }).catch(() => null);

  return (
    <ImparablesPage
      event={{
        slug: event.slug,
        displayName: publicEventName(event),
        subtitle: event.subtitle,
        city: event.city,
        venueName: event.venueName,
        format: event.format,
        closingText: event.closingText,
        registerButtonLabel: event.registerButtonLabel,
        ctaNote: event.ctaNote,
      }}
      blocks={transformation ? withTransformationBlocks(data.blocks) : levels ? withTierBlocks(data.blocks) : data.blocks}
      sales={data.sales}
      when={data.when}
      timezone={orgSettings.timezone}
      now={now}
      pixelId={data.pixelId}
      whatsappUrl={data.whatsappUrl}
      brandName={orgSettings.name}
      preview={null}
      levels={levels}
      transformation={transformation}
      version={{
        title: version.title?.trim() || null,
        subtitle: version.subtitle?.trim() || null,
        imageUrl: version.imageUrl?.trim() || null,
        buttonLabel: version.buttonLabel?.trim() || null,
        special: special
          ? {
              price: special.price,
              struck: special.struck,
              label: special.label,
              endsAt: special.endsAt?.toISOString() ?? null,
            }
          : null,
      }}
    />
  );
}
