import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedBaseline } from "@/lib/seed";

// One-time bootstrap for a fresh production database — this session can't
// reach the production Postgres instance directly (network policy), so
// seeding happens by calling this endpoint once instead of running a
// script against the DB from here. Safe to call more than once: every
// write is an upsert.
//
// GET (secret as a query param) exists purely so this can be triggered by
// pasting a URL into a browser address bar — no terminal needed. POST
// (secret as a header) is the "proper" version for scripted/cron use.
function authorized(secret: string | null): boolean {
  return Boolean(process.env.INTERNAL_CRON_SECRET) && secret === process.env.INTERNAL_CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!authorized(req.nextUrl.searchParams.get("secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await seedBaseline(db);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  if (!authorized(req.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await seedBaseline(db);
  return NextResponse.json({ ok: true, ...result });
}
