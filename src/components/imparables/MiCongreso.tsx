import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { congressTimes, dayWords, instagramUrl, peopleOf, readRecordings, talksOf, whoIs, youtubeId } from "@/lib/imparables/grabaciones";
import { coverName, eventWhen } from "@/lib/imparables/schedule";
import { Tiara } from "./ImpArt";
import ImpVideo from "./ImpVideo";
import { cinzel, manrope } from "./fonts";

// «Grabaciones» in the admin (the team, 2026-11-04): each buyer's page for Manicuristas Imparables, in the checkout's
// chrome — hello, the day and its hours, and the recording of every talk, from the congress's end to its last day;
// until then, when they open. Only the recordings (the team, 2026-11-04): her diploma has a link of its own, for the
// emails (/api/diploma/[token]), and her kit and her «¡Asistiré!» image go by email before the congress. While her
// payment is being confirmed, a note to come back. The team's sample shows the recordings, with sample data
// (app/mi-congreso/[token]).

type Props = {
  event: Event;
  /** «Ana María», her first name as it's said; «» when it can't be. */
  firstName: string;
  /** Her own link into the Zoom, when it has one. */
  zoomUrl?: string | null;
  sample?: boolean;
  waiting?: boolean;
};

/** Who gives a talk: her photo — her initials without one —, her name and her Instagram, which opens it. */
function Speaker({ name, handle, photoUrl }: { name: string; handle: string; photoUrl: string }) {
  const url = instagramUrl(handle);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase("es"))
    .join("");
  return (
    <div className="imp-mc-who">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the speakers' photos from the congress's page
        <img src={photoUrl} alt="" width={44} height={44} loading="lazy" />
      ) : (
        <span className="imp-mc-who-i" aria-hidden="true">
          {initials}
        </span>
      )}
      <span className="imp-mc-who-t">
        <b>{name}</b>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Instagram de ${name}`}>
            @{handle.replace(/^@+/, "")}
          </a>
        )}
      </span>
    </div>
  );
}

export default async function MiCongreso({ event, firstName, zoomUrl, sample = false, waiting = false }: Props) {
  const [orgSettings, whatsapp] = await Promise.all([
    getOrgSettings(),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  const helpUrl = digits.length >= 8 ? `https://wa.me/${digits}` : null;
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const pre = words.join(" ");
  const when = eventWhen(event, orgSettings.timezone);
  const recordings = readRecordings(event.recordings);
  const times = congressTimes(event, recordings, orgSettings.timezone);
  const now = Date.now();
  const over = sample || now >= times.ends.getTime();
  const closed = !sample && now >= times.recordingsClose.getTime();
  const blocks = parseLandingBlocks(event.landingBlocks);
  const people = peopleOf(blocks);
  // Each talk with its video, who gives it — her photo and her Instagram, as the page has them unless the team wrote
  // another — and its tag: «Charla 1», «Charla 2»… in the program's order, «Panel» for the panel.
  let count = 0;
  const talks = (recordings.items.length ? recordings.items : talksOf(blocks.filter((block) => !block.hidden))).map((talk) => {
    const who = whoIs(people, talk.speaker);
    return {
      ...talk,
      video: youtubeId(talk.url),
      handle: talk.handle || who?.handle || "",
      photoUrl: who?.photoUrl || "",
      tag: /^panel\b/i.test(talk.title) ? "Panel" : `Charla ${++count}`,
    };
  });
  const someVideo = talks.some((talk) => talk.video);

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <div className="imp-co">
        <header className="imp-co-top">
          <span />
          <a className="imp-co-mark" href={`/${event.slug}`}>
            {pre && <span>{pre} </span>}
            <b>{big}</b>
          </a>
          <span />
        </header>
        <div className="imp-co-main imp-mc">
          {sample && (
            <p className="imp-mc-sample">
              Muestra para el equipo: así ve su página cada compradora, con datos de ejemplo. A ella, las grabaciones le aparecen al terminar el congreso.
            </p>
          )}

          <section className="imp-mc-hero imp-co-dark">
            <Tiara className="imp-mc-tiara" />
            <p className="imp-mc-kicker">Tu congreso</p>
            <h1 className="imp-mc-h1">{firstName ? `Hola, ${firstName}` : "Hola, Imparable"}</h1>
            {waiting ? (
              <p className="imp-mc-lead">Tu página se activa apenas se confirme tu pago. Vuelve a abrir este enlace en unos minutos.</p>
            ) : (
              <>
                <p className="imp-mc-lead">Aquí está la grabación de cada charla. Este enlace es solo tuyo: guárdalo.</p>
                <p className="imp-mc-when">
                  <b>{when.dates}</b>
                  {when.hours ? ` · ${when.hours}, hora Colombia` : ""}
                </p>
                {zoomUrl && !over && (
                  <a className="imp-co-btn" href={zoomUrl}>
                    Entrar al congreso en Zoom
                  </a>
                )}
              </>
            )}
          </section>

          {!waiting && (
            <>
              <section className="imp-mc-sec" id="grabaciones" aria-labelledby="imp-mc-rec">
                <h2 className="imp-mc-h2" id="imp-mc-rec">
                  Grabaciones
                </h2>
                {closed ? (
                  <p className="imp-mc-sub">Las grabaciones estuvieron disponibles hasta el {dayWords(times.recordingsUntil)}.</p>
                ) : (
                  <>
                    <p className="imp-mc-sub">
                      {!over
                        ? `Aquí vas a ver la grabación de cada charla desde que termine el congreso, el ${dayWords(times.lastDay)}, hasta el ${dayWords(times.recordingsUntil)}.`
                        : someVideo
                          ? `La grabación de cada charla, para verla cuando quieras hasta el ${dayWords(times.recordingsUntil)}.`
                          : "Estamos subiendo las grabaciones: aparecen aquí apenas estén listas."}
                    </p>
                    <ol className="imp-mc-videos">
                      {talks.map((talk, i) => (
                        <li key={i} className="imp-mc-card">
                          {over && talk.video ? (
                            <ImpVideo id={talk.video} title={talk.title} />
                          ) : (
                            <div className="imp-mc-cover" aria-hidden="true">
                              <Tiara className="imp-mc-cover-tiara" />
                              <span>{over ? "Muy pronto" : `Disponible el ${dayWords(times.lastDay)}`}</span>
                            </div>
                          )}
                          <div className="imp-mc-card-in">
                            <p className="imp-mc-tag">{talk.tag}</p>
                            <h3 className="imp-mc-vt">{talk.title}</h3>
                            {talk.speaker && <Speaker name={talk.speaker} handle={talk.handle} photoUrl={talk.photoUrl} />}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>
            </>
          )}

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
