import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendDueEventBroadcasts } from "@/lib/broadcasts";

// Declared in vercel.json's `crons`. Sends every QUEUED event broadcast
// whose scheduled time (fixed, or relative to the event's own start/end —
// see lib/broadcastSchedule.ts) has arrived. POST also works for manual
// testing: curl -X POST .../api/broadcasts/send-due -H "x-cron-secret: <INTERNAL_CRON_SECRET>"
//
// Scheduled once/day (0 5 * * *) in vercel.json, same as this app's other
// two crons — see docs/DEPLOY.md, "Ongoing: the background crons". This
// project is on Vercel's Hobby plan, which only allows daily cron
// schedules; an earlier version of this file declared "*/15 * * * *" on
// the assumption Vercel would just run it at whatever cadence it could —
// instead Vercel REJECTS THE WHOLE DEPLOY when any cron in vercel.json
// exceeds the plan's allowed frequency, which silently broke every deploy
// after that commit. Don't repeat that: on Hobby, every cron in
// vercel.json must be once/day or the deploy fails outright, not just
// this one. A broadcast still never goes out early and never gets
// silently dropped — it just isn't checked more than once a day, so
// "2 hours before doors open" can land up to ~24h later than intended.
// If this project moves to Vercel Pro, tighten this to something like
// "*/15 * * * *" for real precision.
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
