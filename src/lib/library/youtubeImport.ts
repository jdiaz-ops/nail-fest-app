import { z } from "zod";
import { db } from "@/lib/db";
import { uniqueVideoSlug } from "./admin";
import { getLibrarySettings, updateLibrarySettings } from "./settings";
import { LIBRARY_LEVELS, LIBRARY_THEMES, formatDuration, isTheme, themeOf } from "./shared";
import { YoutubeError, cleanDescription, fetchChannel, fetchUploadsPage, fetchVideos, guessTheme, isShortVideo, parseChannel } from "./youtube";

// Editar biblioteca → YouTube (2026-10-25): the team's channel connected
// with its free Google key, its videos brought in to review — all of them
// the first time, the new ones after —, and the chosen ones passed to the
// library by batches, hidden, to finish and switch on in Videos.

export const connectSchema = z.object({
  channel: z.string().trim().min(2).max(200),
  // Empty keeps the key already saved.
  apiKey: z.string().trim().max(200).optional(),
});

/** Saves the channel and its key once YouTube says both work. */
export async function connectChannel(input: z.infer<typeof connectSchema>) {
  const settings = await getLibrarySettings();
  const key = input.apiKey || settings.youtubeApiKey;
  if (!key) throw new YoutubeError("key");
  const parsed = parseChannel(input.channel);
  if (!parsed) throw new YoutubeError("channel");
  const channel = await fetchChannel(key, parsed);
  await updateLibrarySettings({
    youtubeChannel: input.channel,
    youtubeChannelId: channel.id,
    youtubeChannelTitle: channel.title,
    youtubeUploadsId: channel.uploadsId,
    youtubeApiKey: key,
  });
  return channel;
}

/** One page (50) of the channel's uploads: the new ones arrive to review,
 * with what they suggest; the ones already here get their newest title,
 * duration and views — the team's decision about them stays. */
export async function importUploadsPage(pageToken: string | null): Promise<{ added: number; updated: number; nextPageToken: string | null; total: number | null }> {
  const settings = await getLibrarySettings();
  if (!settings.youtubeApiKey || !settings.youtubeUploadsId) throw new YoutubeError("channel");
  const page = await fetchUploadsPage(settings.youtubeApiKey, settings.youtubeUploadsId, pageToken);
  const videos = await fetchVideos(settings.youtubeApiKey, page.ids);
  const known = new Set(
    (await db.libraryYoutubeVideo.findMany({ where: { youtubeId: { in: videos.map((v) => v.youtubeId) } }, select: { youtubeId: true } })).map((v) => v.youtubeId),
  );
  await db.$transaction(
    videos.map((v) => {
      const facts = {
        title: v.title,
        description: v.description,
        publishedAt: v.publishedAt,
        durationSeconds: v.durationSeconds,
        views: v.views,
        privacy: v.privacy,
        short: isShortVideo(v.durationSeconds, v.title),
      };
      return known.has(v.youtubeId)
        ? db.libraryYoutubeVideo.update({ where: { youtubeId: v.youtubeId }, data: facts })
        : db.libraryYoutubeVideo.create({ data: { youtubeId: v.youtubeId, ...facts, suggestedTheme: guessTheme(v.title, v.description) } });
    }),
  );
  if (!page.nextPageToken) await updateLibrarySettings({ youtubeImportedAt: new Date() });
  const added = videos.filter((v) => !known.has(v.youtubeId)).length;
  return { added, updated: videos.length - added, nextPageToken: page.nextPageToken, total: page.total };
}

const themeKeys = LIBRARY_THEMES.map((t) => t.key) as [string, ...string[]];
const levelKeys = LIBRARY_LEVELS.map((l) => l.key) as [string, ...string[]];

/** How the chosen ones go in: as each one suggests (a corto in Cortos, a
 * long one as a recording behind the free sign-up), or all one way. */
export const PASS_KINDS = ["sugerido", "corto", "video", "maraton"] as const;

export const decideSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pasar"),
    ids: z.array(z.string().min(1)).min(1).max(200),
    // null: each one's suggested theme.
    theme: z.enum(themeKeys).nullable(),
    level: z.enum(levelKeys),
    instructorId: z.string().min(1).nullable(),
    kind: z.enum(PASS_KINDS),
    visible: z.boolean(),
  }),
  z.object({ action: z.enum(["descartar", "revisar"]), ids: z.array(z.string().min(1)).min(1).max(500) }),
]);

/** The chosen ones into the library — hidden unless asked —, each a video
 * to finish (its products, its steps) and switch on in Videos. */
export async function passToLibrary(input: Extract<z.infer<typeof decideSchema>, { action: "pasar" }>): Promise<number> {
  if (input.instructorId && !(await db.instructor.findUnique({ where: { id: input.instructorId }, select: { id: true } }))) {
    throw new Error("unknown_instructor");
  }
  const rows = await db.libraryYoutubeVideo.findMany({ where: { id: { in: input.ids }, status: "PENDING", privacy: { not: "private" } } });
  for (const row of rows) {
    const kind = input.kind === "sugerido" ? (row.short ? "corto" : "maraton") : input.kind;
    const theme = input.theme ?? (isTheme(row.suggestedTheme) ? row.suggestedTheme : "tecnicas");
    await db.$transaction(async (tx) => {
      const video = await tx.libraryVideo.create({
        data: {
          slug: await uniqueVideoSlug(row.title),
          kind: kind === "maraton" ? "maraton" : "video",
          title: row.title.slice(0, 160),
          description: cleanDescription(row.description),
          theme,
          level: input.level,
          youtubeId: row.youtubeId,
          durationSeconds: row.durationSeconds,
          instructorId: input.instructorId,
          gated: kind === "maraton",
          inShorties: kind === "corto",
          visible: input.visible,
          publishedAt: row.publishedAt,
        },
      });
      await tx.libraryYoutubeVideo.update({ where: { id: row.id }, data: { status: "ADDED", libraryVideoId: video.id } });
    });
  }
  return rows.length;
}

export async function setAside(ids: string[], back: boolean): Promise<number> {
  const result = await db.libraryYoutubeVideo.updateMany({
    where: { id: { in: ids }, status: back ? "DISCARDED" : "PENDING" },
    data: { status: back ? "PENDING" : "DISCARDED" },
  });
  return result.count;
}

// ── For the tab ─────────────────────────────────────────────────────────────

/** The tab's count: the videos waiting for the team. */
export function countYoutubeToReview(): Promise<number> {
  return db.libraryYoutubeVideo.count({ where: { status: "PENDING" } });
}

// Written on the server: the browser's Intl writes dates and numbers in its
// own way and the page would not match its HTML.
const dayFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });
const numberFormat = new Intl.NumberFormat("es-CO");
/** "3 de mar. de 2024" → "3 mar 2024", whichever way this ICU writes it. */
const plain = (text: string) => text.replace(/\s/g, " ").replace(/\./g, "").replace(/ de /g, " ");

export interface YoutubeAdminVideo {
  id: string;
  youtubeId: string;
  title: string;
  /** "1:02" */
  duration: string | null;
  views: number;
  /** "12.345 vistas" */
  viewsLabel: string;
  publishedAt: string;
  /** "3 mar 2024" */
  publishedLabel: string;
  short: boolean;
  privacy: string;
  suggestedTheme: string | null;
  suggestedThemeLabel: string | null;
  status: "PENDING" | "ADDED" | "DISCARDED";
  /** Its video in the library, to finish in Videos; null once deleted there. */
  libraryVideoId: string | null;
}

export async function getYoutubeAdminData() {
  const [settings, rows] = await Promise.all([getLibrarySettings(), db.libraryYoutubeVideo.findMany({ orderBy: [{ views: "desc" }, { publishedAt: "desc" }], take: 3000 })]);
  const key = settings.youtubeApiKey;
  return {
    channel: settings.youtubeChannelId
      ? {
          input: settings.youtubeChannel ?? "",
          title: settings.youtubeChannelTitle ?? "Tu canal",
          importedLabel: settings.youtubeImportedAt ? plain(dayFormat.format(settings.youtubeImportedAt)) : null,
        }
      : null,
    /** The saved key's last characters — never the whole key. */
    keyEnd: key ? key.slice(-4) : null,
    suggestedChannel: settings.youtubeChannel ?? "@hlacosedora",
    videos: rows.map(
      (r): YoutubeAdminVideo => ({
        id: r.id,
        youtubeId: r.youtubeId,
        title: r.title,
        duration: r.durationSeconds ? formatDuration(r.durationSeconds) : null,
        views: r.views,
        viewsLabel: `${numberFormat.format(r.views).replace(/\s/g, ".")} ${r.views === 1 ? "vista" : "vistas"}`,
        publishedAt: r.publishedAt.toISOString(),
        publishedLabel: plain(dayFormat.format(r.publishedAt)),
        short: r.short,
        privacy: r.privacy,
        suggestedTheme: isTheme(r.suggestedTheme) ? r.suggestedTheme : null,
        suggestedThemeLabel: isTheme(r.suggestedTheme) ? themeOf(r.suggestedTheme).label : null,
        status: r.status === "ADDED" || r.status === "DISCARDED" ? r.status : "PENDING",
        libraryVideoId: r.libraryVideoId,
      }),
    ),
  };
}

export type YoutubeAdminData = Awaited<ReturnType<typeof getYoutubeAdminData>>;
