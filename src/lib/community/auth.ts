import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { CommunityMember, Instructor } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalUser } from "@/lib/library/portalAuth";
import { isListed } from "@/lib/library/data";

// Community accounts (nailfest.lat/cuenta) and who is posting in the
// Consultorio — kept apart from the team's login and the instructors'
// portal: their own cookie and sessions. The same rules as the portal's
// (lib/library/portalAuth.ts): long sessions, a lock after too many wrong
// passwords, and one-time links the team sends by WhatsApp.

export const MEMBER_COOKIE = "nf_cuenta";
const SESSION_DAYS = 180;
export const MEMBER_SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;
export const LOGIN_TRIES = 8;
export const LOCK_MINUTES = 15;
export const LINK_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function setMemberCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(MEMBER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MEMBER_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export async function createMemberSession(memberId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.communitySession.create({
    data: { tokenHash: hashToken(token), memberId, expiresAt: new Date(Date.now() + MEMBER_SESSION_MAX_AGE_SECONDS * 1000) },
  });
  await db.communityMember.update({ where: { id: memberId }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  return token;
}

/** The member logged in on this request, if any. */
export async function getMember(): Promise<CommunityMember | null> {
  const token = cookies().get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  const session = await db.communitySession.findUnique({ where: { tokenHash: hashToken(token) }, include: { member: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.communitySession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.member;
}

export async function endMemberSession(token: string): Promise<void> {
  await db.communitySession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function isLocked(member: { lockedUntil: Date | null }, now: Date = new Date()): boolean {
  return Boolean(member.lockedUntil && member.lockedUntil > now);
}

/** One more wrong password; returns whether that locked the login. */
export async function recordFailedLogin(member: { id: string; failedLogins: number }, now: Date = new Date()): Promise<boolean> {
  const failed = member.failedLogins + 1;
  const lock = failed >= LOGIN_TRIES;
  await db.communityMember.update({
    where: { id: member.id },
    data: lock ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
  });
  return lock;
}

/** A new one-time link for a new password; an earlier unused one stops working. */
export async function createMemberLink(memberId: string, now: Date = new Date()): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.$transaction([
    db.communityAccessLink.updateMany({ where: { memberId, usedAt: null }, data: { usedAt: now } }),
    db.communityAccessLink.create({ data: { tokenHash: hashToken(token), memberId, expiresAt: new Date(now.getTime() + LINK_DAYS * 86_400_000) } }),
  ]);
  return token;
}

export function memberLinkUrl(token: string): string {
  return `${process.env.APP_BASE_URL || ""}/cuenta/clave/${token}`;
}

export async function findMemberLink(token: string, now: Date = new Date()) {
  if (!token || token.length > 100) return null;
  const link = await db.communityAccessLink.findUnique({ where: { tokenHash: hashToken(token) }, include: { member: true } });
  if (!link || link.usedAt || link.expiresAt <= now) return null;
  return link;
}

// ── Who is posting ──────────────────────────────────────────────────────────

export type ConsultorioIdentity =
  | { kind: "TEAM"; adminUserId: string }
  | { kind: "INSTRUCTOR"; instructor: Instructor; listed: boolean }
  | { kind: "MEMBER"; member: CommunityMember };

/** Who would post from this browser: the team (logged in to the admin)
 * first, then an instructor (her portal), then a community member. */
export async function getConsultorioIdentity(): Promise<ConsultorioIdentity | null> {
  const staff = await getCurrentUser().catch(() => null);
  if (staff && (staff.role === "ADMIN" || staff.role === "COORDINADOR")) return { kind: "TEAM", adminUserId: staff.id };
  const portal = await getPortalUser();
  if (portal) return { kind: "INSTRUCTOR", instructor: portal.instructor, listed: isListed(portal.instructor) };
  const member = await getMember();
  return member ? { kind: "MEMBER", member } : null;
}

/** The columns that say who posted, for a new question, answer or vote. */
export function authorColumns(identity: ConsultorioIdentity) {
  return {
    authorKind: identity.kind,
    memberId: identity.kind === "MEMBER" ? identity.member.id : null,
    instructorId: identity.kind === "INSTRUCTOR" ? identity.instructor.id : null,
    adminUserId: identity.kind === "TEAM" ? identity.adminUserId : null,
  };
}

/** How the posting box introduces her: "Respondes como Laura · Cúcuta". */
export function identityLabel(identity: ConsultorioIdentity): string {
  if (identity.kind === "TEAM") return "Equipo Nail Fest";
  if (identity.kind === "INSTRUCTOR") return `${identity.instructor.name}${identity.instructor.city ? ` · ${identity.instructor.city}` : ""}`;
  return `${identity.member.name} · ${identity.member.city}`;
}

/** The API's answer when nobody is there to post. */
export function signInFirst(): NextResponse {
  return NextResponse.json({ error: "unauthorized", message: "Entra a tu cuenta para participar." }, { status: 401 });
}

/** Whether this identity wrote it. */
export function wrote(identity: ConsultorioIdentity | null, row: { memberId: string | null; instructorId: string | null; adminUserId: string | null; authorKind: string }): boolean {
  if (!identity) return false;
  if (identity.kind === "MEMBER") return row.memberId === identity.member.id;
  if (identity.kind === "INSTRUCTOR") return row.instructorId === identity.instructor.id;
  return row.authorKind === "TEAM";
}
