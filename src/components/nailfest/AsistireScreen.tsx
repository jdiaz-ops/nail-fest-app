import type { Event } from "@prisma/client";
import { getOrgSettings } from "@/lib/settings";
import { nailFestAsistire } from "@/lib/nailfest/asistire";
import ImpAsistire from "../imparables/ImpAsistire";
import { fraunces, inter } from "./fonts";

// Nail Fest's «Asistiré» page (2026-10-30): the image maker of Manicuristas
// Imparables' (ImpAsistire.tsx), with Nail Fest's image, in the site's colors
// (.imp.nf in globals.css). Shown by her own link — from her confirmation
// email and the page after signing up — and by the team's sample link
// (app/asistire/[token]).
export default async function NailFestAsistireScreen({ event }: { event: Event }) {
  const orgSettings = await getOrgSettings();
  const { texts, linkHref } = await nailFestAsistire(event, orgSettings.timezone);

  return (
    <main className={`imp nf ${fraunces.variable} ${inter.variable}`}>
      <div className="imp-co">
        <header className="imp-co-top">
          <a className="imp-co-back" href={`/${event.slug}`}>
            <span aria-hidden="true">←</span>
            <span className="imp-co-back-t">Volver</span>
          </a>
          <a className="nf-co-logo" href={`/${event.slug}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the logo, small */}
            <img src="/logo.png" alt="Nail Fest" width={45} height={36} />
          </a>
          <span />
        </header>
        <div className="imp-co-main">
          <ImpAsistire design="NAIL_FEST" texts={texts} fonts={{ display: fraunces.style.fontFamily, body: inter.style.fontFamily }} linkHref={linkHref} />
        </div>
      </div>
    </main>
  );
}
