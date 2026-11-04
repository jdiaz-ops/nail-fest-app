import type { Event } from "@prisma/client";
import { publicEventName } from "@/lib/eventDisplayName";
import { KIT, type KitFile } from "@/lib/imparables/kit";
import { coverName } from "@/lib/imparables/schedule";
import { Tiara } from "./ImpArt";
import { cinzel, manrope } from "./fonts";

// «Tu kit Imparable» (the team, 2026-11-04: «necesito la pestaña individual de Tu kit Imparable… para ver cómo es la
// landing de esto»): her kit's own page, in the checkout's chrome — hello; her profile photo in the congress's frame;
// the wallpapers for her phone and the templates for her stories, each one opening its file to save it. Her kit, not
// her recordings (those have their page). Opened from her «Asistiré» link, with /kit (app/asistire/[token]/kit); the
// team's sample shows it with sample data.

function Thumbs({ files }: { files: KitFile[] }) {
  return (
    <ul className="imp-kit-grid">
      {files.map((file) => (
        <li key={file.file}>
          <a className="imp-kit-thumb" href={file.file} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed kit files */}
            <img src={file.mini} alt={file.name} width={360} height={640} loading="lazy" />
            <span>{file.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function ImpKit({
  event,
  firstName,
  frameUrl,
  helpUrl,
  sample = false,
}: {
  event: Event;
  /** «Ana María», her first name as it's said; «» when it can't be. */
  firstName: string;
  /** Her profile frame's page. */
  frameUrl: string;
  /** The team's WhatsApp, when there's one. */
  helpUrl: string | null;
  sample?: boolean;
}) {
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const pre = words.join(" ");

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
        <div className="imp-co-main imp-mc">
          {sample && <p className="imp-mc-sample">Muestra para el equipo: así ve su kit cada compradora, con datos de ejemplo.</p>}

          <section className="imp-mc-hero imp-co-dark">
            <Tiara className="imp-mc-tiara" />
            <p className="imp-mc-kicker">Tu kit Imparable</p>
            <h1 className="imp-mc-h1">{firstName ? `Hola, ${firstName}` : "Hola, Imparable"}</h1>
            <p className="imp-mc-lead">
              Para que se note que vas: tu foto de perfil con el marco del congreso, fondos para tu celular y plantillas para tus historias. Úsalo antes,
              durante y después del congreso.
            </p>
          </section>

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
            <p className="imp-mc-sub">Ábrelo, mantenlo presionado y toca «Guardar». Luego ponlo de fondo en tu celular.</p>
            <Thumbs files={KIT.wallpapers} />
          </section>

          <section className="imp-mc-sec" aria-labelledby="imp-kit-historias">
            <h2 className="imp-mc-h2" id="imp-kit-historias">
              Plantillas para tus historias
            </h2>
            <p className="imp-mc-sub">Guárdala, súbela a tu historia de Instagram o a tu estado de WhatsApp y escribe encima.</p>
            <Thumbs files={KIT.stories} />
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
