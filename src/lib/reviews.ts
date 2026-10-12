// Reseñas — attendees rate an event (1–5 stars, comment, up to three
// photos) through the same signed qrToken their ticket link carries:
// /resena/<token>. Only someone scanned at the door may review; nothing
// is public until an admin approves it; a review shows with name, city and
// photos only when the person ticked publishConsent (stored with its
// timestamp). The same module serves the public blocks (landing / home),
// the admin moderation page, the per-event sorteo and the Claude summary
// of what the comments talk about. Nothing here sends anything to anyone:
// the ask goes out through the normal correo / difusión composers, which
// only need the link (reviewUrl).

import { createHash, randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { Event, Person, Registration, Review, ReviewRaffle, ReviewRaffleWinner, ReviewStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyQrToken } from "@/lib/ticket";
import { publicEventName } from "@/lib/eventDisplayName";

export const MAX_REVIEW_PHOTOS = 3;
export const MAX_COMMENT_LENGTH = 1500;
/** Label every reviewer gets, so a segment can target them for early
 * access to the next edition (the reward the form promises). */
export const REVIEWER_LABEL = "acceso anticipado";
/** The email merge tag the composer inserts; sendEventBroadcast swaps it
 * for the registrant's own link. ASCII on purpose: it has to survive a
 * trip through an href attribute and the HTML sanitizer unchanged. */
export const REVIEW_LINK_TAG = "{{LINK_RESENA}}";

export function reviewUrl(qrToken: string): string {
  return `${(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}/resena/${encodeURIComponent(qrToken)}`;
}

// ── Eligibility ──────────────────────────────────────────────────────────

export type ReviewEligibility =
  | { ok: false; reason: "invalid_token" | "not_found" | "not_confirmed" | "not_attended" }
  | {
      ok: true;
      registration: Registration;
      person: Person;
      event: Event;
      existing: (Review & { photos: { url: string }[] }) | null;
      raffle: RaffleView | null;
    };

export interface RaffleView {
  prizeCount: number;
  prizeLabel: string;
  closesAt: Date;
  open: boolean;
}

function raffleView(raffle: ReviewRaffle | null, now = new Date()): RaffleView | null {
  if (!raffle) return null;
  return { prizeCount: raffle.prizeCount, prizeLabel: raffle.prizeLabel, closesAt: raffle.closesAt, open: !raffle.drawnAt && raffle.closesAt.getTime() > now.getTime() };
}

/** Was this registration actually at the event? The door scanner bumps
 * checkedInCount on the first valid scan; the ScanLog check covers an
 * older registration whose count was never written. */
export async function registrationAttended(registration: { id: string; checkedInCount: number }): Promise<boolean> {
  if (registration.checkedInCount > 0) return true;
  const scan = await db.scanLog.findFirst({ where: { registrationId: registration.id, result: { in: ["VALID_FIRST", "VALID_REENTRY"] } }, select: { id: true } });
  return Boolean(scan);
}

export async function reviewEligibilityForToken(token: string): Promise<ReviewEligibility> {
  const verified = verifyQrToken(token);
  if (!verified.valid || !verified.registrationId) return { ok: false, reason: "invalid_token" };
  const registration = await db.registration.findUnique({
    where: { id: verified.registrationId },
    include: { person: true, event: { include: { reviewRaffle: true } }, review: { include: { photos: { orderBy: { position: "asc" } } } } },
  });
  if (!registration) return { ok: false, reason: "not_found" };
  if (registration.status !== "CONFIRMED") return { ok: false, reason: "not_confirmed" };
  if (!(await registrationAttended(registration))) return { ok: false, reason: "not_attended" };
  const { person, event, review, ...rest } = registration;
  return { ok: true, registration: rest as Registration, person, event, existing: review, raffle: raffleView(event.reviewRaffle) };
}

// ── Submitting ───────────────────────────────────────────────────────────

export interface ReviewInput {
  rating: number;
  comment?: string | null;
  instagramHandle?: string | null;
  publishConsent: boolean;
  raffleOptIn: boolean;
  photoUrls: string[];
}

/** "@Karen.NailArt " → "karen.nailart"; anything Instagram wouldn't accept
 * as a handle becomes null rather than a stored oddity. */
export function normalizeInstagramHandle(raw: string | null | undefined): string | null {
  const h = (raw ?? "").trim().replace(/^@+/, "").replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").toLowerCase();
  if (!h) return null;
  if (!/^[a-z0-9._]{1,30}$/.test(h)) return null;
  return h;
}

/** A photo URL is accepted only if it is one this registration uploaded
 * through /api/resenas/<token>/foto — a Blob URL under its own folder —
 * so a submission can never point the public gallery at someone else's
 * file or at an outside site. */
export function isOwnReviewPhotoUrl(url: string, registrationId: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!u.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
    return u.pathname.startsWith(`/${reviewPhotoFolder(registrationId)}/`);
  } catch {
    return false;
  }
}

export function reviewPhotoFolder(registrationId: string): string {
  return `reviews/${registrationId}`;
}

export type ReviewError = "invalid_token" | "not_found" | "not_confirmed" | "not_attended" | "invalid_rating" | "already_reviewed" | "too_many_photos" | "bad_photo";
export type SubmitReviewResult = { ok: true; review: Review } | { ok: false; error: ReviewError };

export async function submitReview(token: string, input: ReviewInput): Promise<SubmitReviewResult> {
  const eligibility = await reviewEligibilityForToken(token);
  if (!eligibility.ok) return { ok: false, error: eligibility.reason };
  if (eligibility.existing) return { ok: false, error: "already_reviewed" };
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "invalid_rating" };
  const photoUrls = (input.photoUrls ?? []).filter((u) => typeof u === "string");
  if (photoUrls.length > MAX_REVIEW_PHOTOS) return { ok: false, error: "too_many_photos" };
  if (photoUrls.some((u) => !isOwnReviewPhotoUrl(u, eligibility.registration.id))) return { ok: false, error: "bad_photo" };
  const comment = (input.comment ?? "").trim().slice(0, MAX_COMMENT_LENGTH) || null;
  const now = new Date();
  const review = await db.review.create({
    data: {
      eventId: eligibility.event.id,
      registrationId: eligibility.registration.id,
      personId: eligibility.person.id,
      rating,
      comment,
      instagramHandle: normalizeInstagramHandle(input.instagramHandle),
      publishConsent: Boolean(input.publishConsent),
      publishConsentAt: input.publishConsent ? now : null,
      raffleOptIn: Boolean(input.raffleOptIn) && Boolean(eligibility.raffle?.open),
      photos: { create: photoUrls.map((url, position) => ({ url, position })) },
    },
  });
  // The reward: a label the next edition's "acceso anticipado" segment can
  // target. Best-effort — a label hiccup must never lose the review.
  try {
    const label = await db.label.upsert({ where: { name: REVIEWER_LABEL }, update: {}, create: { name: REVIEWER_LABEL } });
    await db.label.update({ where: { id: label.id }, data: { people: { connect: { id: eligibility.person.id } } } });
  } catch (err) {
    console.error("reviews: reviewer label failed", eligibility.person.id, err);
  }
  return { ok: true, review };
}

// ── Public reading ───────────────────────────────────────────────────────

export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  name: string;
  city: string | null;
  instagramHandle: string | null;
  photos: string[];
  eventName: string; // "Nail Fest Cúcuta 2025" — what the "Asistió a …" badge says
  featured: boolean;
  createdAt: Date;
}

export interface ReviewAggregate {
  average: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** "Karen M." — first name plus the last name's initial, never the full
 * surname in public. */
export function publicReviewerName(person: { firstName: string | null; lastName: string | null }): string {
  const first = (person.firstName ?? "").trim();
  const last = (person.lastName ?? "").trim();
  if (!first && !last) return "Asistente";
  return last ? `${first} ${last[0]!.toUpperCase()}.`.trim() : first;
}

/** Approved reviews with publish consent, featured first. `eventIds`
 * null = every event. */
export async function listPublicReviews(eventIds: string[] | null, limit = 12): Promise<PublicReview[]> {
  if (eventIds && eventIds.length === 0) return [];
  const rows = await db.review.findMany({
    where: { status: "APPROVED", publishConsent: true, ...(eventIds ? { eventId: { in: eventIds } } : {}) },
    orderBy: [{ featured: "desc" }, { rating: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { photos: { orderBy: { position: "asc" } }, person: { select: { firstName: true, lastName: true, city: true } }, event: { select: { name: true, publicName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    name: publicReviewerName(r.person),
    city: r.person.city,
    instagramHandle: r.instagramHandle,
    photos: r.photos.map((p) => p.url),
    eventName: publicEventName(r.event),
    featured: r.featured,
    createdAt: r.createdAt,
  }));
}

/** Average and distribution over every APPROVED review (consent or not:
 * a person who declined to be named still rated the event). */
export async function reviewAggregate(eventIds: string[] | null): Promise<ReviewAggregate> {
  const empty: ReviewAggregate = { average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  if (eventIds && eventIds.length === 0) return empty;
  const rows = await db.review.groupBy({
    by: ["rating"],
    where: { status: "APPROVED", ...(eventIds ? { eventId: { in: eventIds } } : {}) },
    _count: { _all: true },
  });
  return aggregateFromCounts(rows.map((r) => ({ rating: r.rating, count: r._count._all })));
}

export function aggregateFromCounts(rows: { rating: number; count: number }[]): ReviewAggregate {
  const distribution: ReviewAggregate["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const r of rows) {
    if (r.rating < 1 || r.rating > 5) continue;
    distribution[r.rating as 1 | 2 | 3 | 4 | 5] += r.count;
    count += r.count;
    sum += r.rating * r.count;
  }
  return { average: count > 0 ? Math.round((sum / count) * 10) / 10 : null, count, distribution };
}

export type ReviewScope = "event" | "previous" | "global";

/** Which events a public block shows: this one, the latest earlier edition
 * in the same city that has approved reviews, or all of them. */
export async function resolveReviewScope(scope: ReviewScope, event: { id: string; city: string; startsAt: Date }): Promise<{ eventIds: string[] | null; sourceEvent: { id: string; name: string; publicName: string | null } | null }> {
  if (scope === "global") return { eventIds: null, sourceEvent: null };
  if (scope === "event") return { eventIds: [event.id], sourceEvent: null };
  const previous = await db.event.findFirst({
    where: {
      id: { not: event.id },
      city: { equals: event.city.trim(), mode: "insensitive" },
      startsAt: { lt: event.startsAt },
      reviews: { some: { status: "APPROVED" } },
    },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, publicName: true },
  });
  return previous ? { eventIds: [previous.id], sourceEvent: previous } : { eventIds: [], sourceEvent: null };
}

// ── Admin: moderation, stats ─────────────────────────────────────────────

export type ModerationAction = "approve" | "hide" | "pending" | "feature" | "unfeature";

export async function moderateReview(reviewId: string, action: ModerationAction, by: string): Promise<Review> {
  const review = await db.review.findUniqueOrThrow({ where: { id: reviewId } });
  const now = new Date();
  switch (action) {
    case "approve":
      return db.review.update({ where: { id: reviewId }, data: { status: "APPROVED", moderatedAt: now, moderatedBy: by } });
    case "hide":
      return db.review.update({ where: { id: reviewId }, data: { status: "HIDDEN", featured: false, moderatedAt: now, moderatedBy: by } });
    case "pending":
      return db.review.update({ where: { id: reviewId }, data: { status: "PENDING", featured: false, moderatedAt: now, moderatedBy: by } });
    case "feature":
      // Featuring implies approving; a review nobody may name can't be a
      // showcase piece.
      if (!review.publishConsent) throw new Error("Sin permiso de publicación no se puede destacar.");
      return db.review.update({ where: { id: reviewId }, data: { status: "APPROVED", featured: true, moderatedAt: now, moderatedBy: by } });
    case "unfeature":
      return db.review.update({ where: { id: reviewId }, data: { featured: false, moderatedAt: now, moderatedBy: by } });
  }
}

export interface EventReviewStats {
  average: number | null;
  count: number; // every non-hidden review
  distribution: ReviewAggregate["distribution"];
  pending: number;
  approved: number;
  hidden: number;
  featured: number;
  withConsent: number;
  withPhotos: number;
  scanned: number; // registrations that were at the door
  responseRate: number | null; // count ÷ scanned
  raffleOptIns: number;
}

export async function eventReviewStats(eventId: string): Promise<EventReviewStats> {
  const [byRating, byStatus, withConsent, withPhotos, featured, scanned, raffleOptIns] = await Promise.all([
    db.review.groupBy({ by: ["rating"], where: { eventId, status: { not: "HIDDEN" } }, _count: { _all: true } }),
    db.review.groupBy({ by: ["status"], where: { eventId }, _count: { _all: true } }),
    db.review.count({ where: { eventId, publishConsent: true, status: { not: "HIDDEN" } } }),
    db.review.count({ where: { eventId, status: { not: "HIDDEN" }, photos: { some: {} } } }),
    db.review.count({ where: { eventId, featured: true } }),
    db.registration.count({ where: { eventId, status: "CONFIRMED", checkedInCount: { gt: 0 } } }),
    db.review.count({ where: { eventId, raffleOptIn: true, status: { not: "HIDDEN" } } }),
  ]);
  const agg = aggregateFromCounts(byRating.map((r) => ({ rating: r.rating, count: r._count._all })));
  const status = (s: ReviewStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  return {
    ...agg,
    pending: status("PENDING"),
    approved: status("APPROVED"),
    hidden: status("HIDDEN"),
    featured,
    withConsent,
    withPhotos,
    scanned,
    responseRate: scanned > 0 ? agg.count / scanned : null,
    raffleOptIns,
  };
}

export interface EditionReviewRow {
  eventId: string;
  name: string;
  startsAt: Date;
  average: number | null;
  count: number;
  scanned: number;
  responseRate: number | null;
}

/** One row per event that has at least one review — the "comparado con
 * otras ediciones" panel. */
export async function reviewsByEdition(): Promise<EditionReviewRow[]> {
  const rows = await db.review.groupBy({ by: ["eventId", "rating"], where: { status: { not: "HIDDEN" } }, _count: { _all: true } });
  const eventIds = [...new Set(rows.map((r) => r.eventId))];
  if (eventIds.length === 0) return [];
  const [events, scanned] = await Promise.all([
    db.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, name: true, publicName: true, startsAt: true } }),
    db.registration.groupBy({ by: ["eventId"], where: { eventId: { in: eventIds }, status: "CONFIRMED", checkedInCount: { gt: 0 } }, _count: { _all: true } }),
  ]);
  return events
    .map((e) => {
      const agg = aggregateFromCounts(rows.filter((r) => r.eventId === e.id).map((r) => ({ rating: r.rating, count: r._count._all })));
      const s = scanned.find((x) => x.eventId === e.id)?._count._all ?? 0;
      return { eventId: e.id, name: publicEventName(e), startsAt: e.startsAt, average: agg.average, count: agg.count, scanned: s, responseRate: s > 0 ? agg.count / s : null };
    })
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
}

// ── Sorteo ───────────────────────────────────────────────────────────────

export const RAFFLE_DEFAULT_PRIZES = 3;
export const RAFFLE_DAYS_OPEN = 7;

/** The event's raffle, created on first sight with the agreed defaults:
 * three prizes, closes seven days after the event ends. */
export async function ensureRaffle(eventId: string): Promise<ReviewRaffle & { winners: (ReviewRaffleWinner & { review: Review & { person: Person } })[] }> {
  const existing = await db.reviewRaffle.findUnique({ where: { eventId }, include: { winners: { include: { review: { include: { person: true } } }, orderBy: [{ kind: "asc" }, { position: "asc" }] } } });
  if (existing) return existing;
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { startsAt: true, endsAt: true } });
  const closesAt = new Date((event.endsAt ?? event.startsAt).getTime() + RAFFLE_DAYS_OPEN * 86400000);
  return db.reviewRaffle.create({ data: { eventId, prizeCount: RAFFLE_DEFAULT_PRIZES, closesAt }, include: { winners: { include: { review: { include: { person: true } } } } } });
}

export async function updateRaffle(eventId: string, data: { closesAt?: Date; prizeCount?: number; prizeLabel?: string }): Promise<ReviewRaffle> {
  const raffle = await ensureRaffle(eventId);
  if (raffle.drawnAt) throw new Error("El sorteo ya se hizo; no se puede cambiar.");
  return db.reviewRaffle.update({
    where: { id: raffle.id },
    data: {
      ...(data.closesAt ? { closesAt: data.closesAt } : {}),
      ...(data.prizeCount != null ? { prizeCount: Math.max(1, Math.min(50, Math.floor(data.prizeCount))) } : {}),
      ...(data.prizeLabel != null ? { prizeLabel: data.prizeLabel.trim().slice(0, 80) || "premio" } : {}),
    },
  });
}

/** Deterministic shuffle from a hex seed — the acta can be re-checked:
 * same seed + same participant order = same result. */
export function seededShuffle<T>(items: T[], seedHex: string): T[] {
  const out = [...items];
  let counter = 0;
  const next = () => {
    const h = createHash("sha256").update(`${seedHex}:${counter++}`).digest();
    return h.readUInt32BE(0) / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export async function drawRaffle(eventId: string): Promise<{ drawn: boolean; participants: number; winners: number; backups: number }> {
  const raffle = await ensureRaffle(eventId);
  if (raffle.drawnAt) return { drawn: false, participants: raffle.participants ?? 0, winners: raffle.winners.filter((w) => w.kind === "WINNER").length, backups: raffle.winners.filter((w) => w.kind === "BACKUP").length };
  const participants = await db.review.findMany({
    where: { eventId, raffleOptIn: true, status: { not: "HIDDEN" }, createdAt: { lte: raffle.closesAt } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const seed = randomBytes(16).toString("hex");
  const order = seededShuffle(participants.map((p) => p.id), seed);
  const winners = order.slice(0, raffle.prizeCount);
  const backups = order.slice(raffle.prizeCount, raffle.prizeCount * 2);
  await db.$transaction([
    db.reviewRaffleWinner.createMany({
      data: [
        ...winners.map((reviewId, i) => ({ raffleId: raffle.id, reviewId, position: i + 1, kind: "WINNER" as const })),
        ...backups.map((reviewId, i) => ({ raffleId: raffle.id, reviewId, position: i + 1, kind: "BACKUP" as const })),
      ],
    }),
    db.reviewRaffle.update({ where: { id: raffle.id }, data: { drawnAt: new Date(), participants: participants.length, seed } }),
  ]);
  return { drawn: true, participants: participants.length, winners: winners.length, backups: backups.length };
}

/** The WhatsApp text the admin copies for each winner — prepared, never
 * sent by the app. */
export function winnerMessage(firstName: string | null, eventName: string, prizeLabel: string): string {
  return `¡Hola, ${firstName || ""}! Gracias por tu reseña de ${eventName}. Saliste ganadora en el sorteo: tienes un ${prizeLabel} esperándote. Respóndenos a este mensaje para coordinar la entrega.`.replace("¡Hola, !", "¡Hola!");
}

// ── Claude summary ───────────────────────────────────────────────────────

export interface ReviewSummary {
  themes: { label: string; share: number; sentiment: "positive" | "negative" | "mixed" }[];
  highlights: string[];
  toFix: string[];
  commentCount: number;
  generatedAt: string;
}

const SUMMARY_MODEL = "claude-sonnet-5";

/** Groups the comments of one event into themes with a share of comments
 * mentioning each, plus what to keep and what to fix. Cached on the event
 * (reviewSummary) — the admin regenerates it with a click. */
export async function summarizeReviews(eventId: string): Promise<ReviewSummary> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ia_not_configured");
  const [event, reviews] = await Promise.all([
    db.event.findUniqueOrThrow({ where: { id: eventId }, select: { name: true, publicName: true } }),
    db.review.findMany({ where: { eventId, status: { not: "HIDDEN" }, comment: { not: null } }, select: { rating: true, comment: true }, orderBy: { createdAt: "asc" }, take: 600 }),
  ]);
  const comments = reviews.filter((r) => (r.comment ?? "").trim().length > 0);
  if (comments.length === 0) {
    const empty: ReviewSummary = { themes: [], highlights: [], toFix: [], commentCount: 0, generatedAt: new Date().toISOString() };
    await db.event.update({ where: { id: eventId }, data: { reviewSummary: empty as object, reviewSummaryAt: new Date() } });
    return empty;
  }
  const client = new Anthropic();
  const list = comments.map((c, i) => `${i + 1}. [${c.rating}/5] ${(c.comment ?? "").replace(/\s+/g, " ").slice(0, 600)}`).join("\n");
  const response = await client.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 1500,
    system:
      "Eres analista de experiencia de eventos de belleza. Recibes reseñas de asistentes a una feria de uñas (Nail Fest) y devuelves SOLO un objeto JSON válido, sin texto alrededor, con esta forma exacta: " +
      '{"themes":[{"label":"tema corto en español","share":0.0,"sentiment":"positive|negative|mixed"}],"highlights":["frase corta"],"toFix":["frase corta"]}. ' +
      "share es la fracción (0 a 1) de reseñas que mencionan el tema. Máximo 8 temas, ordenados por share descendente. highlights: hasta 4 cosas que más valoran. toFix: hasta 4 cosas concretas que piden corregir. Nunca inventes temas que no estén en las reseñas.",
    messages: [{ role: "user", content: `Evento: ${publicEventName(event)}\nReseñas (${comments.length}):\n${list}` }],
  });
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let parsed: { themes?: unknown; highlights?: unknown; toFix?: unknown };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("El resumen no vino en el formato esperado. Intenta de nuevo.");
  }
  const summary: ReviewSummary = {
    themes: (Array.isArray(parsed.themes) ? parsed.themes : [])
      .filter((t): t is { label: string; share: number; sentiment: string } => typeof t === "object" && t !== null && typeof (t as { label?: unknown }).label === "string")
      .slice(0, 8)
      .map((t) => ({ label: t.label.slice(0, 60), share: Math.max(0, Math.min(1, Number(t.share) || 0)), sentiment: t.sentiment === "negative" ? "negative" : t.sentiment === "mixed" ? "mixed" : "positive" })),
    highlights: (Array.isArray(parsed.highlights) ? parsed.highlights : []).filter((h): h is string => typeof h === "string").slice(0, 4),
    toFix: (Array.isArray(parsed.toFix) ? parsed.toFix : []).filter((h): h is string => typeof h === "string").slice(0, 4),
    commentCount: comments.length,
    generatedAt: new Date().toISOString(),
  };
  await db.event.update({ where: { id: eventId }, data: { reviewSummary: summary as object, reviewSummaryAt: new Date() } });
  return summary;
}

export function parseReviewSummary(value: unknown): ReviewSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<ReviewSummary>;
  if (!Array.isArray(v.themes)) return null;
  return { themes: v.themes, highlights: v.highlights ?? [], toFix: v.toFix ?? [], commentCount: v.commentCount ?? 0, generatedAt: v.generatedAt ?? "" };
}

// ── Instagram card ───────────────────────────────────────────────────────

export interface ReviewCardData {
  name: string;
  city: string | null;
  instagramHandle: string | null;
  rating: number;
  comment: string | null;
  photo: string | null;
  eventName: string;
}

export async function reviewCardData(reviewId: string): Promise<ReviewCardData | null> {
  const r = await db.review.findUnique({
    where: { id: reviewId },
    include: { photos: { orderBy: { position: "asc" }, take: 1 }, person: { select: { firstName: true, lastName: true, city: true } }, event: { select: { name: true, publicName: true } } },
  });
  if (!r) return null;
  return { name: publicReviewerName(r.person), city: r.person.city, instagramHandle: r.instagramHandle, rating: r.rating, comment: r.comment, photo: r.photos[0]?.url ?? null, eventName: publicEventName(r.event) };
}
