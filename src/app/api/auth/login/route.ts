import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

const bodySchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const user = await db.adminUser.findUnique({ where: { username: username.trim().toLowerCase() } });
  // Same generic error either way — confirming "that username doesn't
  // exist" to whoever's asking is a data leak, not a feature (same
  // reasoning as /api/resend-ticket's own comment).
  const genericError = NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  if (!user || !user.active) return genericError;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return genericError;

  const token = await createSession(user.id, req.headers.get("user-agent"));

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
