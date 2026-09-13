// Shape of Event.salesPageContent — see that column's own schema comment
// for why this exists as a separate, optional rendering path alongside
// `description` instead of replacing it. Rendered by
// components/salesPage/SalesPageContent.tsx as real React (plain-text
// fields, auto-escaped by JSX — never dangerouslySetInnerHTML), which is
// what lets it use real <table>s and styled cards that the sanitized
// rich-text `description` field can't (sanitizeEventDescription's
// allowlist has no <table>).
export interface SalesPageTestimonial {
  quote: string;
  name: string;
  city: string;
}

export interface SalesPageValueItem {
  label: string;
  detail?: string;
  value: number;
}

export interface SalesPageScheduleBlock {
  time: string;
  topic: string;
  speaker: string;
}

export interface SalesPageScheduleDay {
  label: string;
  blocks: SalesPageScheduleBlock[];
}

export interface SalesPageSpeaker {
  name: string;
  role: string;
  bio: string;
  // Real headshot, once there is one — see SpeakerGrid.tsx's own comment
  // on why a missing one renders as an initials badge instead of a
  // placeholder stock photo (these are real, named people; showing a
  // stranger's photo under their name would misrepresent them, and their
  // real photos aren't ours to embed until someone actually uploads one).
  photoUrl?: string;
}

export interface SalesPageFaqItem {
  question: string;
  answer: string;
}

export interface SalesPageContent {
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    tensionLine: string;
  };
  story: {
    intro: string;
    testimonials: SalesPageTestimonial[];
    transition: string;
  };
  valueStack: {
    items: SalesPageValueItem[];
    totalValue: number;
    priceToday: number;
  };
  schedule: {
    timezoneNote: string;
    days: SalesPageScheduleDay[];
  };
  speakers: SalesPageSpeaker[];
  forWhom: {
    yes: string[];
    no: string[];
  };
  urgency: {
    capacity: number;
    note: string;
  };
  guarantee: {
    title: string;
    text: string;
  };
  faq: SalesPageFaqItem[];
  closingPs: string;
}

/** Event.salesPageContent comes back from Prisma as `Prisma.JsonValue |
 * null` — this is the one place that gets cast to the real shape. Not a
 * full runtime schema validator: this field is never hand-typed through
 * an open admin form (see the column's own schema comment), only ever
 * written by this app's own typed content modules, so a shallow "is it a
 * non-null object" guard is enough to avoid rendering something broken if
 * a future write is ever malformed — real field-level mistakes are a
 * TypeScript error at the write site, not a runtime concern here. */
export function parseSalesPageContent(value: unknown): SalesPageContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as SalesPageContent;
}
