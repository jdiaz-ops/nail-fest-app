import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendDueWhatsAppBroadcasts } from "@/lib/whatsapp/broadcasts";

// Same cron shape as /api/broadcasts/send-due — see that route's own
// comment for why this is checked once/day rather than more precisely
// (Vercel Hobby plan's cron frequency cap). Add this route's path to
// vercel.json's `crons` once a real send is scheduled non-IMMEDIATE; an
// IMMEDIATE WhatsApp broadcast never needs this at all, same as email.
//
// Each due broadcast now only sends its FIRST chunk here before handing
// the rest to a QStash continuation (see sendWhatsAppBroadcast's own
// comment) — real headroom for that, not the framework default.
export const maxDuration = 60;

async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendDueWhatsAppBroadcasts();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
