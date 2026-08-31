import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { previewSegmentRecipients } from "@/lib/whatsapp/broadcasts";

// Backs the pre-send eligibility breakdown in WhatsAppBroadcastComposer —
// see previewSegmentRecipients' own comment on why this exists as a
// separate GET rather than only reporting the breakdown after sending.
export async function GET(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const segmentId = req.nextUrl.searchParams.get("segmentId");
  if (!segmentId) return NextResponse.json({ error: "segmentId required" }, { status: 400 });

  try {
    const preview = await previewSegmentRecipients(segmentId);
    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "preview failed" }, { status: 400 });
  }
}
