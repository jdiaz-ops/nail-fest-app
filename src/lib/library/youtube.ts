import { normalizeText } from "@/lib/cuponera/shared";
import type { LibraryTheme } from "./shared";

// The team's YouTube channel brought into the library (Editar biblioteca →
// YouTube, 2026-10-25): reading it with the YouTube Data API v3 and a free
// Google key, and what each video suggests — a corto or a recording, and
// its theme from the words of its title. No database here.

/** "@hlacosedora", "youtube.com/@hlacosedora?si=…", "youtube.com/channel/UC…":
 * the channel to read; null when it isn't one of those. */
export function parseChannel(input: string): { handle: string } | { id: string } | null {
  const text = input.trim();
  if (!text) return null;
  const id = text.match(/(?:^|\/channel\/)(UC[\w-]{22})(?:[/?#]|$)/);
  if (id) return { id: id[1]! };
  const handle = text.match(/(?:^|youtube\.com\/)@([\w.-]{3,30})(?:[/?#]|$)/i) ?? text.match(/^([\w.-]{3,30})$/);
  return handle ? { handle: handle[1]!.toLowerCase() } : null;
}

/** "PT1H2M3S" → 3723 seconds; null when it isn't a duration. */
export function isoDurationSeconds(iso: string | null | undefined): number | null {
  const match = iso?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const [, d, h, m, s] = match.map((part) => Number(part ?? 0));
  return d! * 86400 + h! * 3600 + m! * 60 + s!;
}

/** YouTube's Shorts are up to three minutes. */
export const SHORT_UP_TO_SECONDS = 180;

/** Three minutes or less, or #shorts in its title: a corto. */
export function isShortVideo(seconds: number | null, title: string): boolean {
  return /#shorts?\b/i.test(title) || (seconds !== null && seconds > 0 && seconds <= SHORT_UP_TO_SECONDS);
}

// The words that say a theme, accent-free and lowercase (each one matches
// at the start of a word: "esteriliz" finds "esterilizar"). On a tie the
// first theme wins: a title about an error or a trend says more than one
// that only names a technique.
const THEME_WORDS: { theme: LibraryTheme; words: string[] }[] = [
  { theme: "errores", words: ["error", "mito", "evita", "no hagas", "se levanta", "levantamiento", "se despega", "falla", "problema"] },
  { theme: "transformaciones", words: ["antes y despues", "transformacion", "rescate", "reconstruccion", "makeover"] },
  { theme: "tendencias", words: ["tendencia", "moda", "viral", "trend", "temporada", "navidad", "halloween", "verano", "2024", "2025", "2026"] },
  { theme: "negocio", words: ["precio", "cobrar", "cobro", "clienta", "negocio", "emprend", "salon", "marketing", "vender", "venta", "ganar", "dinero", "agenda"] },
  { theme: "bioseguridad", words: ["hongo", "bioseguridad", "esteriliz", "desinfec", "salud", "alergia", "encarnada", "infeccion"] },
  {
    theme: "productos",
    words: ["top coat", "base coat", "lampara", "pincel", "producto", "marca", "resena", "review", "unboxing", "kit", "monomero", "primer", "deshidratador", "torno", "broca", "fresa"],
  },
  { theme: "personas", words: ["entrevista", "historia", "testimonio", "conoce a", "invitada", "podcast", "conversatorio"] },
  {
    theme: "tecnicas",
    words: [
      "polygel",
      "acrilic",
      "gel",
      "francesa",
      "semipermanente",
      "esculpid",
      "tips",
      "press on",
      "rubber",
      "builder",
      "dual system",
      "encapsulad",
      "baby boomer",
      "ombre",
      "degradado",
      "nail art",
      "diseno",
      "decoracion",
      "cromo",
      "efecto",
      "stamping",
      "limado",
      "cuticula",
      "manicur",
      "pedicur",
      "kapping",
      "nivelacion",
      "tecnica",
      "paso a paso",
      "tutorial",
    ],
  },
];

/** The theme a video's title suggests (its description counts less); null
 * when no word says one. */
export function guessTheme(title: string, description?: string | null): LibraryTheme | null {
  const inTitle = ` ${normalizeText(title)}`;
  const inDescription = description ? ` ${normalizeText(description.slice(0, 400))}` : "";
  let best: { theme: LibraryTheme; score: number } | null = null;
  for (const { theme, words } of THEME_WORDS) {
    const score = words.reduce((sum, word) => sum + (inTitle.includes(` ${word}`) ? 2 : inDescription.includes(` ${word}`) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { theme, score };
  }
  return best?.theme ?? null;
}

/** A YouTube description as the library shows it: without its lines of
 * links, hashtags and handles, the first 600 characters. */
export function cleanDescription(text: string | null | undefined): string | null {
  const kept = (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/https?:\/\/|www\./i.test(line) && !/^[#@]/.test(line))
    .join("\n")
    .slice(0, 600)
    .trim();
  return kept || null;
}

// ── Reading the channel (YouTube Data API v3) ──────────────────────────────

export type YoutubeProblem = "key" | "api" | "quota" | "channel" | "network";

/** What to tell the team, in words. */
export const YOUTUBE_PROBLEMS: Record<YoutubeProblem, string> = {
  key: "La llave de Google no sirve para YouTube: revisa que esté bien copiada y que tenga permiso para «YouTube Data API v3».",
  api: "Falta activar «YouTube Data API v3» en tu proyecto de Google.",
  quota: "YouTube no deja leer más por hoy (la cuota diaria). Vuelve a intentarlo mañana.",
  channel: "No encontramos ese canal. Escríbelo así: @nombre.",
  network: "No pudimos hablar con YouTube. Vuelve a intentarlo en un momento.",
};

export class YoutubeError extends Error {
  constructor(readonly problem: YoutubeProblem) {
    super(YOUTUBE_PROBLEMS[problem]);
  }
}

interface ApiErrorBody {
  error?: { status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] };
}

function problemOf(status: number, body: ApiErrorBody | null): YoutubeProblem {
  const reasons = [body?.error?.status, ...(body?.error?.errors ?? []).map((e) => e.reason), ...(body?.error?.details ?? []).map((d) => d.reason)];
  const has = (...names: string[]) => reasons.some((r) => r !== undefined && names.includes(r));
  if (has("quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "RATE_LIMIT_EXCEEDED")) return "quota";
  if (has("accessNotConfigured", "SERVICE_DISABLED")) return "api";
  if (has("keyInvalid", "API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "forbidden")) return "key";
  if (status === 404 || has("playlistNotFound", "channelNotFound", "notFound")) return "channel";
  if (status === 400) return "key";
  return "network";
}

/** The API's address — another one only to test against a stand-in. */
function apiBase(): string {
  return process.env.YOUTUBE_API_BASE || "https://www.googleapis.com/youtube/v3";
}

async function call<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(`${apiBase()}/${path}`);
  for (const [name, value] of Object.entries({ ...params, key })) url.searchParams.set(name, value);
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new YoutubeError("network");
  }
  if (!res.ok) throw new YoutubeError(problemOf(res.status, (await res.json().catch(() => null)) as ApiErrorBody | null));
  return (await res.json()) as T;
}

export interface YoutubeChannel {
  id: string;
  title: string;
  /** Its uploads, as a playlist ("UU…"). */
  uploadsId: string;
  videoCount: number | null;
}

export async function fetchChannel(key: string, channel: { handle: string } | { id: string }): Promise<YoutubeChannel> {
  const body = await call<{
    items?: { id: string; snippet?: { title?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } }; statistics?: { videoCount?: string } }[];
  }>("channels", { part: "snippet,contentDetails,statistics", ...("id" in channel ? { id: channel.id } : { forHandle: `@${channel.handle}` }) }, key);
  const item = body.items?.[0];
  const uploadsId = item?.contentDetails?.relatedPlaylists?.uploads;
  if (!item || !uploadsId) throw new YoutubeError("channel");
  const count = Number(item.statistics?.videoCount);
  return { id: item.id, title: item.snippet?.title?.trim() || "Tu canal", uploadsId, videoCount: Number.isFinite(count) ? count : null };
}

/** One page (50) of the channel's uploads, newest first. */
export async function fetchUploadsPage(key: string, uploadsId: string, pageToken: string | null): Promise<{ ids: string[]; nextPageToken: string | null; total: number | null }> {
  const body = await call<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string; pageInfo?: { totalResults?: number } }>(
    "playlistItems",
    { part: "contentDetails", playlistId: uploadsId, maxResults: "50", ...(pageToken ? { pageToken } : {}) },
    key,
  );
  return {
    ids: (body.items ?? []).map((i) => i.contentDetails?.videoId).filter((id): id is string => Boolean(id)),
    nextPageToken: body.nextPageToken ?? null,
    total: body.pageInfo?.totalResults ?? null,
  };
}

export interface YoutubeVideoFacts {
  youtubeId: string;
  title: string;
  description: string | null;
  publishedAt: Date;
  durationSeconds: number | null;
  views: number;
  privacy: string;
  /** Its tags on YouTube, as the channel wrote them. */
  tags: string[];
}

/** What each video is (up to 50 at a time); upcoming lives are left out. */
export async function fetchVideos(key: string, ids: string[]): Promise<YoutubeVideoFacts[]> {
  if (ids.length === 0) return [];
  const body = await call<{
    items?: {
      id: string;
      snippet?: { title?: string; description?: string; publishedAt?: string; liveBroadcastContent?: string; tags?: string[] };
      contentDetails?: { duration?: string };
      statistics?: { viewCount?: string };
      status?: { privacyStatus?: string };
    }[];
  }>("videos", { part: "snippet,contentDetails,statistics,status", id: ids.slice(0, 50).join(","), maxResults: "50" }, key);
  return (body.items ?? [])
    .filter((v) => v.snippet?.liveBroadcastContent !== "upcoming" && v.snippet?.liveBroadcastContent !== "live")
    .map((v) => {
      const views = Number(v.statistics?.viewCount);
      const published = new Date(v.snippet?.publishedAt ?? "");
      return {
        youtubeId: v.id,
        title: v.snippet?.title?.trim() || "Video sin título",
        description: v.snippet?.description?.trim() || null,
        publishedAt: Number.isNaN(published.getTime()) ? new Date() : published,
        durationSeconds: isoDurationSeconds(v.contentDetails?.duration),
        views: Number.isFinite(views) ? views : 0,
        privacy: v.status?.privacyStatus ?? "public",
        tags: (v.snippet?.tags ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 30),
      };
    });
}
