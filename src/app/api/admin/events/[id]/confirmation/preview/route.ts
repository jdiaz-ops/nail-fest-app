import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sampleConfirmation, type ConfirmationMode } from "@/lib/confirmationSample";

export const dynamic = "force-dynamic";

const MODES: ConfirmationMode[] = ["design", "event", "global"];

// The preview of an event's confirmation email, with sample data
// (lib/confirmationSample.ts): Manicuristas Imparables' designed email by
// default (2026-10-29, «Confirmación del evento»), or ?modo=event|global —
// the event's own template or the account's (2026-10-30, «Después del
// pago»). Nothing is sent.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const asked = req.nextUrl.searchParams.get("modo") as ConfirmationMode | null;
  const email = await sampleConfirmation(event, asked && MODES.includes(asked) ? asked : "design");
  return new NextResponse(email.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
