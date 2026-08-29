import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

// One-time bootstrap for the real login system (see /admin/settings/users).
// The site used to be gated by a single shared ADMIN_USERNAME/ADMIN_PASSWORD
// via HTTP Basic Auth (see this repo's history on middleware.ts) — this
// endpoint turns that same pair into the FIRST real AdminUser account, so a
// deployment that's already live doesn't lose access the moment the new
// login ships. Same x-cron-secret pattern as /api/admin/seed (this session
// can't reach the production DB directly — see that route's own comment).
//
// Deliberately does NOT touch an account that already exists under that
// username — once someone's changed their password from the Users panel,
// re-running this must never silently reset it back to the env value.
function authorized(secret: string | null): boolean {
  return Boolean(process.env.INTERNAL_CRON_SECRET) && secret === process.env.INTERNAL_CRON_SECRET;
}

async function bootstrap() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    return { ok: false as const, error: "ADMIN_USERNAME/ADMIN_PASSWORD not set" };
  }

  const existing = await db.adminUser.findUnique({ where: { username } });
  if (existing) {
    return { ok: true as const, created: false, username };
  }

  await db.adminUser.create({
    data: { username, passwordHash: await hashPassword(password), role: "ADMIN", name: "Admin" },
  });
  return { ok: true as const, created: true, username };
}

export async function GET(req: NextRequest) {
  if (!authorized(req.nextUrl.searchParams.get("secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await bootstrap());
}

export async function POST(req: NextRequest) {
  if (!authorized(req.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await bootstrap());
}
