import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedBaseline } from "@/lib/seed";

// One-time bootstrap for a fresh production database — this session can't
// reach the production Postgres instance directly (network policy), so
// seeding happens by calling this endpoint once instead of running a
// script against the DB from here. Safe to call more than once: every
// write is an upsert.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await seedBaseline(db);
  return NextResponse.json({ ok: true, ...result });
}
