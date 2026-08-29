import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendDueEventBroadcasts } from "@/lib/broadcasts";

// Declared in vercel.json's `crons`. Sends every QUEUED event broadcast
// whose scheduled time (fixed, or relative to the event's own start/end —
// see lib/broadcastSchedule.ts) has arrived. POST also works for manual
// testing: curl -X POST .../api/broadcasts/send-due -H "x-cron-secret: <INTERNAL_CRON_SECRET>"
//
// IMPORTANT for whoever deploys this: this cron needs to run more often
// than this app's existing daily crons (/api/meta/retry, /api/meta/sync-
// audiences) for "send a reminder 2 hours before doors open" to actually
// mean something — vercel.json asks for every 15 minutes, which needs a
// Vercel plan that allows sub-daily cron schedules (the Hobby plan is
// capped at once/day). If that's not available, this still runs safely
// at whatever cadence Vercel actually grants it — a broadcast just goes
// out somewhat later than its exact scheduled time, never early and
// never silently dropped.
async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendDueEventBroadcasts();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
