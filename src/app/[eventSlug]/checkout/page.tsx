import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { getPublicTicketTypes } from "@/lib/ticketTypes";
import { publicEventName } from "@/lib/eventDisplayName";
import type { LandingBlock } from "@/lib/landingBlocks/types";
import { imparablesPageData } from "@/lib/imparables/page";
import { coverName } from "@/lib/imparables/schedule";
import { untilDate } from "@/lib/imparables/stages";
import MetaPixelScript from "@/components/MetaPixelScript";
import ImpCheckout from "@/components/imparables/ImpCheckout";
import { cinzel, manrope } from "@/components/imparables/fonts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { eventSlug: string } }): Promise<Metadata> {
  const event = await db.event.findUnique({
    where: { slug: params.eventSlug },
  });
  return {
    title: event ? `Reserva tu cupo · ${publicEventName(event)}` : "Reserva tu cupo",
    robots: { index: false },
  };
}

// An event's one-page checkout (2026-10-29), after Marcolini's — the
// landing's buttons come here while a price is on sale. Only Manicuristas
// Imparables' for now (EventTheme IMPARABLES): every other event keeps its
// own form. Without a price on sale it goes back to the event's page.
export default async function CheckoutPage({ params }: { params: { eventSlug: string } }) {
  const event = await db.event.findUnique({
    where: { slug: params.eventSlug },
  });
  if (!event || event.status === "DRAFT") notFound();
  if (event.theme !== "IMPARABLES") redirect(`/${event.slug}`);

  const orgSettings = await getOrgSettings();
  const now = new Date();
  const data = await imparablesPageData(event, orgSettings.timezone, now);
  const { current, normal, next } = data.sales;
  if (data.sales.mode !== "sale" || !current) redirect(`/${event.slug}`);

  const [professions, ticketTypes] = await Promise.all([getOrderedProfessionOptions(), getPublicTicketTypes(event.id, now)]);
  const onSale = ticketTypes.find((t) => t.id === current.id);
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const points = data.blocks.find((b): b is Extract<LandingBlock, { type: "points" }> => b.type === "points");

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <MetaPixelScript pixelId={data.pixelId} />
      <ImpCheckout
        eventSlug={event.slug}
        backHref={`/${event.slug}`}
        name={{ pre: words.join(" "), big }}
        dates={data.when.compact}
        format={event.format === "VIRTUAL" ? "Congreso virtual · 100% en vivo" : event.format === "HYBRID" ? "Presencial y virtual" : (event.city ?? "")}
        ticket={{
          id: current.id,
          name: current.name,
          price: current.price,
          normalPrice: normal && normal.id !== current.id && normal.price > current.price ? normal.price : null,
          min: onSale?.minPerOrder ?? 1,
          max: Math.max(1, Math.min(onSale?.maxPerOrder ?? 1, onSale?.remaining ?? 1)),
        }}
        until={current.closesAt && next ? untilDate(current.closesAt, orgSettings.timezone) : null}
        professions={professions}
        includes={(points?.items ?? [])
          .map((item) => item.title)
          .filter(Boolean)
          .slice(0, 4)}
      />
    </main>
  );
}
