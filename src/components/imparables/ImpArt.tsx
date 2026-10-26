import type { LandingTone } from "@/lib/landingBlocks/types";

// The drawn pieces of Manicuristas Imparables' page: the tiara over the
// name, the line icons, and the silhouette a panelist shows until her photo
// arrives. Plain SVG in the page's own colors (globals.css), same strokes as
// the boceto.

/** On the cover and the closing, in the color .imp-tiara gives it. */
export function Tiara() {
  return (
    <svg className="imp-tiara" viewBox="0 0 190 52" aria-hidden="true">
      <path d="M6 48 Q95 -4 184 48" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="M30 46 Q95 12 160 46" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
      <polygon points="95,8 99.4,19 111,19.6 101.9,26.8 105,38 95,31.6 85,38 88.1,26.8 79,19.6 90.6,19" fill="currentColor" />
    </svg>
  );
}

const ICONS = {
  live: (
    <>
      <path d="M4 8.5a10 10 0 0 1 16 0M7 11.5a6 6 0 0 1 10 0" />
      <circle cx="12" cy="15" r="2.2" fill="currentColor" />
      <path d="M12 17.5V21" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  move: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 7v6l-3.5 7M12 13l3.5 7M6.5 10l5.5-2 5.5 2" />
    </>
  ),
  file: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M12 11v6M9.5 14.5 12 17l2.5-2.5" />
    </>
  ),
  replay: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
      <path d="M10.5 9.5v5l4-2.5z" fill="currentColor" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M9.5 9.2l1.7 1.7 3.3-3.4M8.6 13.6 7 21l5-2.6 5 2.6-1.6-7.4" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.5" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </>
  ),
  star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />,
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" />
      <path d="m8.8 12.2 2.3 2.3 4.3-4.6" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v9h14v-9M12 8a3 3 0 1 1 3-3c0 3-3 3-3 3zM12 8a3 3 0 1 0-3-3c0 3 3 3 3 3z" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M13 5v14" strokeDasharray="2 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.6 14.4a4.6 4.6 0 0 1 5.4 4.6" />
    </>
  ),
};
export type ImpIconName = keyof typeof ICONS;

export function ImpIcon({ name, size = 22 }: { name: ImpIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** What each line of «Qué incluye» shows, by what it says. */
export function iconForPoint(title: string): ImpIconName {
  const t = title.toLowerCase();
  if (/repetici|grabaci/.test(t)) return "replay";
  if (/certificad/.test(t)) return "award";
  if (/en vivo|directo/.test(t)) return "live";
  if (/pausa/.test(t)) return "move";
  if (/guía|guia|descarg|plantilla|material/.test(t)) return "file";
  if (/descuento|cup[oó]n|precio/.test(t)) return "tag";
  if (/ruta|plan\b/.test(t)) return "map";
  if (/speaker|panel|charla|conferencia/.test(t)) return "mic";
  return "star";
}

const TONE_GROUND: Record<LandingTone, string> = {
  pink: "var(--imp-chocolate-tarjeta)",
  teal: "var(--imp-chocolate-medio)",
  peach: "var(--imp-bronce-oscuro)",
};

/** A portrait still to come: a silhouette in a medallion, in the color .imp-pn-ph gives it. */
export function Silhouette({ tone, className }: { tone: LandingTone; className: string }) {
  return (
    <span className={className} style={{ background: TONE_GROUND[tone] }} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <path
          fill="currentColor"
          fillOpacity=".55"
          d="M32 13c-7.2 0-11.5 5.6-11.5 12.4 0 4.3 1.6 8 4.3 10.2-1 .9-2.4 1.6-4.2 2.1C13.4 39.6 9 45.4 7.5 64h49c-1.5-18.6-5.9-24.4-13.1-26.3-1.8-.5-3.2-1.2-4.2-2.1 2.7-2.2 4.3-5.9 4.3-10.2C43.5 18.6 39.2 13 32 13z"
        />
      </svg>
    </span>
  );
}

/** "Alejandro Salinas" -> "AS". */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/** "@jimenanails" or "jimenanails" -> its Instagram address. */
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle.replace(/^@+/, ""))}`;
}
