import type {
  AgendaRow,
  CardLandingBlock,
  HeadingLandingBlock,
  LandingBlock,
  PeopleLandingBlock,
  PricesLandingBlock,
  SlideItem,
  SlidesLandingBlock,
} from "@/lib/landingBlocks/types";
import { youtubeVideo } from "@/lib/landingBlocks/types";
import { agendaInstant, zoneLabel, zoneOffset, type EventWhen } from "@/lib/imparables/schedule";
import { dayMonth, pesos, stageDates, type SalesState } from "@/lib/imparables/stages";
import { isPanelCard, namesIn } from "@/lib/imparables/blocks";
import { ImpIcon, Silhouette, iconForPoint, initials, instagramUrl, type ImpIconName } from "./ImpArt";
import ImpButton from "./ImpButton";
import ImpCountdown from "./ImpCountdown";
import ImpLocalTime, { ImpZoneNote } from "./ImpLocalTime";
import ImpSwipe from "./ImpSwipe";

// Event.landingBlocks drawn in Manicuristas Imparables' style (EventTheme
// IMPARABLES): the same blocks every event page has, read the way the
// approved boceto lays them out. Each «Título de sección» opens a section
// of its own, the background alternating; inside it, a card with a photo is
// the host, a card without one followed by people is the panel, one with a
// list is a box of ✓ (or ✕ when its label starts with «No»), and any other
// is a big phrase; «Tarjetas deslizables» are the results or the doubts.
// The text in cards and text blocks is the same sanitized HTML as
// everywhere (lib/events.ts).

export interface ImparablesContext {
  sales: SalesState;
  /** How far the page's day is from the real one (the team's preview of another day). */
  offsetMs: number;
  when: EventWhen;
  timezone: string;
  now: Date;
  /** "Quiero mi boleta" */
  buyLabel: string;
  /** The speakers, whose photos go next to their names on the cards. */
  speakers: PeopleLandingBlock["items"];
}

type Section = { heading: HeadingLandingBlock | null; blocks: LandingBlock[] };

function sectionsOf(blocks: LandingBlock[]): Section[] {
  const sections: Section[] = [];
  for (const block of blocks) {
    if (block.type === "heading") sections.push({ heading: block, blocks: [] });
    else if (sections.length === 0) sections.push({ heading: null, blocks: [block] });
    else sections[sections.length - 1]!.blocks.push(block);
  }
  return sections;
}

export default function ImparablesBlocks({ blocks, context }: { blocks: LandingBlock[]; context: ImparablesContext }) {
  // Only the sections with something to show, so the backgrounds keep alternating.
  const sections = sectionsOf(blocks)
    .map((section) => ({ ...section, content: renderBlocks(section.blocks, context) }))
    .filter((section) => section.content.length > 0 || section.heading?.title || section.heading?.intro);
  return (
    <>
      {sections.map((section, i) => {
        const { content, heading } = section;
        // A section with a big phrase in it (the hook) gets the big quote mark.
        const quote = section.blocks.some(
          (b, j) => b.type === "card" && !b.imageUrl && b.icon === "none" && b.title && !/<(ul|ol)\b/i.test(b.html) && !isPanelCard(b, section.blocks[j + 1])
        );
        return (
          <section key={i} className={`imp-sec${i % 2 === 0 ? " imp-sec--alt" : ""}`}>
            <div className="imp-sec-in">
              {quote && (
                <span className="imp-quote" aria-hidden="true">
                  “
                </span>
              )}
              {heading?.eyebrow && <div className="imp-eyebrow">{heading.eyebrow}</div>}
              {heading?.title && <h2 className="imp-h2">{heading.title}</h2>}
              {heading?.intro && <p className="imp-lead">{heading.intro}</p>}
              {content}
            </div>
          </section>
        );
      })}
    </>
  );
}

function renderBlocks(blocks: LandingBlock[], context: ImparablesContext): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const next = blocks[i + 1];
    if (isPanelCard(block, next)) {
      out.push(<Panel key={i} card={block} people={next as PeopleLandingBlock} />);
      i += 1;
      continue;
    }
    const node = renderBlock(block, i, context);
    if (node) out.push(node);
  }
  return out;
}

function renderBlock(block: LandingBlock, key: number, context: ImparablesContext): React.ReactNode {
  switch (block.type) {
    case "text":
      // Sanitized before storage (lib/events.ts).
      return block.html ? <div key={key} className="imp-rich" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;

    case "image":
      return block.url ? (
        <figure key={key} className="imp-figure">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, arbitrary Blob URL */}
          <img src={block.url} alt={block.caption || ""} loading="lazy" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      ) : null;

    case "video": {
      if (!block.url) return null;
      const yt = youtubeVideo(block.url);
      return (
        <figure key={key} className="imp-figure">
          {yt ? (
            <div className={`imp-video${yt.vertical ? " is-vertical" : ""}`}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${yt.id}?rel=0&playsinline=1`}
                title={block.caption || "Video"}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : block.autoplay ? (
            <video src={block.url} autoPlay muted loop playsInline controls preload="auto" />
          ) : (
            <video src={`${block.url}#t=0.1`} controls playsInline preload="metadata" />
          )}
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    }

    case "gallery":
      // The sponsors' logos, on light tiles so any logo reads.
      return block.items.length > 0 ? (
        <ul key={key} className="imp-logos">
          {block.items.map((item, j) => {
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo, arbitrary Blob URL
            const logo = <img src={item.url} alt={item.handle ? `@${item.handle.replace(/^@+/, "")}` : ""} loading="lazy" />;
            return (
              <li key={j}>
                {item.handle ? (
                  <a href={instagramUrl(item.handle)} target="_blank" rel="noopener noreferrer">
                    {logo}
                  </a>
                ) : (
                  logo
                )}
              </li>
            );
          })}
        </ul>
      ) : null;

    case "faq": {
      const items = block.items.filter((item) => item.question.trim() || item.answer.trim());
      return items.length > 0 ? (
        <div key={key} className="imp-faq">
          {block.title && <h3 className="imp-h3">{block.title}</h3>}
          {items.map((item, j) => (
            <details className="imp-faq-item" key={j}>
              <summary>
                {item.question.trim() || "Leer más"}
                <i aria-hidden="true" />
              </summary>
              <p className="imp-faq-a">{item.answer}</p>
            </details>
          ))}
        </div>
      ) : null;
    }

    case "card":
      return <Card key={key} card={block} />;

    case "points": {
      const items = block.items.filter((item) => item.title || item.text);
      return items.length > 0 ? (
        <ul key={key} className="imp-inc">
          {items.map((item, j) => (
            <li key={j}>
              <ImpIcon name={iconForPoint(item.title || item.text)} size={28} />
              <span>
                {item.title && <b>{item.title}</b>}
                {item.text && <small>{item.text}</small>}
              </span>
            </li>
          ))}
        </ul>
      ) : null;
    }

    case "people":
      return block.items.length > 0 ? <Speakers key={key} people={block} /> : null;

    case "agenda":
      return block.rows.length > 0 ? <Agenda key={key} rows={block.rows} context={context} /> : null;

    case "prices":
      return <Prices key={key} block={block} context={context} />;

    case "slides":
      return <Slides key={key} block={block} speakers={context.speakers} />;

    // The venue and the reviews keep the Nail Fest page's own look; this page has none of them.
    default:
      return null;
  }
}

// ── Cards that slide: the results and the doubts ────────────────────────────

/** The photo (or initials, or a group icon for «el panel») of each name in a card's `who`. */
function Face({ name, speakers }: { name: string; speakers: PeopleLandingBlock["items"] }) {
  const person = speakers.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
  if (person?.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
    return <img src={person.photoUrl} alt="" loading="lazy" />;
  }
  return <span aria-hidden="true">{/panel/i.test(name) ? <ImpIcon name="people" size={16} /> : initials(name)}</span>;
}

function Slides({ block, speakers }: { block: SlidesLandingBlock; speakers: PeopleLandingBlock["items"] }) {
  const items = block.items.filter((it) => it.title.trim() || it.text.trim());
  if (items.length === 0) return null;
  return (
    <ImpSwipe>
      {items.map((item, j) => (block.style === "doubts" ? <Doubt key={j} item={item} speakers={speakers} /> : <Result key={j} item={item} speakers={speakers} />))}
    </ImpSwipe>
  );
}

function Result({ item, speakers }: { item: SlideItem; speakers: PeopleLandingBlock["items"] }) {
  const names = namesIn(item.who);
  return (
    <article className="imp-slide">
      {item.tag && <span className="imp-slide-tag">{item.tag}</span>}
      {item.title && <h3 className="imp-slide-t">{item.title}</h3>}
      {item.text && <p className="imp-slide-l">{item.text}</p>}
      {(item.noteLabel || item.note) && (
        <p className="imp-slide-k">
          {item.noteLabel && <b>{item.noteLabel}</b>} {item.note}
        </p>
      )}
      {names.length > 0 && (
        <div className="imp-slide-who">
          <span className="imp-slide-faces">
            {names.map((name) => (
              <Face key={name} name={name} speakers={speakers} />
            ))}
          </span>
          <span>Con {item.who.trim()}</span>
        </div>
      )}
    </article>
  );
}

function Doubt({ item, speakers }: { item: SlideItem; speakers: PeopleLandingBlock["items"] }) {
  const who = namesIn(item.who)[0];
  const icon = CARD_ICONS[item.icon];
  const quoted = /^[«"“]/.test(item.title.trim()) ? item.title.trim() : `«${item.title.trim()}»`;
  return (
    <article className="imp-slide imp-slide--q">
      {item.title.trim() && <p className="imp-slide-q">{quoted}</p>}
      {item.text && <p className="imp-slide-a">{item.text}</p>}
      {(item.noteLabel || item.note) && (
        <div className="imp-slide-proof">
          {who ? (
            <span className="imp-slide-faces">
              <Face name={who} speakers={speakers} />
            </span>
          ) : icon ? (
            <span className="imp-slide-ic">
              <ImpIcon name={icon} size={20} />
            </span>
          ) : null}
          <span>
            {item.noteLabel && <b>{item.noteLabel}</b>}
            {item.note}
          </span>
        </div>
      )}
    </article>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

/** A leading "<p>@handle</p>" in a host's card is her Instagram, drawn as a gold link. */
function splitHandle(html: string): { handle: string | null; body: string } {
  const match = /^\s*<p>\s*@([A-Za-z0-9._]+)\s*<\/p>/.exec(html);
  return match ? { handle: match[1]!, body: html.slice(match[0].length) } : { handle: null, body: html };
}

const CARD_ICONS: Partial<Record<CardLandingBlock["icon"], ImpIconName>> = { gift: "gift", ticket: "ticket", star: "star", clock: "clock", shield: "shield" };

function Card({ card }: { card: CardLandingBlock }) {
  if (!card.title && !card.html && !card.eyebrow) return null;

  if (card.imageUrl) {
    const { handle, body } = splitHandle(card.html);
    return (
      <div className="imp-host">
        <div className="imp-host-ring">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL */}
          <img className="imp-host-ph" src={card.imageUrl} alt={card.title} loading="lazy" />
        </div>
        <div className="imp-host-t">
          {card.eyebrow && <span className="imp-host-k">{card.eyebrow}</span>}
          {card.title && <b>{card.title}</b>}
          {handle && (
            <a className="imp-host-ig" href={instagramUrl(handle)} target="_blank" rel="noopener noreferrer">
              @{handle}
            </a>
          )}
          {body.trim() && <div className="imp-host-body" dangerouslySetInnerHTML={{ __html: body }} />}
        </div>
      </div>
    );
  }

  if (/<(ul|ol)\b/i.test(card.html)) {
    const negative = /^\s*no\b/i.test(card.eyebrow);
    return (
      <div className={`imp-list${negative ? " imp-list--no" : ""}`}>
        {card.eyebrow && <b className="imp-list-h">{card.eyebrow}</b>}
        {card.title && <p className="imp-list-t">{card.title}</p>}
        <div className="imp-list-body" dangerouslySetInnerHTML={{ __html: card.html }} />
      </div>
    );
  }

  const icon = CARD_ICONS[card.icon];
  return (
    <div className={`imp-st${icon ? " imp-st--icon" : ""}`}>
      {icon && (
        <span className="imp-st-icon">
          <ImpIcon name={icon} size={26} />
        </span>
      )}
      {card.eyebrow && <small>{card.eyebrow}</small>}
      {card.title && <p className="imp-st-title">{card.title}</p>}
      {card.html && <div className="imp-st-body" dangerouslySetInnerHTML={{ __html: card.html }} />}
    </div>
  );
}

function Panel({ card, people }: { card: CardLandingBlock; people: PeopleLandingBlock }) {
  // A panelist not confirmed yet has no name: her card still shows, with a
  // silhouette, «Por anunciar» and the story she brings (her line).
  const guests = people.items.filter((p) => p.name.trim() || p.tag.trim());
  const pending = guests.filter((p) => !p.name.trim()).length;
  return (
    <div className="imp-panel">
      {card.eyebrow && <span className="imp-panel-when">{card.eyebrow}</span>}
      {card.title && <b className="imp-panel-t imp-gold">{card.title}</b>}
      {card.html && <div className="imp-panel-l" dangerouslySetInnerHTML={{ __html: card.html }} />}
      <div className="imp-panel-grid">
        {guests.map((p, j) =>
          p.name.trim() ? (
            <div className="imp-pn" key={j}>
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
                <img className="imp-pn-ph" src={p.photoUrl} alt="" loading="lazy" />
              ) : (
                <Silhouette className="imp-pn-ph" tone={p.tone} />
              )}
              <b>{p.name}</b>
              {p.handle && (
                <a className="imp-pn-ig" href={instagramUrl(p.handle)} target="_blank" rel="noopener noreferrer">
                  @{p.handle.replace(/^@+/, "")}
                </a>
              )}
              {p.tag && <span>{p.tag}</span>}
            </div>
          ) : (
            <div className="imp-pn imp-pn--tba" key={j}>
              <Silhouette className="imp-pn-ph" tone={p.tone} />
              <small>Por anunciar</small>
              <span>{p.tag}</span>
            </div>
          )
        )}
      </div>
      {pending > 0 && <p className="imp-panel-tba">{pending === 1 ? "Panelista por anunciar." : "Panelistas por anunciar."}</p>}
    </div>
  );
}

function Speakers({ people }: { people: PeopleLandingBlock }) {
  return (
    <div className="imp-sp-grid">
      {people.items
        .filter((p) => p.name.trim())
        .map((p, j) => (
          <div className="imp-sp" key={j}>
            <div className="imp-sp-ring">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
                <img className="imp-sp-ph" src={p.photoUrl} alt="" loading="lazy" />
              ) : (
                <span className="imp-sp-ph imp-sp-ph--ini" aria-hidden="true">
                  {initials(p.name)}
                </span>
              )}
            </div>
            <div className="imp-sp-name">{p.name}</div>
            {p.handle && (
              <a className="imp-sp-ig" href={instagramUrl(p.handle)} target="_blank" rel="noopener noreferrer">
                @{p.handle.replace(/^@+/, "")}
              </a>
            )}
            {p.tag && <p className="imp-sp-line">{p.tag}</p>}
          </div>
        ))}
    </div>
  );
}

// ── The program ─────────────────────────────────────────────────────────────
// Both days one under the other, each line told the way the approved boceto
// does: the talk first, then who gives it (her photo and name), how long it
// lasts under its hour, the day's star talk in a box of its own and the
// active breaks as thin lines; a day can say what she takes home.

/** "10:15 a. m." -> ["10:15", "a. m."]; anything else stays whole. */
function splitChip(chip: string): [string, string] {
  const match = /^(\d{1,2}[:.]\d{2})\s*(.*)$/.exec(chip.trim());
  return match ? [match[1]!, match[2]!] : [chip, ""];
}

/** How long a line lasts: until the next one starts (or its day ends), when that's known and sensible. */
function minutesBetween(from: string | null, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const minutes = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
  return minutes > 0 && minutes <= 300 ? minutes : null;
}

function Agenda({ rows, context }: { rows: AgendaRow[]; context: ImparablesContext }) {
  const days: { head: AgendaRow | null; rows: AgendaRow[] }[] = [];
  for (const row of rows) {
    if (row.kind === "day") {
      if (row.chip || row.topic) days.push({ head: row, rows: [] });
    } else {
      if (days.length === 0) days.push({ head: null, rows: [] });
      days[days.length - 1]!.rows.push(row);
    }
  }
  // The n-th day of the program happens on the event's n-th day.
  const instants = days.map((d, i) => d.rows.map((row) => agendaInstant(context.when.days[i], row.chip, context.timezone)));
  const firstInstant = instants.flat().find((instant): instant is string => Boolean(instant)) ?? null;
  const cards = days.map((d, i) => {
    return (
      <div className="imp-day" key={i}>
        {d.head && (
          <div className="imp-day-h">
            {d.head.chip && <small>{d.head.chip}</small>}
            {d.head.topic && <b>{d.head.topic}</b>}
            {d.head.text && <span className="imp-day-time">{d.head.text}</span>}
            {d.head.takeaway && (
              <span className="imp-take">
                <strong>Te llevas:</strong> {d.head.takeaway}
              </span>
            )}
          </div>
        )}
        {d.rows.length > 0 && (
          <ol className="imp-ag">
            {d.rows.map((row, j) => {
              const start = instants[i]![j] ?? null;
              const next = instants[i]!.slice(j + 1).find(Boolean) ?? context.when.ends[i];
              return <AgendaLine key={j} row={row} instant={start} minutes={minutesBetween(start, next)} timezone={context.timezone} />;
            })}
          </ol>
        )}
      </div>
    );
  });
  return (
    <div className="imp-agenda">
      {cards}
      {firstInstant && <ImpZoneNote zone={zoneLabel(context.timezone)} at={firstInstant} eventOffset={zoneOffset(firstInstant, context.timezone)} />}
    </div>
  );
}

function AgendaLine({ row, instant, minutes, timezone }: { row: AgendaRow; instant: string | null; minutes: number | null; timezone: string }) {
  const isPause = !row.instructor && !row.photoUrl && /^pausa/i.test(row.topic.trim());
  // Rows saved before topic/instructor existed keep everything in `text`.
  const title = row.topic || row.instructor || row.text;
  // A talk: its title, its subtitle (the row's «Nota extra»), then who gives
  // it. A line with a photo and no speaker (the host's): its title, then the
  // photo next to its text.
  const subtitle = row.topic && (row.instructor || !row.photoUrl) ? row.text : "";
  const who = row.topic ? row.instructor || (row.photoUrl ? row.text : "") : "";
  const [digits, suffix] = splitChip(row.chip);
  if (!title && !row.chip) return null;
  if (isPause) {
    return (
      <li className="is-pause">
        <span>
          {title}
          {minutes ? ` · ${minutes} min` : ""}
        </span>
      </li>
    );
  }
  return (
    <li className={row.star ? "is-star" : undefined}>
      {row.chip && (
        <span className="imp-ag-time">
          <span>{digits}</span>
          {suffix && <small>{suffix}</small>}
          {instant && <ImpLocalTime instant={instant} eventOffset={zoneOffset(instant, timezone)} />}
          {minutes && <em className="imp-ag-dur">{minutes} min</em>}
        </span>
      )}
      <span className="imp-what">
        {row.star && <span className="imp-star-k">★ Charla estrella</span>}
        <b>{title}</b>
        {subtitle && <span>{subtitle}</span>}
        {who && (
          <span className="imp-by">
            {row.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
              <img src={row.photoUrl} alt="" loading="lazy" />
            ) : row.instructor ? (
              <span aria-hidden="true">{initials(row.instructor)}</span>
            ) : null}
            {who}
          </span>
        )}
      </span>
    </li>
  );
}

// ── Tu boleta ───────────────────────────────────────────────────────────────

function secondsUntil(to: Date, now: Date): number {
  return Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
}

function Prices({ block, context }: { block: PricesLandingBlock; context: ImparablesContext }) {
  const { sales, timezone, now, offsetMs } = context;
  if (sales.stages.length === 0) return null;
  const { current, next, countdown } = sales;
  const STATE_NOTE = { current: " · ahora", past: " · cerrada", soldout: " · agotada", future: "" } as const;
  return (
    <div className="imp-prices">
      {current ? (
        <div className="imp-now">
          <span className="imp-now-badge">Precio de hoy · {current.name}</span>
          <div className="imp-now-amt">
            {pesos(current.price)} <small>COP</small>
          </div>
          {block.note && <div className="imp-now-iva">{block.note}</div>}
          {next?.opensAt && (
            <div className="imp-now-up">
              El {dayMonth(next.opensAt, timezone)} sube a <b>{pesos(next.price)}</b>
            </div>
          )}
          {countdown && <ImpCountdown to={countdown.to.toISOString()} label="Faltan" initialSeconds={secondsUntil(countdown.to, now)} seconds={false} offsetMs={offsetMs} />}
          <ImpButton action="buy" className="imp-cta">
            Comprar mi boleta
          </ImpButton>
        </div>
      ) : next?.opensAt ? (
        <div className="imp-now">
          <span className="imp-now-badge">
            {next.name} · desde el {dayMonth(next.opensAt, timezone)}
          </span>
          <div className="imp-now-amt">
            {pesos(next.price)} <small>COP</small>
          </div>
          {block.note && <div className="imp-now-iva">{block.note}</div>}
          {countdown && (
            <ImpCountdown to={countdown.to.toISOString()} label="La venta abre en" initialSeconds={secondsUntil(countdown.to, now)} seconds={false} offsetMs={offsetMs} />
          )}
          <ImpButton action="waitlist" className="imp-cta">
            Quiero estar en la lista de espera
          </ImpButton>
        </div>
      ) : (
        <div className="imp-now">
          <span className="imp-now-badge">Venta cerrada</span>
          <p className="imp-now-up">Ya no hay boletas a la venta.</p>
        </div>
      )}
      <ol className="imp-stages">
        {sales.stages.map((stage) => (
          <li key={stage.id} className={stage.state === "current" ? "is-on" : stage.state === "past" || stage.state === "soldout" ? "is-off" : undefined}>
            <span>
              <b>{stage.name}</b>
              {stageDates(stage, timezone)}
              {STATE_NOTE[stage.state]}
            </span>
            <strong>{pesos(stage.price)}</strong>
          </li>
        ))}
      </ol>
      <div className="imp-pay">
        <span>Tarjeta</span>
        <span>PSE</span>
        <span>Nequi</span>
        <span>Pago seguro con Wompi</span>
      </div>
    </div>
  );
}
