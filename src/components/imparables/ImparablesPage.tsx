import { Fragment } from "react";
import { Cinzel, Manrope } from "next/font/google";
import type { EventFormat } from "@prisma/client";
import MetaPixelScript from "@/components/MetaPixelScript";
import type { LandingBlock } from "@/lib/landingBlocks/types";
import { coverName, type EventWhen } from "@/lib/imparables/schedule";
import { dayMonth, pesos, saving, untilDay, type SalesState } from "@/lib/imparables/stages";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { castLine, castOf, coverOf, panelOf } from "@/lib/imparables/blocks";
import ImparablesBlocks from "./ImparablesBlocks";
import { ImpIcon, Tiara, initials } from "./ImpArt";
import ImpButton from "./ImpButton";
import ImpPageTracking from "./ImpPageTracking";
import ImpStickyBar from "./ImpStickyBar";
import ImpTitle from "./ImpTitle";
import ImpWaitlistForm from "./ImpWaitlistForm";

// Manicuristas Imparables' own page (EventTheme IMPARABLES, 2026-10-26):
// the approved boceto, deep blue and gold, cinematic, mobile first, with
// Nail Fest as the organizer. Everything on it comes from the event — its
// name, tagline and days on the cover, the group photo (the first image of
// its blocks) with the speakers' names, its blocks below, its ticket types
// as price stages — so the team edits it like any other event's page. With
// a price on sale the cover sells it and the checkout is the usual one
// (EventRegistration, rendered here as just its modal); before the first
// stage opens, the page takes names for the waiting list instead.

const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--imp-display" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--imp-body" });

export interface ImparablesEvent {
  slug: string;
  /** publicEventName(event) */
  displayName: string;
  subtitle: string | null;
  city: string;
  venueName: string | null;
  format: EventFormat;
  closingText: string | null;
  registerButtonLabel: string | null;
  /** «Texto debajo del botón»: on this cover, the line under the countdown ("Imparables pasa una vez al año."). */
  ctaNote: string | null;
}

export interface ImparablesPreview {
  draft: boolean;
  /** The date the page is shown as of, when the team asked for one (?fecha=). */
  simulated: Date | null;
  /** Days worth looking at: the waiting list and each stage's first day. */
  shortcuts: { label: string; date: string }[];
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Tienes el talento. Ahora, a construir tu negocio." -> the first sentence, then the rest. */
function twoLines(text: string): [string, string] | [string] {
  const match = /^(.+?[.!?])\s+(.+)$/s.exec(text.trim());
  return match ? [match[1]!, match[2]!] : [text.trim()];
}

function secondsUntil(to: Date, now: Date): number {
  return Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
}

export default function ImparablesPage({
  event,
  blocks,
  sales,
  when,
  timezone,
  now,
  pixelId,
  whatsappUrl,
  brandName,
  preview,
  checkout,
}: {
  event: ImparablesEvent;
  blocks: LandingBlock[];
  sales: SalesState;
  when: EventWhen;
  timezone: string;
  now: Date;
  pixelId: string | null;
  whatsappUrl: string | null;
  brandName: string;
  preview: ImparablesPreview | null;
  /** The checkout (EventRegistration as a modal), only while a price is on sale. */
  checkout: React.ReactNode;
}) {
  // The name is the cover's title; a date in it is left out (the dates are right below).
  const words = coverName(event.displayName).split(/\s+/);
  const big = words.pop() ?? event.displayName;
  const pre = words.join(" ");
  const liveNote = event.format === "IN_PERSON" ? "" : "100% en vivo, desde tu celular";
  // The pill over the name (2026-10-27): how, when and from where — no platform named.
  const place = event.venueName || event.city;
  const kind = event.format === "VIRTUAL" ? "Congreso virtual" : event.format === "HYBRID" ? `Presencial${place ? ` en ${place}` : ""} y virtual` : place;
  const pill = [kind, when.short, when.opens, liveNote].filter((part): part is string => Boolean(part));

  const { cover, rest } = coverOf(blocks);
  const { speakers } = castOf(blocks);
  const panel = panelOf(rest);
  // Whose photo goes next to a name on the cards: the speakers', and the panel's guests already named.
  const faces = [...speakers, ...(panel?.people.items.filter((p) => p.name.trim()) ?? [])];
  const line = castLine(blocks);
  // The cover's button (and the closing's) says what the event's label says
  // («Quiero hacerlo diferente», 2026-10-27); the price's and the bar's, a
  // short one that fits the bar.
  const heroLabel = event.registerButtonLabel?.trim() || "Quiero mi cupo";
  const buyLabel = "Quiero mi cupo";
  const { mode, current, next } = sales;
  const closing = twoLines(event.closingText?.trim() || `Nos vemos el ${when.short}.`);
  // The lowest price the congress will have, when the one about to open is it.
  const opensCheapest = next && sales.stages.every((s) => s.state === "past" || s.price >= next.price);
  // Under the bar's price: the regular one struck with what today's saves —
  // or, with no regular price to tell it against, what comes after. Struck,
  // it needs no words: with «Quiero mi cupo» the bar has room for one line.
  const save = current ? saving(current, sales.normal) : 0;
  const barNote =
    save > 0 ? (
      <>
        <s>{pesos(sales.normal!.price)}</s> · ahorras {pesos(save)}
      </>
    ) : next ? (
      `Después sube a ${pesos(next.price)}`
    ) : current && current.id === sales.normal?.id ? (
      "El precio durante el congreso"
    ) : (
      "El último precio antes del congreso"
    );
  // The team's preview of another day runs its countdowns on that day's clock.
  const offsetMs = preview?.simulated ? now.getTime() - Date.now() : 0;

  const cta =
    mode === "sale" && current ? (
      <ImpButton action="buy" className="imp-cta">
        {heroLabel} · {pesos(current.price)}
      </ImpButton>
    ) : mode === "waitlist" ? (
      <ImpButton action="waitlist" className="imp-cta">
        Quiero estar en la lista de espera
      </ImpButton>
    ) : null;

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <MetaPixelScript pixelId={pixelId} />
      {mode !== "sale" && <ImpPageTracking />}

      {preview && (
        <div className="imp-preview">
          <p>
            <b>Vista previa del equipo.</b> {preview.draft ? "Este evento está en borrador: solo lo ve el equipo. " : ""}
            {preview.simulated ? `Así se ve el ${dayMonth(preview.simulated, timezone)} de ${utcToZonedInputValue(preview.simulated, timezone).slice(0, 4)}.` : "Así se ve hoy."}
          </p>
          {preview.shortcuts.length > 0 && (
            <nav aria-label="Ver la página en otra fecha">
              {preview.shortcuts.map((s) => (
                <a key={s.date} href={`?fecha=${s.date}`}>
                  {s.label}
                </a>
              ))}
              {preview.simulated && <a href="?">Hoy</a>}
            </nav>
          )}
        </div>
      )}

      <section className="imp-hero">
        <div className="imp-rays" aria-hidden="true" />
        <div className="imp-hero-in">
          <div className="imp-topbar">
            <span className="imp-org">
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
              <img src="/logo.png" alt={brandName} /> presenta
            </span>
          </div>
          {pill.length > 0 && (
            <p className="imp-pill">
              {pill.map((part, i) => (
                // Each part whole on its line: the pill breaks only between them.
                <Fragment key={i}>
                  {i > 0 && " · "}
                  <span>{part}</span>
                </Fragment>
              ))}
            </p>
          )}
          <Tiara />
          <ImpTitle pre={pre} big={big} />
          {event.subtitle && (
            // Sanitized before storage (lib/events.ts), like every event's tagline.
            <div className="imp-tag" dangerouslySetInnerHTML={{ __html: event.subtitle }} />
          )}
          {speakers.length > 0 ? (
            // The speakers: their photos in one strip, all of the same height,
            // and their names in a line under it — the cover image's caption,
            // or else their first names (2026-10-27).
            <figure className="imp-strip">
              <div className="imp-strip-row">
                {speakers.map((p, i) =>
                  p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
                    <img key={i} src={p.photoUrl} alt="" />
                  ) : (
                    <span key={i} className="imp-strip-ini" aria-hidden="true">
                      {initials(p.name)}
                    </span>
                  )
                )}
              </div>
              <figcaption>{cover?.caption.trim() || speakers.map((p) => p.name.trim().split(/\s+/)[0]).join(", ")}</figcaption>
            </figure>
          ) : (
            cover && (
              // Who is in it goes only to those who can't see it.
              <figure className="imp-group">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL */}
                <img src={cover.url} alt={cover.caption || [line.names, line.also].filter(Boolean).join(", ")} />
              </figure>
            )
          )}
          {cta}
          {mode === "closed" && <p className="imp-closed-note">La venta de boletas está cerrada.</p>}
          {/* Under the button: until when today's price holds and what comes
              after — then what makes buying risk-free («Texto debajo del
              botón», a guarantee). The regular price and the saving are told
              in «Tu boleta» and the bar (2026-10-27). */}
          {mode === "sale" && current && next && current.closesAt && (
            <div className="imp-deal">
              <p className="imp-deal-until">
                {current.name} hasta el {untilDay(current.closesAt, timezone)}; después sube a {pesos(next.price)}.
              </p>
            </div>
          )}
          {event.ctaNote?.trim() && (
            <p className="imp-once">
              <ImpIcon name="shield" size={17} />
              <span>{event.ctaNote.trim()}</span>
            </p>
          )}
        </div>
      </section>

      {mode === "waitlist" && next?.opensAt && (
        <div className="imp-wl-wrap">
          <ImpWaitlistForm
            eventSlug={event.slug}
            intro={
              <>
                Te avisamos primero cuando abra la venta, el {dayMonth(next.opensAt, timezone)}: <b>{pesos(next.price)}</b>
                {opensCheapest ? ", el precio más bajo que va a tener." : "."}
              </>
            }
          />
        </div>
      )}

      <ImparablesBlocks blocks={rest} context={{ sales, offsetMs, when, timezone, now, buyLabel, speakers: faces, panel }} />

      <section className="imp-close">
        <div className="imp-rays" aria-hidden="true" />
        <div className="imp-hero-in">
          <Tiara />
          {closing.length === 2 ? (
            <>
              <p className="imp-close-1">{closing[0]}</p>
              <p className="imp-close-2 imp-gold">{closing[1]}</p>
            </>
          ) : (
            <p className="imp-close-2 imp-gold">{closing[0]}</p>
          )}
          {cta}
          <div className="imp-close-3">
            {capitalize(when.short)}
            {liveNote ? ` · ${liveNote}` : ""}
          </div>
        </div>
      </section>

      <footer className={`imp-foot${mode === "closed" ? "" : " imp-foot--bar"}`}>
        <span className="imp-foot-org">
          Organiza
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
          <img src="/logo.png" alt={brandName} />
        </span>
        <nav>
          <a href="/terminos">Términos</a>
          <a href="/privacidad">Privacidad</a>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              ¿Dudas? Escríbenos por WhatsApp
            </a>
          )}
        </nav>
      </footer>

      {mode === "sale" && current && (
        <ImpStickyBar>
          <div className="imp-sticky-in">
            <div className="imp-st-p">
              <b>
                {pesos(current.price)} · {current.name}
              </b>
              <span>{barNote}</span>
            </div>
            <ImpButton action="buy" className="imp-st-b">
              {buyLabel}
            </ImpButton>
          </div>
        </ImpStickyBar>
      )}
      {mode === "waitlist" && next?.opensAt && (
        <ImpStickyBar>
          <div className="imp-sticky-in">
            <div className="imp-st-p">
              <b>Lista de espera</b>
              <span>La venta abre el {dayMonth(next.opensAt, timezone)}</span>
            </div>
            <ImpButton action="waitlist" className="imp-st-b">
              Anotarme
            </ImpButton>
          </div>
        </ImpStickyBar>
      )}

      {/* The checkout keeps the app's own light look: a form to fill, not a poster. */}
      {checkout && <div className="imp-checkout">{checkout}</div>}
    </main>
  );
}
