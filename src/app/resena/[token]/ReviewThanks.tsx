import Link from "next/link";
import type { ReviewPageTexts } from "@/lib/reviewPageTexts";
import ReviewPageHeader from "./ReviewPageHeader";

// What an attendee sees once their review is in (or when they reopen the
// link later): the raffle status, the optional reward box (only when the
// admin wrote one — /admin/resenas/textos) and their Instagram card.
// `texts` arrive with the placeholders already filled (page.tsx).
export default function ReviewThanks({
  texts,
  brandName,
  displayClassName,
  eventName,
  token,
  raffleOptIn,
  raffle,
  hasPhoto,
}: {
  texts: ReviewPageTexts;
  brandName: string;
  displayClassName: string;
  eventName: string;
  token: string;
  raffleOptIn: boolean;
  raffle: { prizeCount: number; prizeLabel: string; closesLabel: string; open: boolean } | null;
  hasPhoto: boolean;
}) {
  // "Asistió a <edición>" in bold inside the intro, when the admin's text
  // still carries it.
  const seal = `Asistió a ${eventName}`;
  const introParts = texts.thanksIntro.split(seal);
  const boxStyle = { background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column" as const, gap: 4 };
  const eyebrowStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--link)" };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "18px 20px 48px", display: "flex", flexDirection: "column", gap: 14 }}>
      <ReviewPageHeader brandName={brandName} eyebrow={texts.formEyebrow} displayClassName={displayClassName} />
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 8 }}>
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0b2e2c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </div>
      <h1 className={displayClassName} style={{ fontSize: 30, lineHeight: 1.1, margin: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
        {texts.thanksTitle}
      </h1>
      <p style={{ margin: 0, fontSize: 14, color: "#5b5f6b", lineHeight: 1.45 }}>
        {introParts.map((part, i) => (
          <span key={i}>
            {i > 0 && <strong style={{ color: "var(--ink)" }}>{seal}</strong>}
            {part}
          </span>
        ))}
      </p>

      {texts.rewardTitle && (
        <section style={boxStyle}>
          {texts.rewardEyebrow && <div style={eyebrowStyle}>{texts.rewardEyebrow}</div>}
          <div style={{ fontSize: 15, fontWeight: 800 }}>{texts.rewardTitle}</div>
          {texts.rewardText && <p style={{ margin: 0, fontSize: 13, color: "#5b5f6b", lineHeight: 1.45 }}>{texts.rewardText}</p>}
        </section>
      )}

      {raffle && (
        <section style={boxStyle}>
          <div style={eyebrowStyle}>{texts.raffleEyebrow}</div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{raffleOptIn ? texts.raffleInTitle : texts.raffleOutTitle}</div>
          <p style={{ margin: 0, fontSize: 13, color: "#5b5f6b", lineHeight: 1.45 }}>{texts.raffleText}</p>
        </section>
      )}

      <section style={{ background: "var(--accent-secondary)", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        {/* A sketch of the 9:16 card (api/resenas/<token>/tarjeta renders
            the real one), so the box reads as "a card to download". */}
        <div aria-hidden="true" style={{ width: 64, height: 96, borderRadius: 8, background: "#1c1310", flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 6, boxSizing: "border-box", gap: 3, overflow: "hidden" }}>
          {hasPhoto && <div style={{ flex: "1 1 auto", borderRadius: 4, background: "var(--accent-secondary)", opacity: 0.85, marginBottom: 3 }} />}
          <div style={{ display: "flex", gap: 1 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{ width: 7, height: 7, background: "#f2b01e", borderRadius: 1 }} />
            ))}
          </div>
          <div style={{ height: 4, width: "80%", background: "#fff", borderRadius: 2 }} />
          <div style={{ height: 4, width: "60%", background: "#fff", borderRadius: 2, opacity: 0.7 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1c1310", lineHeight: 1.2 }}>{texts.cardTitle}</div>
          <p style={{ margin: 0, fontSize: 12.5, color: "#1c1310", opacity: 0.85, lineHeight: 1.4 }}>{texts.cardText}</p>
          <a href={`/api/resenas/${encodeURIComponent(token)}/tarjeta`} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", height: 40, padding: "0 14px", borderRadius: 10, background: "#1c1310", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            {texts.cardButton}
          </a>
        </div>
      </section>

      <Link href="/" style={{ textAlign: "center", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
        {texts.backLink}
      </Link>
    </main>
  );
}
