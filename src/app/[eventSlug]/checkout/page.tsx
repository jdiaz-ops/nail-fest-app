import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { publicEventName } from "@/lib/eventDisplayName";
import ImpCheckoutScreen from "@/components/imparables/ImpCheckoutScreen";

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
  return <ImpCheckoutScreen event={event} version={null} />;
}
