import type { SalesState } from "@/lib/imparables/stages";
import { pesos } from "@/lib/imparables/stages";
import { COMMON_PERKS, GUARANTEE, TIERS_SECTION, tierBadge, tierPrice, tiersInOrder, type Tier, type TierSlug } from "@/lib/imparables/tiers";
import ImpButton from "./ImpButton";
import ImpEliteWaitlist from "./ImpEliteWaitlist";

// «Elige cómo vivirlo» on a version that sells the ticket levels
// (lib/imparables/tiers.ts, 2026-10-31): Élite, Círculo and Imparable — in
// that order, left to right on a computer and from the top on a phone —,
// Círculo raised, each with what the three bring and, in bold after
// «Además:», what it brings besides; Élite in grey with its waiting list once
// its 20 are paid. Under them, the line for whoever doesn't know which, and
// the guarantee.

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** The guarantee's shield. */
export function Shield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 L20 5.5 V11.5 C20 16.5 16.6 20.4 12 22 C7.4 20.4 4 16.5 4 11.5 V5.5 Z" fill="currentColor" />
      <path d="M8.2 12.2 L11 15 L16 9.6" fill="none" stroke="#3b2418" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** «Garantía Imparable: escucha la primera charla…» */
export function GuaranteeLine({ className = "imp-lv-guar" }: { className?: string }) {
  return (
    <p className={className}>
      <Shield />
      <b>{GUARANTEE.title}</b> {GUARANTEE.line}
    </p>
  );
}

/** One level's card: its tag, name and price, what the three bring and what it brings besides, and what to do. */
export function TierCard({
  tier,
  badge,
  price,
  struck = null,
  note,
  top = false,
  out = false,
  children,
}: {
  tier: Tier;
  badge: string | null;
  price: string;
  struck?: string | null;
  note: React.ReactNode;
  top?: boolean;
  out?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className={`imp-lv${top ? " is-top" : ""}${out ? " is-out" : ""}`} aria-label={tier.name}>
      <div className="imp-lv-body">
        <p className="imp-lv-tag">{badge ?? " "}</p>
        <h3 className="imp-lv-name">{tier.name}</h3>
        <p className="imp-lv-amt">
          {price}
          {struck && <s>{struck}</s>}
        </p>
        <p className="imp-lv-note">{note}</p>
        <div className="imp-lv-lists">
          <ul className="imp-lv-list">
            {COMMON_PERKS.map((perk) => (
              <li key={perk}>
                <Check />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
          {tier.perks.length > 0 && (
            <>
              <p className="imp-lv-more">{TIERS_SECTION.more}</p>
              <ul className="imp-lv-list imp-lv-extra">
                {tier.perks.map((perk) => (
                  <li key={perk}>
                    <Check />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {children}
    </article>
  );
}

/** The three cards, the line under them and the guarantee — the section's content (ImparablesBlocks puts it before
 * the questions). */
export default function ImpTiers({
  eventSlug,
  sales,
  soldOut,
  stageLine,
}: {
  eventSlug: string;
  sales: SalesState;
  soldOut: TierSlug[];
  /** «Etapa Creyente · hasta el 18 de abril · luego $120.000» under Imparable's price. */
  stageLine: string | null;
}) {
  const stage = sales.current;
  const struck = stage && sales.full && sales.full.id !== stage.id && sales.full.price > stage.price ? pesos(sales.full.price) : null;
  return (
    <>
      <div className="imp-lv-cards">
        {tiersInOrder().map((tier) => {
          const price = tierPrice(tier, stage);
          if (price === null) return null;
          const out = soldOut.includes(tier.slug);
          return (
            <TierCard
              key={tier.slug}
              tier={tier}
              badge={out ? TIERS_SECTION.soldOut.badge : tierBadge(tier, stage)}
              price={pesos(price)}
              struck={tier.priceMode === "stage" ? struck : null}
              note={tier.priceMode === "stage" ? stageLine : TIERS_SECTION.fixedNote}
              top={tier.slug === "circulo"}
              out={out}
            >
              {out ? (
                <ImpEliteWaitlist eventSlug={eventSlug} intro={TIERS_SECTION.soldOut.intro} button={TIERS_SECTION.soldOut.button} done={TIERS_SECTION.soldOut.done} />
              ) : (
                <ImpButton action="buy" className="imp-cta" tier={tier.slug}>
                  {tier.button}
                </ImpButton>
              )}
            </TierCard>
          );
        })}
      </div>
      <p className="imp-lv-after">{TIERS_SECTION.undecided}</p>
      <GuaranteeLine />
    </>
  );
}
