import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { publicEventName } from "@/lib/eventDisplayName";
import { paypalCheckoutConfig } from "@/lib/payments/paypal";
import { imparablesPageData } from "@/lib/imparables/page";
import { checkoutOffer } from "@/lib/imparables/pricing";
import { coverName, kindLine } from "@/lib/imparables/schedule";
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
// own form. It sells the price stage on sale right now (lib/imparables/
// pricing.ts) — /api/register checks it again when paying; without one on
// sale it goes back to the event's page. Paying in dollars with PayPal shows
// up only for a stage with a USD price, with PayPal set up
// (lib/payments/paypal.ts).
export default async function CheckoutPage({ params }: { params: { eventSlug: string } }) {
  const event = await db.event.findUnique({
    where: { slug: params.eventSlug },
  });
  if (!event || event.status === "DRAFT") notFound();
  if (event.theme !== "IMPARABLES") redirect(`/${event.slug}`);

  const orgSettings = await getOrgSettings();
  const now = new Date();
  const data = await imparablesPageData(event, orgSettings.timezone, now);
  const offer = await checkoutOffer(data.sales, orgSettings.timezone);
  if (!offer) redirect(`/${event.slug}`);

  const professions = await getOrderedProfessionOptions();
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <MetaPixelScript pixelId={data.pixelId} />
      <ImpCheckout
        eventSlug={event.slug}
        backHref={`/${event.slug}`}
        name={{ pre: words.join(" "), big }}
        dates={data.when.compact}
        format={kindLine(event)}
        ticket={offer.ticket}
        // No discount code box for now (the team, 2026-10-29).
        codes={false}
        professions={professions}
        paypal={offer.ticket.usdCents ? paypalCheckoutConfig() : null}
      />
    </main>
  );
}
