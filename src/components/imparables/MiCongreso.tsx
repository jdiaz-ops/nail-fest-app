import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { congressTimes, dayWords, readRecordings, talksOf, youtubeId } from "@/lib/imparables/grabaciones";
import { KIT } from "@/lib/imparables/kit";
import { diplomaPath } from "@/lib/imparables/miCongreso";
import { coverName, eventWhen } from "@/lib/imparables/schedule";
import { Tiara } from "./ImpArt";
import ImpVideo from "./ImpVideo";
import { cinzel, manrope } from "./fonts";

// «Grabaciones» in the admin, «Tu congreso» for her (the team, 2026-11-04): each buyer's page for Manicuristas
// Imparables, in the checkout's chrome — hello, the day and its hours; the recording of every talk, from the
// congress's end to its last day; and the link to download her diploma with her name, once it's over. Until then each
// part says when it opens. Her kit and her «¡Asistiré!» image aren't here: she gets them by email before the congress
// (the team, 2026-11-04). While her payment is being confirmed, a note to come back. The team's sample shows every
// part, with sample data (app/mi-congreso/[token]).

type Props = {
  event: Event;
  token: string;
  /** «Ana María», her first name as it's said; «» when it can't be. */
  firstName: string;
  /** The name on her diploma; «» when we don't have it. */
  diplomaName: string;
  /** Her own link into the Zoom, when it has one. */
  zoomUrl?: string | null;
  sample?: boolean;
  waiting?: boolean;
};

export default async function MiCongreso({ event, token, firstName, diplomaName, zoomUrl, sample = false, waiting = false }: Props) {
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
  const talks = recordings.items.length ? recordings.items : talksOf(parseLandingBlocks(event.landingBlocks).filter((block) => !block.hidden));
  const someVideo = talks.some((talk) => youtubeId(talk.url));
  const diploma = diplomaPath(token);

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
              Muestra para el equipo: así ve su página cada compradora, con datos de ejemplo. A ella, las grabaciones y el diploma le aparecen al terminar el
              congreso.
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
                <p className="imp-mc-lead">Aquí están la grabación de cada charla y tu diploma. Este enlace es solo tuyo: guárdalo.</p>
                <p className="imp-mc-when">
                  <b>{when.dates}</b>
                  {when.hours ? ` · ${when.hours}, hora Colombia` : ""}
                </p>
                {zoomUrl && !over && (
                  <a className="imp-co-btn" href={zoomUrl}>
                    Entrar al congreso en Zoom
                  </a>
                )}
                <nav className="imp-mc-nav" aria-label="En esta página">
                  <a href="#grabaciones">Grabaciones</a>
                  <a href="#diploma">Diploma</a>
                </nav>
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
                ) : over ? (
                  <>
                    <p className="imp-mc-sub">
                      {someVideo
                        ? `La grabación de cada charla, para verla cuando quieras hasta el ${dayWords(times.recordingsUntil)}.`
                        : "Estamos subiendo las grabaciones: aparecen aquí apenas estén listas."}
                    </p>
                    {someVideo && (
                      <ol className="imp-mc-videos">
                        {talks.map((talk, i) => {
                          const id = youtubeId(talk.url);
                          return id ? (
                            <li key={i}>
                              <ImpVideo id={id} title={talk.title} />
                              <h3 className="imp-mc-vt">{talk.title}</h3>
                              {talk.speaker && <p className="imp-mc-vs">{talk.speaker}</p>}
                            </li>
                          ) : null;
                        })}
                      </ol>
                    )}
                    {talks.some((talk) => !youtubeId(talk.url)) && (
                      <ol className="imp-mc-list">
                        {talks.map((talk, i) =>
                          youtubeId(talk.url) ? null : (
                            <li key={i}>
                              <b>{talk.title}</b>
                              {talk.speaker && <span>{talk.speaker}</span>}
                              <em className="imp-mc-soon">Muy pronto</em>
                            </li>
                          )
                        )}
                      </ol>
                    )}
                  </>
                ) : (
                  <>
                    <p className="imp-mc-sub">
                      Aquí vas a ver la grabación de cada charla desde que termine el congreso, el {dayWords(times.lastDay)}, hasta el{" "}
                      {dayWords(times.recordingsUntil)}.
                    </p>
                    <ol className="imp-mc-list">
                      {talks.map((talk, i) => (
                        <li key={i}>
                          <b>{talk.title}</b>
                          {talk.speaker && <span>{talk.speaker}</span>}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>

              <section className="imp-mc-sec" id="diploma" aria-labelledby="imp-mc-dip">
                <h2 className="imp-mc-h2" id="imp-mc-dip">
                  Tu diploma
                </h2>
                {!over ? (
                  <>
                    <p className="imp-mc-sub">Tu diploma digital con tu nombre aparece aquí al terminar el congreso, el {dayWords(times.lastDay)}.</p>
                    <figure className="imp-mc-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element -- fixed sample image */}
                      <img src={KIT.diplomaPreview} alt="El diploma de Manicuristas Imparables, con un nombre de ejemplo" width={1200} height={849} loading="lazy" />
                      <figcaption>Así se verá, con tu nombre.</figcaption>
                    </figure>
                  </>
                ) : diplomaName ? (
                  <>
                    <p className="imp-mc-sub">
                      Tu diploma de participación, a nombre de <b>{diplomaName}</b>. Descárgalo, imprímelo o compártelo.
                    </p>
                    <a className="imp-co-btn" href={`${diploma}?descargar`}>
                      Descargar mi diploma (PDF)
                    </a>
                    <a className="imp-mc-link" href={diploma} target="_blank" rel="noreferrer">
                      Verlo antes de descargarlo
                    </a>
                    {helpUrl && (
                      <p className="imp-mc-note">
                        ¿Tu nombre está mal escrito?{" "}
                        <a href={helpUrl} target="_blank" rel="noreferrer">
                          Escríbenos por WhatsApp
                        </a>{" "}
                        y lo corregimos.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="imp-mc-sub">
                    No tenemos tu nombre completo para el diploma.{" "}
                    {helpUrl ? (
                      <a href={helpUrl} target="_blank" rel="noreferrer">
                        Escríbenos por WhatsApp
                      </a>
                    ) : (
                      "Escríbenos"
                    )}{" "}
                    y te lo hacemos.
                  </p>
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
