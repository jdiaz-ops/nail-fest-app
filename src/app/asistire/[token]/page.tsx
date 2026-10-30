import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { asistireRegistrationId, asistireSampleEventId } from "@/lib/imparables/asistire";
import { hasNailFestAsistire } from "@/lib/nailfest/asistire";
import AsistireScreen from "@/components/imparables/AsistireScreen";
import NailFestAsistireScreen from "@/components/nailfest/AsistireScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cuéntale a todos que vas",
  robots: { index: false },
};

// «Asistiré» (2026-10-30): where someone who bought Manicuristas Imparables
// makes her image to share (components/imparables/AsistireScreen.tsx). Her
// link is signed (lib/imparables/asistire.ts); it opens the image once her
// purchase is confirmed, and is nothing for anyone else. The team's sample
// link opens the same page for its event, with no purchase behind it. For
// someone signed up to a Nail Fest event at a place, Nail Fest's image
// (components/nailfest/AsistireScreen.tsx), once her place is confirmed.
export default async function AsistirePage({ params }: { params: { token: string } }) {
  const registrationId = asistireRegistrationId(params.token);
  const sampleEventId = registrationId ? asistireSampleEventId(registrationId) : null;
  if (sampleEventId) {
    const event = await db.event.findUnique({ where: { id: sampleEventId } });
    if (event?.theme === "IMPARABLES") return <AsistireScreen event={event} />;
    if (event && hasNailFestAsistire(event)) return <NailFestAsistireScreen event={event} />;
    notFound();
  }
  const registration = registrationId ? await db.registration.findUnique({ where: { id: registrationId }, include: { event: true } }) : null;
  if (!registration) notFound();
  const waiting = registration.status === "STARTED" || registration.status === "PENDING_PAYMENT";
  if (registration.event.theme === "IMPARABLES") {
    if (registration.status !== "CONFIRMED" && !waiting) notFound();
    return <AsistireScreen event={registration.event} waiting={waiting} />;
  }
  if (!hasNailFestAsistire(registration.event) || registration.status !== "CONFIRMED") notFound();
  return <NailFestAsistireScreen event={registration.event} />;
}
