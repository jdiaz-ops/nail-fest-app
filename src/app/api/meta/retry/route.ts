import { NextRequest, NextResponse } from "next/server";
import { processDueMetaEvents } from "@/lib/meta/capi";

// Hit on a schedule (e.g. every 5 minutes) by whatever cron mechanism the
// host provides — Vercel Cron, a GitHub Action, etc. Not public: requires
// the shared secret so it can't be used to hammer the Meta API by anyone
// who finds the URL.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processDueMetaEvents();
  return NextResponse.json(result);
}
