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
import { agendaInstant, type EventWhen } from "@/lib/imparables/schedule";
import { dayMonth, pesos, saving, stageLine, stagesSummary, type SalesState } from "@/lib/imparables/stages";
import { isPanelCard, listNames, namesIn, panelGuestsOf } from "@/lib/imparables/blocks";
import { ImpIcon, Silhouette, iconForPoint, initials, instagramUrl, type ImpIconName } from "./ImpArt";
import ImpButton from "./ImpButton";
import ImpCountdown from "./ImpCountdown";
import ImpSwipe from "./ImpSwipe";

// Event.landingBlocks drawn in Manicuristas Imparables' style (EventTheme
// IMPARABLES): the same blocks every event page has, read the way the
// approved boceto lays them out. Each «Título de sección» opens a section
// of its own, the background alternating; inside it, a card with a photo is
// the host, a card without one followed by people is the panel (its people
// a row of «Panelistas» under the speakers; what its card says, the panel's
// line in the program), one with a
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
  /** "Reservar mi cupo": every buy button's label. */
  buyLabel: string;
  /** Whose photo goes next to a name on the cards: the speakers and the panel's guests already named. */
  speakers: PeopleLandingBlock["items"];
  /** The panel: its line in the program tells what its card says, with its panelists' faces. */
  panel: { card: CardLandingBlock; people: PeopleLandingBlock } | null;
}

type Section = { heading: HeadingLandingBlock | null; blocks: LandingBlock[]; id?: string; tone?: "dark" | "light" };

/** A section the page adds of its own (2026-10-31: the ticket levels on a version that sells them, lib/imparables/
 * tiers.ts; the promise and the outcomes on one that sells the transformation, lib/imparables/transformacion.ts):
 * its heading's parts, its own content or blocks, where it goes, and — when it must — its color; the sections after it
 * keep alternating from it. */
export interface ExtraSection {
  id: string;
  eyebrow?: string;
  title: string;
  intro: string;
  content?: React.ReactNode;
  blocks?: LandingBlock[];
  tone?: "dark" | "light";
  /** First of all, before the program, or before the questions (else last). */
  at: "start" | "beforeAgenda" | "beforeFaq";
}

/** "8:00 a. m." and "7 p. m." whole on their line, wherever a line breaks (2026-10-29: the day's hours under
 * «Agenda» and in what the ticket brings). */
function keepTimes(text: string): string {
  return text.replace(/(\d{1,2}(?:[:.]\d{2})?) ([ap])\. m\./g, "$1\u00a0$2.\u00a0m.");
}

function sectionsOf(blocks: LandingBlock[]): Section[] {
  const sections: Section[] = [];
  for (const block of blocks) {
    if (block.type === "heading") sections.push({ heading: block, blocks: [] });
    else if (sections.length === 0) sections.push({ heading: null, blocks: [block] });
    else sections[sections.length - 1]!.blocks.push(block);
  }
  return sections;
}

export default function ImparablesBlocks({ blocks, context, extras = [] }: { blocks: LandingBlock[]; context: ImparablesContext; extras?: ExtraSection[] }) {
  // Only the sections with something to show, so the backgrounds keep alternating.
  const sections = sectionsOf(blocks)
    .map((section) => ({ ...section, content: renderBlocks(section.blocks, context) }))
    .filter((section) => section.content.length > 0 || section.heading?.title || section.heading?.intro);
  for (const extra of extras) {
    const before = (type: LandingBlock["type"]) => sections.findIndex((section) => section.blocks.some((b) => b.type === type));
    const at = extra.at === "start" ? 0 : extra.at === "beforeAgenda" ? before("agenda") : before("faq");
    const heading: HeadingLandingBlock = { type: "heading", eyebrow: extra.eyebrow ?? "", title: extra.title, intro: extra.intro };
    const content = [...(extra.blocks ? renderBlocks(extra.blocks, context) : []), ...(extra.content ? [extra.content] : [])];
    sections.splice(at >= 0 ? at : sections.length, 0, { heading, blocks: extra.blocks ?? [], content, id: extra.id, tone: extra.tone });
  }
  // Dark, light, dark… from the first; a section with a color of its own takes it, and the next ones go on from it.
  let dark = false;
  const tones = sections.map((section) => (dark = section.tone ? section.tone === "dark" : !dark));
  return (
    <>
      {sections.map((section, i) => {
        const { content, heading } = section;
        // A section with a big phrase in it (the hook) gets the big quote mark.
        const quote = section.blocks.some(
          (b, j) => b.type === "card" && !b.imageUrl && b.icon === "none" && b.title && !/<(ul|ol)\b/i.test(b.html) && !isPanelCard(b, section.blocks[j + 1])
        );
        return (
          <section key={i} id={section.id} className={`imp-sec${tones[i] ? " imp-sec--alt" : ""}`}>
            <div className="imp-sec-in">
              {quote && (
                <span className="imp-quote" aria-hidden="true">
                  “
                </span>
              )}
              {heading?.eyebrow && <div className="imp-eyebrow">{heading.eyebrow}</div>}
              {heading?.title && <h2 className="imp-h2">{heading.title}</h2>}
              {heading?.intro && <p className="imp-lead">{keepTimes(heading.intro)}</p>}
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
      out.push(<Panelists key={i} people={next as PeopleLandingBlock} />);
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
              <p className="imp-faq-a">{withStages(item.answer, context)}</p>
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
                {item.text && <small>{keepTimes(item.text)}</small>}
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

// The panelists under the speakers (2026-10-26): a list, each on a line of
// her own — her photo, then who she is and her line, or, not confirmed yet,
// a silhouette, «Por anunciar» and the story she brings — the confirmed ones
// first. When and what the panel is, the program says.
function Panelists({ people }: { people: PeopleLandingBlock }) {
  const guests = panelGuestsOf(people);
  if (guests.length === 0) return null;
  return (
    <div className="imp-pnl">
      <h3 className="imp-pnl-t">Panelistas</h3>
      <div className="imp-pnl-row">
        {guests.map((p, j) => (
          <div className={`imp-pn${p.name.trim() ? "" : " imp-pn--tba"}`} key={j}>
            {p.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
              <img className="imp-pn-ph" src={p.photoUrl} alt="" loading="lazy" />
            ) : (
              <Silhouette className="imp-pn-ph" tone={p.tone} />
            )}
            <div className="imp-pn-t">
              {p.name.trim() ? <b>{p.name}</b> : <small>Por anunciar</small>}
              {p.name.trim() && p.handle && (
                <a className="imp-pn-ig" href={instagramUrl(p.handle)} target="_blank" rel="noopener noreferrer">
                  @{p.handle.replace(/^@+/, "")}
                </a>
              )}
              {p.tag && <span>{p.tag}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// A speaker's card: her photo, her name, her Instagram and her line — always
// those four, so each row of cards lines them up (globals.css) whatever
// their length (2026-10-26).
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
            {p.handle ? (
              <a className="imp-sp-ig" href={instagramUrl(p.handle)} target="_blank" rel="noopener noreferrer">
                @{p.handle.replace(/^@+/, "")}
              </a>
            ) : (
              <span className="imp-sp-ig" />
            )}
            <p className="imp-sp-line">{p.tag}</p>
          </div>
        ))}
    </div>
  );
}

// ── The program ─────────────────────────────────────────────────────────────
// Its parts one under the other — the two days, or since 2026-10-29 one day's
// morning and afternoon — each line told the way the approved boceto does:
// the talk first (after its small tag, if it has one), then who gives it (her
// photo, name and Instagram), only the hour it starts — no durations since
// 2026-10-28 — a star talk in a box of its own, the active breaks as thin
// lines and the lunch as a band. A part's header: its label, and its title and
// subtitle if it has them (since 2026-10-29 Imparables' say only when they
// start: «Mañana · 8:00 a. m.»).

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
  // The n-th part of the program happens on the event's n-th day; a one-day
  // event's parts (its morning, its afternoon) all on its one day.
  const dayOf = (i: number) => context.when.days[Math.min(i, context.when.days.length - 1)];
  const instants = days.map((d, i) => d.rows.map((row) => agendaInstant(dayOf(i), row.chip, context.timezone)));
  // A speaker's Instagram goes next to her name in the program (2026-10-28) — the panel's and the host's lines keep theirs.
  const handleOf = (name: string) => context.speakers.find((p) => p.name.trim() === name.trim())?.handle.trim() ?? "";
  const cards = days.map((d, i) => {
    return (
      <div className="imp-day" key={i}>
        {d.head && (
          <div className="imp-day-h">
            {/* Only the date: its hours are the program's own (2026-10-28). */}
            {d.head.chip && <small>{d.head.chip}</small>}
            {d.head.topic && <b>{d.head.topic}</b>}
            {d.head.takeaway && <span className="imp-day-sub">{d.head.takeaway}</span>}
          </div>
        )}
        {d.rows.length > 0 && (
          <ol className="imp-ag">
            {d.rows.map((row, j) => (
              <AgendaLine
                key={j}
                row={row}
                instant={instants[i]![j] ?? null}
                timezone={context.timezone}
                handle={row.instructor ? handleOf(row.instructor) : ""}
                panel={context.panel && isPanelRow(row, context.panel.card) ? context.panel : null}
              />
            ))}
          </ol>
        )}
      </div>
    );
  });
  return (
    <div className="imp-agenda">
      {cards}
    </div>
  );
}

/** The program's line for the panel: the one whose title names it. */
function isPanelRow(row: AgendaRow, card: CardLandingBlock): boolean {
  const title = card.title.trim().toLowerCase();
  return row.kind !== "day" && Boolean(title) && row.topic.toLowerCase().includes(title);
}

function AgendaLine({
  row,
  instant,
  timezone,
  handle,
  panel,
}: {
  row: AgendaRow;
  instant: string | null;
  timezone: string;
  /** Her Instagram, next to her name. */
  handle: string;
  panel: ImparablesContext["panel"];
}) {
  const isPause = !row.instructor && !row.photoUrl && /^pausa/i.test(row.topic.trim());
  // The lunch, a band of its own: how long it is («1 hora de almuerzo») and its hours (2026-10-29).
  const isLunch = !row.instructor && !row.photoUrl && /almuerzo/i.test(row.topic);
  // Rows saved before topic/instructor existed keep everything in `text`.
  const title = row.topic || row.instructor || row.text;
  // A talk: its title, its subtitle (the row's «Nota extra»), then who gives
  // it. A line with a photo and no speaker (the host's): its title, then the
  // photo next to its text.
  // The panel's line tells what its card says instead (2026-10-26).
  const guests = panel ? panelGuestsOf(panel.people) : [];
  const named = guests.filter((p) => p.name.trim()).map((p) => p.name.trim());
  const pending = guests.length - named.length;
  // Or it names its guests its own way (2026-10-29): «Maris
  // @maris_nails_oficial · desde Chile» — its «Quién la da», its Instagram,
  // its note — with her round photo, instead of the full names on the
  // panel's cards, which still count who is to be announced.
  const panelWho = panel ? row.instructor.trim() : "";
  const subtitle = panel?.card.html || panelWho ? "" : row.topic && (row.instructor || !row.photoUrl) ? row.text : "";
  const toAnnounce = pending > 0 ? ` y ${pending} ${pending === 1 ? "panelista" : "panelistas"} por anunciar` : "";
  const who = panel ? "" : row.topic ? row.instructor || (row.photoUrl ? row.text : "") : "";
  const [digits, suffix] = splitChip(row.chip);
  if (!title && !row.chip) return null;
  if (isPause) {
    return (
      <li className="is-pause">
        <span>{title}</span>
      </li>
    );
  }
  if (isLunch) {
    return (
      <li className="is-lunch">
        <b>{title}</b>
        {row.text && <span>{keepTimes(row.text)}</span>}
      </li>
    );
  }
  return (
    <li className={row.star ? "is-star" : undefined}>
      {row.chip && (
        <span className="imp-ag-time">
          <span>{digits}</span>
          {suffix && <small>{suffix}</small>}
        </span>
      )}
      <span className="imp-what">
        {(row.label || row.star) && <span className="imp-ag-tag">{row.label || "★ Charla estrella"}</span>}
        <b>{title}</b>
        {subtitle && <span>{subtitle}</span>}
        {panel?.card.html && <span className="imp-ag-desc" dangerouslySetInnerHTML={{ __html: panel.card.html }} />}
        {panelWho ? (
          <span className="imp-by">
            {row.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
              <img src={row.photoUrl} alt="" loading="lazy" />
            ) : (
              <span aria-hidden="true">{initials(panelWho)}</span>
            )}
            <i className="imp-by-who">
              Con {panelWho}
              {row.handles.trim() && <> <em>{row.handles.trim()}</em></>}
              {row.text.trim() && ` · ${row.text.trim()}`}
              {toAnnounce}
            </i>
          </span>
        ) : guests.length > 0 && (
          <span className="imp-by">
            <span className="imp-by-faces" aria-hidden="true">
              {guests.map((p, k) =>
                p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
                  <img key={k} src={p.photoUrl} alt="" loading="lazy" />
                ) : (
                  <Silhouette key={k} className="imp-by-sil" tone={p.tone} />
                )
              )}
            </span>
            {pending === 0
              ? `Con ${listNames(named)}`
              : named.length
                ? `Con ${listNames(named)} y ${pending} ${pending === 1 ? "panelista" : "panelistas"} por anunciar`
                : `${guests.length} ${guests.length === 1 ? "panelista" : "panelistas"} por anunciar`}
          </span>
        )}
        {who && (
          <span className="imp-by">
            {row.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
              <img src={row.photoUrl} alt="" loading="lazy" />
            ) : row.instructor ? (
              <span aria-hidden="true">{initials(row.instructor)}</span>
            ) : null}
            <i className="imp-by-who">
              {who}
              {handle && <> <em>{handle}</em></>}
            </i>
          </span>
        )}
      </span>
    </li>
  );
}

/** «{{etapas}}» in a question's answer: every price stage in a sentence each, as its ticket types say today
 * («¿Por qué sube el precio?», 2026-10-29) — the answer follows any change to them. */
function withStages(answer: string, context: ImparablesContext): string {
  return answer.includes("{{etapas}}") ? answer.split("{{etapas}}").join(stagesSummary(context.sales.stages, context.timezone)) : answer;
}

// ── Tu boleta ───────────────────────────────────────────────────────────────

function secondsUntil(to: Date, now: Date): number {
  return Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
}

/** Today's price says until when it holds; the countdown only comes in its last days — months away, it hurries no one (2026-10-27). */
const COUNTDOWN_DAYS = 30;

function Prices({ block, context }: { block: PricesLandingBlock; context: ImparablesContext }) {
  const { sales, timezone, now, offsetMs } = context;
  if (sales.stages.length === 0) return null;
  const { current, next, countdown, full } = sales;
  // Each stage says where it stands, no dates (2026-10-26); today's price
  // says what the cover says under its button (2026-10-29), and the
  // countdown comes in its last days.
  const STATE_NOTE = { current: "Ahora", past: "Cerrada", soldout: "Agotada", future: "Próximamente" } as const;
  const STATE_CLASS = { current: "is-on", past: "is-off", soldout: "is-off", future: "is-soon" } as const;
  return (
    <div className="imp-prices">
      {current ? (
        <div className="imp-now">
          <span className="imp-now-badge">Precio de hoy · {current.name}</span>
          {saving(current, full) > 0 && (
            <div className="imp-now-was">
              {full!.name} <s>{pesos(full!.price)}</s>
            </div>
          )}
          <div className="imp-now-amt">
            {pesos(current.price)} <small>COP</small>
          </div>
          {saving(current, full) > 0 && <div className="imp-now-save">Ahorras {pesos(saving(current, full))}</div>}
          {block.note && <div className="imp-now-iva">{block.note}</div>}
          <div className="imp-now-up">{stageLine(sales, timezone)}</div>
          {countdown && secondsUntil(countdown.to, now) <= COUNTDOWN_DAYS * 86_400 && (
            <ImpCountdown to={countdown.to.toISOString()} label="Faltan" initialSeconds={secondsUntil(countdown.to, now)} seconds={false} offsetMs={offsetMs} />
          )}
          <ImpButton action="buy" className="imp-cta">
            {context.buyLabel}
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
          <li key={stage.id} className={STATE_CLASS[stage.state]}>
            <span>
              <b>{stage.name}</b>
              {STATE_NOTE[stage.state]}
            </span>
            <span className="imp-stage-p">
              <strong>{pesos(stage.price)}</strong>
              {saving(stage, full) > 0 && stage.state !== "past" && stage.state !== "soldout" && <small>Ahorras {pesos(saving(stage, full))}</small>}
            </span>
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
