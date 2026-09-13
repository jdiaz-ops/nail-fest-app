import { Fraunces } from "next/font/google";
import type { SalesPageContent } from "@/lib/salesPage/types";

// Same font call as EventRegistration.tsx/pago/page.tsx (next/font
// dedupes identical calls) — the one display face used everywhere a page
// wants a "this is a moment" headline instead of the plain sans body copy.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

// Replaces the plain "<h1>{event.name}</h1>" + venue line for an event
// that has salesPageContent — see [eventSlug]/page.tsx's own branch. A
// full-bleed dark band (the one place this landing departs from the
// site's usual light background) so the hook lands with real weight
// instead of reading as one more paragraph on the page.
export default function SalesPageHero({ hero }: { hero: SalesPageContent["hero"] }) {
  return (
    <div className="sales-hero">
      <span className="sales-hero-eyebrow">{hero.eyebrow}</span>
      <h1 className={`${fraunces.className} sales-hero-headline`}>{hero.headline}</h1>
      <p className="sales-hero-subhead">{hero.subheadline}</p>
      <p className="sales-hero-tension">{hero.tensionLine}</p>
    </div>
  );
}
