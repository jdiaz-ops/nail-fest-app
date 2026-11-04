import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { publicEventName } from "@/lib/eventDisplayName";
import { getOrgSettings } from "@/lib/settings";
import { asistireRegistrationId, asistireSampleEventId } from "@/lib/imparables/asistire";
import { KIT } from "@/lib/imparables/kit";
import { coverName, eventWhen } from "@/lib/imparables/schedule";
import { ImpPageTop } from "@/components/imparables/ImpArt";
import ImpMarco from "@/components/imparables/ImpMarco";
import { cinzel, manrope } from "@/components/imparables/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu foto de perfil",
  robots: { index: false },
};

// The profile frame of Manicuristas Imparables' kit (components/imparables/ImpMarco.tsx), which she gets by email before
// the congress with her «Asistiré» image (the team, 2026-11-04): it hangs from her «Asistiré» link — the same signed
// link, with /marco —, and opens once her purchase is confirmed; the team's sample link opens it too.
export default async function MarcoPage({ params }: { params: { token: string } }) {
  const registrationId = asistireRegistrationId(params.token);
  if (!registrationId) notFound();
  const sampleEventId = asistireSampleEventId(registrationId);
  const event = sampleEventId
    ? await db.event.findUnique({ where: { id: sampleEventId } })
    : await db.registration
        .findUnique({ where: { id: registrationId }, include: { event: true } })
        .then((registration) => (registration?.status === "CONFIRMED" ? registration.event : null));
  if (!event || event.theme !== "IMPARABLES") notFound();
  const { timezone } = await getOrgSettings();
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const pre = words.join(" ");

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <div className="imp-co">
        <div className="imp-co-main">
          {/* No bar and no way back on the pages she gets after paying (the team, 2026-11-04): the cover's mark. */}
          <ImpPageTop pre={pre} big={big} heading={false} />
          <ImpMarco
            fonts={{ display: cinzel.style.fontFamily, body: manrope.style.fontFamily }}
            texts={{ top: KIT.frame.top, bottom: eventWhen(event, timezone).compact }}
          />
        </div>
      </div>
    </main>
  );
}
