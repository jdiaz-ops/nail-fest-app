import { BOLETA } from "@/lib/imparables/boleta";
import { pesos } from "@/lib/imparables/stages";
import { Tiara } from "./ImpArt";
import ImpButton from "./ImpButton";

/** «Boleta Imparable» (lib/imparables/boleta.ts; the team's boceto, 2026-11-03): a chocolate card with a gold edge —
 * its name, the ticket drawn and tilted, today's price with the full one struck over it, the line of its places, what
 * it brings in short lines with a gold check each, the button and how to pay. Its own colors (globals.css
 * .imp-bt-card), on the light ground between «Qué incluye tu cupo» and the questions. */
export default function ImpBoleta({
  eventName,
  date,
  stub,
  price,
  struck,
  line,
  rise,
  buyLabel,
}: {
  /** "Manicuristas Imparables" */
  eventName: string;
  /** "Domingo 4 de julio 2027" */
  date: string;
  /** "04 · 07 · 2027" */
  stub: string;
  price: number;
  struck: number | null;
  /** "Solo 200 cupos a este precio", the places left, or a version's special price. */
  line: string | null;
  /** "El precio sube a … en …", in the stage's last weeks. */
  rise?: React.ReactNode;
  buyLabel: string;
}) {
  const { ticket } = BOLETA;
  // Two halves: its name and the ticket; then the price, what it brings and the button — one under the other on a
  // phone, side by side on a computer (the team, 2026-11-03: «adapta para la versión desktop»).
  return (
    <article className="imp-bt-card" aria-labelledby="imp-bt-t">
      <div className="imp-bt-show">
        <h2 className="imp-bt-title" id="imp-bt-t">
          {BOLETA.title}
        </h2>
        <div className="imp-bt-stage">
          <div className="imp-bt-ticket" role="img" aria-label={`${BOLETA.title} · ${eventName} · ${date}`}>
            <div className="imp-bt-main">
              <Tiara className="imp-bt-tiara" />
              <span className="imp-bt-no">{ticket.number}</span>
              <span className="imp-bt-kicker">{ticket.kicker}</span>
              <span className="imp-bt-name">{ticket.name}</span>
              <span className="imp-bt-rule" />
              <span className="imp-bt-event">{eventName}</span>
              <span className="imp-bt-date">
                {date} · {ticket.live}
              </span>
            </div>
            <div className="imp-bt-stub">
              <span className="imp-bt-bars" />
              {stub && <span className="imp-bt-stub-t">{stub}</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="imp-bt-buy">
        {struck !== null && struck > price && (
          <p className="imp-bt-was">
            <s>{pesos(struck)}</s>
          </p>
        )}
        <p className="imp-bt-amt">
          {pesos(price)} <small>COP</small>
        </p>
        {line && <p className="imp-bt-line">{line}</p>}
        {rise}
        <ul className="imp-bt-list">
          {BOLETA.lines.map((text) => (
            <li key={text}>
              <span className="imp-bt-ok" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M6 12.5l4 4L18 8.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <ImpButton action="buy" className="imp-cta imp-bt-cta">
          {buyLabel}
        </ImpButton>
        <div className="imp-pay">
          {BOLETA.pay.map((way) => (
            <span key={way}>{way}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
