import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { asistireRegistrationId, asistireSampleEventId } from "@/lib/imparables/asistire";
import ImpKit from "@/components/imparables/ImpKit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu kit Imparable",
  robots: { index: false },
};

// Her kit's page (components/imparables/ImpKit.tsx, 2026-11-04): it hangs from her «Asistiré» link — the same signed
// link, with /kit, like her profile frame's — and opens once her purchase is confirmed; the team's sample link opens
// the same page.
export default async function KitPage({ params }: { params: { token: string } }) {
  const registrationId = asistireRegistrationId(params.token);
  if (!registrationId) notFound();
  const sampleEventId = asistireSampleEventId(registrationId);
  const [found, whatsapp] = await Promise.all([
    sampleEventId
      ? db.event.findUnique({ where: { id: sampleEventId } }).then((event) => (event ? { event } : null))
      : db.registration
          .findUnique({ where: { id: registrationId }, include: { event: true } })
          .then((registration) => (registration?.status === "CONFIRMED" ? { event: registration.event } : null)),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  if (!found || found.event.theme !== "IMPARABLES") notFound();
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";

  return (
    <ImpKit event={found.event} frameUrl={`/asistire/${params.token}/marco`} helpUrl={digits.length >= 8 ? `https://wa.me/${digits}` : null} />
  );
}
