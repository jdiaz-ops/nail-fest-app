import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Instructor, InstructorAccessKind, InstructorAccount } from "@prisma/client";
import { db } from "@/lib/db";

// The instructors' own login to their portal (lib/library/portal.ts) —
// kept apart from the team's (lib/auth/session.ts): its own cookie, its
// own sessions, and an instructor's session never opens anything in /admin.

export const INSTRUCTOR_COOKIE = "nf_instructora";
const SESSION_DAYS = 180;
export const INSTRUCTOR_SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;
/** Wrong passwords in a row before the login locks… */
export const LOGIN_TRIES = 8;
/** …and for how long. */
export const LOCK_MINUTES = 15;
/** How long a link the team sends her stays good. */
export const LINK_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function setSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(INSTRUCTOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INSTRUCTOR_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

/** A new session for her; a successful login also clears the wrong tries. */
export async function createInstructorSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.instructorSession.create({
    data: { tokenHash: hashToken(token), accountId, expiresAt: new Date(Date.now() + INSTRUCTOR_SESSION_MAX_AGE_SECONDS * 1000) },
  });
  await db.instructorAccount.update({ where: { id: accountId }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  return token;
}

export interface PortalUser {
  account: InstructorAccount;
  instructor: Instructor;
}

/** Who's logged in to the portal on this request, if anyone. */
export async function getPortalUser(): Promise<PortalUser | null> {
  const token = cookies().get(INSTRUCTOR_COOKIE)?.value;
  if (!token) return null;
  const session = await db.instructorSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { account: { include: { instructor: true } } } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.instructorSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const { instructor, ...account } = session.account;
  return { account, instructor };
}

/** The portal's pages: her, or off to the login. */
export async function requirePortalPage(): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user) redirect("/instructoras/entrar");
  return user;
}

/** The portal's routes: her, or a ready 401. */
export async function requirePortalUser(): Promise<{ user: PortalUser } | { response: NextResponse }> {
  const user = await getPortalUser();
  if (!user) return { response: NextResponse.json({ error: "unauthorized", message: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 }) };
  return { user };
}

export async function endInstructorSession(token: string): Promise<void> {
  await db.instructorSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Every device logged out — after a new password from a link. */
export async function endAllInstructorSessions(accountId: string): Promise<void> {
  await db.instructorSession.deleteMany({ where: { accountId } });
}

// ── Wrong passwords ─────────────────────────────────────────────────────────

export function isLocked(account: { lockedUntil: Date | null }, now: Date = new Date()): boolean {
  return Boolean(account.lockedUntil && account.lockedUntil > now);
}

/** One more wrong password; returns whether that locked the login. */
export async function recordFailedLogin(account: { id: string; failedLogins: number }, now: Date = new Date()): Promise<boolean> {
  const failed = account.failedLogins + 1;
  const lock = failed >= LOGIN_TRIES;
  await db.instructorAccount.update({
    where: { id: account.id },
    data: lock ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
  });
  return lock;
}

// ── The links the team sends by WhatsApp ────────────────────────────────────

/** A new one-time link; any earlier unused one of the same kind stops working. */
export async function createAccessLink(instructorId: string, kind: InstructorAccessKind, now: Date = new Date()): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.$transaction([
    db.instructorAccessLink.updateMany({ where: { instructorId, kind, usedAt: null }, data: { usedAt: now } }),
    db.instructorAccessLink.create({ data: { tokenHash: hashToken(token), kind, instructorId, expiresAt: new Date(now.getTime() + LINK_DAYS * 86_400_000) } }),
  ]);
  return token;
}

export function accessLinkUrl(token: string): string {
  return `${process.env.APP_BASE_URL || ""}/instructoras/clave/${token}`;
}

/** The link behind a token, while it's unused and unexpired. */
export async function findAccessLink(token: string, now: Date = new Date()) {
  if (!token || token.length > 100) return null;
  const link = await db.instructorAccessLink.findUnique({ where: { tokenHash: hashToken(token) }, include: { instructor: { include: { account: true } } } });
  if (!link || link.usedAt || link.expiresAt <= now) return null;
  return link;
}

// ── Her photo ───────────────────────────────────────────────────────────────

export function photoFolder(instructorId: string): string {
  return `instructor-photos/${instructorId}`;
}

/** A photo she uploaded herself (Vercel Blob, her own folder). */
export function isOwnPhotoUrl(url: string, instructorId: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith(`/${photoFolder(instructorId)}/`);
  } catch {
    return false;
  }
}

/** Her profile's address, whole and as people read it ("nailfest.lat/instructoras/ana"). */
export function profileAddress(slug: string): { url: string; label: string } {
  const base = (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");
  const url = `${base}/instructoras/${slug}`;
  return { url, label: url.replace(/^https?:\/\//, "") };
}
