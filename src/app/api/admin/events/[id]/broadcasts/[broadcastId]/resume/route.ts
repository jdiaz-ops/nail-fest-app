import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sendEventBroadcast } from "@/lib/broadcasts";

// Email twin of /api/admin/whatsapp/broadcasts/[id]/resume — see that
// route's comment. sendEventBroadcast skips anyone with an EmailLog row
// for this broadcast, so resuming a half-finished chunk never doubles up.
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string; broadcastId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const broadcast = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: params.id } });
  if (!broadcast) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (broadcast.status !== "SENDING") return NextResponse.json({ error: "not_sending" }, { status: 409 });
  try {
    const result = await sendEventBroadcast(params.broadcastId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("email broadcast resume failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "resume_failed" }, { status: 502 });
  }
}
