import { NextRequest, NextResponse } from "next/server";
import { ensureSeedAudiences, syncAllSegmentAudiences } from "@/lib/meta/audiences";
import { isAuthorizedCronRequest } from "@/lib/cron";

// Declared in vercel.json's `crons` — Vercel hits this on a schedule with no
// dashboard setup needed. This is the ONLY thing that keeps Meta Custom
// Audiences current — no manual "sync now" button by design:
//   - Landing visitors / Checkout started / Purchasers (the seed audiences)
//   - every segment linked from /admin/segments
// POST still works too, for manual testing:
// curl -X POST .../api/meta/sync-audiences -H "x-cron-secret: <INTERNAL_CRON_SECRET>"
async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const seeds = await ensureSeedAudiences();
  const segments = await syncAllSegmentAudiences();
  return NextResponse.json({ seeds, segments });
}

export const GET = handle;
export const POST = handle;
