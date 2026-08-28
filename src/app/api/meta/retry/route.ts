import { NextRequest, NextResponse } from "next/server";
import { processDueMetaEvents } from "@/lib/meta/capi";
import { isAuthorizedCronRequest } from "@/lib/cron";

// Declared in vercel.json's `crons` — Vercel hits this on a schedule with no
// dashboard setup needed. POST still works too, for manual testing:
// curl -X POST .../api/meta/retry -H "x-cron-secret: <INTERNAL_CRON_SECRET>"
async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processDueMetaEvents();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
