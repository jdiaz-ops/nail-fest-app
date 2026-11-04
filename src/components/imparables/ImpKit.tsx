import type { Event } from "@prisma/client";
import { publicEventName } from "@/lib/eventDisplayName";
import { KIT } from "@/lib/imparables/kit";
import { coverName } from "@/lib/imparables/schedule";
import { ImpPageTop } from "./ImpArt";
import { cinzel, manrope } from "./fonts";

// «Tu kit Imparable» (the team, 2026-11-04: «necesito la pestaña individual de Tu kit Imparable… para ver cómo es la
// landing de esto»): her kit's own page — the congress's mark as its cover draws it (no bar, no welcome: the team,
// 2026-11-04), her profile photo in the congress's frame, and the wallpapers for her phone, each one with its own
// «Descargar». No story templates (the team, 2026-11-04). Her kit, not her recordings (those have their page). Opened
// from her «Asistiré» link, with /kit (app/asistire/[token]/kit); the team's sample shows the same page.

export default function ImpKit({ event, frameUrl, helpUrl }: { event: Event; /** Her profile frame's page. */ frameUrl: string; /** The team's WhatsApp, when there's one. */ helpUrl: string | null }) {
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const pre = words.join(" ");

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <div className="imp-co">
        <div className="imp-co-main imp-mc">
          <ImpPageTop pre={pre} big={big} />

          <section className="imp-mc-sec" aria-labelledby="imp-kit-foto">
            <h2 className="imp-mc-h2" id="imp-kit-foto">
              Tu foto de perfil
            </h2>
            <a className="imp-kit-frame" href={frameUrl}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the frame, empty, as the tool draws it */}
              <img src={KIT.framePreview} alt="" width={120} height={120} />
              <span className="imp-kit-frame-t">
                <b>Pon tu foto en el marco Imparable</b>
                <span>Elige tu foto, ajústala y descárgala para tu perfil de WhatsApp e Instagram.</span>
                <em>Hacer mi foto de perfil →</em>
              </span>
            </a>
          </section>

          <section className="imp-mc-sec" aria-labelledby="imp-kit-fondos">
            <h2 className="imp-mc-h2" id="imp-kit-fondos">
              Fondos de pantalla
            </h2>
            <p className="imp-mc-sub">Descarga el que quieras y ponlo de fondo en tu celular.</p>
            <ul className="imp-kit-grid">
              {KIT.wallpapers.map((file) => (
                <li key={file.file}>
                  <a className="imp-kit-thumb" href={file.file} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- fixed kit files */}
                    <img src={file.mini} alt={file.name} width={360} height={640} loading="lazy" />
                    <span>{file.name}</span>
                  </a>
                  {/* Each one by itself (the team, 2026-11-04): it saves that file. */}
                  <a className="imp-kit-dl" href={file.file} download={file.file.split("/").pop()} aria-label={`Descargar «${file.name}»`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12M7 10l5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
            <p className="imp-mc-note imp-kit-iphone">En iPhone también puedes abrirlo, mantener el dedo sobre la imagen y tocar «Guardar en Fotos».</p>
          </section>

          {helpUrl && (
            <p className="imp-mc-help">
              ¿Necesitas ayuda?{" "}
              <a href={helpUrl} target="_blank" rel="noreferrer">
                Escríbenos por WhatsApp
              </a>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
