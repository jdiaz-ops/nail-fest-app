import { z } from "zod";
import { db } from "@/lib/db";
import { uniqueVideoSlug } from "./admin";
import { getLibrarySettings, updateLibrarySettings } from "./settings";
import { LIBRARY_LEVELS, LIBRARY_THEMES, formatDuration, isTheme, themeOf, type LibraryLevel, type LibraryTheme } from "./shared";
import { YoutubeError, cleanDescription, fetchChannel, fetchUploadsPage, fetchVideos, guessTheme, isShortVideo, parseChannel } from "./youtube";
import { AUTOPILOT_MAX_ATTEMPTS, claudeKeyOf, countWaitingForAutopilot, libraryVideoData, proposalOf, tidyTitle, type AutopilotKind, type AutopilotProposal } from "./youtubeAutopilot";

// Editar biblioteca → YouTube (2026-10-25): the team's channel connected
// with its free Google key, its videos brought in — all of them the first
// time, the new ones after —, and what's done with them: the autopilot
// (lib/library/youtubeAutopilot.ts) reviews and publishes them by itself;
// the team can still pass them to the library by batches, set them aside,
// publish one the autopilot left out or take one out.

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
        youtubeTags: v.tags,
      };
      // An upsert: the autopilot's import and the tab's may run at once.
      return db.libraryYoutubeVideo.upsert({
        where: { youtubeId: v.youtubeId },
        update: facts,
        create: { youtubeId: v.youtubeId, ...facts, suggestedTheme: guessTheme(v.title, v.description) },
      });
    }),
  );
  if (!page.nextPageToken) await updateLibrarySettings({ youtubeImportedAt: new Date() });
  const added = videos.filter((v) => !known.has(v.youtubeId)).length;
  return { added, updated: videos.length - added, nextPageToken: page.nextPageToken, total: page.total };
}

type ImportedPage = Awaited<ReturnType<typeof importUploadsPage>>;

/** The channel's newest uploads, page after page until one brings nothing
 * new — the whole channel the first time: what the autopilot brings by
 * itself (api/library/youtube-autopilot). */
export async function importNewUploads(budgetMs: number): Promise<{ added: number; complete: boolean }> {
  const started = Date.now();
  const firstTime = !(await getLibrarySettings()).youtubeImportedAt;
  let pageToken: string | null = null;
  let added = 0;
  do {
    const page: ImportedPage = await importUploadsPage(pageToken);
    added += page.added;
    pageToken = page.nextPageToken;
    if (!firstTime && page.added === 0) {
      await updateLibrarySettings({ youtubeImportedAt: new Date() });
      return { added, complete: true };
    }
  } while (pageToken && Date.now() - started < budgetMs);
  // The last page stamps youtubeImportedAt (importUploadsPage).
  return { added, complete: !pageToken };
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
  z.object({ action: z.enum(["descartar", "revisar", "publicar", "quitar"]), ids: z.array(z.string().min(1)).min(1).max(500) }),
]);

/** A video with no proposal from the autopilot, as it came from YouTube. */
function proposalFromYoutube(row: { title: string; description: string | null; short: boolean; suggestedTheme: string | null }): AutopilotProposal {
  const title = tidyTitle(row.title);
  return {
    title: title.length >= 3 ? title : row.title.slice(0, 140),
    description: cleanDescription(row.description),
    theme: isTheme(row.suggestedTheme) ? row.suggestedTheme : "tecnicas",
    level: "principiante",
    kind: row.short ? "corto" : "grabacion",
    tags: [],
    instructorId: null,
  };
}

const KIND_OF_PASS: Record<Exclude<(typeof PASS_KINDS)[number], "sugerido">, AutopilotKind> = { corto: "corto", video: "video", maraton: "grabacion" };

/** The chosen ones into the library — hidden unless asked —, each a video
 * to finish (its products, its steps) and switch on in Videos: with the
 * autopilot's title, description and topics when it wrote them. */
export async function passToLibrary(input: Extract<z.infer<typeof decideSchema>, { action: "pasar" }>): Promise<number> {
  if (input.instructorId && !(await db.instructor.findUnique({ where: { id: input.instructorId }, select: { id: true } }))) {
    throw new Error("unknown_instructor");
  }
  const rows = await db.libraryYoutubeVideo.findMany({ where: { id: { in: input.ids }, status: "PENDING", privacy: { not: "private" } } });
  let count = 0;
  for (const row of rows) {
    const base = proposalOf(row.aiProposal) ?? proposalFromYoutube(row);
    const proposal: AutopilotProposal = {
      ...base,
      theme: (input.theme as LibraryTheme | null) ?? base.theme,
      level: input.level as LibraryLevel,
      kind: input.kind === "sugerido" ? base.kind : KIND_OF_PASS[input.kind],
      instructorId: input.instructorId,
    };
    const slug = await uniqueVideoSlug(proposal.title);
    await db.$transaction(async (tx) => {
      const { count: taken } = await tx.libraryYoutubeVideo.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "ADDED", decidedBy: "equipo" } });
      if (!taken) return;
      const data = libraryVideoData(row, proposal, slug, input.visible);
      if (row.libraryVideoId) {
        // Taken out of the library before: the same video, back with these choices.
        const { slug: _slug, ...choices } = data;
        await tx.libraryVideo.update({ where: { id: row.libraryVideoId }, data: choices });
      } else {
        const video = await tx.libraryVideo.create({ data });
        await tx.libraryYoutubeVideo.update({ where: { id: row.id }, data: { libraryVideoId: video.id } });
      }
      count++;
    });
  }
  return count;
}

export async function setAside(ids: string[], back: boolean): Promise<number> {
  const result = await db.libraryYoutubeVideo.updateMany({
    where: { id: { in: ids }, status: back ? "DISCARDED" : "PENDING" },
    data: { status: back ? "PENDING" : "DISCARDED", decidedBy: back ? null : "equipo" },
  });
  return result.count;
}

/** «Publicar igual»: the ones set aside, into the library and seen, as the
 * autopilot proposed them (or as they came) — or back on, if they had been
 * taken out. */
export async function publishAnyway(ids: string[]): Promise<number> {
  const rows = await db.libraryYoutubeVideo.findMany({ where: { id: { in: ids }, status: "DISCARDED", privacy: { not: "private" } } });
  let count = 0;
  for (const row of rows) {
    const proposal = proposalOf(row.aiProposal) ?? proposalFromYoutube(row);
    const slug = row.libraryVideoId ? null : await uniqueVideoSlug(proposal.title);
    await db.$transaction(async (tx) => {
      const { count: taken } = await tx.libraryYoutubeVideo.updateMany({ where: { id: row.id, status: "DISCARDED" }, data: { status: "ADDED", decidedBy: "equipo" } });
      if (!taken) return;
      if (row.libraryVideoId) {
        await tx.libraryVideo.update({ where: { id: row.libraryVideoId }, data: { visible: true } });
      } else {
        const video = await tx.libraryVideo.create({ data: libraryVideoData(row, proposal, slug!, true) });
        await tx.libraryYoutubeVideo.update({ where: { id: row.id }, data: { libraryVideoId: video.id } });
      }
      count++;
    });
  }
  return count;
}

/** «Quitar de la biblioteca»: hidden there (nothing deleted) and set aside here. */
export async function takeOut(ids: string[]): Promise<number> {
  const rows = await db.libraryYoutubeVideo.findMany({ where: { id: { in: ids }, status: "ADDED" }, select: { id: true, libraryVideoId: true } });
  for (const row of rows) {
    await db.$transaction([
      ...(row.libraryVideoId ? [db.libraryVideo.update({ where: { id: row.libraryVideoId }, data: { visible: false } })] : []),
      db.libraryYoutubeVideo.update({ where: { id: row.id }, data: { status: "DISCARDED", decidedBy: "equipo" } }),
    ]);
  }
  return rows.length;
}

/** The autopilot's switch, and Claude's key when Vercel has none. */
export const autopilotSchema = z.object({
  autopilot: z.boolean().optional(),
  // Empty: forget the pasted key.
  claudeKey: z.string().trim().max(300).optional(),
});

// ── For the tab ─────────────────────────────────────────────────────────────

/** The tab's count: the videos waiting for the team. */
export function countYoutubeToReview(): Promise<number> {
  return db.libraryYoutubeVideo.count({ where: { status: "PENDING" } });
}

// Written on the server: the browser's Intl writes dates and numbers in its
// own way and the page would not match its HTML.
const dayFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });
const momentFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Bogota" });
const numberFormat = new Intl.NumberFormat("es-CO");
/** "3 de mar. de 2024" → "3 mar 2024", whichever way this ICU writes it. */
const plain = (text: string) => text.replace(/\s/g, " ").replace(/\./g, "").replace(/ de /g, " ");
/** "25 oct · 15:40", in Bogotá. */
function momentLabel(date: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) => momentFormat.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replace(/\./g, "")} · ${part("hour")}:${part("minute")}`;
}

const KIND_LABELS: Record<AutopilotKind, string> = { corto: "Corto, en Cortos", video: "Video", grabacion: "Grabación con registro" };

export interface YoutubeAdminVideo {
  id: string;
  youtubeId: string;
  /** What the library shows (or would show): the autopilot's title, or the one edited in Videos. */
  title: string;
  /** As it's called on YouTube. */
  youtubeTitle: string;
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
  decidedBy: "ia" | "equipo" | null;
  /** The autopilot's reason, for the team. */
  aiReason: string | null;
  /** "Técnicas · Corto, en Cortos · Polygel, Francesa" — what the autopilot chose. */
  aiChoiceLabel: string | null;
  /** Waiting for the autopilot (it will review it). */
  aiWaiting: boolean;
  /** The autopilot tried three times and couldn't: the team decides. */
  aiGaveUp: boolean;
  /** Its video in the library, to finish in Videos; null once deleted there. */
  libraryVideoId: string | null;
  /** Seen in the library (null: not there). */
  libraryVisible: boolean | null;
}

export async function getYoutubeAdminData() {
  const [settings, rows, waiting] = await Promise.all([
    getLibrarySettings(),
    db.libraryYoutubeVideo.findMany({
      orderBy: [{ views: "desc" }, { publishedAt: "desc" }],
      take: 3000,
      include: { libraryVideo: { select: { title: true, visible: true } } },
    }),
    countWaitingForAutopilot(),
  ]);
  const key = settings.youtubeApiKey;
  const claude = claudeKeyOf(settings);
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
    autopilot: {
      on: settings.youtubeAutopilot,
      /** Where Claude's key comes from; null: there's none. */
      keySource: claude?.source ?? null,
      /** The pasted key's last characters — never the whole key. */
      keyEnd: settings.claudeApiKey ? settings.claudeApiKey.slice(-4) : null,
      lastRunLabel: settings.youtubeAutopilotAt ? momentLabel(settings.youtubeAutopilotAt) : null,
      waiting,
    },
    videos: rows.map((r): YoutubeAdminVideo => {
      const proposal = proposalOf(r.aiProposal);
      const decidedBy = r.decidedBy === "ia" || r.decidedBy === "equipo" ? r.decidedBy : null;
      const waitingForAi = r.status === "PENDING" && !r.aiReviewedAt && r.privacy === "public";
      return {
        id: r.id,
        youtubeId: r.youtubeId,
        title: r.libraryVideo?.title ?? proposal?.title ?? r.title,
        youtubeTitle: r.title,
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
        decidedBy,
        aiReason: r.aiReason,
        aiChoiceLabel: proposal ? [themeOf(proposal.theme).label, KIND_LABELS[proposal.kind], proposal.tags.join(", ")].filter(Boolean).join(" · ") : null,
        aiWaiting: waitingForAi && r.aiAttempts < AUTOPILOT_MAX_ATTEMPTS,
        aiGaveUp: waitingForAi && r.aiAttempts >= AUTOPILOT_MAX_ATTEMPTS,
        libraryVideoId: r.libraryVideoId,
        libraryVisible: r.libraryVideo ? r.libraryVideo.visible : null,
      };
    }),
  };
}

export type YoutubeAdminData = Awaited<ReturnType<typeof getYoutubeAdminData>>;
