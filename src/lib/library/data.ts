import type { CuponeraBrand, CuponeraProduct as CuponeraProductRow, Instructor, LibraryVideo } from "@prisma/client";
import { db } from "@/lib/db";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getCuponeraSettings } from "@/lib/cuponera/settings";
import { getCuponeraView } from "@/lib/cuponera/data";
import { SAMPLE_PRODUCTS } from "@/lib/cuponera/sampleData";
import { classifyProduct, lookFor, type CuponeraProduct } from "@/lib/cuponera/shared";
import { hasLibraryAccess } from "./access";
import { getLibrarySettings, libraryConfigOf, type LibraryConfig } from "./settings";
import { sampleInstructorClasses, sampleInstructors, sampleVideoDetail, sampleVideos } from "./samples";
import { rankBy } from "./search";
import {
  SAMPLE_SLUG_PREFIX,
  isKind,
  isLevel,
  initialOf,
  isTheme,
  queryWords,
  themeOf,
  levelLabel,
  toneOf,
  usedProductRefsOf,
  withExamples,
  type InstructorCard,
  type InstructorClassItem,
  type LibraryLevel,
  type LibraryPerson,
  type LibraryTheme,
  type LibraryVideoCard,
  type LibraryVideoKind,
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

function personOf(instructor: Instructor): LibraryPerson {
  return {
    slug: instructor.visible ? instructor.slug : null,
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

function toVideoCard(row: VideoRow, views: { total: Map<string, number>; week: Map<string, number> }): LibraryVideoCard {
  return {
    id: row.id,
    slug: row.slug,
    kind: isKind(row.kind) ? row.kind : "video",
    title: row.title,
    description: row.description,
    theme: isTheme(row.theme) ? row.theme : "tecnicas",
    level: isLevel(row.level) ? row.level : "principiante",
    youtubeId: row.youtubeId,
    durationSeconds: row.durationSeconds,
    instructor: row.instructor ? personOf(row.instructor) : null,
    teachersNote: row.teachersNote,
    gated: row.gated,
    publishedAt: row.publishedAt.toISOString(),
    views: views.total.get(row.id) ?? 0,
    weekViews: views.week.get(row.id) ?? 0,
    sample: false,
  };
}

/** Every visible video, newest first. */
async function realVideoCards(now: Date): Promise<LibraryVideoCard[]> {
  const rows = await db.libraryVideo.findMany({ where: { visible: true }, orderBy: { publishedAt: "desc" }, include: { instructor: true } });
  const views = await viewCounts(
    rows.map((r) => r.id),
    now,
  );
  return rows.map((row) => toVideoCard(row, views));
}

/** The pool a page draws from: the real videos and, for staff, the examples. */
async function videoPool(viewer: LibraryViewer, now: Date): Promise<{ real: LibraryVideoCard[]; examples: LibraryVideoCard[] }> {
  return { real: await realVideoCards(now), examples: viewer.staff ? sampleVideos(now) : [] };
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
}

export async function getLibraryHome(viewer: LibraryViewer, now: Date = new Date()): Promise<LibraryHome> {
  const [{ real, examples }, instructors] = await Promise.all([
    videoPool(viewer, now),
    viewer.staff || viewer.config.instructorsPublished ? getInstructorCards(viewer, now) : Promise.resolve([]),
  ]);
  const shorts = real.filter((v) => v.kind === "video");
  const exampleShorts = examples.filter((v) => v.kind === "video");
  const byWeek = (list: LibraryVideoCard[]) => list.filter((v) => v.weekViews > 0).sort((a, b) => b.weekViews - a.weekViews);
  const ranked = byWeek(shorts);
  const mostViewed =
    ranked.length >= MOST_VIEWED_FROM ? ranked.slice(0, MOST_VIEWED_UP_TO) : viewer.staff ? withExamples(ranked, byWeek(exampleShorts), MOST_VIEWED_UP_TO, true) : [];

  const counted = withExamples(real, examples, Number.MAX_SAFE_INTEGER, viewer.staff);
  const themeCounts: Partial<Record<LibraryTheme, number>> = {};
  for (const v of counted) themeCounts[v.theme] = (themeCounts[v.theme] ?? 0) + 1;

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

/** Each product of a video: from the cuponera — its discount, code, photo
 * and store — when it's there and the cuponera is live; otherwise the
 * names the coordination wrote, without a link. */
export async function resolveUsedProducts(refs: UsedProductRef[], cuponeraLive: boolean): Promise<UsedProduct[]> {
  const rows = await cuponeraRows(refs.map((r) => r.cuponeraProductId).filter((id): id is string => Boolean(id)));
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

function relatedTo(video: LibraryVideoCard, pool: LibraryVideoCard[]): LibraryVideoCard[] {
  const others = pool.filter((v) => v.id !== video.id && v.kind === "video");
  return [...others.filter((v) => v.theme === video.theme), ...others.filter((v) => v.theme !== video.theme)].slice(0, RELATED_UP_TO);
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
  const [views, products, pool] = await Promise.all([
    viewCounts([row.id], now),
    resolveUsedProducts(usedProductRefsOf(row.products), viewer.cuponeraLive),
    videoPool(viewer, now),
  ]);
  const video = toVideoCard(row, views);
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

// ── Search ─────────────────────────────────────────────────────────────────

export interface LibrarySearchParams {
  query: string;
  theme: LibraryTheme | null;
  level: LibraryLevel | null;
  kind: LibraryVideoKind | null;
}

export interface LibrarySearchResult {
  videos: LibraryVideoCard[];
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
  const level = one("nivel");
  const kind = one("tipo");
  return { query: one("q").trim(), theme: isTheme(theme) ? theme : null, level: isLevel(level) ? level : null, kind: isKind(kind) ? kind : null };
}

export async function searchLibrary(params: LibrarySearchParams, viewer: LibraryViewer, now: Date = new Date()): Promise<LibrarySearchResult> {
  const words = queryWords(params.query);
  const { real, examples } = await videoPool(viewer, now);
  const pool = [...real, ...examples].filter(
    (v) => (!params.theme || v.theme === params.theme) && (!params.level || v.level === params.level) && (!params.kind || v.kind === params.kind),
  );
  const videos = words.length
    ? rankBy(pool, words, (v) => [
        { text: v.title, weight: 5 },
        { text: themeOf(v.theme).label, weight: 3 },
        { text: v.instructor?.name, weight: 3 },
        { text: v.description, weight: 1 },
        { text: levelLabel(v.level), weight: 1 },
        { text: v.teachersNote, weight: 1 },
      ])
    : pool;

  if (!words.length) return { videos, instructors: [], products: [] };

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
  return { videos, instructors, products };
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

function toClassItem(row: { id: string; title: string; startsAt: Date; place: string; priceLabel: string | null; url: string | null }): InstructorClassItem {
  return { id: row.id, title: row.title, startsAt: row.startsAt.toISOString(), place: row.place, priceLabel: row.priceLabel, url: row.url };
}

/** The visible instructors — the featured first, then the most active —
 * and, for staff, the examples up to eight. */
export async function getInstructorCards(viewer: LibraryViewer, now: Date = new Date()): Promise<InstructorCard[]> {
  const rows = await db.instructor.findMany({
    where: { visible: true },
    include: {
      _count: { select: { videos: { where: { visible: true } } } },
      classes: { where: { visible: true, startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 1 },
    },
  });
  const cards: InstructorCard[] = rows.map((row) => ({
    ...personOf(row),
    slug: row.slug,
    id: row.id,
    bio: row.bio,
    specialties: row.specialties,
    instagram: row.instagram,
    tiktok: row.tiktok,
    appearances: row.appearances,
    videoCount: row._count.videos,
    nextClass: row.classes[0] ? toClassItem(row.classes[0]) : null,
    sample: false,
  }));
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
  /** Hidden in the admin: only staff get here, with a note. */
  hidden: boolean;
  videos: LibraryVideoCard[];
  classes: InstructorClassItem[];
  brands: ProfileBrand[];
}

function brandsOf(products: UsedProduct[]): ProfileBrand[] {
  const seen = new Map<string, ProfileBrand>();
  for (const p of products) {
    if (p.discountPercent == null || !p.code || seen.has(p.brand)) continue;
    seen.set(p.brand, { key: p.brand, name: p.brand, logoUrl: null, discountPercent: p.discountPercent, code: p.code, url: p.url });
  }
  return [...seen.values()];
}

export async function getInstructorProfile(slug: string, viewer: LibraryViewer, now: Date = new Date()): Promise<InstructorProfile | null> {
  if (slug.startsWith(SAMPLE_SLUG_PREFIX)) {
    if (!viewer.staff) return null;
    const instructor = sampleInstructors(now).find((i) => i.slug === slug);
    if (!instructor) return null;
    const videos = sampleVideos(now).filter((v) => v.instructor?.slug === slug);
    const products = videos.flatMap((v) => sampleVideoDetail(v.slug, now)?.products ?? []);
    return { instructor, hidden: false, videos, classes: sampleInstructorClasses(slug, now), brands: brandsOf(products) };
  }

  const row = await db.instructor.findUnique({
    where: { slug },
    include: {
      videos: { where: { visible: true }, orderBy: { publishedAt: "desc" }, include: { instructor: true } },
      classes: { where: { visible: true, startsAt: { gte: now } }, orderBy: { startsAt: "asc" } },
    },
  });
  if (!row || (!row.visible && !viewer.staff)) return null;
  const views = await viewCounts(
    row.videos.map((v) => v.id),
    now,
  );
  const products = await resolveUsedProducts(
    row.videos.flatMap((v) => usedProductRefsOf(v.products)),
    viewer.cuponeraLive,
  );
  const classes = row.classes.map(toClassItem);
  return {
    instructor: {
      ...personOf(row),
      slug: row.slug,
      id: row.id,
      bio: row.bio,
      specialties: row.specialties,
      instagram: row.instagram,
      tiktok: row.tiktok,
      appearances: row.appearances,
      videoCount: row.videos.length,
      nextClass: classes[0] ?? null,
      sample: false,
    },
    hidden: !row.visible,
    videos: row.videos.map((v) => toVideoCard(v, views)),
    classes,
    brands: brandsOf(products),
  };
}

/** For the forms: the instructor a class booking or a brand's request is about. */
export async function instructorForForm(slug: string | null, viewer: LibraryViewer): Promise<{ slug: string; name: string; sample: boolean } | null> {
  if (!slug) return null;
  if (slug.startsWith(SAMPLE_SLUG_PREFIX)) {
    const sample = viewer.staff ? sampleInstructors().find((i) => i.slug === slug) : undefined;
    return sample ? { slug: sample.slug, name: sample.name, sample: true } : null;
  }
  const row = await db.instructor.findUnique({ where: { slug }, select: { slug: true, name: true, visible: true } });
  return row && (row.visible || viewer.staff) ? { slug: row.slug, name: row.name, sample: false } : null;
}

