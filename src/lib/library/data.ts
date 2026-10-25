import type { CuponeraBrand, CuponeraProduct as CuponeraProductRow, Instructor, LibraryVideo, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getOrgSettings } from "@/lib/settings";
import { getCuponeraSettings } from "@/lib/cuponera/settings";
import { getCuponeraView } from "@/lib/cuponera/data";
import { SAMPLE_PRODUCTS } from "@/lib/cuponera/sampleData";
import { classifyProduct, lookFor, type CuponeraProduct } from "@/lib/cuponera/shared";
import { hasLibraryAccess } from "./access";
import { getLibrarySettings, libraryConfigOf, type LibraryConfig } from "./settings";
import { sampleInstructors, sampleVideoDetail, sampleVideos } from "./samples";
import { rankBy } from "./search";
import {
  LIBRARY_THEMES,
  SAMPLE_SLUG_PREFIX,
  SHORTIES_SHOWN_FROM,
  SUBCATEGORY_SHOWN_FROM,
  isKind,
  initialOf,
  isTheme,
  queryWords,
  themeOf,
  themesOf,
  toneOf,
  topicsOf,
  usedProductRefsOf,
  withExamples,
  type CortosTopic,
  type InstructorCard,
  type LibraryMenuData,
  type LibraryPerson,
  type LibrarySubcategoryRef,
  type LibraryTheme,
  type LibraryVideoCard,
  type LibraryVideoKind,
  type ShortItem,
  type UsedProduct,
  type UsedProductRef,
} from "./shared";

// What nailfest.lat/biblioteca and nailfest.lat/instructoras read, with one
// rule for who sees what: visitors see the real, visible content once each
// page is published in /admin/biblioteca; staff see everything, always, plus
// the invented examples (lib/library/samples.ts) filling the sections that
// don't have enough yet.

const DAY_MS = 86_400_000;
// Colombia has no DST: Bogotá is always UTC−5.
const BOGOTA_OFFSET_MS = 5 * 3_600_000;

// How many each section shows while it fills up with examples (staff only).
const NEWEST_UP_TO = 8;
const MOST_VIEWED_UP_TO = 8;
const MOST_VIEWED_FROM = 3;
const RECORDINGS_UP_TO = 3;
const INSTRUCTORS_UP_TO = 8;
const RELATED_UP_TO = 6;

/** The Bogotá calendar day of a moment, as a date (UTC midnight). */
export function bogotaDay(now: Date): Date {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export interface LibraryViewer {
  staff: boolean;
  config: LibraryConfig;
  /** The cuponera is public (or this is staff): "Lo que usó" shows its
   * discounts, codes and store links. */
  cuponeraLive: boolean;
  /** Signed up (or staff): the recordings and the step by steps open. */
  unlocked: boolean;
}

export async function getLibraryViewer(): Promise<LibraryViewer> {
  const [staff, settings, cuponera] = await Promise.all([viewerCanSeeSamples(), getLibrarySettings(), getCuponeraSettings()]);
  return { staff, config: libraryConfigOf(settings), cuponeraLive: cuponera.published || staff, unlocked: staff || hasLibraryAccess() };
}

/** Indexed only once the page is public; the preview never is. */
export async function libraryRobots(page: "biblioteca" | "instructoras") {
  const settings = await getLibrarySettings();
  const published = page === "biblioteca" ? settings.published : settings.instructorsPublished;
  return published ? undefined : { index: false, follow: false };
}

// ── Videos ─────────────────────────────────────────────────────────────────

type VideoRow = LibraryVideo & { instructor: Instructor | null };

/** Who's in the directory: on in the admin, approved by the team (a
 * profile made in the portal waits for that — lib/library/portal.ts) and
 * not paused by her. */
export const listedInstructor = { visible: true, paused: false, approvedAt: { not: null } } satisfies Prisma.InstructorWhereInput;

export function isListed(instructor: Pick<Instructor, "visible" | "paused" | "approvedAt">): boolean {
  return instructor.visible && !instructor.paused && instructor.approvedAt !== null;
}

function personOf(instructor: Instructor): LibraryPerson {
  return {
    slug: isListed(instructor) ? instructor.slug : null,
    name: instructor.name,
    initial: initialOf(instructor.name),
    city: instructor.city,
    photoUrl: instructor.photoUrl,
    tone: toneOf(instructor.slug),
    featured: instructor.featured,
  };
}

async function viewCounts(ids: string[], now: Date): Promise<{ total: Map<string, number>; week: Map<string, number> }> {
  if (ids.length === 0) return { total: new Map(), week: new Map() };
  const since = new Date(bogotaDay(now).getTime() - 6 * DAY_MS);
  const [all, week] = await Promise.all([
    db.libraryVideoDailyView.groupBy({ by: ["videoId"], where: { videoId: { in: ids } }, _sum: { views: true } }),
    db.libraryVideoDailyView.groupBy({ by: ["videoId"], where: { videoId: { in: ids }, day: { gte: since } }, _sum: { views: true } }),
  ]);
  return {
    total: new Map(all.map((r) => [r.videoId, r._sum.views ?? 0])),
    week: new Map(week.map((r) => [r.videoId, r._sum.views ?? 0])),
  };
}

type SubcategoryRefs = Map<string, LibrarySubcategoryRef>;

/** The subcategories this viewer sees on the videos: not hidden and with
 * three videos or more — for staff always, for everyone once «Subcategorías»
 * is on (Editar biblioteca → Textos y secciones). */
export async function subcategoryRefs(viewer: LibraryViewer): Promise<SubcategoryRefs> {
  if (!viewer.staff && !viewer.config.sections.subcategories) return new Map();
  const [subs, counts] = await Promise.all([
    db.librarySubcategory.findMany({ where: { hidden: false } }),
    db.$queryRaw<{ key: string; n: bigint }[]>`SELECT unnest("subcategories") AS key, COUNT(*) AS n FROM "LibraryVideo" WHERE visible GROUP BY 1`,
  ]);
  const count = new Map(counts.map((c) => [c.key, Number(c.n)]));
  return new Map(
    subs
      .filter((s) => isTheme(s.theme) && (count.get(s.key) ?? 0) >= SUBCATEGORY_SHOWN_FROM)
      .map((s) => [s.key, { key: s.key, name: s.name, theme: s.theme as LibraryTheme }]),
  );
}

function toVideoCard(row: VideoRow, views: { total: Map<string, number>; week: Map<string, number> }, subs: SubcategoryRefs): LibraryVideoCard {
  return {
    id: row.id,
    slug: row.slug,
    kind: isKind(row.kind) ? row.kind : "video",
    title: row.title,
    description: row.description,
    theme: isTheme(row.theme) ? row.theme : "tecnicas",
    themes: themesOf({ theme: isTheme(row.theme) ? row.theme : "tecnicas", extraThemes: row.extraThemes }),
    subcategories: row.subcategories.map((key) => subs.get(key)).filter((s): s is LibrarySubcategoryRef => Boolean(s)),
    youtubeId: row.youtubeId,
    durationSeconds: row.durationSeconds,
    instructor: row.instructor ? personOf(row.instructor) : null,
    teachersNote: row.teachersNote,
    tags: row.tags,
    gated: row.gated,
    publishedAt: row.publishedAt.toISOString(),
    views: views.total.get(row.id) ?? 0,
    weekViews: views.week.get(row.id) ?? 0,
    sample: false,
  };
}

/** Every visible video, newest first. */
async function realVideoCards(viewer: LibraryViewer, now: Date): Promise<LibraryVideoCard[]> {
  const [rows, subs] = await Promise.all([
    db.libraryVideo.findMany({ where: { visible: true }, orderBy: { publishedAt: "desc" }, include: { instructor: true } }),
    subcategoryRefs(viewer),
  ]);
  const views = await viewCounts(
    rows.map((r) => r.id),
    now,
  );
  return rows.map((row) => toVideoCard(row, views, subs));
}

/** The pool a page draws from: the real videos and, for staff, the examples. */
async function videoPool(viewer: LibraryViewer, now: Date): Promise<{ real: LibraryVideoCard[]; examples: LibraryVideoCard[] }> {
  return { real: await realVideoCards(viewer, now), examples: viewer.staff ? sampleVideos(now) : [] };
}

export interface LibraryHome {
  /** Nothing real to show yet (staff still see the examples). */
  empty: boolean;
  newest: LibraryVideoCard[];
  mostViewed: LibraryVideoCard[];
  recordings: LibraryVideoCard[];
  /** Videos per theme; themes with none don't show. */
  themeCounts: Partial<Record<LibraryTheme, number>>;
  instructors: InstructorCard[];
  /** Real cortos (the public sees the way into Cortos from SHORTIES_SHOWN_FROM). */
  shorties: number;
  /** The cortos' topics, the most cortos first: chips to their feed. */
  cortosTopics: CortosTopic[];
}

export async function getLibraryHome(viewer: LibraryViewer, now: Date = new Date()): Promise<LibraryHome> {
  const [{ real, examples }, instructors, shorties, cortosTopics] = await Promise.all([
    videoPool(viewer, now),
    viewer.staff || viewer.config.instructorsPublished ? getInstructorCards(viewer, now) : Promise.resolve([]),
    shortiesCount(),
    getCortosTopics(viewer, now),
  ]);
  const shorts = real.filter((v) => v.kind === "video");
  const exampleShorts = examples.filter((v) => v.kind === "video");
  const byWeek = (list: LibraryVideoCard[]) => list.filter((v) => v.weekViews > 0).sort((a, b) => b.weekViews - a.weekViews);
  const ranked = byWeek(shorts);
  const mostViewed =
    ranked.length >= MOST_VIEWED_FROM ? ranked.slice(0, MOST_VIEWED_UP_TO) : viewer.staff ? withExamples(ranked, byWeek(exampleShorts), MOST_VIEWED_UP_TO, true) : [];

  const counted = withExamples(real, examples, Number.MAX_SAFE_INTEGER, viewer.staff);
  const themeCounts: Partial<Record<LibraryTheme, number>> = {};
  for (const v of counted) for (const theme of v.themes) themeCounts[theme] = (themeCounts[theme] ?? 0) + 1;

  return {
    empty: real.length === 0,
    newest: withExamples(shorts, exampleShorts, NEWEST_UP_TO, viewer.staff),
    mostViewed,
    recordings: withExamples(
      real.filter((v) => v.kind === "maraton"),
      examples.filter((v) => v.kind === "maraton"),
      RECORDINGS_UP_TO,
      viewer.staff,
    ),
    themeCounts,
    instructors,
    shorties,
    cortosTopics,
  };
}

// ── "Lo que usó" ───────────────────────────────────────────────────────────

type CuponeraRow = CuponeraProductRow & { brand: CuponeraBrand };

async function cuponeraRows(ids: string[]): Promise<Map<string, CuponeraRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db.cuponeraProduct.findMany({
    where: { id: { in: ids }, visible: true, available: true, brand: { visible: true, available: true } },
    include: { brand: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

function lookOfName(name: string) {
  const { category, subcategory } = classifyProduct({ name });
  return lookFor(category, subcategory);
}

function cuponeraIdsOf(refs: UsedProductRef[]): string[] {
  return refs.map((r) => r.cuponeraProductId).filter((id): id is string => Boolean(id));
}

/** Each product of a video: from the cuponera — its discount, code, photo
 * and store — when it's there and the cuponera is live; otherwise the
 * names the coordination wrote, without a link. */
export async function resolveUsedProducts(refs: UsedProductRef[], cuponeraLive: boolean): Promise<UsedProduct[]> {
  return resolveWith(refs, await cuponeraRows(cuponeraIdsOf(refs)), cuponeraLive);
}

function resolveWith(refs: UsedProductRef[], rows: Map<string, CuponeraRow>, cuponeraLive: boolean): UsedProduct[] {
  return refs.map((ref, index) => {
    const row = ref.cuponeraProductId ? rows.get(ref.cuponeraProductId) : undefined;
    if (row && cuponeraLive) {
      return {
        key: `${row.id}-${index}`,
        brand: row.brand.name,
        name: row.name,
        imageUrl: row.imageUrl,
        ...lookOfName(row.name),
        discountPercent: Number(row.brand.discountPercent),
        code: row.brand.discountCode,
        url: row.url,
      };
    }
    return {
      key: `ref-${index}`,
      brand: ref.brand,
      name: ref.name,
      imageUrl: cuponeraLive ? (row?.imageUrl ?? null) : null,
      ...lookOfName(ref.name),
      discountPercent: null,
      code: null,
      url: null,
    };
  });
}

// ── A video's page ─────────────────────────────────────────────────────────

export interface LibraryVideoPage {
  video: LibraryVideoCard;
  /** Hidden in the admin: only staff get here, with a note. */
  hidden: boolean;
  products: UsedProduct[];
  steps: string[];
  related: LibraryVideoCard[];
}

/** Its subcategory's first, then the ones that share a theme, then the rest. */
function relatedTo(video: LibraryVideoCard, pool: LibraryVideoCard[]): LibraryVideoCard[] {
  const others = pool.filter((v) => v.id !== video.id && v.kind === "video");
  const closeness = (v: LibraryVideoCard) =>
    (v.subcategories.some((s) => video.subcategories.some((x) => x.key === s.key)) ? 2 : 0) + (v.themes.some((t) => video.themes.includes(t)) ? 1 : 0);
  return others
    .map((v, index) => ({ v, index, score: closeness(v) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, RELATED_UP_TO)
    .map((x) => x.v);
}

export async function getLibraryVideoPage(slug: string, viewer: LibraryViewer, now: Date = new Date()): Promise<LibraryVideoPage | null> {
  if (slug.startsWith(SAMPLE_SLUG_PREFIX)) {
    const sample = viewer.staff ? sampleVideoDetail(slug, now) : null;
    if (!sample) return null;
    const { real, examples } = await videoPool(viewer, now);
    return { video: sample.card, hidden: false, products: sample.products, steps: sample.steps, related: relatedTo(sample.card, [...real, ...examples]) };
  }

  const row = await db.libraryVideo.findUnique({ where: { slug }, include: { instructor: true } });
  if (!row || (!row.visible && !viewer.staff)) return null;
  const [views, products, pool, subs] = await Promise.all([
    viewCounts([row.id], now),
    resolveUsedProducts(usedProductRefsOf(row.products), viewer.cuponeraLive),
    videoPool(viewer, now),
    subcategoryRefs(viewer),
  ]);
  const video = toVideoCard(row, views, subs);
  const related = relatedTo(video, pool.real);
  return {
    video,
    hidden: !row.visible,
    products,
    steps: row.steps,
    related: withExamples(related, relatedTo(video, pool.examples), RELATED_UP_TO, viewer.staff),
  };
}

export async function recordVideoView(videoId: string, now: Date = new Date()): Promise<boolean> {
  const video = await db.libraryVideo.findUnique({ where: { id: videoId }, select: { visible: true } });
  if (!video?.visible) return false;
  const day = bogotaDay(now);
  await db.libraryVideoDailyView.upsert({
    where: { videoId_day: { videoId, day } },
    update: { views: { increment: 1 } },
    create: { videoId, day, views: 1 },
  });
  return true;
}

// ── Cortos ("Shorties" until 2026-10-24) ────────────────────────────────────

const SHORTIES_EXAMPLES_UP_TO = 12;
const shortiesWhere = { visible: true, kind: "video", inShorties: true } satisfies Prisma.LibraryVideoWhereInput;

/** Real cortos: whether the public sees the way into Cortos. */
export function shortiesCount(): Promise<number> {
  return db.libraryVideo.count({ where: shortiesWhere });
}

/** The topics of the cortos feed, the most cortos first — its chips (the
 * library's front page, the community home). Staff see the examples' too
 * while there are few real ones. */
export async function getCortosTopics(viewer: LibraryViewer, now: Date = new Date()): Promise<CortosTopic[]> {
  const [rows, subs] = await Promise.all([
    db.libraryVideo.findMany({ where: shortiesWhere, select: { theme: true, extraThemes: true, subcategories: true, tags: true } }),
    subcategoryRefs(viewer),
  ]);
  const examples = viewer.staff && rows.length < SHORTIES_EXAMPLES_UP_TO ? sampleVideos(now).filter((v) => v.kind === "video") : [];
  const real = rows.map((r) => ({ ...r, subcategories: r.subcategories.map((key) => subs.get(key)).filter((x): x is LibrarySubcategoryRef => Boolean(x)) }));
  return topicsOf([...real, ...examples]);
}

/** Every short of the feed, newest first (the page shuffles them), with its
 * products from one cuponera query — and, for staff, the examples up to twelve. */
export async function getShorties(viewer: LibraryViewer, now: Date = new Date()): Promise<ShortItem[]> {
  const rows = await db.libraryVideo.findMany({ where: shortiesWhere, orderBy: { publishedAt: "desc" }, include: { instructor: true } });
  const refs = rows.map((r) => usedProductRefsOf(r.products));
  const [views, cuponera, subs] = await Promise.all([
    viewCounts(
      rows.map((r) => r.id),
      now,
    ),
    cuponeraRows(cuponeraIdsOf(refs.flat())),
    subcategoryRefs(viewer),
  ]);
  const items = rows.map(
    (row, i): ShortItem => ({ video: toVideoCard(row, views, subs), products: resolveWith(refs[i]!, cuponera, viewer.cuponeraLive), hasSteps: row.steps.length > 0 }),
  );
  const examples = viewer.staff
    ? sampleVideos(now)
        .filter((v) => v.kind === "video")
        .map((card): ShortItem => {
          const detail = sampleVideoDetail(card.slug, now);
          return { video: card, products: detail?.products ?? [], hasSteps: (detail?.steps.length ?? 0) > 0 };
        })
    : [];
  return withExamples(items, examples, SHORTIES_EXAMPLES_UP_TO, viewer.staff);
}

// ── The menu ───────────────────────────────────────────────────────────────

const MENU_PEOPLE_UP_TO = 8;

async function menuVideoFacts(viewer: LibraryViewer, now: Date) {
  const since = new Date(bogotaDay(now).getTime() - 6 * DAY_MS);
  const [themed, byKind, watched, shorties] = await Promise.all([
    db.libraryVideo.findMany({ where: { visible: true }, select: { theme: true, extraThemes: true } }),
    db.libraryVideo.groupBy({ by: ["kind"], where: { visible: true }, _count: { _all: true } }),
    db.libraryVideoDailyView.groupBy({ by: ["videoId"], where: { day: { gte: since }, views: { gt: 0 }, video: { visible: true, kind: "video" } } }),
    shortiesCount(),
  ]);
  // A video counts in each of its themes.
  const themeCounts = new Map<string, number>();
  for (const v of [...themed, ...(viewer.staff ? sampleVideos(now) : [])]) for (const theme of themesOf(v)) themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
  const kinds = new Map<string, number>(byKind.map((r) => [r.kind, r._count._all]));
  return { themeCounts, shorts: kinds.get("video") ?? 0, recordings: kinds.get("maraton") ?? 0, watched: watched.length, shorties };
}

/** The menu of every page of the library and the instructors' directory:
 * the sections and the ways to search this viewer can open. */
export async function getLibraryMenu(viewer: LibraryViewer, now: Date = new Date()): Promise<LibraryMenuData> {
  const { texts, sections, popularSearches } = viewer.config;
  const library = viewer.staff || viewer.config.published;
  const instructors = viewer.staff || viewer.config.instructorsPublished;
  const [facts, people, org] = await Promise.all([
    library ? menuVideoFacts(viewer, now) : Promise.resolve(null),
    instructors ? getInstructorCards(viewer, now) : Promise.resolve([] as InstructorCard[]),
    getOrgSettings(),
  ]);
  const themes = facts
    ? LIBRARY_THEMES.filter((t) => (facts.themeCounts.get(t.key) ?? 0) > 0).map((t) => ({ key: t.key, label: t.label, icon: t.icon, tile: t.tile, count: facts.themeCounts.get(t.key) ?? 0 }))
    : [];
  return {
    library,
    instructors,
    cuponera: viewer.cuponeraLive,
    consultorio: viewer.staff || viewer.config.consultorioPublished,
    communityHome: org.homepageCommunity ? "/" : viewer.staff ? "/?vista=comunidad" : null,
    // The site's menu fills these in (lib/community/home.ts getSiteMenu).
    event: null,
    account: null,
    brands: [],
    shorties: Boolean(facts) && (viewer.staff || (sections.shorties && facts!.shorties >= SHORTIES_SHOWN_FROM)),
    videos: Boolean(facts) && sections.newest && (viewer.staff || facts!.shorts > 0),
    mostViewed: Boolean(facts) && sections.mostViewed && (viewer.staff || facts!.watched >= MOST_VIEWED_FROM),
    recordings: Boolean(facts) && sections.recordings && (viewer.staff || facts!.recordings > 0),
    signup: library && sections.menuSignup && (viewer.staff || !viewer.unlocked),
    popularSearches: library ? popularSearches : [],
    themes,
    people: people.slice(0, MENU_PEOPLE_UP_TO).map((p) => ({ slug: p.slug, name: p.name, initial: p.initial, photoUrl: p.photoUrl, tone: p.tone, city: p.city })),
    cities: [...new Set(people.map((p) => p.city))].sort((a, b) => a.localeCompare(b, "es")),
    sections: { badge: sections.shortiesBadge, themes: sections.menuThemes, instructors: sections.menuInstructors, cities: sections.menuCities },
    texts: {
      sectionsTitle: texts.menuSectionsTitle,
      home: texts.menuHome,
      libraryHint: texts.menuLibraryHint,
      shorties: texts.shortiesTitle,
      badge: texts.shortiesBadgeLabel,
      newest: texts.newestTitle,
      mostViewed: texts.menuMostViewed,
      recordings: texts.menuRecordings,
      directory: texts.menuDirectory,
      cuponera: texts.menuCuponera,
      themesTitle: texts.menuThemesTitle,
      instructorsTitle: texts.menuInstructorsTitle,
      seeAll: texts.menuSeeAll,
      citiesTitle: texts.menuCitiesTitle,
      searchPlaceholder: texts.searchPlaceholder,
      directorySearchPlaceholder: texts.directorySearchPlaceholder,
      signupTitle: texts.signupTitle,
      signupText: texts.signupText,
      signupButton: texts.signupButton,
    },
  };
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface LibrarySearchParams {
  query: string;
  theme: LibraryTheme | null;
  /** A subcategory's key (?sub=navidad), inside the theme. */
  sub: string | null;
  kind: LibraryVideoKind | null;
}

export interface LibrarySearchResult {
  videos: LibraryVideoCard[];
  /** The chosen theme's subcategories in sight, the most videos first. */
  subcategories: { key: string; name: string; count: number }[];
  instructors: InstructorCard[];
  /** From the cuponera, only while it's live. */
  products: CuponeraProduct[];
}

const PRODUCTS_SHOWN = 6;

export function searchParamsOf(raw: Record<string, string | string[] | undefined>): LibrarySearchParams {
  const one = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value)?.slice(0, 120) ?? "";
  };
  const theme = one("tema");
  const sub = one("sub").toLowerCase();
  const kind = one("tipo");
  return { query: one("q").trim(), theme: isTheme(theme) ? theme : null, sub: /^[a-z0-9-]{2,60}$/.test(sub) ? sub : null, kind: isKind(kind) ? kind : null };
}

export async function searchLibrary(params: LibrarySearchParams, viewer: LibraryViewer, now: Date = new Date()): Promise<LibrarySearchResult> {
  const words = queryWords(params.query);
  const { real, examples } = await videoPool(viewer, now);
  const inTheme = [...real, ...examples].filter((v) => (!params.theme || v.themes.includes(params.theme)) && (!params.kind || v.kind === params.kind));
  const subcategories = new Map<string, { key: string; name: string; count: number }>();
  if (params.theme) {
    for (const v of inTheme) {
      for (const s of v.subcategories) {
        if (s.theme !== params.theme) continue;
        const known = subcategories.get(s.key);
        if (known) known.count++;
        else subcategories.set(s.key, { key: s.key, name: s.name, count: 1 });
      }
    }
  }
  const pool = params.sub ? inTheme.filter((v) => v.subcategories.some((s) => s.key === params.sub)) : inTheme;
  const videos = words.length
    ? rankBy(pool, words, (v) => [
        { text: v.title, weight: 5 },
        { text: v.tags.join(" "), weight: 4 },
        { text: v.subcategories.map((s) => s.name).join(" "), weight: 4 },
        { text: v.themes.map((t) => themeOf(t).label).join(" "), weight: 3 },
        { text: v.instructor?.name, weight: 3 },
        { text: v.description, weight: 1 },
        { text: v.teachersNote, weight: 1 },
      ])
    : pool;

  const subs = [...subcategories.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  if (!words.length) return { videos, subcategories: subs, instructors: [], products: [] };

  const [instructors, products] = await Promise.all([
    viewer.staff || viewer.config.instructorsPublished
      ? getInstructorCards(viewer, now).then((cards) =>
          rankBy(cards, words, (i) => [
            { text: i.name, weight: 5 },
            { text: i.city, weight: 3 },
            { text: i.specialties.join(" "), weight: 3 },
            { text: i.bio, weight: 1 },
          ]),
        )
      : Promise.resolve([]),
    viewer.cuponeraLive ? cuponeraProductsFor(words, viewer.staff, now) : Promise.resolve([]),
  ]);
  return { videos, subcategories: subs, instructors, products };
}

async function cuponeraProductsFor(words: string[], staff: boolean, now: Date): Promise<CuponeraProduct[]> {
  const view = await getCuponeraView(now);
  // Before the first sync only staff get here, and they see the cuponera's examples.
  const catalog = view ? view.products : staff ? SAMPLE_PRODUCTS : [];
  return rankBy(catalog, words, (p) => [
    { text: p.name, weight: 3 },
    { text: p.brand, weight: 2 },
    { text: p.line, weight: 1 },
  ]).slice(0, PRODUCTS_SHOWN);
}

// ── Instructors ────────────────────────────────────────────────────────────

function toInstructorCard(row: Instructor, videoCount: number): InstructorCard {
  return {
    ...personOf(row),
    slug: row.slug,
    id: row.id,
    bio: row.bio,
    specialties: row.specialties,
    instagram: row.instagram,
    tiktok: row.tiktok,
    youtube: row.youtube,
    whatsapp: row.whatsapp,
    online: row.online,
    invited: row.invited,
    appearances: row.appearances,
    videoCount,
    sample: false,
  };
}

/** The instructors in the directory — the featured first, then the most
 * active — and, for staff, the examples up to eight. */
export async function getInstructorCards(viewer: LibraryViewer, now: Date = new Date()): Promise<InstructorCard[]> {
  const rows = await db.instructor.findMany({
    where: listedInstructor,
    include: { _count: { select: { videos: { where: { visible: true } } } } },
  });
  const cards: InstructorCard[] = rows.map((row) => toInstructorCard(row, row._count.videos));
  cards.sort((a, b) => Number(b.featured) - Number(a.featured) || b.videoCount - a.videoCount || a.name.localeCompare(b.name, "es"));
  return withExamples(cards, viewer.staff ? sampleInstructors(now) : [], INSTRUCTORS_UP_TO, viewer.staff);
}

/** A brand of the cuponera in an instructor's videos ("Lo que usa en sus videos"). */
export interface ProfileBrand {
  key: string;
  name: string;
  logoUrl: string | null;
  discountPercent: number;
  code: string;
  /** Its store with Nail Fest's code; null for the examples. */
  url: string | null;
}

export interface InstructorProfile {
  instructor: InstructorCard;
  /** Why it isn't in the directory (hidden, waiting for approval, paused),
   * for the staff and for her own preview; null when it is. */
  hidden: string | null;
  videos: LibraryVideoCard[];
  brands: ProfileBrand[];
}

/** Why a profile isn't in the directory, in words. */
function hiddenReason(row: Instructor): string | null {
  if (!row.visible) return "Este perfil está oculto.";
  if (!row.approvedAt) return row.submittedAt ? "Este perfil espera la aprobación del equipo." : "Este perfil todavía no se envía a revisión.";
  if (row.paused) return "Este perfil está pausado por la instructora.";
  return null;
}

function brandsOf(products: UsedProduct[]): ProfileBrand[] {
  const seen = new Map<string, ProfileBrand>();
  for (const p of products) {
    if (p.discountPercent == null || !p.code || seen.has(p.brand)) continue;
    seen.set(p.brand, { key: p.brand, name: p.brand, logoUrl: null, discountPercent: p.discountPercent, code: p.code, url: p.url });
  }
  return [...seen.values()];
}

/** A profile; one outside the directory only for staff, or for its own
 * instructor (`owner`: her preview from the portal). */
export async function getInstructorProfile(slug: string, viewer: LibraryViewer, now: Date = new Date(), owner = false): Promise<InstructorProfile | null> {
  if (slug.startsWith(SAMPLE_SLUG_PREFIX)) {
    if (!viewer.staff) return null;
    const instructor = sampleInstructors(now).find((i) => i.slug === slug);
    if (!instructor) return null;
    const videos = sampleVideos(now).filter((v) => v.instructor?.slug === slug);
    const products = videos.flatMap((v) => sampleVideoDetail(v.slug, now)?.products ?? []);
    return { instructor, hidden: null, videos, brands: brandsOf(products) };
  }

  const row = await db.instructor.findUnique({
    where: { slug },
    include: { videos: { where: { visible: true }, orderBy: { publishedAt: "desc" }, include: { instructor: true } } },
  });
  if (!row || (!isListed(row) && !viewer.staff && !owner)) return null;
  const [views, subs] = await Promise.all([
    viewCounts(
      row.videos.map((v) => v.id),
      now,
    ),
    subcategoryRefs(viewer),
  ]);
  const products = await resolveUsedProducts(
    row.videos.flatMap((v) => usedProductRefsOf(v.products)),
    viewer.cuponeraLive,
  );
  return {
    instructor: toInstructorCard(row, row.videos.length),
    hidden: hiddenReason(row),
    videos: row.videos.map((v) => toVideoCard(v, views, subs)),
    brands: brandsOf(products),
  };
}
