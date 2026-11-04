import { zonedTimeToUtc } from "@/lib/dateFormat";
import type { LandingBlock } from "@/lib/landingBlocks/types";
import { eventWhen } from "./schedule";

// Manicuristas Imparables' recordings (the team, 2026-11-04: «pienso subirlas cada una individualmente en privado a
// YouTube y poder copiar/pegar el link ahí»): one YouTube link per talk, pasted in the admin («Grabaciones»), each
// one played on every buyer's own page («Tu congreso», app/mi-congreso/[token]) from the moment the congress ends
// until the last day — 30 days after it (the ticket's promise), unless the team picks another. Each video goes up as
// «No listado» on YouTube: only who has the link sees it, and the link lives only inside her page. Event.recordings
// keeps the list.

export interface RecordingItem {
  /** «Cómo cobrar lo que vales» */
  title: string;
  /** «Jimena Montalban» */
  speaker: string;
  /** The link as pasted: https://youtu.be/…, «» while it isn't up yet. */
  url: string;
}

export interface Recordings {
  /** The last day they can be watched, "2027-08-03", where the event happens; null: 30 days after the congress. */
  until: string | null;
  items: RecordingItem[];
}

/** How long the recordings stay up after the congress (the ticket's «Grabación de cada charla disponible por 30 días»). */
export const RECORDING_DAYS = 30;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Event.recordings as saved; an empty list for anything else. */
export function readRecordings(value: unknown): Recordings {
  const saved = value && typeof value === "object" ? (value as { until?: unknown; items?: unknown }) : {};
  const until = typeof saved.until === "string" && DAY.test(saved.until) ? saved.until : null;
  const items = Array.isArray(saved.items)
    ? saved.items
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : {}))
        .map((item) => ({ title: text(item.title, 200), speaker: text(item.speaker, 200), url: text(item.url, 500) }))
        .filter((item) => item.title || item.speaker || item.url)
    : [];
  return { until, items };
}

/** The video's id in a YouTube link — youtu.be/ID, youtube.com/watch?v=ID, /live/ID, /embed/ID, /shorts/ID — or null. */
export function youtubeId(url: string): string | null {
  const typed = url.trim();
  if (!typed) return null;
  let link: URL;
  try {
    link = new URL(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`);
  } catch {
    return null;
  }
  const host = link.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  const id = (value: string | null | undefined) => (value && /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null);
  if (host === "youtu.be") return id(link.pathname.split("/")[1]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (link.pathname === "/watch") return id(link.searchParams.get("v"));
    const [, kind, value] = link.pathname.split("/");
    if (kind === "embed" || kind === "live" || kind === "shorts" || kind === "v") return id(value);
  }
  return null;
}

/** The talks in the event's program, to start the list: each one someone gives — not the breaks, lunch, the welcome or the closing. */
export function talksOf(blocks: LandingBlock[]): RecordingItem[] {
  return blocks
    .flatMap((block) => (block.type === "agenda" ? block.rows : []))
    .filter((row) => row.kind === "session" && row.instructor.trim() && !/pausa|almuerzo|bienvenida|cierre/i.test(row.topic))
    .map((row) => ({ title: row.topic.trim(), speaker: row.instructor.trim(), url: "" }));
}

/** "2027-07-04" and 30 → "2027-08-03" */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2027-08-03" → "martes 3 de agosto" */
export function dayWords(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`;
}

export interface CongressTimes {
  /** When the congress ends: the recordings and the diploma open then. */
  ends: Date;
  /** Its (last) day, "2027-07-04". */
  lastDay: string;
  /** The recordings' last day, "2027-08-03", and the moment it's over. */
  recordingsUntil: string;
  recordingsClose: Date;
}

/** When the congress ends and how long its recordings last. */
export function congressTimes(event: { startsAt: Date; endsAt: Date | null; scheduleDays?: unknown }, recordings: Recordings, timezone: string): CongressTimes {
  const when = eventWhen(event, timezone);
  const lastDay = when.days[when.days.length - 1]!;
  const lastEnd = when.ends[when.ends.length - 1];
  const ends = lastEnd ? new Date(lastEnd) : (event.endsAt ?? event.startsAt);
  const recordingsUntil = recordings.until ?? addDays(lastDay, RECORDING_DAYS);
  const recordingsClose = new Date(zonedTimeToUtc(`${addDays(recordingsUntil, 1)}T00:00`, timezone).getTime());
  return { ends, lastDay, recordingsUntil, recordingsClose };
}
