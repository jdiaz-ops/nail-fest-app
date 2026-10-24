// Shapes and helpers the library (nailfest.lat/biblioteca) and the
// instructors' pages (nailfest.lat/instructoras) share between the public
// pages, their admin (/admin/biblioteca) and the tests. No database here:
// client components import it too.

import { normalizeText, type ProductIconKind } from "@/lib/cuponera/shared";

// ── Themes and levels ──────────────────────────────────────────────────────
//
// The eight themes a video can be about — the content plan agreed on
// 2026-10-24, so the library isn't only techniques. Keys are stored in
// LibraryVideo.theme: don't rename them.

export type LibraryThemeIcon = "brush" | "coin" | "shield" | "bottle" | "warning" | "sparkle" | "star" | "person";

export const LIBRARY_THEMES = [
  { key: "tecnicas", label: "Técnicas", icon: "brush", tile: "bib-tone-mint" },
  { key: "negocio", label: "Negocio", icon: "coin", tile: "bib-tone-sand" },
  { key: "bioseguridad", label: "Salud y bioseguridad", icon: "shield", tile: "bib-tone-green" },
  { key: "productos", label: "Productos", icon: "bottle", tile: "bib-tone-rose" },
  { key: "errores", label: "Errores y mitos", icon: "warning", tile: "bib-tone-peach" },
  { key: "transformaciones", label: "Transformaciones", icon: "sparkle", tile: "bib-tone-lilac" },
  { key: "tendencias", label: "Tendencias", icon: "star", tile: "bib-tone-sky" },
  { key: "personas", label: "Personas", icon: "person", tile: "bib-tone-stone" },
] as const satisfies readonly { key: string; label: string; icon: LibraryThemeIcon; tile: string }[];

export type LibraryTheme = (typeof LIBRARY_THEMES)[number]["key"];

export function isTheme(value: unknown): value is LibraryTheme {
  return LIBRARY_THEMES.some((t) => t.key === value);
}

export function themeOf(key: LibraryTheme) {
  return LIBRARY_THEMES.find((t) => t.key === key)!;
}

export const LIBRARY_LEVELS = [
  { key: "principiante", label: "Principiante" },
  { key: "intermedio", label: "Intermedio" },
  { key: "avanzado", label: "Avanzado" },
] as const;

export type LibraryLevel = (typeof LIBRARY_LEVELS)[number]["key"];

export function isLevel(value: unknown): value is LibraryLevel {
  return LIBRARY_LEVELS.some((l) => l.key === value);
}

export function levelLabel(key: LibraryLevel): string {
  return LIBRARY_LEVELS.find((l) => l.key === key)!.label;
}

/** A short vertical video, or the long recording of a marathon. */
export type LibraryVideoKind = "video" | "maraton";

export function isKind(value: unknown): value is LibraryVideoKind {
  return value === "video" || value === "maraton";
}

// Slugs the pages under /biblioteca and /instructoras already use
// ("shorties" is the cortos' old address).
export const RESERVED_VIDEO_SLUGS = ["buscar", "registro", "cortos", "shorties"];
// The directory's own pages under /instructoras/ (the portal, its sign-up
// and login, the terms) — never an instructor's address.
export const RESERVED_INSTRUCTOR_SLUGS = ["solicitud", "unirme", "entrar", "portal", "clave", "terminos"];
// Invented examples (lib/library/samples.ts) live under this prefix, so a
// real video or instructor never takes one of their addresses.
export const SAMPLE_SLUG_PREFIX = "ejemplo-";

// ── Topics ──────────────────────────────────────────────────────────────────
//
// A video's topics ("Polygel", "Nail art"…), on top of its theme: each chip
// opens the cortos of that topic (/biblioteca/cortos?tema=polygel), and a
// theme works the same way (?tema=tecnicas). The usual ones are offered as
// chips; the team can write others.

export const VIDEO_TAG_SUGGESTIONS = [
  "Polygel",
  "Acrílico",
  "Semipermanente",
  "Nail art",
  "Manicura rusa",
  "Esculpidas",
  "Francesa",
  "Retiro",
  "Pedicura",
  "Spa de manos",
] as const;
export const VIDEO_TAGS_UP_TO = 6;

/** A topic's address: "Nail art" → "nail-art". */
export function topicKey(text: string): string {
  return normalizeText(text).replace(/ /g, "-");
}

/** Topics as stored: tidy, without repeats (accents and case aside), up to six. */
export function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    const key = topicKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= VIDEO_TAGS_UP_TO) break;
  }
  return out;
}

/** A video is in a topic by its theme or by one of its tags. */
export function hasTopic(video: { theme: string; tags: readonly string[] }, key: string): boolean {
  return video.theme === key || video.tags.some((t) => topicKey(t) === key);
}

export interface CortosTopic {
  key: string;
  label: string;
  count: number;
}

/** The topics some videos are in, the most videos first — a theme by its
 * name, a tag as the videos write it. */
export function topicsOf(videos: { theme: string; tags: readonly string[] }[]): CortosTopic[] {
  const topics = new Map<string, CortosTopic>();
  for (const video of videos) {
    const keys = new Map<string, string>();
    const theme = LIBRARY_THEMES.find((t) => t.key === video.theme);
    if (theme) keys.set(theme.key, theme.label);
    for (const tag of video.tags) {
      const key = topicKey(tag);
      if (key && !keys.has(key)) keys.set(key, LIBRARY_THEMES.find((t) => t.key === key)?.label ?? tag);
    }
    for (const [key, label] of keys) {
      const topic = topics.get(key);
      if (topic) topic.count++;
      else topics.set(key, { key, label, count: 1 });
    }
  }
  return [...topics.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

// ── YouTube ─────────────────────────────────────────────────────────────────

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** The video id from whatever the admin pastes: a watch, Shorts, youtu.be,
 * embed or live link, or the bare id. null = not a YouTube video. */
export function youtubeIdFrom(input: string): string | null {
  const text = input.trim();
  if (YOUTUBE_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(?:www|m|music)\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  const v = url.searchParams.get("v");
  if (v && YOUTUBE_ID.test(v)) return v;
  const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  return match ? match[1]! : null;
}

/** YouTube's own still of the video (480×360; a Short sits in the middle). */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** The privacy-enhanced player: no YouTube cookies until it's played. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
}

/** Shorties' player when YouTube's script can't load: starts silent (what
 * browsers allow on their own), loops, and keeps YouTube's controls for the sound. */
export function youtubeLoopEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&rel=0&playsinline=1&modestbranding=1`;
}

// ── Durations and views ────────────────────────────────────────────────────

/** "0:48" or "1:02:30" (or plain seconds) → seconds; null when empty or
 * not a duration. */
export function parseDuration(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text) > 0 ? Number(text) : null;
  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((n) => n > 59)) return null;
  const seconds = numbers.reduce((total, n) => total * 60 + n, 0);
  return seconds > 0 ? seconds : null;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** A recording's length in words: "3 horas", "1 h 30 min", "45 min". */
export function formatLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${Math.max(1, m)} min`;
  if (m === 0) return h === 1 ? "1 hora" : `${h} horas`;
  return `${h} h ${m} min`;
}

// Page views count from this many on; fewer reads worse than nothing.
export const VIEWS_SHOWN_FROM = 100;

/** "350 vistas", "1,2 mil vistas", "21 mil vistas", "1,5 M de vistas". */
export function formatViews(count: number): string {
  const one = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  if (count < 1000) return count === 1 ? "1 vista" : `${count} vistas`;
  if (count < 1_000_000) return `${one(Math.floor(count / 100) / 10)} mil vistas`;
  return `${one(Math.floor(count / 100_000) / 10)} M de vistas`;
}

// ── People ─────────────────────────────────────────────────────────────────

/** One of eight gradients (globals.css .bib-ph-1…8) for a face with no
 * photo yet — always the same one for the same person. */
export function toneOf(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 8) + 1;
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "·";
}

/** "@ana.unas", "instagram.com/ana.unas/" or "ana.unas" → "ana.unas". */
export function handleOf(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(?:www\.)?(?:instagram\.com|tiktok\.com)\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]!
    .replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,40}$/.test(text) ? text : null;
}

// ── What the pages render ──────────────────────────────────────────────────

/** "Lo que usó", as stored in LibraryVideo.products. */
export interface UsedProductRef {
  cuponeraProductId: string | null;
  brand: string;
  name: string;
}

export function usedProductRefsOf(value: unknown): UsedProductRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): UsedProductRef | null => {
      if (!item || typeof item !== "object") return null;
      const { cuponeraProductId, brand, name } = item as Record<string, unknown>;
      if (typeof name !== "string" || !name.trim()) return null;
      return {
        cuponeraProductId: typeof cuponeraProductId === "string" && cuponeraProductId ? cuponeraProductId : null,
        brand: typeof brand === "string" ? brand.trim() : "",
        name: name.trim(),
      };
    })
    .filter((p): p is UsedProductRef => p !== null);
}

/** A product as the video page shows it: with the cuponera's discount, code
 * and store link when it's there (and the cuponera is public). */
export interface UsedProduct {
  key: string;
  brand: string;
  name: string;
  imageUrl: string | null;
  icon: ProductIconKind;
  color: string;
  tint: string;
  discountPercent: number | null;
  code: string | null;
  /** The store with Nail Fest's code; null = no link (not in the cuponera, or an example). */
  url: string | null;
}

export interface LibraryPerson {
  /** null = her profile isn't public: the name shows without a link. */
  slug: string | null;
  name: string;
  /** What shows on her gradient while there's no photo. */
  initial: string;
  city: string;
  photoUrl: string | null;
  tone: number;
  featured: boolean;
}

export interface LibraryVideoCard {
  id: string;
  slug: string;
  kind: LibraryVideoKind;
  title: string;
  description: string | null;
  theme: LibraryTheme;
  level: LibraryLevel;
  /** null only for the invented examples. */
  youtubeId: string | null;
  durationSeconds: number | null;
  instructor: LibraryPerson | null;
  teachersNote: string | null;
  /** Its topics ("Polygel"…) — see topicsOf(). */
  tags: string[];
  gated: boolean;
  /** ISO date. */
  publishedAt: string;
  views: number;
  weekViews: number;
  /** One of the invented examples (staff only). */
  sample: boolean;
}

export interface InstructorCard extends LibraryPerson {
  id: string;
  slug: string;
  bio: string | null;
  specialties: string[];
  instagram: string | null;
  tiktok: string | null;
  /** Her channel: "@handle" or "channel/UC…" (lib/library/portal.ts). */
  youtube: string | null;
  /** A WhatsApp for students, when she gave one. */
  whatsapp: string | null;
  /** Also teaches online. */
  online: boolean;
  /** The "Instructora invitada Nail Fest" seal. */
  invited: boolean;
  appearances: string[];
  videoCount: number;
  sample: boolean;
}

/** A short in the Shorties feed: the video and what its buttons open. */
export interface ShortItem {
  video: LibraryVideoCard;
  products: UsedProduct[];
  /** Its page has a step by step ("Paso a paso" links there). */
  hasSteps: boolean;
}

// A sign-up card every this many shorties, for whoever hasn't signed up.
export const SHORTIES_SIGNUP_EVERY = 6;
// The public sees the way into Shorties (the front page's box, the menu)
// from this many real shorties on; staff always, filled with examples.
export const SHORTIES_SHOWN_FROM = 3;

/** A new order, at random (Fisher–Yates). */
export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Shorties' order: the shared one first (?v=), the rest at random. */
export function shortiesOrder(items: ShortItem[], first: string | null, random: () => number = Math.random): ShortItem[] {
  const lead = first ? items.find((i) => i.video.slug === first) : undefined;
  const rest = shuffled(
    items.filter((i) => i !== lead),
    random,
  );
  return lead ? [lead, ...rest] : rest;
}

export type ShortiesSlide = { kind: "video"; item: ShortItem } | { kind: "signup"; key: string } | { kind: "end" };

/** The feed: the shorties, a sign-up card after every `signupEvery` (never
 * last), and the end. */
export function shortiesSlides(items: ShortItem[], signupEvery: number | null): ShortiesSlide[] {
  const slides: ShortiesSlide[] = [];
  items.forEach((item, i) => {
    slides.push({ kind: "video", item });
    if (signupEvery && (i + 1) % signupEvery === 0 && i < items.length - 1) slides.push({ kind: "signup", key: `signup-${i}` });
  });
  if (items.length > 0) slides.push({ kind: "end" });
  return slides;
}

/** The menu of the library and the instructors' pages: only what this
 * viewer can open. */
export interface LibraryMenuData {
  library: boolean;
  instructors: boolean;
  cuponera: boolean;
  /** The Consultorio, once it's public. */
  consultorio: boolean;
  /** Nail Fest's homepage as the community's home (OrgSettings.
   * homepageCommunity) — where it is; null while it's not on. The team
   * goes to its preview. */
  communityHome: string | null;
  shorties: boolean;
  /** "Lo nuevo", the levels: there are short videos. */
  videos: boolean;
  mostViewed: boolean;
  recordings: boolean;
  signup: boolean;
  popularSearches: string[];
  themes: { key: LibraryTheme; label: string; icon: LibraryThemeIcon; tile: string; count: number }[];
  people: { slug: string; name: string; initial: string; photoUrl: string | null; tone: number; city: string }[];
  cities: string[];
  sections: { badge: boolean; themes: boolean; levels: boolean; instructors: boolean; cities: boolean };
  texts: {
    sectionsTitle: string;
    home: string;
    shorties: string;
    badge: string;
    newest: string;
    mostViewed: string;
    recordings: string;
    directory: string;
    cuponera: string;
    themesTitle: string;
    levelsTitle: string;
    instructorsTitle: string;
    seeAll: string;
    citiesTitle: string;
    searchPlaceholder: string;
    directorySearchPlaceholder: string;
    signupTitle: string;
    signupText: string;
    signupButton: string;
  };
}

/** Search words: accent-free, lowercase, in order. */
export function queryWords(query: string): string[] {
  return normalizeText(query).split(" ").filter(Boolean);
}

/** The real ones, then — for staff only — invented examples up to `upTo`,
 * so a page that's still filling up shows what it'll look like. */
export function withExamples<T>(real: T[], examples: T[], upTo: number, staff: boolean): T[] {
  if (!staff) return real;
  return [...real, ...examples.slice(0, Math.max(0, upTo - real.length))];
}
