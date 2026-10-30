import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { publicEventName } from "@/lib/eventDisplayName";
import { liveVersion } from "@/lib/imparables/versions";
import ImpCheckoutScreen from "@/components/imparables/ImpCheckoutScreen";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { event } = await liveVersion(params.slug);
  return { title: event ? `Reserva tu cupo · ${publicEventName(event)}` : "Reserva tu cupo", robots: { index: false, follow: false } };
}

// A version's checkout (2026-10-30): the congress's one, at the version's
// special price when it has one (components/imparables/ImpCheckoutScreen).
// Paused or outside its dates, the main checkout — at the normal price —
// keeping the visit's query.
export default async function VersionCheckoutPage({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const { version, event } = await liveVersion(params.slug);
  if (!event || event.status === "DRAFT") notFound();
  if (!version || event.theme !== "IMPARABLES") {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) for (const one of Array.isArray(v) ? v : v ? [v] : []) q.append(k, one);
    redirect(`/${event.slug}/checkout${q.toString() ? `?${q}` : ""}`);
  }
  return <ImpCheckoutScreen event={event} version={version} />;
}
