import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendDueEventBroadcasts } from "@/lib/broadcasts";

// Declared in vercel.json's `crons`. Sends every QUEUED event broadcast
// whose scheduled time (fixed, or relative to the event's own start/end —
// see lib/broadcastSchedule.ts) has arrived. POST also works for manual
// testing: curl -X POST .../api/broadcasts/send-due -H "x-cron-secret: <INTERNAL_CRON_SECRET>"
//
// Every 5 minutes (*/5 * * * *) in vercel.json — the project is on
// Vercel Pro, which allows per-minute crons (Hobby only allowed daily
// ones, and Vercel rejects the whole deploy when any cron in vercel.json
// exceeds the plan's limit — keep that in mind if the plan ever changes).
// QStash still fires each armed send on its exact second; this cron arms
// sends as they come within QStash's 7-day reach and is the fallback that
// sends anything due whose callback never came.
//
// Each due broadcast now only sends its FIRST chunk here before handing
// the rest to a QStash continuation (see sendEventBroadcast's own
// comment) — real headroom for however many due broadcasts + first
// chunks land in one run, not the framework default.
export const maxDuration = 60;

async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendDueEventBroadcasts();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
