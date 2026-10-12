// The small brand bar on top of the attendee's review pages (the form,
// the thanks page, the "can't review" message): the org's name with the
// teal dot, and the page's eyebrow on the right.
export default function ReviewPageHeader({ brandName, eyebrow, displayClassName }: { brandName: string; eyebrow: string; displayClassName: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0 0 2px" }}>
      <div className={displayClassName} style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 6 }}>
        <span>{brandName}</span>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--link)" }}>{eyebrow}</div>
    </div>
  );
}
