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
import { TIERS_SECTION, UPGRADE_OFFER, fill, isTieredVersion, tierBySlug, type Tier } from "@/lib/imparables/tiers";
import { ensureTierTypes, soldOutTiers } from "@/lib/imparables/tiersServer";
import { dollars, pesos } from "@/lib/imparables/stages";
import type { CheckoutTicket } from "@/lib/imparables/pricing";
import MetaPixelScript from "@/components/MetaPixelScript";
import ImpCheckout, { type CheckoutLevel } from "./ImpCheckout";
import { cinzel, manrope } from "./fonts";

// The congress's one-page checkout, for its main page (/<event>/checkout) and
// for a version of it (/v/<slug>/checkout, 2026-10-30): the stage on sale
// (lib/imparables/pricing.ts) — at the version's special price when it has
// one, in pesos only — and back to the page it came from. Without a stage on
// sale, back to that page.
export default async function ImpCheckoutScreen({ event, version, tier: asked = null }: { event: Event; version: LandingVersion | null; tier?: string | null }) {
  const page = version ? `/v/${version.slug}` : `/${event.slug}`;
  const orgSettings = await getOrgSettings();
  const now = new Date();
  const data = await imparablesPageData(event, orgSettings.timezone, now);
  const offer = await checkoutOffer(data.sales, orgSettings.timezone);
  if (!offer) redirect(page);

  const special = version ? specialPriceFor(version, data.sales, await specialSold(version.id)) : null;
  let ticket = special ? withVersionPrice(offer.ticket, special) : offer.ticket;

  // A version that sells the ticket levels (lib/imparables/tiers.ts, 2026-10-31): the one its button chose — Círculo
  // and Élite at their own price, one, through their own ticket types; Imparable at the stage on sale, with the one
  // offer to move to Círculo. A level with no places left goes back to the levels.
  let level: CheckoutLevel | null = null;
  if (version && isTieredVersion(version.slug)) {
    const [types, soldOut] = await Promise.all([ensureTierTypes(event.id), soldOutTiers(event.id)]);
    const fixedTicket = (t: Tier): CheckoutTicket | null => {
      const type = types.get(t.slug);
      return type && t.fixedPrice ? { id: type.id, name: t.name, price: t.fixedPrice, fullPrice: null, usdCents: t.fixedUsdCents, fullUsdCents: null, min: 1, max: 1 } : null;
    };
    const fixedLevel = (t: Tier): CheckoutLevel => ({ slug: t.slug, name: t.name, note: TIERS_SECTION.fixedNote, extras: t.perks, upgrade: null });
    const chosen = tierBySlug(asked) ?? tierBySlug("imparable")!;
    if (chosen.priceMode === "fixed") {
      const fixed = fixedTicket(chosen);
      if (!fixed || soldOut.includes(chosen.slug)) redirect(`${page}#niveles`);
      ticket = fixed;
      level = fixedLevel(chosen);
    } else {
      const circulo = tierBySlug("circulo");
      const circuloTicket = circulo ? fixedTicket(circulo) : null;
      const difference = circuloTicket ? circuloTicket.price - ticket.price : 0;
      // In dollars too, for whoever pays with PayPal — when both have a price in dollars.
      const differenceUsd = circuloTicket?.usdCents != null && ticket.usdCents !== null ? circuloTicket.usdCents - ticket.usdCents : null;
      level = {
        slug: chosen.slug,
        name: chosen.name,
        note: data.sales.current?.name ?? null,
        extras: chosen.perks,
        upgrade:
          circulo && circuloTicket && difference > 0 && !special && !soldOut.includes(circulo.slug)
            ? {
                level: fixedLevel(circulo),
                ticket: circuloTicket,
                title: fill(UPGRADE_OFFER.title, { diferencia: pesos(difference) }),
                titleUsd: differenceUsd !== null && differenceUsd > 0 ? fill(UPGRADE_OFFER.title, { diferencia: dollars(differenceUsd) }) : null,
                text: UPGRADE_OFFER.text,
                yes: UPGRADE_OFFER.yes,
                no: UPGRADE_OFFER.no,
              }
            : null,
      };
    }
  }
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
        level={level}
      />
    </main>
  );
}
