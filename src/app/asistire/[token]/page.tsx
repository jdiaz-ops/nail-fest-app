import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { asistireRegistrationId } from "@/lib/imparables/asistire";
import AsistireScreen from "@/components/imparables/AsistireScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cuéntale a todos que vas",
  robots: { index: false },
};

// «Asistiré» (2026-10-30): where someone who bought Manicuristas Imparables
// makes her image to share (components/imparables/AsistireScreen.tsx). Her
// link is signed (lib/imparables/asistire.ts); it opens the image once her
// purchase is confirmed, and is nothing for anyone else.
export default async function AsistirePage({ params }: { params: { token: string } }) {
  const registrationId = asistireRegistrationId(params.token);
  const registration = registrationId ? await db.registration.findUnique({ where: { id: registrationId }, include: { event: true } }) : null;
  const waiting = registration?.status === "STARTED" || registration?.status === "PENDING_PAYMENT";
  if (!registration || registration.event.theme !== "IMPARABLES" || (registration.status !== "CONFIRMED" && !waiting)) notFound();
  return <AsistireScreen event={registration.event} waiting={waiting} />;
}
