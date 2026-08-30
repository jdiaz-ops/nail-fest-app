import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendDueWhatsAppBroadcasts } from "@/lib/whatsapp/broadcasts";

// Same cron shape as /api/broadcasts/send-due — see that route's own
// comment for why this is checked once/day rather than more precisely
// (Vercel Hobby plan's cron frequency cap). Add this route's path to
// vercel.json's `crons` once a real send is scheduled non-IMMEDIATE; an
// IMMEDIATE WhatsApp broadcast never needs this at all, same as email.
async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendDueWhatsAppBroadcasts();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
