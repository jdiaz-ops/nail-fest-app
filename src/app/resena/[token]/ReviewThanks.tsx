import Link from "next/link";
import type { ReviewPageTexts } from "@/lib/reviewPageTexts";
import ReviewHero from "./ReviewHero";

// What an attendee sees once their review is in (or when they reopen the
// link later): the same photo header with the check, the raffle box, the
// optional reward box (only when the admin wrote one — /admin/resenas/
// textos) and their Instagram card. `texts` arrive with the placeholders
// already filled (page.tsx). Styles: globals.css (.rv-*).
export default function ReviewThanks({
  texts,
  brandName,
  displayClassName,
  eventImageUrl,
  token,
  raffleOptIn,
  raffle,
  hasPhoto,
}: {
  texts: ReviewPageTexts;
  brandName: string;
  displayClassName: string;
  eventImageUrl: string | null;
  token: string;
  raffleOptIn: boolean;
  raffle: { prizeCount: number; prizeLabel: string; closesLabel: string; open: boolean } | null;
  hasPhoto: boolean;
}) {
  // The seal ("Asistió a <edición>") in bold inside the intro, when the
  // admin's text still carries it.
  const introParts = texts.thanksIntro.split(texts.seal);

  return (
    <div className="rv-page">
      <ReviewHero brandName={brandName} eyebrow={texts.formEyebrow} imageUrl={eventImageUrl}>
        <div className="rv-check-circle" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className={`rv-title rv-title-lg ${displayClassName}`}>{texts.thanksTitle}</h1>
        <p className="rv-intro">
          {introParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <strong>{texts.seal}</strong>}
              {part}
            </span>
          ))}
        </p>
      </ReviewHero>

      <div className="rv-body">
        {texts.rewardTitle && (
          <section className="rv-box rv-box-white">
            {texts.rewardEyebrow && <div className="rv-eyebrow rv-eyebrow-ink">{texts.rewardEyebrow}</div>}
            <div className={`rv-raffle-title ${displayClassName}`}>{texts.rewardTitle}</div>
            {texts.rewardText && <p className="rv-box-text">{texts.rewardText}</p>}
          </section>
        )}

        {raffle && (
          <section className="rv-box rv-box-cream">
            <div className="rv-raffle-head">
              <span className="rv-raffle-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </svg>
              </span>
              <span className="rv-eyebrow rv-eyebrow-ink">{texts.raffleEyebrow}</span>
            </div>
            <div className={`rv-raffle-title ${displayClassName}`}>{raffleOptIn ? texts.raffleInTitle : texts.raffleOutTitle}</div>
            <p className="rv-box-text">{texts.raffleText}</p>
          </section>
        )}

        <section className="rv-ig">
          {/* A sketch of the 9:16 story card (api/resenas/<token>/tarjeta
              renders the real one), so the box reads as "a card". */}
          <div className="rv-ig-mini" aria-hidden="true">
            {hasPhoto && <div className="rv-ig-mini-photo" />}
            <div style={{ display: "flex", gap: 1 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} style={{ width: 8, height: 8, background: "#f2b01e", borderRadius: 1 }} />
              ))}
            </div>
            <div style={{ height: 4, width: "85%", background: "#fff", borderRadius: 2 }} />
            <div style={{ height: 4, width: "60%", background: "#fff", borderRadius: 2, opacity: 0.7 }} />
            <div style={{ height: 3, width: "40%", background: "var(--accent)", borderRadius: 2, marginTop: 2 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div className={`rv-ig-title ${displayClassName}`}>{texts.cardTitle}</div>
            <p className="rv-ig-text">{texts.cardText}</p>
            <a className="rv-ig-btn" href={`/api/resenas/${encodeURIComponent(token)}/tarjeta`}>
              {texts.cardButton}
            </a>
          </div>
        </section>

        <Link href="/" className="rv-back">
          {texts.backLink}
        </Link>
      </div>
    </div>
  );
}
