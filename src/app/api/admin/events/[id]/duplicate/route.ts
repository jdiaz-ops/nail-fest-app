import { NextRequest, NextResponse } from "next/server";
import { duplicateEvent } from "@/lib/events";
import { requireUser } from "@/lib/auth/guard";

// "Copiar a nuevo evento" from the event module's Actions menu — see
// lib/events.ts's duplicateEvent for what actually gets copied (the
// event's own configuration + ticket types) and what deliberately
// doesn't (dates, status, and — obviously — registrations/scans/stats;
// the whole point is a fresh event with its own history).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  try {
    const copy = await duplicateEvent(params.id);
    return NextResponse.json({ ok: true, id: copy.id });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
