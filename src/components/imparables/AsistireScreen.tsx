import type { Event } from "@prisma/client";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { asistireShortLink } from "@/lib/imparables/asistire";
import { sponsorLogosOf } from "@/lib/imparables/blocks";
import { coverName, eventWhen, kindLine, PILLARS } from "@/lib/imparables/schedule";
import { ImpPageTop } from "./ImpArt";
import ImpAsistire from "./ImpAsistire";
import { MAX_SPONSORS } from "./asistireArt";
import { cinzel, manrope } from "./fonts";

// «Asistiré»'s page (2026-10-30), in the checkout's chrome: the image maker
// (ImpAsistire.tsx) for someone whose purchase is confirmed, or, while her
// payment is still being confirmed, a note to come back. Shown by her own
// link and by the team's sample link (app/asistire/[token]).
export default async function AsistireScreen({ event, waiting = false, token }: { event: Event; waiting?: boolean; token?: string }) {
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const pre = words.join(" ");
  const orgSettings = await getOrgSettings();
  const link = asistireShortLink();
  // The brands under «Con el apoyo de», as the cover reads them: from their section even while it's hidden.
  const sponsors = sponsorLogosOf(parseLandingBlocks(event.landingBlocks))
    .slice(0, MAX_SPONSORS)
    .map((item) => ({ name: item.handle.trim(), url: item.url.trim() }));

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <div className="imp-co">
        <div className="imp-co-main">
          {/* No bar and no way back on the pages she gets after paying (the team, 2026-11-04): the cover's mark. */}
          <ImpPageTop pre={pre} big={big} heading={false} />
          {waiting ? (
            <div className="imp-as">
              <h1 className="imp-co-h1">Tu imagen te espera</h1>
              <p className="imp-as-sub">Se activa apenas se confirme tu pago: vuelve a abrir este enlace en unos minutos.</p>
            </div>
          ) : (
            <ImpAsistire
              texts={{ pre, big, date: eventWhen(event, orgSettings.timezone).dates, kind: kindLine(event), link: link.text, tagline: PILLARS, sponsors }}
              fonts={{ display: cinzel.style.fontFamily, body: manrope.style.fontFamily }}
              linkHref={link.href}
              track={token}
            />
          )}
        </div>
      </div>
    </main>
  );
}
