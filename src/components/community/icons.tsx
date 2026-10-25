import type { ReactNode } from "react";

// The community's icons (the home's doors, its links) — line icons on a
// 24px grid, in the text's color.

/** A part of Nail Fest to link to: the community's footer, its way in. */
export interface CommunityLink {
  href: string;
  label: string;
  hint?: string;
  icon: keyof typeof ICONS;
}

export const ICONS = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  event: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  cortos: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 9.2v5.6l4.4-2.8z" fill="currentColor" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M16.5 14.6A5 5 0 0 1 21.5 20" />
    </>
  ),
  chat: <path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.5L3.5 20.5l1.4-4.6a8.4 8.4 0 1 1 15.6-4.3z" />,
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export function SiteIcon({ name, size = 20 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
