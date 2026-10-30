import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { asistireRegistrationId, asistireShortLink } from "@/lib/imparables/asistire";
import { coverName, eventWhen, kindLine } from "@/lib/imparables/schedule";
import ImpAsistire from "@/components/imparables/ImpAsistire";
import { cinzel, manrope } from "@/components/imparables/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cuéntale a todos que vas",
  robots: { index: false },
};

// «Asistiré» (2026-10-30): where someone who bought Manicuristas Imparables
// makes her image to share (components/imparables/ImpAsistire.tsx), in the
// checkout's chrome. Her link is signed (lib/imparables/asistire.ts); it
// opens the image once her purchase is confirmed, and is nothing for anyone
// else.
export default async function AsistirePage({ params }: { params: { token: string } }) {
  const registrationId = asistireRegistrationId(params.token);
  const registration = registrationId ? await db.registration.findUnique({ where: { id: registrationId }, include: { event: true } }) : null;
  const waiting = registration?.status === "STARTED" || registration?.status === "PENDING_PAYMENT";
  if (!registration || registration.event.theme !== "IMPARABLES" || (registration.status !== "CONFIRMED" && !waiting)) notFound();

  const { event } = registration;
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const pre = words.join(" ");
  const orgSettings = await getOrgSettings();
  const link = asistireShortLink();

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <div className="imp-co">
        <header className="imp-co-top">
          <a className="imp-co-back" href={`/${event.slug}`}>
            <span aria-hidden="true">←</span>
            <span className="imp-co-back-t">Volver</span>
          </a>
          <a className="imp-co-mark" href={`/${event.slug}`}>
            {pre && <span>{pre} </span>}
            <b>{big}</b>
          </a>
          <span />
        </header>
        <div className="imp-co-main">
          {waiting ? (
            <div className="imp-as">
              <h1 className="imp-co-h1">Tu imagen te espera</h1>
              <p className="imp-as-sub">Se activa apenas se confirme tu pago: vuelve a abrir este enlace en unos minutos.</p>
            </div>
          ) : (
            <ImpAsistire
              texts={{ pre, big, date: eventWhen(event, orgSettings.timezone).dates, kind: kindLine(event), link: link.text }}
              fonts={{ display: cinzel.style.fontFamily, body: manrope.style.fontFamily }}
              linkHref={link.href}
            />
          )}
        </div>
      </div>
    </main>
  );
}
