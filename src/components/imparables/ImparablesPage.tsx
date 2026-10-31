import type { EventFormat } from "@prisma/client";
import MetaPixelScript from "@/components/MetaPixelScript";
import type { LandingBlock } from "@/lib/landingBlocks/types";
import { coverName, type EventWhen } from "@/lib/imparables/schedule";
import { coverDeal, dayMonth, pesos, riseCountdown, saving, stagePill, stageProgress, untilDay, type SalesState } from "@/lib/imparables/stages";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { castLine, castOf, coverOf, introOf, panelOf } from "@/lib/imparables/blocks";
import { splitTagline } from "@/lib/imparables/tagline";
import ImparablesBlocks from "./ImparablesBlocks";
import { Tiara } from "./ImpArt";
import ImpButton from "./ImpButton";
import { ImpCountdownInline } from "./ImpCountdown";
import ImpPageTracking from "./ImpPageTracking";
import ImpStickyBar from "./ImpStickyBar";
import ImpTitle from "./ImpTitle";
import ImpWaitlistForm from "./ImpWaitlistForm";
import { GuaranteeLine, Shield } from "./ImpTiers";
import { tierCounter, tierDeal } from "@/lib/imparables/tiers";
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

/** A version of the page (/v/<slug>, lib/imparables/versions.ts): its own cover where it says so, and its special
 * price for the stage on sale, when it has one — with the full price struck beside it, and the moment it ends
 * (ISO) to count down to. */
export interface ImparablesVersion {
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  buttonLabel: string | null;
  special: { price: number; struck: number; label: string; endsAt: string | null } | null;
}

export interface ImparablesPreview {
  draft: boolean;
  /** The date the page is shown as of, when the team asked for one (?fecha=). */
  simulated: Date | null;
  /** Days worth looking at: the waiting list and each stage's first day. */
  shortcuts: { label: string; date: string }[];
}

/** How full today's stage is (2026-10-29): its bar, filled as far as its paid tickets go. */
function ProgressBar({ progress, className }: { progress: NonNullable<ReturnType<typeof stageProgress>>; className?: string }) {
  return (
    <span className={`imp-bar${className ? ` ${className}` : ""}`} role="img" aria-label={`${progress.taken} de ${progress.cap} cupos tomados`}>
      {progress.taken > 0 && <i style={{ width: `${Math.round(progress.share * 1000) / 10}%` }} />}
    </span>
  );
}

/** The event's «Texto debajo del botón» under the cover's (the team's boceto, 2026-10-31): «Garantía de 30 minutos: si en
 * la primera media hora…», its label — up to the first colon — in bold, with the shield. */
function GuaranteeNote({ text }: { text: string }) {
  const match = /^([^:\n]{1,60}:)\s*([\s\S]*)$/.exec(text.trim());
  return (
    <p className="imp-lv-guar imp-deal-guar">
      <Shield />
      {match ? (
        <>
          <b>{match[1]}</b> {match[2]}
        </>
      ) : (
        text.trim()
      )}
    </p>
  );
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
  version = null,
  levels = false,
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
  version?: ImparablesVersion | null;
  /** A version that sells the ticket levels (lib/imparables/tiers.ts, 2026-10-31): the page says «Desde» its stage's
   * price, and Círculo and Élite wait in the checkout. */
  levels?: boolean;
}) {
  // The name is the cover's title; a date in it is left out (the dates are right below).
  const words = coverName(event.displayName).split(/\s+/);
  const big = words.pop() ?? event.displayName;
  const pre = words.join(" ");
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
  const heroLabel = version?.buttonLabel?.trim() || event.registerButtonLabel?.trim() || "Quiero mi cupo";
  const buyLabel = "Reservar mi cupo";
  const { mode, current, next } = sales;
  const closing = twoLines(event.closingText?.trim() || `Nos vemos el ${when.short}.`);
  // The lowest price the congress will have, when the one about to open is it.
  const opensCheapest = next && sales.stages.every((s) => s.state === "past" || s.state === "soldout" || s.price >= next.price);
  // Beside today's price, the full one struck — always the full price
  // (2026-10-29), unless today's is it.
  const struck = current && saving(current, sales.full) > 0 ? sales.full : null;
  // A version's special price (2026-10-30): it, with the full price struck beside it, everywhere the price shows.
  const special = mode === "sale" ? (version?.special ?? null) : null;
  const shownPrice = special ? special.price : (current?.price ?? 0);
  const struckPrice = special ? special.struck : (struck?.price ?? null);
  // On a version that sells the ticket levels (lib/imparables/tiers.ts; the team's boceto, 2026-10-31): one price on the
  // page, «Desde $90.000» — no price struck on the buttons —, its places and the normal price under the cover's button,
  // and Círculo and Élite only in the checkout.
  const sellsLevels = levels && mode === "sale" && Boolean(current) && !special;
  // The team's preview of another day runs its countdowns on that day's clock.
  const offsetMs = preview?.simulated ? now.getTime() - Date.now() : 0;
  // …and the special price's own, to its end, in the band over the cover and in the sticky bar (the team, 2026-10-30).
  const offerLeft = special?.endsAt ? Math.max(0, Math.floor((new Date(special.endsAt).getTime() - now.getTime()) / 1000)) : 0;

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
      // Its words, then today's price after the full one struck (2026-10-29);
      // on a computer the prices go to the button's right end, with no «·».
      <ImpButton action="buy" className="imp-cta">
        <span>
          {heroLabel}
          <span className="imp-cta-dot"> ·</span>
        </span>
        {sellsLevels ? (
          <span className="imp-cta-p imp-cta-p--desde">
            <span className="imp-cta-desde">Desde</span>
            <span>{pesos(shownPrice)}</span>
          </span>
        ) : (
          <span className="imp-cta-p">
            {struckPrice !== null && <s>{pesos(struckPrice)}</s>}
            <span>{pesos(shownPrice)}</span>
          </span>
        )}
      </ImpButton>
    ) : mode === "waitlist" ? (
      <ImpButton action="waitlist" className="imp-cta">
        Quiero estar en la lista de espera
      </ImpButton>
    ) : null;
  // Under the cover's button (2026-10-29; the closing's until 2026-10-30):
  // for a week after the stage before closed, a pill saying so; then, for a
  // stage with a cap, its places left over a bar of how full it is — from its
  // first ticket — and under it its terms («hasta completar los 200 cupos o
  // hasta el 18 de abril · luego $120.000»); with no cap, its line
  // (lib/imparables/stages.ts). No dollars on the page: only the checkout's
  // PayPal says them.
  // At a version's special price, none of them: it takes no place in the stage's places, and its band over the
  // cover counts down to its end.
  const pill = mode === "sale" && !special ? stagePill(sales, now) : null;
  // There, under the cover's button: «Etapa Creyente · Solo 200 cupos a $90.000» — the counter instead, under 30% of its
  // places left —, then the normal price and when it goes up, then the guarantee.
  const counter = sellsLevels ? tierCounter(sales) : null;
  const dealLines = sellsLevels ? tierDeal(sales, timezone) : null;
  // On every other page (the team's boceto, 2026-10-31): before 30% of the stage's places are paid, its places as the
  // offer — «Las primeras 200 entran a $90.000» — and its terms; from then on, the counter over its bar; in the stage's
  // last three weeks, a countdown to the price going up; and under them the guarantee (the event's «Texto debajo del
  // botón»). The bar — here and in the sticky bar — only once the counter shows.
  const stageDeal = !sellsLevels && !special && mode === "sale" && current ? coverDeal(sales, timezone) : null;
  const rise = stageDeal ? riseCountdown(sales, now) : null;
  const progress = mode === "sale" && !special && (sellsLevels ? counter : stageDeal?.kind === "counter") ? stageProgress(sales) : null;
  const guarantee = event.ctaNote?.trim() || null;
  const deal =
    !special && mode === "sale" && current ? (
      sellsLevels ? (
        <div className="imp-deal">
          {pill && <p className="imp-stage-pill">{pill}</p>}
          {counter && progress ? (
            <>
              <p className="imp-prog-t">{counter.text}</p>
              <ProgressBar progress={progress} />
            </>
          ) : (
            dealLines && (
              <p className="imp-deal-stage">
                <b>{dealLines.stage}</b> · {dealLines.offer}
              </p>
            )
          )}
          {dealLines?.then && <p className="imp-deal-then">{dealLines.then}</p>}
          <div className="imp-lv-cover">
            <GuaranteeLine />
          </div>
        </div>
      ) : (
        <div className="imp-deal">
          {pill && <p className="imp-stage-pill">{pill}</p>}
          {rise && (
            <p className="imp-stage-pill imp-rise">
              <Clock />
              El precio sube a {pesos(rise.price)} en <ImpCountdownInline to={rise.to.toISOString()} initialSeconds={rise.seconds} offsetMs={offsetMs} />
            </p>
          )}
          {stageDeal?.kind === "first" && (
            <>
              <p className="imp-deal-stage">
                <b>{stageDeal.stage}</b> · {stageDeal.offer}
              </p>
              {stageDeal.terms && <p className="imp-deal-then">{stageDeal.terms}</p>}
            </>
          )}
          {stageDeal?.kind === "counter" && progress && (
            <>
              <p className="imp-prog-t">{stageDeal.title}</p>
              <ProgressBar progress={progress} />
              {stageDeal.terms && <p className="imp-deal-until imp-deal-terms">{stageDeal.terms}</p>}
            </>
          )}
          {stageDeal?.kind === "line" && <p className="imp-deal-until">{stageDeal.terms}</p>}
          {guarantee && <GuaranteeNote text={guarantee} />}
        </div>
      )
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

      {special && (
        // «Precio especial visitantes Nail Fest Bogotá · La oferta termina en: ⏱ 122d 11:22:05» (the team, 2026-10-30).
        <p className="imp-v-band">
          <b>{special.label}</b>
          {special.endsAt && (
            <span className="imp-v-band-end">
              <span className="imp-v-band-dot"> · </span>
              La oferta termina en:{" "}
              <span className="imp-clock">
                <Clock />
                <ImpCountdownInline to={special.endsAt} initialSeconds={offerLeft} offsetMs={offsetMs} />
              </span>
            </span>
          )}
        </p>
      )}

      <section className="imp-hero">
        <div className="imp-rays" aria-hidden="true" />
        <div className="imp-hero-in">
          <Tiara />
          <ImpTitle pre={pre} big={big} />
          {version?.title && <h2 className="imp-v-title">{version.title}</h2>}
          {version?.subtitle ? (
            <p className="imp-tag">{version.subtitle}</p>
          ) : tagline && (
            // Its last line only, right under the name (2026-10-28: no headline
            // above it any more). Sanitized before storage (lib/events.ts).
            <div className="imp-tag" dangerouslySetInnerHTML={{ __html: tagline }} />
          )}
          {/* Right before the group photo (2026-10-28): what it is and when, before who. */}
          <p className="imp-pill">
            <span className="imp-pill-date">{pillDate}</span>
            {pillNote && <span className="imp-pill-note">{pillNote}</span>}
          </p>
          {(cover || version?.imageUrl || pillars) && (
            // On a computer, the column beside the words (2026-10-29); on a
            // phone it changes nothing.
            <div className="imp-hero-pic">
              {(version?.imageUrl || cover) && (
                // The group photo (2026-10-28: back from a strip of portraits) —
                // or a version's own. Who is in it goes only to those who can't see it.
                <figure className="imp-group">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL */}
                  <img src={version?.imageUrl || cover!.url} alt={version?.imageUrl ? "" : cover!.caption || [line.names, line.also].filter(Boolean).join(", ")} />
                </figure>
              )}
              {/* «Mentalidad · Dinero · Marketing», under the group photo (2026-10-28). */}
              {pillars && <div className="imp-pillars" dangerouslySetInnerHTML={{ __html: pillars }} />}
            </div>
          )}
          {cta}
          {mode === "closed" && <p className="imp-closed-note">La venta de boletas está cerrada.</p>}
          {/* The guarantee («Texto debajo del botón») is hidden from the
              cover for now; it stays on the event. */}
          {deal}
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
              (2026-10-29), then the button — and nothing under it since
              2026-10-30: its stage's bar and the day stay on the cover. */}
          <Tiara />
          {closingLine}
          {cta}
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
          {/* A version's special price: its name and its countdown over the row on a phone, where they fit. */}
          {special?.endsAt && (
            <p className="imp-st-offer">
              <b>{special.label}</b>
              <span className="imp-clock">
                <Clock />
                <ImpCountdownInline to={special.endsAt} initialSeconds={offerLeft} offsetMs={offsetMs} />
              </span>
            </p>
          )}
          {/* One row (2026-10-29): today's price big with the full one
              struck beside it, and its stage's name with its places left —
              under it on a phone («Etapa Creyente · Quedan 136»), beside it
              on a computer with its bar («Quedan 136 de 200») — then the
              button. */}
          <div className="imp-sticky-in">
            <div className="imp-st-p">
              <p className="imp-st-amt">
                {sellsLevels ? (
                  // «Desde $90.000»: the lowest of the levels, today's stage (2026-10-31).
                  <b>Desde {pesos(shownPrice)}</b>
                ) : (
                  <>
                    <b>{pesos(shownPrice)}</b>
                    {struckPrice !== null && <s>{pesos(struckPrice)}</s>}
                  </>
                )}
              </p>
              <span className="imp-st-name">
                <span className="imp-st-stage">
                  {special ? special.label : current.name}
                  {/* «Etapa Creyente · 200 cupos» on a version that sells the levels, until its counter shows. */}
                  {sellsLevels && !progress && current.cap !== null && ` · ${current.cap} cupos`}
                  {/* Elsewhere, until the counter shows: when the price goes up (2026-10-31). */}
                  {!sellsLevels && !special && !progress && current.closesAt && next && ` · hasta el ${untilDay(current.closesAt, timezone)}`}
                </span>
                {special?.endsAt && (
                  // …and beside its price on a computer.
                  <span className="imp-clock imp-st-clock">
                    <Clock />
                    La oferta termina en <ImpCountdownInline to={special.endsAt} initialSeconds={offerLeft} offsetMs={offsetMs} />
                  </span>
                )}
                {progress && (
                  <>
                    <ProgressBar progress={progress} className="imp-st-bar" />
                    <span className="imp-st-left">
                      <span className="imp-st-dot">· </span>
                      {progress.left === 1 ? "Queda" : "Quedan"} {progress.left}
                      <span className="imp-st-of"> de {progress.cap}</span>
                    </span>
                  </>
                )}
              </span>
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

    </main>
  );
}

/** The stopwatch beside a countdown in the sticky bar. */
function Clock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 2M10 2.5h4M18.5 6l1.5-1.5" />
    </svg>
  );
}
