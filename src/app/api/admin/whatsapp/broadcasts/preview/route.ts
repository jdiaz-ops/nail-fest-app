import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { previewSegmentRecipients } from "@/lib/whatsapp/broadcasts";

// Backs the pre-send eligibility breakdown in WhatsAppBroadcastComposer —
// see previewSegmentRecipients' own comment on why this exists as a
// separate GET rather than only reporting the breakdown after sending.
// ticketEventId (optional) = the event a "Ver mi entrada" button links to;
// with it, people with no confirmed entrada there are counted apart.
export async function GET(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const segmentId = req.nextUrl.searchParams.get("segmentId");
  if (!segmentId) return NextResponse.json({ error: "segmentId required" }, { status: 400 });
  const ticketEventId = req.nextUrl.searchParams.get("ticketEventId") || null;

  try {
    const preview = await previewSegmentRecipients(segmentId, ticketEventId);
    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "preview failed" }, { status: 400 });
  }
}
