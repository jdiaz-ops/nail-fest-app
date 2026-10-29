import type { EventFormat } from "@prisma/client";
import MetaPixelScript from "@/components/MetaPixelScript";
import type { LandingBlock } from "@/lib/landingBlocks/types";
import { coverName, type EventWhen } from "@/lib/imparables/schedule";
import { dayMonth, dollars, pesos, saving, untilDate, type SalesState } from "@/lib/imparables/stages";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { castLine, castOf, coverOf, introOf, panelOf } from "@/lib/imparables/blocks";
import { splitTagline } from "@/lib/imparables/tagline";
import ImparablesBlocks from "./ImparablesBlocks";
import { Tiara } from "./ImpArt";
import ImpButton from "./ImpButton";
import ImpPageTracking from "./ImpPageTracking";
import ImpStickyBar from "./ImpStickyBar";
import ImpTitle from "./ImpTitle";
import ImpWaitlistForm from "./ImpWaitlistForm";
import { cinzel, manrope } from "./fonts";

// Manicuristas Imparables' own page (EventTheme IMPARABLES, 2026-10-26):
// the approved boceto, deep blue and gold, cinematic, mobile first, with
// Nail Fest as the organizer. Everything on it comes from the event — its
// name, tagline and days on the cover, the group photo (the first image of
// its blocks) with the speakers' names, its blocks below, its ticket types
// as price stages — so the team edits it like any other event's page. With
// a price on sale the cover sells it and its buttons go to the event's
// one-page checkout (/[eventSlug]/checkout, ImpCheckout.tsx); before the
// first stage opens, the page takes names for the waiting list instead.

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

/** "Tienes el talento. Ahora, a construir tu negocio." -> the first sentence, then the rest. */
function twoLines(text: string): [string, string] | [string] {
  const match = /^(.+?[.!?])\s+(.+)$/s.exec(text.trim());
  return match ? [match[1]!, match[2]!] : [text.trim()];
}

/** The event's name in a title — «¿Qué tienen en común todos los conferencistas de Manicuristas Imparables?» —
 * in gold, on a line of its own with what follows it (2026-10-29). Without the name, the title as it is. */
function titleWithName(title: string, name: string): React.ReactNode {
  const at = name ? title.indexOf(name) : -1;
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="imp-h2-end">
        <span className="imp-h2-name">{name}</span>
        {title.slice(at + name.length)}
      </span>
    </>
  );
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
}) {
  // The name is the cover's title; a date in it is left out (the dates are right below).
  const words = coverName(event.displayName).split(/\s+/);
  const big = words.pop() ?? event.displayName;
  const pre = words.join(" ");
  const liveNote = event.format === "IN_PERSON" ? "" : "100% en vivo, desde tu celular";
  // The pill right before the group photo (2026-10-28): when, big — written
  // the way the team writes it there, «27 de junio 2027» (2026-10-29: no «de»
  // before the year only) — and under it, smaller, what it is. No hours, no
  // platform named.
  const place = event.venueName || event.city;
  const kind = event.format === "VIRTUAL" ? "Congreso virtual" : event.format === "HYBRID" ? `Presencial${place ? ` en ${place}` : ""} y virtual` : place;
  const pillDate = when.compact.replace(/ de (\d{4})$/, " $1");
  const pillNote = [kind, event.format === "VIRTUAL" ? "100% en vivo" : ""].filter(Boolean).join(" ");

  const { cover, rest: afterCover } = coverOf(blocks);
  const { intro, rest } = introOf(afterCover);
  const { pillars, line: tagline } = splitTagline(event.subtitle ?? "");
  const { speakers } = castOf(blocks);
  const panel = panelOf(rest);
  // Whose photo goes next to a name on the cards: the speakers', and the panel's guests already named.
  const faces = [...speakers, ...(panel?.people.items.filter((p) => p.name.trim()) ?? [])];
  const line = castLine(blocks);
  // The cover's button (and the closing's) says what the event's label says
  // («Reservar mi cupo», 2026-10-28); the price's and the bar's say the same
  // since then.
  const heroLabel = event.registerButtonLabel?.trim() || "Quiero mi cupo";
  const buyLabel = "Reservar mi cupo";
  const { mode, current, next } = sales;
  const closing = twoLines(event.closingText?.trim() || `Nos vemos el ${when.short}.`);
  // The lowest price the congress will have, when the one about to open is it.
  const opensCheapest = next && sales.stages.every((s) => s.state === "past" || s.price >= next.price);
  // Beside the bar's price, the regular one struck, when today's is lower
  // (2026-10-28: the saving itself isn't spelled out any more).
  const save = current ? saving(current, sales.normal) : 0;
  // The team's preview of another day runs its countdowns on that day's clock.
  const offsetMs = preview?.simulated ? now.getTime() - Date.now() : 0;

  // «Nadie nace imparable. Se hace.» (2026-10-29): it closes the section under
  // the cover when there is one, else the cover itself.
  const closingLine = (
    <p className="imp-tagline">
      {closing.length === 2 ? (
        <>
          <span>{closing[0]}</span>
          <span className="imp-gold">{closing[1]}</span>
        </>
      ) : (
        <span className="imp-gold">{closing[0]}</span>
      )}
    </p>
  );

  const cta =
    mode === "sale" && current ? (
      // Its words and today's price, nothing else (2026-10-29).
      <ImpButton action="buy" className="imp-cta">
        {`${heroLabel} · ${pesos(current.price)}`}
      </ImpButton>
    ) : mode === "waitlist" ? (
      <ImpButton action="waitlist" className="imp-cta">
        Quiero estar en la lista de espera
      </ImpButton>
    ) : null;
  // Under the button, in one line (2026-10-29): today's price in dollars,
  // when its ticket has one, and the regular price, struck, when today's is
  // lower.
  const priceMore =
    mode === "sale" && current && (current.usdCents || save > 0) ? (
      <p className="imp-cta-more">
        {current.usdCents ? `o ${dollars(current.usdCents)}` : null}
        {current.usdCents && save > 0 ? " · " : null}
        {save > 0 && <s>{pesos(sales.normal!.price)}</s>}
      </p>
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
          <Tiara />
          <ImpTitle pre={pre} big={big} />
          {tagline && (
            // Its last line only, right under the name (2026-10-28: no headline
            // above it any more). Sanitized before storage (lib/events.ts).
            <div className="imp-tag" dangerouslySetInnerHTML={{ __html: tagline }} />
          )}
          {/* Right before the group photo (2026-10-28): what it is and when, before who. */}
          <p className="imp-pill">
            <span className="imp-pill-date">{pillDate}</span>
            {pillNote && <span className="imp-pill-note">{pillNote}</span>}
          </p>
          {(cover || pillars) && (
            // On a computer, the column beside the words (2026-10-29); on a
            // phone it changes nothing.
            <div className="imp-hero-pic">
              {cover && (
                // The group photo (2026-10-28: back from a strip of portraits).
                // Who is in it goes only to those who can't see it.
                <figure className="imp-group">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL */}
                  <img src={cover.url} alt={cover.caption || [line.names, line.also].filter(Boolean).join(", ")} />
                </figure>
              )}
              {/* «Mentalidad · Dinero · Marketing», under the group photo (2026-10-28). */}
              {pillars && <div className="imp-pillars" dangerouslySetInnerHTML={{ __html: pillars }} />}
            </div>
          )}
          {cta}
          {mode === "closed" && <p className="imp-closed-note">La venta de boletas está cerrada.</p>}
          {/* Under the button: its price in dollars and the regular one,
              struck (2026-10-29), then which price it is and until when it
              holds (2026-10-28). The guarantee («Texto debajo del botón») is
              hidden from the cover for now; it stays on the event. */}
          {mode === "sale" && current && (priceMore || current.closesAt) && (
            <div className="imp-deal">
              {priceMore}
              {current.closesAt && (
                <p className="imp-deal-until">
                  Tarifa {current.name} hasta el {untilDate(current.closesAt, timezone)}
                </p>
              )}
            </div>
          )}
          {!intro && closingLine}
          {/* Who organizes it, last on the cover, as its signature (2026-10-28:
              it was «Nail Fest presenta», above the name). */}
          <p className="imp-organiza">
            Organiza
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt={brandName} />
          </p>
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

      {intro && (
        // Right under the cover, in its colors (2026-10-29): what all the speakers have in common.
        <section className="imp-sec imp-intro">
          <div className="imp-sec-in">
            <h2 className="imp-h2">{titleWithName(intro.heading.title, coverName(event.displayName))}</h2>
            {/* Sanitized before storage (lib/events.ts). */}
            <div className="imp-rich" dangerouslySetInnerHTML={{ __html: intro.text.html }} />
            {closingLine}
          </div>
        </section>
      )}

      <ImparablesBlocks blocks={rest} context={{ sales, offsetMs, when, timezone, now, buyLabel, speakers: faces, panel }} />

      <section className="imp-close">
        <div className="imp-rays" aria-hidden="true" />
        <div className="imp-hero-in">
          {/* The arc, «Nadie nace imparable. Se hace.» as the page's last word
              (2026-10-29), then the button, the line under it and the day. */}
          <Tiara />
          {closingLine}
          {cta}
          {priceMore}
          <div className="imp-close-3">
            {when.named}
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
                {save > 0 && <s>{pesos(sales.normal!.price)}</s>} {pesos(current.price)}
              </b>
              {/* The stage's name under the price (2026-10-28). */}
              <span>{current.name}</span>
            </div>
            <ImpButton action="buy" className="imp-st-b">
              {buyLabel}
            </ImpButton>
          </div>
          {/* Until when today's price holds, across the foot of the bar (2026-10-28). */}
          {current.closesAt && next && (
            <p className="imp-st-up">Tarifa hasta el {untilDate(current.closesAt, timezone)}. ¡Luego sube!</p>
          )}
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

    </main>
  );
}
