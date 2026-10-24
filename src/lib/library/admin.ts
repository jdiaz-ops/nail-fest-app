import { z } from "zod";
import { db } from "@/lib/db";
import { slugify } from "@/lib/events";
import { getLibrarySettings } from "./settings";
import { resolveSections, resolveTexts } from "./texts";
import {
  LIBRARY_LEVELS,
  LIBRARY_THEMES,
  RESERVED_INSTRUCTOR_SLUGS,
  RESERVED_VIDEO_SLUGS,
  SAMPLE_SLUG_PREFIX,
  handleOf,
  parseDuration,
  usedProductRefsOf,
  youtubeIdFrom,
  type UsedProductRef,
} from "./shared";

// Editar biblioteca (/admin/biblioteca): what its screen reads, and the
// shapes its routes (/api/admin/library/*) accept.

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null));

const themeKeys = LIBRARY_THEMES.map((t) => t.key) as [string, ...string[]];
const levelKeys = LIBRARY_LEVELS.map((l) => l.key) as [string, ...string[]];

export const videoInputSchema = z.object({
  kind: z.enum(["video", "maraton"]),
  title: z.string().trim().min(3).max(140),
  /** The YouTube link (any form) or the bare id. */
  youtube: z
    .string()
    .max(300)
    .transform((v, ctx) => {
      const id = youtubeIdFrom(v);
      if (!id) ctx.addIssue({ code: "custom", message: "youtube" });
      return id ?? "";
    }),
  /** "0:48", "1:02:30" or empty. */
  duration: z
    .string()
    .max(12)
    .nullish()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const seconds = parseDuration(v);
      if (seconds === null) ctx.addIssue({ code: "custom", message: "duration" });
      return seconds;
    }),
  theme: z.enum(themeKeys),
  level: z.enum(levelKeys),
  instructorId: z.string().min(1).nullish(),
  teachersNote: optionalText(80),
  description: optionalText(1000),
  products: z
    .array(
      z.object({
        cuponeraProductId: z.string().min(1).nullish(),
        brand: z.string().trim().max(80).default(""),
        name: z.string().trim().min(1).max(160),
      }),
    )
    .max(20)
    .transform((list): UsedProductRef[] => list.map((p) => ({ cuponeraProductId: p.cuponeraProductId ?? null, brand: p.brand, name: p.name }))),
  steps: z.array(z.string().trim().min(1).max(300)).max(30),
  gated: z.boolean(),
  visible: z.boolean(),
  /** Only short videos go to Shorties; on by default. */
  inShorties: z.boolean().default(true),
});

export const instructorInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(60),
  photoUrl: z.string().url().max(600).startsWith("https://").nullish(),
  bio: optionalText(300),
  specialties: z.array(z.string().trim().min(1).max(40)).max(8),
  instagram: z
    .string()
    .max(120)
    .nullish()
    .transform((v) => handleOf(v)),
  tiktok: z
    .string()
    .max(120)
    .nullish()
    .transform((v) => handleOf(v)),
  featured: z.boolean(),
  visible: z.boolean(),
  appearances: z.array(z.string().trim().min(1).max(120)).max(12),
});

/** "2026-11-12T19:00", in Bogotá time. */
const bogotaDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .transform((v) => new Date(`${v}:00-05:00`))
  .refine((d) => !Number.isNaN(d.getTime()), "invalid date");

export const classInputSchema = z.object({
  instructorId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  startsAt: bogotaDateTime,
  place: z.string().trim().min(2).max(120),
  priceLabel: optionalText(60),
  url: z
    .string()
    .max(500)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null))
    .refine((v) => v === null || /^https:\/\/\S+$/.test(v), "https"),
  visible: z.boolean(),
});

async function uniqueSlug(base: string, fallback: string, reserved: string[], taken: (slug: string) => Promise<boolean>): Promise<string> {
  let root = slugify(base) || fallback;
  if (root.startsWith(SAMPLE_SLUG_PREFIX)) root = root.slice(SAMPLE_SLUG_PREFIX.length) || fallback;
  if (reserved.includes(root)) root = `${root}-${fallback}`;
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
}

export function uniqueVideoSlug(title: string, excludeId?: string): Promise<string> {
  return uniqueSlug(title, "video", RESERVED_VIDEO_SLUGS, async (slug) => {
    const row = await db.libraryVideo.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(row && row.id !== excludeId);
  });
}

export function uniqueInstructorSlug(name: string, excludeId?: string): Promise<string> {
  return uniqueSlug(name, "instructora", RESERVED_INSTRUCTOR_SLUGS, async (slug) => {
    const row = await db.instructor.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(row && row.id !== excludeId);
  });
}

const bogotaInput = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const classDate = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const leadDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

/** A moment as a datetime-local input's value, in Bogotá time. */
export function toBogotaInput(date: Date): string {
  return bogotaInput.format(date).replace(" ", "T");
}

export interface AdminVideo {
  id: string;
  slug: string;
  kind: string;
  title: string;
  description: string | null;
  theme: string;
  level: string;
  youtubeId: string;
  durationSeconds: number | null;
  instructorId: string | null;
  instructorName: string | null;
  teachersNote: string | null;
  products: UsedProductRef[];
  steps: string[];
  gated: boolean;
  visible: boolean;
  inShorties: boolean;
  views: number;
}

export interface AdminInstructor {
  id: string;
  slug: string;
  name: string;
  city: string;
  photoUrl: string | null;
  bio: string | null;
  specialties: string[];
  instagram: string | null;
  tiktok: string | null;
  featured: boolean;
  visible: boolean;
  appearances: string[];
  videoCount: number;
}

export interface AdminClass {
  id: string;
  instructorId: string;
  instructorName: string;
  title: string;
  startsAt: string;
  /** Written on the server, so the page the browser takes over reads the same. */
  startsAtLabel: string;
  /** For the form's datetime-local input. */
  startsAtInput: string;
  past: boolean;
  place: string;
  priceLabel: string | null;
  url: string | null;
  visible: boolean;
}

export interface AdminLead {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  company: string | null;
  message: string | null;
  instructorName: string | null;
  context: string | null;
  marketingConsent: boolean;
  handled: boolean;
  createdAt: string;
  createdAtLabel: string;
}

export interface AdminCuponeraProduct {
  id: string;
  name: string;
  brand: string;
}

export async function getLibraryAdminData() {
  const [settings, videos, instructors, classes, leads, products, views] = await Promise.all([
    getLibrarySettings(),
    db.libraryVideo.findMany({ orderBy: { publishedAt: "desc" }, include: { instructor: { select: { name: true } } } }),
    db.instructor.findMany({ orderBy: [{ featured: "desc" }, { name: "asc" }], include: { _count: { select: { videos: true } } } }),
    db.instructorClass.findMany({ orderBy: { startsAt: "desc" }, take: 200, include: { instructor: { select: { name: true } } } }),
    db.libraryLead.findMany({ orderBy: { createdAt: "desc" }, take: 500, include: { instructor: { select: { name: true } } } }),
    db.cuponeraProduct.findMany({
      where: { available: true, visible: true, brand: { visible: true, available: true } },
      select: { id: true, name: true, brand: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.libraryVideoDailyView.groupBy({ by: ["videoId"], _sum: { views: true } }),
  ]);
  const viewsById = new Map(views.map((v) => [v.videoId, v._sum.views ?? 0]));
  const now = Date.now();
  const counts = await db.libraryLead.groupBy({ by: ["kind"], where: { handled: false }, _count: { _all: true } });

  return {
    settings: {
      published: settings.published,
      instructorsPublished: settings.instructorsPublished,
      // What the admin typed, not the usual texts: an empty box is the usual one.
      texts: Object.fromEntries(
        Object.entries((settings.texts ?? {}) as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"),
      ),
      sections: resolveSections(settings.sections),
      popularSearches: settings.popularSearches,
      usual: resolveTexts({}),
    },
    videos: videos.map(
      (v): AdminVideo => ({
        id: v.id,
        slug: v.slug,
        kind: v.kind,
        title: v.title,
        description: v.description,
        theme: v.theme,
        level: v.level,
        youtubeId: v.youtubeId,
        durationSeconds: v.durationSeconds,
        instructorId: v.instructorId,
        instructorName: v.instructor?.name ?? null,
        teachersNote: v.teachersNote,
        products: usedProductRefsOf(v.products),
        steps: v.steps,
        gated: v.gated,
        visible: v.visible,
        inShorties: v.inShorties,
        views: viewsById.get(v.id) ?? 0,
      }),
    ),
    instructors: instructors.map(
      (i): AdminInstructor => ({
        id: i.id,
        slug: i.slug,
        name: i.name,
        city: i.city,
        photoUrl: i.photoUrl,
        bio: i.bio,
        specialties: i.specialties,
        instagram: i.instagram,
        tiktok: i.tiktok,
        featured: i.featured,
        visible: i.visible,
        appearances: i.appearances,
        videoCount: i._count.videos,
      }),
    ),
    classes: classes.map(
      (c): AdminClass => ({
        id: c.id,
        instructorId: c.instructorId,
        instructorName: c.instructor.name,
        title: c.title,
        startsAt: c.startsAt.toISOString(),
        startsAtLabel: classDate.format(c.startsAt),
        startsAtInput: toBogotaInput(c.startsAt),
        past: c.startsAt.getTime() < now,
        place: c.place,
        priceLabel: c.priceLabel,
        url: c.url,
        visible: c.visible,
      }),
    ),
    leads: leads.map(
      (l): AdminLead => ({
        id: l.id,
        kind: l.kind,
        name: l.name,
        email: l.email,
        phone: l.phone,
        city: l.city,
        company: l.company,
        message: l.message,
        instructorName: l.instructor?.name ?? null,
        context: l.context,
        marketingConsent: l.marketingConsent,
        handled: l.handled,
        createdAt: l.createdAt.toISOString(),
        createdAtLabel: leadDate.format(l.createdAt),
      }),
    ),
    pendingLeads: Object.fromEntries(counts.map((c) => [c.kind, c._count._all])) as Record<string, number>,
    cuponeraProducts: products.map((p): AdminCuponeraProduct => ({ id: p.id, name: p.name, brand: p.brand.name })),
  };
}

export type LibraryAdminData = Awaited<ReturnType<typeof getLibraryAdminData>>;
