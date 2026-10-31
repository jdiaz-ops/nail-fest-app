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
import { CHECKOUT_LEVELS, fill, isTieredVersion, tierBySlug } from "@/lib/imparables/tiers";
import { ensureTierTypes, soldOutTiers } from "@/lib/imparables/tiersServer";
import { pesos } from "@/lib/imparables/stages";
import MetaPixelScript from "@/components/MetaPixelScript";
import ImpCheckout, { type CheckoutChoice, type CheckoutLevels } from "./ImpCheckout";
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

  // A version that sells the ticket levels (lib/imparables/tiers.ts; the team's boceto, 2026-10-31): «Tu entrada» —
  // Imparable at the stage on sale, chosen; Círculo and Élite to change it for, at their own price, one, through their
  // own ticket types (one with no places left stays out). ?tier= chooses one from the start. Not at a version's special
  // price: then it's that price's ticket alone.
  let levels: CheckoutLevels | null = null;
  if (version && isTieredVersion(version.slug) && !special) {
    const [types, soldOut] = await Promise.all([ensureTierTypes(event.id), soldOutTiers(event.id)]);
    const stage = data.sales.current;
    const full = data.sales.full;
    const normal = stage && full && full.id !== stage.id && full.price > stage.price ? full.price : null;
    const imparable = tierBySlug("imparable")!;
    const choices: CheckoutChoice[] = [
      {
        slug: imparable.slug,
        name: imparable.name,
        tag: null,
        note: stage ? { strong: stage.name, rest: normal !== null ? fill(CHECKOUT_LEVELS.normal, { precio: pesos(normal) }) : null } : null,
        line: imparable.checkoutLine,
        ticket,
      },
    ];
    for (const slug of ["circulo", "elite"] as const) {
      const tier = tierBySlug(slug);
      const type = tier ? types.get(tier.slug) : undefined;
      if (!tier || !type || !tier.fixedPrice || soldOut.includes(tier.slug)) continue;
      choices.push({
        slug: tier.slug,
        name: tier.name,
        tag: tier.badge,
        note: null,
        line: tier.checkoutLine,
        ticket: { id: type.id, name: tier.name, price: tier.fixedPrice, fullPrice: null, usdCents: tier.fixedUsdCents, fullUsdCents: null, min: 1, max: 1 },
      });
    }
    const chosen = choices.find((c) => c.slug === tierBySlug(asked)?.slug) ?? choices[0]!;
    ticket = chosen.ticket;
    levels = { title: CHECKOUT_LEVELS.title, intro: CHECKOUT_LEVELS.intro, choices, chosen: chosen.slug };
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
        levels={levels}
      />
    </main>
  );
}
