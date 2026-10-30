import type { Event } from "@prisma/client";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { asistireShortLink } from "@/lib/imparables/asistire";
import { coverName, eventWhen, kindLine } from "@/lib/imparables/schedule";
import ImpAsistire from "./ImpAsistire";
import { cinzel, manrope } from "./fonts";

// «Asistiré»'s page (2026-10-30), in the checkout's chrome: the image maker
// (ImpAsistire.tsx) for someone whose purchase is confirmed, or, while her
// payment is still being confirmed, a note to come back. Shown by her own
// link (app/asistire/[token]) and by the team's preview of it
// (app/asistire/muestra/[eventSlug]).
export default async function AsistireScreen({ event, waiting = false }: { event: Event; waiting?: boolean }) {
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
