import { Fraunces } from "next/font/google";
import type { SalesPageContent as SalesPageContentData, SalesPageSpeaker } from "@/lib/salesPage/types";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

// Matches the one other place a price already renders in this app
// (EventRegistration.tsx's ticket price: `$${t.price.toLocaleString("es-CO")}`)
// — same formatting everywhere a Colombian peso amount shows up.
function formatCOP(value: number): string {
  return `$${value.toLocaleString("es-CO")}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ width: 15, height: 15 }}>
      <path d="M4 10.5l3.5 3.5L16 5.5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ width: 13, height: 13 }}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function GuaranteeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function UrgencyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" style={{ width: 24, height: 24, flex: "0 0 auto" }}>
      <path d="M6 2h12M6 22h12M8 2c0 5 8 5 8 10s-8 5-8 10M16 2c0 5-8 5-8 10s8 5 8 10" />
    </svg>
  );
}

function SpeakerAvatar({ speaker }: { speaker: SalesPageSpeaker }) {
  if (speaker.photoUrl) {
    return (
      <span className="sales-speaker-avatar">
        {/* eslint-disable-next-line @next/next/no-img-element -- one-off avatar, not worth next/image's config for a single small headshot */}
        <img src={speaker.photoUrl} alt={speaker.name} />
      </span>
    );
  }
  // No real photo yet — an initials badge instead of a stand-in stock
  // photo, since this is a real named person and a stranger's face under
  // their name would misrepresent them (see manicuristasImparables.ts's
  // own comment). Swap in photoUrl once someone uploads the real one.
  return <span className="sales-speaker-avatar">{initials(speaker.name)}</span>;
}

// Everything BELOW the hero — passed as EventRegistration's `salesContent`
// prop, rendered in place of the plain `descriptionHtml` block, right
// next to the untouched registration/checkout sidebar. Plain-text fields
// throughout (JSX auto-escapes), no dangerouslySetInnerHTML anywhere —
// this data is curated in code, not free-typed by an open admin field, so
// it doesn't go through sanitizeEventDescription's tag allowlist and can
// use real <table>s and cards that allowlist has no room for.
export default function SalesPageContent({ content }: { content: SalesPageContentData }) {
  return (
    <>
      <section className="sales-section">
        <h2 className="sales-section-title">Un congreso pensado para que ejecutes, no solo para que escuches</h2>
        <p>{content.story.intro}</p>
        <div className="sales-quotes" style={{ marginTop: 16 }}>
          {content.story.testimonials.map((t) => (
            <blockquote key={t.name} className="sales-quote-card">
              <span className="sales-quote-mark" aria-hidden="true">
                “
              </span>
              <p className="sales-quote-text">{t.quote}</p>
              <p className="sales-quote-attr">
                — {t.name}, {t.city}
              </p>
            </blockquote>
          ))}
        </div>
        <p>{content.story.transition}</p>
      </section>

      <section className="sales-section">
        <h2 className="sales-section-title">Esto es todo lo que recibes cuando entras hoy</h2>
        <table className="sales-value-table">
          <thead>
            <tr>
              <th>Qué incluye</th>
              <th style={{ textAlign: "right" }}>Valor individual</th>
            </tr>
          </thead>
          <tbody>
            {content.valueStack.items.map((item) => (
              <tr key={item.label}>
                <td>
                  {item.label}
                  {item.detail && <span className="sales-value-detail">{item.detail}</span>}
                </td>
                <td className="sales-value-amount">{formatCOP(item.value)}</td>
              </tr>
            ))}
            <tr className="sales-value-total-row">
              <td>Valor total</td>
              <td className="sales-value-amount">{formatCOP(content.valueStack.totalValue)}</td>
            </tr>
          </tbody>
        </table>
        <div className="sales-price-reveal">
          <span className="sales-price-old">{formatCOP(content.valueStack.totalValue)}</span>
          <span className="sales-price-arrow">→</span>
          <span className={`${fraunces.className} sales-price-new`}>{formatCOP(content.valueStack.priceToday)} hoy</span>
        </div>
      </section>

      <section className="sales-section">
        <h2 className="sales-section-title">Esto es lo que vas a vivir en los 2 días</h2>
        {content.schedule.days.map((day) => (
          <div className="sales-schedule-day" key={day.label}>
            <span className="sales-schedule-day-label">{day.label}</span>
            <table className="sales-schedule-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Taller</th>
                  <th>Speaker</th>
                </tr>
              </thead>
              <tbody>
                {day.blocks.map((block) => (
                  <tr key={`${day.label}-${block.time}`}>
                    <td>{block.time}</td>
                    <td>{block.topic}</td>
                    <td>{block.speaker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="sales-section-note">{content.schedule.timezoneNote}</p>
      </section>

      <section className="sales-section">
        <h2 className="sales-section-title">Quiénes te acompañan estos 2 días</h2>
        <div className="sales-speaker-grid">
          {content.speakers.map((speaker) => (
            <div className="sales-speaker-card" key={speaker.name}>
              <SpeakerAvatar speaker={speaker} />
              <div>
                <p className="sales-speaker-name">{speaker.name}</p>
                <p className="sales-speaker-role">{speaker.role}</p>
                <p className="sales-speaker-bio">{speaker.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sales-section">
        <h2 className="sales-section-title">¿Es para ti?</h2>
        <div className="sales-forwhom-grid">
          <div className="sales-forwhom-card is-yes">
            <p className="sales-forwhom-title">Es para ti si:</p>
            <ul>
              {content.forWhom.yes.map((line) => (
                <li key={line}>
                  <span className="sales-forwhom-mark">
                    <CheckIcon />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="sales-forwhom-card is-no">
            <p className="sales-forwhom-title">No es para ti si:</p>
            <ul>
              {content.forWhom.no.map((line) => (
                <li key={line}>
                  <span className="sales-forwhom-mark">
                    <CrossIcon />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="sales-section">
        <div className="sales-urgency-banner">
          <UrgencyIcon />
          <div>
            <p className={`${fraunces.className} sales-urgency-number`}>{content.urgency.capacity.toLocaleString("es-CO")}</p>
            <p className="sales-urgency-text">{content.urgency.note}</p>
          </div>
        </div>
      </section>

      <section className="sales-section">
        <div className="sales-guarantee-card">
          <span className="sales-guarantee-badge">
            <GuaranteeIcon />
          </span>
          <div>
            <p className="sales-guarantee-title">{content.guarantee.title}</p>
            <p className="sales-guarantee-text">{content.guarantee.text}</p>
          </div>
        </div>
      </section>

      <section className="sales-section">
        <h2 className="sales-section-title">Preguntas frecuentes</h2>
        {content.faq.map((item) => (
          <details className="sales-faq-item" key={item.question}>
            <summary>
              {item.question}
              <span className="sales-faq-icon" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="sales-faq-answer">{item.answer}</p>
          </details>
        ))}
      </section>

      <div className="sales-closing-ps">
        <strong>P.D.</strong> {content.closingPs}
      </div>
    </>
  );
}
