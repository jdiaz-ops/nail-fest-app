import type { Event, LandingVersion } from "@prisma/client";
import { redirect } from "next/navigation";
import { getOrgSettings } from "@/lib/settings";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { publicEventName } from "@/lib/eventDisplayName";
import { paypalCheckoutConfig } from "@/lib/payments/paypal";
import { imparablesPageData } from "@/lib/imparables/page";
import { checkoutOffer } from "@/lib/imparables/pricing";
import { coverName, kindLine } from "@/lib/imparables/schedule";
import { specialPriceFor, specialSold, withVersionPrice } from "@/lib/imparables/versions";
import MetaPixelScript from "@/components/MetaPixelScript";
import ImpCheckout from "./ImpCheckout";
import { cinzel, manrope } from "./fonts";

// The congress's one-page checkout, for its main page (/<event>/checkout) and
// for a version of it (/v/<slug>/checkout, 2026-10-30): the stage on sale
// (lib/imparables/pricing.ts) — at the version's special price when it has
// one, in pesos only — and back to the page it came from. Without a stage on
// sale, back to that page.
export default async function ImpCheckoutScreen({ event, version }: { event: Event; version: LandingVersion | null }) {
  const page = version ? `/v/${version.slug}` : `/${event.slug}`;
  const orgSettings = await getOrgSettings();
  const now = new Date();
  const data = await imparablesPageData(event, orgSettings.timezone, now);
  const offer = await checkoutOffer(data.sales, orgSettings.timezone);
  if (!offer) redirect(page);

  const special = version ? specialPriceFor(version, data.sales, await specialSold(version.id)) : null;
  const ticket = special ? withVersionPrice(offer.ticket, special) : offer.ticket;
  const professions = await getOrderedProfessionOptions();
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <MetaPixelScript pixelId={data.pixelId} />
      <ImpCheckout
        eventSlug={event.slug}
        backHref={page}
        name={{ pre: words.join(" "), big }}
        dates={data.when.compact}
        format={kindLine(event)}
        ticket={ticket}
        // No discount code box for now (the team, 2026-10-29).
        codes={false}
        professions={professions}
        paypal={ticket.usdCents ? paypalCheckoutConfig() : null}
        version={version ? { slug: version.slug, special: special ? { label: special.label } : null } : null}
      />
    </main>
  );
}
