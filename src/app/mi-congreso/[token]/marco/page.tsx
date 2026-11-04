import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicEventName } from "@/lib/eventDisplayName";
import { getOrgSettings } from "@/lib/settings";
import { KIT } from "@/lib/imparables/kit";
import { findCongreso } from "@/lib/imparables/miCongreso";
import { coverName, eventWhen } from "@/lib/imparables/schedule";
import ImpMarco from "@/components/imparables/ImpMarco";
import { cinzel, manrope } from "@/components/imparables/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu foto de perfil",
  robots: { index: false },
};

// The profile frame of her kit (components/imparables/ImpMarco.tsx), from her page («Tu congreso»): the same signed
// link opens it, once her payment is confirmed; the team's sample too.
export default async function MarcoPage({ params }: { params: { token: string } }) {
  const access = await findCongreso(params.token);
  if (!access || (access.kind === "buyer" && access.waiting)) notFound();
  const { event } = access;
  const { timezone } = await getOrgSettings();
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const pre = words.join(" ");
  const back = `/mi-congreso/${params.token}`;

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <div className="imp-co">
        <header className="imp-co-top">
          <a className="imp-co-back" href={back}>
            <span aria-hidden="true">←</span>
            <span className="imp-co-back-t">Tu congreso</span>
          </a>
          <a className="imp-co-mark" href={back}>
            {pre && <span>{pre} </span>}
            <b>{big}</b>
          </a>
          <span />
        </header>
        <div className="imp-co-main">
          <ImpMarco
            fonts={{ display: cinzel.style.fontFamily, body: manrope.style.fontFamily }}
            texts={{ top: KIT.frame.top, bottom: eventWhen(event, timezone).compact }}
          />
        </div>
      </div>
    </main>
  );
}
