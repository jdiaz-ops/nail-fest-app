"use client";

// Thin <a> wrapper that fires the click-count beacon before letting the
// real navigation happen — sendBeacon (not fetch) specifically because it
// survives the page unloading/backgrounding right after the click, which
// a fire-and-forget fetch isn't guaranteed to (target="_blank" opens a
// new tab so this page never actually unloads here, but sendBeacon is
// still the correct, standard tool for "log this, then leave"). No
// preventDefault — the anchor's own href does the navigating.
export default function TrackedLink({
  id,
  href,
  style,
  children,
}: {
  id: string;
  href: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  function handleClick() {
    try {
      navigator.sendBeacon(`/api/links/${id}/click`);
    } catch {
      // Best-effort only — a click that fails to log must never block or
      // visibly break the actual link.
    }
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={handleClick} style={style}>
      {children}
    </a>
  );
}
