import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp/broadcasts";

// "Reanudar envío" for a broadcast stuck in SENDING — an invocation that
// died mid-chunk (before the chunk watchdog in lib/qstash.ts existed)
// leaves the cursor where the chunk started; sendWhatsAppBroadcast picks
// up from there and skips anyone who already has a message row.
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const broadcast = await db.whatsAppBroadcast.findUnique({ where: { id: params.id } });
  if (!broadcast) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (broadcast.status !== "SENDING") return NextResponse.json({ error: "not_sending" }, { status: 409 });
  // Someone (a QStash continuation, a watchdog, an earlier click) is
  // working this send right now — a second runner would only race it.
  if (broadcast.lockedUntil && broadcast.lockedUntil > new Date()) {
    return NextResponse.json({ error: "in_progress" }, { status: 409 });
  }
  try {
    const result = await sendWhatsAppBroadcast(params.id);
    if (result.locked) return NextResponse.json({ error: "in_progress" }, { status: 409 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("whatsapp broadcast resume failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "resume_failed" }, { status: 502 });
  }
}
