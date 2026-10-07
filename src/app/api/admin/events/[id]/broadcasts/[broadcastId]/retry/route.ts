import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { retryFailedEventBroadcast } from "@/lib/broadcasts";

// "Reintentar recuperables" for an event correo — see
// retryFailedEventBroadcast. Chunked like a normal send, so the first
// chunk runs here and the rest continue through QStash.
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string; broadcastId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const broadcast = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: params.id } });
  if (!broadcast) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (broadcast.status === "SENDING" || (broadcast.lockedUntil && broadcast.lockedUntil > new Date())) {
    return NextResponse.json({ error: "in_progress" }, { status: 409 });
  }
  if (broadcast.status !== "SENT") return NextResponse.json({ error: "Solo se puede reintentar un correo que ya terminó de enviarse." }, { status: 409 });
  try {
    const result = await retryFailedEventBroadcast(broadcast.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("email broadcast retry failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "retry_failed" }, { status: 502 });
  }
}
