import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { requireUser } from "@/lib/auth/guard";
import { sendWeeklyBriefings } from "@/lib/weeklyBriefing";

// Monday-morning briefing (see lib/weeklyBriefing.ts). Fired by the
// vercel.json cron (GET, cron secret) — or by an admin from the report
// page's "Enviarme el briefing ahora" button (POST with ?eventId=, session
// auth) to see what it looks like without waiting for Monday.
// testing: curl -X POST .../api/reports/weekly-briefing -H "x-cron-secret: <INTERNAL_CRON_SECRET>"

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await sendWeeklyBriefings());
}

export async function POST(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId") ?? undefined;
  if (!isAuthorizedCronRequest(req)) {
    const auth = await requireUser(["ADMIN"]);
    if ("response" in auth) return auth.response;
  }
  return NextResponse.json(await sendWeeklyBriefings(eventId));
}
