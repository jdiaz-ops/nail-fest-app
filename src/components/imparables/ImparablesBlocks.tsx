import type { AgendaRow, CardLandingBlock, HeadingLandingBlock, LandingBlock, PeopleLandingBlock, PricesLandingBlock } from "@/lib/landingBlocks/types";
import { youtubeVideo } from "@/lib/landingBlocks/types";
import { agendaInstant, zoneLabel, type EventWhen } from "@/lib/imparables/schedule";
import { dayMonth, pesos, stageDates, type SalesState } from "@/lib/imparables/stages";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { isPanelCard } from "@/lib/imparables/blocks";
import { ImpIcon, Silhouette, iconForPoint, initials, instagramUrl, type ImpIconName } from "./ImpArt";
import ImpButton from "./ImpButton";
import ImpCountdown from "./ImpCountdown";
import ImpLocalTime, { ImpZoneNote } from "./ImpLocalTime";

// Event.landingBlocks drawn in Manicuristas Imparables' style (EventTheme
// IMPARABLES): the same blocks every event page has, read the way the
// approved boceto lays them out. Each «Título de sección» opens a section
// of its own, the background alternating; inside it, a card with a photo is
// the host, a card without one followed by people is the panel, one with a
// list is a box of ✓ (or ✕ when its label starts with «No»), and any other
// is a big phrase. The text in cards and text blocks is the same sanitized
// HTML as everywhere (lib/events.ts).

export interface ImparablesContext {
  sales: SalesState;
  /** How far the page's day is from the real one (the team's preview of another day). */
  offsetMs: number;
  when: EventWhen;
  timezone: string;
  now: Date;
  /** "Quiero mi boleta" */
  buyLabel: string;
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

    // The venue and the reviews keep the Nail Fest page's own look; this page has none of them.
    default:
      return null;
  }
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
  return (
    <div className="imp-panel">
      {card.eyebrow && <span className="imp-panel-when">{card.eyebrow}</span>}
      {card.title && <b className="imp-panel-t imp-gold">{card.title}</b>}
      {card.html && <div className="imp-panel-l" dangerouslySetInnerHTML={{ __html: card.html }} />}
      <div className="imp-panel-grid">
        {people.items
          .filter((p) => p.name.trim())
          .map((p, j) => (
            <div className="imp-pn" key={j}>
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
                <img className="imp-pn-ph" src={p.photoUrl} alt="" loading="lazy" />
              ) : (
                <Silhouette className="imp-pn-ph" tone={p.tone} />
              )}
              <b>{p.name}</b>
              {p.tag && <span>{p.tag}</span>}
            </div>
          ))}
      </div>
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

/** Minutes east of UTC where the event happens, at that instant (Bogotá: −300). */
function zoneOffset(instant: string, timezone: string): number {
  const date = new Date(instant);
  const wall = new Date(`${utcToZonedInputValue(date, timezone)}:00Z`);
  return Math.round((wall.getTime() - date.getTime()) / 60_000);
}

/** "10:15 a. m." -> ["10:15", "a. m."]; anything else stays whole. */
function splitChip(chip: string): [string, string] {
  const match = /^(\d{1,2}[:.]\d{2})\s*(.*)$/.exec(chip.trim());
  return match ? [match[1]!, match[2]!] : [chip, ""];
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
          </div>
        )}
        {d.rows.length > 0 && (
          <ol className="imp-ag">
            {d.rows.map((row, j) => (
              <AgendaLine key={j} row={row} instant={instants[i]![j] ?? null} timezone={context.timezone} />
            ))}
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

function AgendaLine({ row, instant, timezone }: { row: AgendaRow; instant: string | null; timezone: string }) {
  const isPause = !row.instructor && !row.photoUrl && /^pausa/i.test(row.topic.trim());
  // Rows saved before topic/instructor existed keep everything in `text`.
  const title = row.instructor || row.topic || row.text;
  const detail = row.instructor ? row.topic : row.topic ? row.text : "";
  const [digits, suffix] = splitChip(row.chip);
  if (!title && !row.chip) return null;
  return (
    <li className={isPause ? "is-pause" : undefined}>
      {row.chip && (
        <span className="imp-ag-time">
          <span>{digits}</span>
          {suffix && <small>{suffix}</small>}
          {instant && <ImpLocalTime instant={instant} eventOffset={zoneOffset(instant, timezone)} />}
        </span>
      )}
      {isPause ? (
        <span className="imp-dot" aria-hidden="true">
          ·
        </span>
      ) : row.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
        <img className="imp-mini" src={row.photoUrl} alt="" loading="lazy" />
      ) : row.instructor ? (
        <span className="imp-mini imp-mini--ini" aria-hidden="true">
          {initials(row.instructor)}
        </span>
      ) : (
        <span className="imp-dot" aria-hidden="true">
          <ImpIcon name="star" size={16} />
        </span>
      )}
      <span className="imp-what">
        {isPause ? title : <b>{title}</b>}
        {detail && <span>{detail}</span>}
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
