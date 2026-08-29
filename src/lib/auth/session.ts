import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";
import type { AdminRole } from "@prisma/client";

export const SESSION_COOKIE = "nf_session";

// ~400 days — the longest Max-Age Chrome will actually honor on a cookie.
// Picked deliberately: "once a phone logs into the scanner app it stays
// logged in, no re-login" was an explicit ask, not something to hedge with
// a conventional 30-day expiry. A session still ends early if the account
// is deactivated (see AdminUser.active) or logged out by hand.
const SESSION_DAYS = 400;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export interface CurrentUser {
  id: string;
  username: string;
  name: string | null;
  role: AdminRole;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * DB-only — creates the session row and returns the raw token. The caller
 * (a Route Handler) sets it as the response cookie; this function never
 * touches the response itself, so it's usable from anywhere.
 */
export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.adminSession.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, userAgent: userAgent || undefined },
  });
  await db.adminUser.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return token;
}

/**
 * The authoritative check, used everywhere in /admin and /api/admin — reads
 * the session cookie off the current request and resolves it to a real,
 * still-active account. Returns null for anything wrong: no cookie, an
 * unknown/expired session, or an account an admin has since deactivated —
 * deactivating someone takes effect on their very next request, not on
 * whenever their cookie happens to expire.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.active) return null;

  return { id: session.user.id, username: session.user.username, name: session.user.name, role: session.user.role };
}

/** Deletes ALL sessions for a user (used when deactivating/deleting an
 * account, so an already-logged-in device is cut off immediately instead of
 * riding out its current session). */
export async function destroySessionsForUser(userId: string): Promise<void> {
  await db.adminSession.deleteMany({ where: { userId } });
}

export async function destroySessionByToken(token: string): Promise<void> {
  await db.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}
