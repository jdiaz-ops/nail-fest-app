import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { sayName } from "@/lib/mesa/email";
import { asistireRegistrationId, asistireSampleEventId } from "@/lib/imparables/asistire";
import { SAMPLE_NAME } from "@/lib/imparables/diplomaText";
import ImpKit from "@/components/imparables/ImpKit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu kit Imparable",
  robots: { index: false },
};

// Her kit's page (components/imparables/ImpKit.tsx, 2026-11-04): it hangs from her «Asistiré» link — the same signed
// link, with /kit, like her profile frame's — and opens once her purchase is confirmed; the team's sample link opens
// it with sample data.
export default async function KitPage({ params }: { params: { token: string } }) {
  const registrationId = asistireRegistrationId(params.token);
  if (!registrationId) notFound();
  const sampleEventId = asistireSampleEventId(registrationId);
  const [found, whatsapp] = await Promise.all([
    sampleEventId
      ? db.event.findUnique({ where: { id: sampleEventId } }).then((event) => (event ? { event, firstName: SAMPLE_NAME.firstName } : null))
      : db.registration
          .findUnique({ where: { id: registrationId }, include: { event: true, person: true } })
          .then((registration) => (registration?.status === "CONFIRMED" ? { event: registration.event, firstName: sayName(registration.person.firstName) } : null)),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  if (!found || found.event.theme !== "IMPARABLES") notFound();
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";

  return (
    <ImpKit
      event={found.event}
      firstName={found.firstName}
      frameUrl={`/asistire/${params.token}/marco`}
      helpUrl={digits.length >= 8 ? `https://wa.me/${digits}` : null}
      sample={Boolean(sampleEventId)}
    />
  );
}
